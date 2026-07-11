import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TRACKING_LINKS_PATH = path.join(ROOT, "tracking_links.json");
const STATUS_PATH = path.join(ROOT, "data", "tracking_link_smoke_status.json");
const REPORT_PATH = path.join(ROOT, "tracking_link_smoke.md");
const LOG_DIR = path.join(ROOT, "logs");
const DATABASE_NAME = "3q-growth-loop-candidate";
const CHALLENGER_ASSET_ID = "challenger-week0-cta-text-v1";
const WRANGLER_COMMAND_TIMEOUT_MS = 180000;
const WORKER_HEALTH_TIMEOUT_MS = 90000;

async function main() {
  const startedAt = new Date();
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const stateDir = await mkdtemp(path.join(tmpdir(), "3q-growth-loop-tracking-smoke-"));
  const logPath = path.join(LOG_DIR, `tracking-link-smoke-${stamp(startedAt)}.log`);
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = null;

  try {
    const trackingLinks = JSON.parse(await readFile(TRACKING_LINKS_PATH, "utf8"));
    const links = Array.isArray(trackingLinks.links) ? trackingLinks.links : [];
    await migrateIsolatedD1(stateDir, logPath);
    child = spawnWranglerDev(stateDir, port, logPath);
    await waitForHealth(baseUrl, WORKER_HEALTH_TIMEOUT_MS);

    const checks = [];
    for (const link of links) {
      checks.push(await checkTrackingLink(baseUrl, link));
    }

    child = await stopWranglerDev(child);
    const isolatedEventsWritten = await waitForEventCount(stateDir, logPath, links.length, 8000);
    const ok =
      links.length > 0 &&
      checks.length === links.length &&
      checks.every((check) => check.ok && check.external_effect === false && check.followed_external_url === false) &&
      isolatedEventsWritten >= links.length;

    const status = buildStatus({
      ok,
      startedAt,
      stateDir,
      baseUrl,
      logPath,
      checks,
      isolatedEventsWritten,
      linkCount: links.length,
    });
    await writeStatusAndReport(status);
    console.log(JSON.stringify(status, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const failed = buildStatus({
      ok: false,
      startedAt,
      stateDir,
      baseUrl,
      logPath,
      checks: [],
      isolatedEventsWritten: 0,
      linkCount: 0,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    await writeStatusAndReport(failed);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child = await stopWranglerDev(child);
  }
}

async function checkTrackingLink(baseUrl, link) {
  const sourceUrl = new URL(link.tracking_url);
  const requestUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, baseUrl);
  let expected;

  if (link.role === "ab_small_traffic") {
    const testId = decodeURIComponent(sourceUrl.pathname.replace("/ab/", ""));
    const sid = findSid(testId, (bucket) => bucket < 10);
    requestUrl.searchParams.set("sid", sid);
    expected = {
      kind: "candidate",
      asset_id: CHALLENGER_ASSET_ID,
      content_id: sourceUrl.searchParams.get("content_id"),
      variant_id: `${testId}:challenger`,
      sid,
      utm_source: sourceUrl.searchParams.get("utm_source"),
      utm_medium: sourceUrl.searchParams.get("utm_medium"),
      utm_campaign: sourceUrl.searchParams.get("utm_campaign"),
    };
  } else if (link.target === "challenger") {
    expected = {
      kind: "candidate",
      asset_id: link.asset_id,
      content_id: link.content_id ?? sourceUrl.searchParams.get("content_id"),
      variant_id: link.variant_id ?? sourceUrl.searchParams.get("variant_id"),
      sid: sourceUrl.searchParams.get("sid"),
      utm_source: sourceUrl.searchParams.get("utm_source"),
      utm_medium: sourceUrl.searchParams.get("utm_medium"),
      utm_campaign: sourceUrl.searchParams.get("utm_campaign"),
    };
  } else if (link.target === "line") {
    expected = {
      kind: "line",
      location: link.destination_url,
    };
  } else if (link.target === "champion") {
    const destination = new URL(link.destination_url);
    expected = {
      kind: "champion",
      origin: destination.origin,
      pathname: destination.pathname,
      asset_id: link.asset_id,
      content_id: link.content_id ?? sourceUrl.searchParams.get("content_id"),
      variant_id: link.variant_id ?? sourceUrl.searchParams.get("variant_id"),
      sid: sourceUrl.searchParams.get("sid"),
      utm_source: sourceUrl.searchParams.get("utm_source"),
      utm_medium: sourceUrl.searchParams.get("utm_medium"),
      utm_campaign: sourceUrl.searchParams.get("utm_campaign"),
    };
  } else {
    expected = {
      kind: "unknown",
    };
  }

  const response = await fetch(requestUrl, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const redirectUrl = location ? new URL(location, baseUrl) : null;
  const observed = buildObservedRedirect(redirectUrl);
  const ok =
    response.status === 302 &&
    expected.kind !== "unknown" &&
    (
      ["candidate", "champion"].includes(expected.kind)
        ? (expected.kind !== "champion" || redirectUrl?.origin === expected.origin)
          && redirectUrl?.pathname === (expected.pathname ?? "/candidate")
          && Object.entries(expected)
          .filter(([key]) => !["kind", "origin", "pathname"].includes(key) && expected[key] !== null && expected[key] !== undefined)
          .every(([key, value]) => observed[key] === value)
        : location === expected.location
    );

  return {
    link_id: link.link_id,
    role: link.role,
    target: link.target,
    status: response.status,
    ok,
    requested_url: requestUrl.toString(),
    original_tracking_url: link.tracking_url,
    location,
    observed,
    expected,
    followed_external_url: false,
    external_effect: false,
  };
}

function buildObservedRedirect(redirectUrl) {
  if (!redirectUrl) return {};
  return {
    pathname: redirectUrl.pathname,
    asset_id: redirectUrl.searchParams.get("asset_id"),
    content_id: redirectUrl.searchParams.get("content_id"),
    variant_id: redirectUrl.searchParams.get("variant_id"),
    sid: redirectUrl.searchParams.get("sid"),
    utm_source: redirectUrl.searchParams.get("utm_source"),
    utm_medium: redirectUrl.searchParams.get("utm_medium"),
    utm_campaign: redirectUrl.searchParams.get("utm_campaign"),
  };
}

async function migrateIsolatedD1(stateDir, logPath) {
  await runWrangler(
    [
      "d1",
      "execute",
      DATABASE_NAME,
      "--local",
      "--persist-to",
      stateDir,
      "--file",
      "schema/d1-week0.sql",
      "--yes",
    ],
    logPath,
  );
}

async function waitForEventCount(stateDir, logPath, expectedCount, timeoutMs) {
  const started = Date.now();
  let latest = 0;
  while (Date.now() - started < timeoutMs) {
    latest = await queryEventCount(stateDir, logPath);
    if (latest >= expectedCount) {
      return latest;
    }
    await delay(500);
  }
  return latest;
}

async function queryEventCount(stateDir, logPath) {
  const sql = "SELECT COUNT(*) AS n FROM lp_events WHERE event_type = 'link_click'";
  const rows = await runSqlite(stateDir, sql, logPath, { mode: "query" });
  return Number(rows[0]?.n ?? 0);
}

function spawnWranglerDev(stateDir, port, logPath) {
  const child = spawn(wranglerBin(), [
    "dev",
    "--local",
    "--port",
    String(port),
    "--persist-to",
    stateDir,
    "--log-level",
    "error",
    "--show-interactive-dev-session=false",
  ], {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => appendLog(logPath, chunk));
  child.stderr.on("data", (chunk) => appendLog(logPath, chunk));
  return child;
}

async function stopWranglerDev(child) {
  if (!child) return null;
  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  return null;
}

async function waitForHealth(baseUrl, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(new URL("/health", baseUrl));
      const body = await response.json();
      if (response.status === 200 && body?.ok === true) {
        return;
      }
    } catch {
      // Keep polling until wrangler is ready.
    }
    await delay(500);
  }
  throw new Error("Timed out waiting for isolated local Worker health endpoint.");
}

async function runSqlite(stateDir, sql, logPath, { mode, timeoutMs = 30000 }) {
  const dbPath = await findD1SqlitePath(stateDir);
  const args = mode === "query" ? ["-json", dbPath, sql] : [dbPath];
  appendLog(logPath, `\n$ sqlite3 ${mode} ${path.relative(stateDir, dbPath)}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", args, {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`sqlite3 ${mode} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
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
        reject(new Error(`sqlite3 ${mode} exited with code ${code}: ${stderr}`));
        return;
      }
      if (mode === "query") {
        resolve(JSON.parse(stdout || "[]"));
        return;
      }
      resolve([]);
    });
    if (mode === "execute") {
      child.stdin.end(sql);
    } else {
      child.stdin.end();
    }
  });
}

