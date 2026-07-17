import { pathToFileURL } from "node:url";

const WORKER_URLS = Object.freeze({
  "3q-line-oa": "https://3q-line-oa.milk790.workers.dev",
  "tudigong-line-oa": "https://tudigong-line-oa.milk790.workers.dev",
  "luxury-line-oa": "https://luxury-line-oa.milk790.workers.dev",
  "pop-line-oa": "https://pop-line-oa.milk790.workers.dev",
});

const CASE_PATTERN = /^GO-[A-F0-9]{12}$/;

function parseFlags(argv) {
  const flags = new Map();
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || typeof value === "undefined") {
      throw new Error(`參數格式錯誤：${name || "(空)"}`);
    }
    flags.set(name.slice(2), value);
  }
  return flags;
}

function parseArgs(argv) {
  const command = argv[0] || "summary";
  const flags = parseFlags([command, ...argv.slice(1)]);
  const allowedFlags = command === "summary"
    ? new Set(["worker", "days"])
    : command === "delivered"
      ? new Set(["worker", "case"])
      : null;
  if (!allowedFlags) throw new Error(`不支援的命令：${command}`);
  for (const name of flags.keys()) {
    if (!allowedFlags.has(name)) throw new Error(`不支援的參數：--${name}`);
  }
  const worker = flags.get("worker") || (command === "summary" ? "all" : "");
  if (![...Object.keys(WORKER_URLS), "all"].includes(worker)) throw new Error(`不支援的 Worker：${worker || "(空)"}`);
  if (command === "summary") {
    const days = Math.min(90, Math.max(1, Number.parseInt(flags.get("days") || "30", 10) || 30));
    return { command, worker, days };
  }
  if (command === "delivered") {
    if (worker === "all") throw new Error("delivered 必須指定單一 Worker");
    const caseId = String(flags.get("case") || "").trim().toUpperCase();
    if (!CASE_PATTERN.test(caseId)) throw new Error("案件碼格式必須是 GO- 加 12 碼十六進位字元");
    return { command, worker, caseId };
  }
  throw new Error(`不支援的命令：${command}`);
}

function blankAggregate(source = null) {
  return {
    ...(source ? { source } : {}),
    starts: 0,
    firstAnswers: 0,
    thirdAnswers: 0,
    deliveries: 0,
    deliveryMinuteSum: 0,
    deliveryMinuteCount: 0,
  };
}

function addMetrics(target, metrics) {
  target.starts += Number(metrics.starts) || 0;
  target.firstAnswers += Number(metrics.firstAnswers) || 0;
  target.thirdAnswers += Number(metrics.thirdAnswers) || 0;
  target.deliveries += Number(metrics.deliveries) || 0;
  if (Number.isFinite(metrics.averageDeliveryMinutes) && Number(metrics.deliveries) > 0) {
    target.deliveryMinuteSum += Number(metrics.averageDeliveryMinutes) * Number(metrics.deliveries);
    target.deliveryMinuteCount += Number(metrics.deliveries);
  }
}

function rate(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 10000) / 10000 : 0;
}

function finishAggregate(aggregate) {
  return {
    ...(aggregate.source ? { source: aggregate.source } : {}),
    starts: aggregate.starts,
    firstAnswers: aggregate.firstAnswers,
    thirdAnswers: aggregate.thirdAnswers,
    deliveries: aggregate.deliveries,
    firstAnswerRate: rate(aggregate.firstAnswers, aggregate.starts),
    thirdAnswerRate: rate(aggregate.thirdAnswers, aggregate.starts),
    deliveryRate: rate(aggregate.deliveries, aggregate.starts),
    averageDeliveryMinutes: aggregate.deliveryMinuteCount
      ? Math.round((aggregate.deliveryMinuteSum / aggregate.deliveryMinuteCount) * 10) / 10
      : null,
  };
}

async function readJson(response, label) {
  let payload;
  try { payload = await response.json(); } catch (_error) { throw new Error(`${label} 回傳非 JSON（HTTP ${response.status}）`); }
  if (!response.ok || payload.ok !== true) throw new Error(`${label} 失敗（HTTP ${response.status}）：${payload.error || "unknown error"}`);
  return payload;
}

async function fetchWorkerSummary(worker, days, adminKey, fetchImpl) {
  const response = await fetchImpl(`${WORKER_URLS[worker]}/admin/go-funnel?days=${days}`, {
    headers: { "X-Admin-Key": adminKey },
  });
  return readJson(response, worker);
}

function aggregateReports(reports, days) {
  const totals = blankAggregate();
  const sources = new Map();
  for (const { worker, report } of reports) {
    addMetrics(totals, report.totals);
    for (const sourceMetrics of report.sources || []) {
      if (!sources.has(sourceMetrics.source)) sources.set(sourceMetrics.source, blankAggregate(sourceMetrics.source));
      addMetrics(sources.get(sourceMetrics.source), sourceMetrics);
    }
  }
  return {
    ok: true,
    feature: "go-funnel-v1",
    generatedAt: new Date().toISOString(),
    days,
    totals: finishAggregate(totals),
    sources: [...sources.values()].sort((a, b) => a.source.localeCompare(b.source)).map(finishAggregate),
    workers: reports.map(({ worker, report }) => ({ worker, ...report })),
  };
}

async function runGoFunnelOps(argv, options = {}) {
  const adminKey = options.adminKey ?? process.env.GO_FUNNEL_ADMIN_KEY ?? "";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const stdout = options.stdout || console.log;
  const args = parseArgs(argv);
  if (!adminKey) throw new Error("缺少 GO_FUNNEL_ADMIN_KEY；請從安全儲存載入環境變數，不要放進指令參數或檔案");

  if (args.command === "summary") {
    const workers = args.worker === "all" ? Object.keys(WORKER_URLS) : [args.worker];
    const reports = await Promise.all(workers.map(async (worker) => ({
      worker,
      report: await fetchWorkerSummary(worker, args.days, adminKey, fetchImpl),
    })));
    const output = aggregateReports(reports, args.days);
    stdout(JSON.stringify(output, null, 2));
    return output;
  }

  const response = await fetchImpl(`${WORKER_URLS[args.worker]}/admin/go-funnel/delivered`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Admin-Key": adminKey },
    body: JSON.stringify({ caseId: args.caseId }),
  });
  const output = await readJson(response, args.worker);
  stdout(JSON.stringify(output, null, 2));
  return output;
}

export { WORKER_URLS, parseArgs, runGoFunnelOps };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGoFunnelOps(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
