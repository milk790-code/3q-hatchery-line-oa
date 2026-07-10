import { appendFileSync } from "node:fs";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "champion_integration_smoke_status.json");
const REPORT_PATH = path.join(ROOT, "champion_integration_smoke.md");
const LOG_DIR = path.join(ROOT, "logs");
const DATABASE_NAME = "3q-growth-loop-candidate";
const WORKER_READY_TIMEOUT_MS = 90000;
const WRANGLER_TIMEOUT_MS = 180000;
const ALLOWED_CAMPAIGN = "champion-integration-smoke-allowed";
const DENIED_CAMPAIGN = "champion-integration-smoke-denied";
const EXPECTED_COLLECTOR_URL = "https://3q-growth-loop-candidate.milk790.workers.dev";
const VALID_SESSION_ID = "00000000-0000-4000-8000-000000000101";

async function main() {
  const startedAt = new Date();
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const stateDir = await mkdtemp(path.join(tmpdir(), "3q-growth-loop-champion-integration-"));
  const logPath = path.join(LOG_DIR, `champion-integration-smoke-${stamp(startedAt)}.log`);
  const collectorPort = await findFreePort();
  const championPort = await findFreePort(new Set([collectorPort]));
  const collectorInspectorPort = await findFreePort(new Set([collectorPort, championPort]));
  const championInspectorPort = await findFreePort(new Set([collectorPort, championPort, collectorInspectorPort]));
  const collectorUrl = `http://127.0.0.1:${collectorPort}`;
  const championUrl = `http://127.0.0.1:${championPort}`;
  let collector = null;
  let champion = null;

  try {
    await migrateIsolatedD1(stateDir, logPath);
    collector = spawnCollector(stateDir, collectorPort, collectorInspectorPort, championUrl, logPath);
    champion = spawnChampion(championPort, championInspectorPort, EXPECTED_COLLECTOR_URL, logPath);
    await Promise.all([
      waitForJson(`${collectorUrl}/health`, (body) => body?.ok === true, collector, "collector"),
      waitForJson(
        `${championUrl}/growth-loop/status`,
        (body) => body?.ok === true
          && body?.collector_configured === true
          && body?.collector_origin === EXPECTED_COLLECTOR_URL
          && body?.collector_url_matches_expected === true,
        champion,
        "champion",
      ),
    ]);

    const pageContract = await checkCandidatePage(championUrl, EXPECTED_COLLECTOR_URL);
    const corsContract = await checkCorsPreflight(collectorUrl, championUrl);
    const allowedWrites = [
      await postEvent(collectorUrl, championUrl, "page_view"),
      await postEvent(collectorUrl, championUrl, "cta_click"),
    ];
    const deniedWrite = await postEvent(collectorUrl, "https://example.invalid", "page_view", DENIED_CAMPAIGN);
    const missingOriginWrite = await postEvent(collectorUrl, null, "page_view", "champion-integration-smoke-missing-origin");
    const sensitiveWrite = await postSensitiveEvent(collectorUrl, championUrl);
    const sensitiveTokenWrite = await postRawEvent(collectorUrl, championUrl, {
      asset_id: "champion-3q-line-v0",
      session_id: "customer@example.invalid",
      source: "local",
      medium: "champion_integration_smoke",
      campaign: ALLOWED_CAMPAIGN,
      event_type: "page_view",
      metadata_json: { fixture: "champion_integration_smoke", isolated: true },
    });
    const embeddedPhoneWrite = await postRawEvent(collectorUrl, championUrl, {
      asset_id: "champion-3q-line-v0",
      session_id: VALID_SESSION_ID,
      source: "local",
      medium: "champion_integration_smoke",
      campaign: "campaign-0912345678",
      event_type: "page_view",
      metadata_json: { fixture: "champion_integration_smoke", isolated: true },
    });
    const urlPathPiiWrite = await postRawEvent(collectorUrl, championUrl, {
      asset_id: "champion-3q-line-v0",
      session_id: VALID_SESSION_ID,
      source: "local",
      medium: "champion_integration_smoke",
      campaign: ALLOWED_CAMPAIGN,
      event_type: "page_view",
      url: `${championUrl}/customer/jane%2540example.com`,
      metadata_json: { fixture: "champion_integration_smoke", isolated: true },
    });
    const conversionWrite = await postEvent(collectorUrl, championUrl, "line_add");

    collector = await stopChild(collector);
    champion = await stopChild(champion);
    champion = spawnChampion(championPort, championInspectorPort, "https://example.invalid", logPath);
    const wrongBindingStatus = await waitForJson(
      `${championUrl}/growth-loop/status`,
      (body) => body?.ok === true && body?.collector_configured === false && body?.collector_origin === null,
      champion,
      "champion-wrong-binding",
    );
    const wrongBindingPage = await fetch(`${championUrl}/contact`);
    const wrongBindingBody = await wrongBindingPage.text();
    const wrongBindingContract = {
      ok: wrongBindingStatus.collector_url_matches_expected === false
        && !wrongBindingBody.includes("data-growth-loop-telemetry")
        && !wrongBindingBody.includes("https://example.invalid"),
      status: wrongBindingStatus,
      telemetry_injected: wrongBindingBody.includes("data-growth-loop-telemetry"),
    };
    champion = await stopChild(champion);
    const rows = await queryIntegrationRows(stateDir, logPath);
    const sensitiveRows = await querySensitiveRows(stateDir, logPath);
    const observedCounts = Object.fromEntries(rows.map((row) => [
      `${row.campaign}:${row.event_type}`,
      Number(row.n),
    ]));
    const databaseContract = {
      ok:
        observedCounts[`${ALLOWED_CAMPAIGN}:page_view`] === 1 &&
        observedCounts[`${ALLOWED_CAMPAIGN}:cta_click`] === 1 &&
        !rows.some((row) => row.campaign === DENIED_CAMPAIGN) &&
        !rows.some((row) => row.event_type === "line_add") &&
        sensitiveRows === 0,
      rows,
      allowed_page_view_rows: observedCounts[`${ALLOWED_CAMPAIGN}:page_view`] ?? 0,
      allowed_cta_click_rows: observedCounts[`${ALLOWED_CAMPAIGN}:cta_click`] ?? 0,
      denied_origin_rows: rows.filter((row) => row.campaign === DENIED_CAMPAIGN).reduce((sum, row) => sum + Number(row.n), 0),
      line_add_rows: rows.filter((row) => row.event_type === "line_add").reduce((sum, row) => sum + Number(row.n), 0),
      sensitive_rows: sensitiveRows,
    };

    const ok =
      pageContract.ok &&
      corsContract.ok &&
      allowedWrites.every((item) => item.status === 200 && item.body?.ok === true) &&
      deniedWrite.status === 403 &&
      deniedWrite.body?.error === "origin_not_allowed" &&
      missingOriginWrite.status === 403 &&
      missingOriginWrite.body?.error === "origin_not_allowed" &&
      sensitiveWrite.status === 400 &&
      sensitiveWrite.body?.error === "blocked_metadata_key" &&
      sensitiveTokenWrite.status === 400 &&
      sensitiveTokenWrite.body?.error === "invalid_session_id" &&
      embeddedPhoneWrite.status === 400 &&
      embeddedPhoneWrite.body?.error === "invalid_campaign" &&
      urlPathPiiWrite.status === 400 &&
      urlPathPiiWrite.body?.error === "invalid_url" &&
      conversionWrite.status === 400 &&
      conversionWrite.body?.error === "event_type_not_allowed_public" &&
      wrongBindingContract.ok &&
      databaseContract.ok;
    const status = buildStatus({
      ok,
      startedAt,
      stateDir,
      logPath,
      collectorUrl,
      championUrl,
      pageContract,
      corsContract,
      allowedWrites,
      deniedWrite,
      missingOriginWrite,
      sensitiveWrite,
      sensitiveTokenWrite,
      embeddedPhoneWrite,
      urlPathPiiWrite,
      conversionWrite,
      wrongBindingContract,
      databaseContract,
    });
    await writeOutputs(status);
    console.log(JSON.stringify(status, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const status = buildStatus({
      ok: false,
      startedAt,
      stateDir,
      logPath,
      collectorUrl,
      championUrl,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    await writeOutputs(status);
    console.error(error);
    process.exitCode = 1;
  } finally {
    collector = await stopChild(collector);
    champion = await stopChild(champion);
  }
}

async function checkCandidatePage(championUrl, collectorUrl) {
  const response = await fetch(`${championUrl}/contact?utm_source=integration_smoke&utm_medium=local_candidate&utm_campaign=${ALLOWED_CAMPAIGN}&content_id=integration-smoke&variant_id=champion-candidate&sid=${VALID_SESSION_ID}`);
  const body = await response.text();
  const statusResponse = await fetch(`${championUrl}/growth-loop/status`);
  const growthStatus = await statusResponse.json();
  const allowedTelemetryPayload = probeInjectedTelemetry(body, `?utm_campaign=${ALLOWED_CAMPAIGN}`);
  const foreignPhoneTelemetryPayload = probeInjectedTelemetry(body, "?utm_campaign=415-555-2671");
  const checks = {
    response_ok: response.status === 200,
    html_no_store: response.headers.get("cache-control") === "no-store",
    false_success_state_absent: !body.includes("setSent(true)"),
    personal_input_controls_absent:
      !body.includes('name="name"') &&
      !body.includes('name="phone"') &&
      !body.includes('name="email"'),
    line_only_mode_present: body.includes('data-growth-contact-mode="line-only"'),
    line_url_present: body.includes("https://lin.ee/VZvs7sj"),
    telemetry_script_present: body.includes("data-growth-loop-telemetry"),
    collector_url_injected: body.includes(collectorUrl),
    credentials_omitted: body.includes("credentials: 'omit'"),
    accurate_telemetry_disclosure: body.includes("匿名瀏覽與 CTA 成效事件") && !body.includes("本頁不會自動送出任何資料"),
    attribution_persisted: body.includes("3q_growth_loop_attribution_v1") && body.includes("JSON.stringify(attribution)"),
    client_token_sanitizer_present: body.includes("const safeToken = (value)") && body.includes("containsPiiLike"),
    client_embedded_pii_guard_present: body.includes("phoneLikePattern") && body.includes("emailLikePattern"),
    allowed_campaign_preserved: allowedTelemetryPayload?.campaign === ALLOWED_CAMPAIGN,
    foreign_phone_campaign_rejected: foreignPhoneTelemetryPayload?.campaign == null,
    client_uuid_session_guard_present: body.includes("safeSessionId") && body.includes("uuidV4Pattern"),
    non_crypto_random_fallback_absent: !body.includes("Math.random()"),
    build_marker_present: statusResponse.status === 200 && growthStatus?.build === "growth-loop-telemetry-v2",
    collector_origin_exact: growthStatus?.collector_origin === EXPECTED_COLLECTOR_URL && growthStatus?.collector_url_matches_expected === true,
    page_view_present: body.includes("send('page_view')"),
    cta_click_present: body.includes("send('cta_click')"),
    line_add_not_inferred: !body.includes("send('line_add')"),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    status: response.status,
    bytes: body.length,
    growth_status: growthStatus,
    checks,
  };
}

function probeInjectedTelemetry(body, search) {
  const match = body.match(/<script data-growth-loop-telemetry>([\s\S]*?)<\/script>/);
  if (!match) return null;
  const captured = [];
  const storage = new Map();
  const context = {
    URLSearchParams,
    location: {
      search,
      origin: "https://3q-site.milk790.workers.dev",
      pathname: "/contact",
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    crypto: { randomUUID: () => VALID_SESSION_ID },
    document: { addEventListener: () => {} },
    fetch: (_url, options) => {
      captured.push(JSON.parse(options.body));
      return Promise.resolve({ ok: true });
    },
  };
  vm.runInNewContext(match[1], context);
  return captured[0] ?? null;
}

async function checkCorsPreflight(collectorUrl, championUrl) {
  const response = await fetch(`${collectorUrl}/e`, {
    method: "OPTIONS",
    headers: {
      origin: championUrl,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowMethods = response.headers.get("access-control-allow-methods") ?? "";
  return {
    ok: response.status === 204 && allowOrigin === championUrl && allowMethods.includes("POST"),
    status: response.status,
    allow_origin: allowOrigin,
    allow_methods: allowMethods,
    vary: response.headers.get("vary"),
  };
}

async function postEvent(collectorUrl, origin, eventType, campaign = ALLOWED_CAMPAIGN) {
  return postRawEvent(collectorUrl, origin, {
    asset_id: "champion-3q-line-v0",
    variant_id: "champion-candidate",
    content_id: "integration-smoke",
    session_id: VALID_SESSION_ID,
    source: "local",
    medium: "champion_integration_smoke",
    campaign,
    event_type: eventType,
    url: `${origin}/contact`,
    metadata_json: {
      fixture: "champion_integration_smoke",
      isolated: true,
      integration: "3q_site_champion_v1",
    },
  });
}

async function postSensitiveEvent(collectorUrl, origin) {
  return postRawEvent(collectorUrl, origin, {
    asset_id: "champion-3q-line-v0",
    session_id: "integration-smoke-sensitive-rejection",
    source: "local",
    medium: "champion_integration_smoke",
    campaign: ALLOWED_CAMPAIGN,
    event_type: "page_view",
    metadata_json: {
      fixture: "champion_integration_smoke",
      email: "blocked@example.invalid",
    },
  });
}

async function postRawEvent(collectorUrl, origin, payload) {
  const headers = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  const response = await fetch(`${collectorUrl}/e`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return {
    status: response.status,
    body,
    allow_origin: response.headers.get("access-control-allow-origin"),
  };
}

async function migrateIsolatedD1(stateDir, logPath) {
  await runWrangler([
    "d1",
    "execute",
    DATABASE_NAME,
    "--local",
    "--persist-to",
    stateDir,
    "--file",
    "schema/d1-week0.sql",
    "--yes",
  ], logPath);
}

async function queryIntegrationRows(stateDir, logPath) {
  const sql = `
    SELECT campaign, event_type, COUNT(*) AS n
    FROM lp_events
    WHERE campaign IN ('${ALLOWED_CAMPAIGN}', '${DENIED_CAMPAIGN}')
    GROUP BY campaign, event_type
    ORDER BY campaign, event_type
  `;
  return runSqlite(stateDir, sql, logPath);
}

async function querySensitiveRows(stateDir, logPath) {
  const sql = `
    SELECT COUNT(*) AS n
    FROM lp_events
    WHERE campaign = '${ALLOWED_CAMPAIGN}'
      AND (
        metadata_json LIKE '%email%'
        OR metadata_json LIKE '%phone%'
        OR metadata_json LIKE '%line_user_id%'
        OR metadata_json LIKE '%customer_name%'
        OR metadata_json LIKE '%payment%'
      )
  `;
  const rows = await runSqlite(stateDir, sql, logPath);
  return Number(rows[0]?.n ?? 0);
}

async function runSqlite(stateDir, sql, logPath) {
  const dbPath = await findD1SqlitePath(stateDir);
  appendLog(logPath, `\n$ sqlite3 -json ${path.relative(stateDir, dbPath)} <query>\n`);
  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", ["-json", dbPath, sql], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      appendLog(logPath, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      appendLog(logPath, chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`sqlite3 query exited with ${code}: ${stderr}`));
        return;
      }
      resolve(JSON.parse(stdout || "[]"));
    });
  });
}

async function findD1SqlitePath(stateDir) {
  const directory = path.join(stateDir, "v3", "d1", "miniflare-D1DatabaseObject");
  const candidates = (await readdir(directory))
    .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .sort();
  if (candidates.length !== 1) {
    throw new Error(`Expected one isolated D1 sqlite file, found ${candidates.length}`);
  }
  return path.join(directory, candidates[0]);
}

function spawnCollector(stateDir, port, inspectorPort, championOrigin, logPath) {
  return spawnLogged("collector", [
    "dev",
    "--local",
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    stateDir,
    "--var",
    `CHAMPION_ORIGIN:${championOrigin}`,
    "--log-level",
    "error",
    "--show-interactive-dev-session=false",
  ], logPath);
}

function spawnChampion(port, inspectorPort, collectorUrl, logPath) {
  return spawnLogged("champion", [
    "dev",
    "--local",
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--config",
    "integrations/3q-site/wrangler.jsonc",
    "--var",
    `GROWTH_LOOP_COLLECTOR_URL:${collectorUrl}`,
    "--log-level",
    "error",
    "--show-interactive-dev-session=false",
  ], logPath);
}

function spawnLogged(label, args, logPath) {
  appendLog(logPath, `[${label}] wrangler ${args.join(" ")}\n`);
  const child = spawn(wranglerBin(), args, {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => appendLog(logPath, `[${label}:stdout] ${chunk}`));
  child.stderr.on("data", (chunk) => appendLog(logPath, `[${label}:stderr] ${chunk}`));
  return child;
}

async function waitForJson(url, predicate, child, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < WORKER_READY_TIMEOUT_MS) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} Worker exited before readiness (exit=${child.exitCode}, signal=${child.signalCode ?? "none"}).`);
    }
    try {
      const response = await fetch(url);
      const body = await response.json();
      if (response.status === 200 && predicate(body)) return body;
    } catch {
      // Wrangler startup is polled until the bounded timeout.
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for local Worker: ${url}`);
}

function runWrangler(args, logPath) {
  return new Promise((resolve, reject) => {
    appendLog(logPath, `\n$ wrangler ${args.join(" ")}\n`);
    const child = spawn(wranglerBin(), args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`wrangler timed out: ${args.join(" ")}`));
    }, WRANGLER_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      appendLog(logPath, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      appendLog(logPath, chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`wrangler exited with ${code}: ${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function stopChild(child) {
  if (!child) return null;
  if (child.exitCode !== null || child.signalCode !== null) return null;
  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  return null;
}

function buildStatus({
  ok,
  startedAt,
  stateDir,
  logPath,
  collectorUrl,
  championUrl,
  pageContract,
  corsContract,
  allowedWrites,
  deniedWrite,
  missingOriginWrite,
  sensitiveWrite,
  sensitiveTokenWrite,
  embeddedPhoneWrite,
  urlPathPiiWrite,
  conversionWrite,
  wrongBindingContract,
  databaseContract,
  error,
}) {
  const finishedAt = new Date();
  return {
    ok,
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    mode: "isolated_local_champion_integration_smoke",
    collector_url: collectorUrl,
    champion_url: championUrl,
    isolated_state_dir: stateDir,
    log_path: logPath,
    page_contract: pageContract ?? null,
    cors_contract: corsContract ?? null,
    allowed_writes: allowedWrites ?? [],
    denied_write: deniedWrite ?? null,
    missing_origin_write: missingOriginWrite ?? null,
    sensitive_write: sensitiveWrite ?? null,
    sensitive_token_write: sensitiveTokenWrite ?? null,
    embedded_phone_write: embeddedPhoneWrite ?? null,
    url_path_pii_write: urlPathPiiWrite ?? null,
    blocked_conversion_write: conversionWrite ?? null,
    wrong_binding_contract: wrongBindingContract ?? null,
    database_contract: databaseContract ?? null,
    error,
    isolated_fixture_event_write_performed: true,
    real_event_write_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Runs both Workers on random localhost ports and writes synthetic events only to an isolated temporary local D1.",
  };
}

async function writeOutputs(status) {
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
}

function renderReport(status) {
  const pageChecks = Object.entries(status.page_contract?.checks ?? {})
    .map(([key, value]) => `| ${key} | ${value ? "pass" : "fail"} |`)
    .join("\n");
  return `# Champion Integration Smoke\n\nBLUF: ${status.ok ? "PASS" : "FAIL"}. The 3Q champion candidate and Growth Loop collector were tested together on localhost with an isolated D1. No production, public-link, GitHub, LINE, customer-data, payment, or delete action occurred.\n\nGenerated: ${status.generated_at}\nMode: ${status.mode}\n\n## Candidate Page\n\n| check | result |\n|---|---|\n${pageChecks || "| unavailable | fail |"}\n\n## Collector Contract\n\n- Preflight: ${status.cors_contract?.status ?? "n/a"}\n- Exact allowed origin: ${status.cors_contract?.allow_origin ?? "n/a"}\n- Allowed page_view rows: ${status.database_contract?.allowed_page_view_rows ?? "n/a"}\n- Allowed cta_click rows: ${status.database_contract?.allowed_cta_click_rows ?? "n/a"}\n- Denied-origin rows: ${status.database_contract?.denied_origin_rows ?? "n/a"}\n- line_add rows: ${status.database_contract?.line_add_rows ?? "n/a"}\n- Sensitive rows: ${status.database_contract?.sensitive_rows ?? "n/a"}\n\n## Gate\n\nProduction deploy and public-link changes remain owner approval gates. This smoke does not click the LINE CTA and does not infer line_add from cta_click.\n`;
}

function wranglerBin() {
  return process.platform === "win32"
    ? path.join(ROOT, "node_modules", ".bin", "wrangler.cmd")
    : path.join(ROOT, "node_modules", ".bin", "wrangler");
}

function findFreePort(excluded = new Set()) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(async () => {
        if (!address || typeof address !== "object") {
          reject(new Error("Unable to allocate a local port."));
          return;
        }
        if (excluded.has(address.port)) {
          resolve(await findFreePort(excluded));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function appendLog(logPath, value) {
  appendFileSync(logPath, value);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

main();
