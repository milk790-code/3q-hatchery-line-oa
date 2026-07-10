import { mkdir, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "browser_smoke_status.json");
const LOG_DIR = path.join(ROOT, "logs");
const BASE_URL = process.env.BROWSER_SMOKE_BASE_URL ?? "http://127.0.0.1:8787";
const HEALTH_TIMEOUT_MS = Number(process.env.BROWSER_SMOKE_HEALTH_TIMEOUT_MS ?? 90000);

async function main() {
  const startedAt = new Date();
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const logPath = path.join(LOG_DIR, `browser-smoke-${stamp(startedAt)}.log`);
  let child = null;
  let serverStarted = false;

  try {
    if (!(await healthReady())) {
      child = spawnWrangler(logPath);
      serverStarted = true;
      await waitForHealth(HEALTH_TIMEOUT_MS);
    }

    const checks = [];
    checks.push(await checkHealth());
    checks.push(await checkCandidate());
    checks.push(await checkCandidateAttributionScript());
    checks.push(await checkAbStatus());
    checks.push(await checkChampionTargetReady());

    const ok = checks.every((check) => check.ok);
    const status = buildStatus({
      ok,
      startedAt,
      logPath,
      serverStarted,
      checks,
    });
    await writeStatus(status);
    console.log(JSON.stringify(status, null, 2));
    if (!ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const failed = buildStatus({
      ok: false,
      startedAt,
      logPath,
      serverStarted,
      checks: [],
      error: error instanceof Error ? error.message : "unknown_error",
    });
    await writeStatus(failed);
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await waitForExit(child, 5000);
    }
  }
}

async function checkHealth() {
  const response = await fetchJson("/health");
  return {
    name: "health",
    ok:
      response.status === 200 &&
      response.body?.ok === true &&
      response.body?.external_effects === false &&
      Array.isArray(response.body?.human_gates),
    status_code: response.status,
    evidence: {
      service: response.body?.service,
      environment: response.body?.environment,
      external_effects: response.body?.external_effects,
      human_gates: response.body?.human_gates,
    },
    external_effect: false,
  };
}

async function checkCandidate() {
  const response = await fetchText("/candidate");
  return {
    name: "candidate_page",
    ok:
      response.status === 200 &&
      response.body.includes("48 小時") &&
      response.body.includes("加 LINE 領 48h 成交診斷") &&
      response.body.includes("challenger-week0-cta-text-v1"),
    status_code: response.status,
    evidence: {
      contains_offer: response.body.includes("48 小時"),
      contains_cta: response.body.includes("加 LINE 領 48h 成交診斷"),
      contains_asset_id: response.body.includes("challenger-week0-cta-text-v1"),
    },
    external_effect: false,
  };
}

async function checkCandidateAttributionScript() {
  const response = await fetchText("/candidate?asset_id=challenger-week0-cta-text-v1&content_id=browser-smoke-content&variant_id=browser-smoke-variant&sid=browser-smoke-session&utm_source=local&utm_medium=browser_smoke&utm_campaign=browser-smoke");
  const markers = [
    'variant_id: params.get("variant_id")',
    'content_id: params.get("content_id")',
    'session_id: params.get("sid")',
    'source: params.get("utm_source")',
    'medium: params.get("utm_medium")',
    'campaign: params.get("utm_campaign")',
    'sendCandidateEvent("page_view")',
    'sendCandidateEvent("cta_click")',
  ];
  return {
    name: "candidate_attribution_script",
    ok: response.status === 200 && markers.every((marker) => response.body.includes(marker)),
    status_code: response.status,
    evidence: {
      markers_present: Object.fromEntries(markers.map((marker) => [marker, response.body.includes(marker)])),
    },
    external_effect: false,
  };
}

async function checkAbStatus() {
  const response = await fetchJson("/ab/status");
  return {
    name: "ab_status",
    ok:
      response.status === 200 &&
      response.body?.ok === true &&
      response.body?.allocation?.champion === 90 &&
      response.body?.allocation?.challenger === 10 &&
      response.body?.champion_url === "https://3q-site.milk790.workers.dev/" &&
      response.body?.champion_url_ready === true &&
      response.body?.public_link_change_performed === false &&
      response.body?.production_deploy_performed === false,
    status_code: response.status,
    evidence: {
      allocation: response.body?.allocation,
      champion_url: response.body?.champion_url,
      champion_url_ready: response.body?.champion_url_ready,
      public_link_change_performed: response.body?.public_link_change_performed,
      production_deploy_performed: response.body?.production_deploy_performed,
      human_gate: response.body?.human_gate,
    },
    external_effect: false,
  };
}

async function checkChampionTargetReady() {
  const response = await fetchJson("/ab/status");
  return {
    name: "ab_champion_target_ready",
    ok:
      response.status === 200 &&
      response.body?.champion_url === "https://3q-site.milk790.workers.dev/" &&
      response.body?.champion_url_ready === true &&
      response.body?.external_effects === false,
    status_code: response.status,
    evidence: {
      champion_url: response.body?.champion_url,
      champion_url_ready: response.body?.champion_url_ready,
      external_effects: response.body?.external_effects,
      human_gate: response.body?.human_gate,
    },
    external_effect: false,
  };
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(new URL(pathname, BASE_URL), options);
  const body = await response.json();
  return { status: response.status, body };
}

async function fetchText(pathname, options = {}) {
  const response = await fetch(new URL(pathname, BASE_URL), options);
  const body = await response.text();
  return { status: response.status, body };
}

async function healthReady() {
  try {
    const response = await fetchJson("/health");
    return response.status === 200 && response.body?.ok === true;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthReady()) {
      return;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting ${timeoutMs}ms for local Worker health endpoint.`);
}

function spawnWrangler(logPath) {
  const bin = process.platform === "win32"
    ? path.join(ROOT, "node_modules", ".bin", "wrangler.cmd")
    : path.join(ROOT, "node_modules", ".bin", "wrangler");
  appendLog(logPath, `[browser-smoke] starting wrangler dev at ${new Date().toISOString()} with health_timeout_ms=${HEALTH_TIMEOUT_MS}\n`);
  const child = spawn(bin, ["dev", "--local", "--port", "8787"], {
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

function buildStatus({ ok, startedAt, logPath, serverStarted, checks, error }) {
  const finishedAt = new Date();
  return {
    ok,
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    mode: "local_browser_smoke",
    base_url: BASE_URL,
    health_timeout_ms: HEALTH_TIMEOUT_MS,
    server_started: serverStarted,
    log_path: logPath,
    checks,
    error,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    event_write_performed: false,
    note: "Local browser-route smoke only. Does not click LINE CTA, publish, deploy, change public links, mutate customer data, process payments, or delete data.",
  };
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

async function writeStatus(status) {
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

main();