async function findD1SqlitePath(stateDir) {
  const d1Dir = path.join(stateDir, "v3", "d1", "miniflare-D1DatabaseObject");
  const files = await readdir(d1Dir);
  const candidates = files
    .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .sort();
  if (candidates.length !== 1) {
    throw new Error(`Expected one local D1 sqlite file, found ${candidates.length}`);
  }
  return path.join(d1Dir, candidates[0]);
}

function runWrangler(args, logPath, timeoutMs = WRANGLER_COMMAND_TIMEOUT_MS) {
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
      reject(new Error(`wrangler timed out after ${timeoutMs}ms: ${args.join(" ")}`));
    }, timeoutMs);
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
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`wrangler exited with code ${code}: ${stderr}`));
    });
  });
}

function buildStatus({ ok, startedAt, stateDir, baseUrl, logPath, checks, isolatedEventsWritten, linkCount, error }) {
  const finishedAt = new Date();
  return {
    ok,
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    mode: "isolated_local_tracking_link_smoke",
    base_url: baseUrl,
    isolated_state_dir: stateDir,
    log_path: logPath,
    links_checked: checks.length,
    expected_link_count: linkCount,
    isolated_link_click_events_written: isolatedEventsWritten,
    checks,
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
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Fetches generated tracking links against an isolated local Worker with redirect: manual. It writes synthetic link_click rows only into a temporary local D1 state and never follows external URLs.",
  };
}

async function writeStatusAndReport(status) {
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
}

function renderReport(status) {
  const rows = status.checks
    .map((check) => `| ${check.link_id} | ${check.role} | ${check.target} | ${check.status} | ${check.ok ? "ok" : "fail"} | ${check.location} |`)
    .join("\n");
  return `# Tracking Link Smoke

- Status: ${status.ok ? "ok" : "not_ready"}
- Mode: ${status.mode}
- Links checked: ${status.links_checked}/${status.expected_link_count}
- Isolated link_click events written: ${status.isolated_link_click_events_written}
- Real event write performed: ${status.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${status.external_effect ? "yes" : "no"}
- Log: ${status.log_path}

| link_id | role | target | status | result | redirect_location |
|---|---|---|---:|---|---|
${rows}
`;
}

function findSid(testId, predicate) {
  for (let index = 0; index < 10000; index += 1) {
    const sid = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const bucket = stableBucket(`${testId}:${sid}`);
    if (predicate(bucket)) {
      return sid;
    }
  }
  throw new Error("Unable to find matching tracking-link smoke session id.");
}

function stableBucket(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function wranglerBin() {
  return process.platform === "win32"
    ? path.join(ROOT, "node_modules", ".bin", "wrangler.cmd")
    : path.join(ROOT, "node_modules", ".bin", "wrangler");
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("Unable to allocate a local port."));
      });
    });
  });
}

function appendLog(logPath, value) {
  appendFileSync(logPath, value);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

main();
