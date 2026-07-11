import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "event_contract_smoke_status.json");
const LOG_DIR = path.join(ROOT, "logs");
const DATABASE_NAME = "3q-growth-loop-candidate";
const AB_TEST_ID = "ab-week0-cta-text-001";
const PUBLIC_EVENT_TYPES = ["page_view", "cta_click"];
const BLOCKED_PUBLIC_EVENT_TYPES = ["link_click", "line_add", "lead_submit", "deal", "quality_flag"];
const VALID_SESSION_ID = "00000000-0000-4000-8000-000000000001";
const WRANGLER_COMMAND_TIMEOUT_MS = 180000;
const WORKER_HEALTH_TIMEOUT_MS = 90000;

async function main() {
  const startedAt = new Date();
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const stateDir = await mkdtemp(path.join(tmpdir(), "3q-growth-loop-event-smoke-"));
  const logPath = path.join(LOG_DIR, `event-contract-smoke-${stamp(startedAt)}.log`);
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = null;

  try {
    await migrateIsolatedD1(stateDir, logPath);
    child = spawnWranglerDev(stateDir, port, logPath);
    await waitForHealth(baseUrl, WORKER_HEALTH_TIMEOUT_MS);

    const redirectAttribution = await checkRedirectAttribution(baseUrl);
    const abRedirectAttribution = await checkAbRedirectAttribution(baseUrl);
    const invalidAbSidRejection = await checkAbSidRejection(baseUrl, "not-a-uuid");
    const embeddedPhoneAbSidRejection = await checkAbSidRejection(baseUrl, "sid-0912345678");
    const corsContract = await checkCorsContract(baseUrl);
    const inserted = [];
    for (const eventType of PUBLIC_EVENT_TYPES) {
      inserted.push(await postEvent(baseUrl, eventType));
    }
    const blockedPublicEvents = [];
    for (const eventType of BLOCKED_PUBLIC_EVENT_TYPES) {
      blockedPublicEvents.push(await postEvent(baseUrl, eventType));
    }

    const sensitiveRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      campaign: "event-contract-smoke",
      metadata_json: {
        email: "blocked@example.com",
        fixture: "event_contract_smoke",
      },
    });
    const invalidEventRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "unknown_event",
      campaign: "event-contract-smoke",
      metadata_json: {
        fixture: "event_contract_smoke",
      },
    });
    const sensitiveTokenRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: "customer@example.invalid",
      campaign: "event-contract-smoke",
      metadata_json: { fixture: "event_contract_smoke", isolated: true },
    });
    const phoneCampaignRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: VALID_SESSION_ID,
      campaign: "campaign-0912345678",
      metadata_json: { fixture: "event_contract_smoke", isolated: true },
    });
    const embeddedPhoneSessionRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: "sid-0912345678",
      campaign: "event-contract-smoke",
      metadata_json: { fixture: "event_contract_smoke", isolated: true },
    });
    const numericPhoneMetadataRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: VALID_SESSION_ID,
      campaign: "event-contract-smoke",
      metadata_json: { page: 912345678, isolated: true },
    });
    const urlPathPiiRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: VALID_SESSION_ID,
      campaign: "event-contract-smoke",
      url: `${baseUrl}/customer/jane%2540example.com`,
      metadata_json: { fixture: "event_contract_smoke", isolated: true },
    });
    const publicFieldRejection = await postRawEvent(baseUrl, {
      asset_id: "challenger-week0-cta-text-v1",
      event_type: "page_view",
      session_id: VALID_SESSION_ID,
      campaign: "event-contract-smoke",
      quality_score: 1,
      metadata_json: { fixture: "event_contract_smoke", isolated: true },
    });
    const oversizedDeclaredBody = await postOversizedBody(baseUrl, false);
    const oversizedChunkedBody = await postOversizedBody(baseUrl, true);

    child = await stopWranglerDev(child);
    const counts = await queryCounts(stateDir, logPath);
    const corsCounts = await queryCorsCounts(stateDir, logPath);
    corsContract.allowed_event_rows = corsCounts.allowed;
    corsContract.denied_event_rows = corsCounts.denied;
    corsContract.ok = corsContract.ok && corsCounts.allowed === 1 && corsCounts.denied === 0;
    const sensitiveRows = await querySensitiveRows(stateDir, logPath);
    await seedScheduledQualityRegressionFixture(stateDir, logPath);
    child = spawnWranglerDev(stateDir, port, logPath);
    await waitForHealth(baseUrl, WORKER_HEALTH_TIMEOUT_MS);
    const scheduledTrigger = await triggerScheduled(baseUrl);
    child = await stopWranglerDev(child);
    const scheduledQualityRegression = await waitForScheduledQualityRegression(stateDir, logPath, 15000);
    const expectedCountsOk = PUBLIC_EVENT_TYPES.every((eventType) => counts[eventType] === 1)
      && BLOCKED_PUBLIC_EVENT_TYPES.every((eventType) => !counts[eventType]);
    const ok =
      inserted.every((item) => item.ok) &&
      blockedPublicEvents.every((item) => item.status === 400 && item.error === "event_type_not_allowed_public") &&
      sensitiveRejection.status === 400 &&
      sensitiveRejection.body?.error === "blocked_metadata_key" &&
      invalidEventRejection.status === 400 &&
      invalidEventRejection.body?.error === "invalid_event_type" &&
      sensitiveTokenRejection.status === 400 &&
      sensitiveTokenRejection.body?.error === "invalid_session_id" &&
      phoneCampaignRejection.status === 400 &&
      phoneCampaignRejection.body?.error === "invalid_campaign" &&
      embeddedPhoneSessionRejection.status === 400 &&
      embeddedPhoneSessionRejection.body?.error === "invalid_session_id" &&
      numericPhoneMetadataRejection.status === 400 &&
      numericPhoneMetadataRejection.body?.error === "invalid_metadata_value" &&
      urlPathPiiRejection.status === 400 &&
      urlPathPiiRejection.body?.error === "invalid_url" &&
      publicFieldRejection.status === 400 &&
      publicFieldRejection.body?.error === "public_event_fields_not_allowed" &&
      oversizedDeclaredBody.status === 413 &&
      oversizedDeclaredBody.body?.error === "payload_too_large" &&
      oversizedChunkedBody.status === 413 &&
      oversizedChunkedBody.body?.error === "payload_too_large" &&
      redirectAttribution.ok &&
      abRedirectAttribution.ok &&
      invalidAbSidRejection.ok &&
      embeddedPhoneAbSidRejection.ok &&
      corsContract.ok &&
      expectedCountsOk &&
      sensitiveRows === 0 &&
      scheduledTrigger.ok &&
      scheduledQualityRegression.ok;

    const status = buildStatus({
      ok,
      startedAt,
      stateDir,
      baseUrl,
      logPath,
      inserted,
      blockedPublicEvents,
      counts,
      sensitiveRows,
      sensitiveRejection,
      invalidEventRejection,
      sensitiveTokenRejection,
      phoneCampaignRejection,
      embeddedPhoneSessionRejection,
      numericPhoneMetadataRejection,
      urlPathPiiRejection,
      publicFieldRejection,
      oversizedDeclaredBody,
      oversizedChunkedBody,
      redirectAttribution,
      abRedirectAttribution,
      invalidAbSidRejection,
      embeddedPhoneAbSidRejection,
      corsContract,
      scheduledTrigger,
      scheduledQualityRegression,
    });
    await writeStatus(status);
    console.log(JSON.stringify(status, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const failed = buildStatus({
      ok: false,
      startedAt,
      stateDir,
      baseUrl,
      logPath,
      inserted: [],
      counts: {},
      sensitiveRows: null,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    await writeStatus(failed);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child = await stopWranglerDev(child);
  }
}

async function postEvent(baseUrl, eventType) {
  const payload = {
    asset_id: "challenger-week0-cta-text-v1",
    variant_id: "event-contract-smoke",
    content_id: "event-contract-smoke",
    session_id: VALID_SESSION_ID,
    source: "local",
    medium: "event_contract_smoke",
    campaign: "event-contract-smoke",
    event_type: eventType,
    url: `${baseUrl}/candidate`,
    metadata_json: {
      fixture: "event_contract_smoke",
      isolated: true,
    },
  };
  const response = await postRawEvent(baseUrl, payload);
  return {
    event_type: eventType,
    ok: response.status === 200 && response.body?.ok === true && typeof response.body?.event_id === "string",
    status: response.status,
    error: response.body?.error ?? null,
    event_id_present: typeof response.body?.event_id === "string",
  };
}

async function checkRedirectAttribution(baseUrl) {
  const expected = {
    asset_id: "challenger-week0-cta-text-v1",
    content_id: "event-contract-redirect-content",
    variant_id: "event-contract-redirect-variant",
    sid: "00000000-0000-4000-8000-000000000002",
    utm_source: "local",
    utm_medium: "event_contract_smoke",
    utm_campaign: "event-contract-redirect-smoke",
  };
  const url = new URL(`/r/${encodeURIComponent(expected.asset_id)}`, baseUrl);
  url.searchParams.set("to", "challenger");
  for (const [key, value] of Object.entries(expected)) {
    if (key !== "asset_id") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const redirectUrl = location ? new URL(location, baseUrl) : null;
  const observed = redirectUrl
    ? Object.fromEntries(["asset_id", "content_id", "variant_id", "sid", "utm_source", "utm_medium", "utm_campaign"].map((key) => [
        key,
        redirectUrl.searchParams.get(key),
      ]))
    : {};
  return {
    ok:
      response.status === 302 &&
      redirectUrl?.pathname === "/candidate" &&
      Object.entries(expected).every(([key, value]) => observed[key] === value),
    status: response.status,
    location,
    observed,
    expected,
    external_effect: false,
  };
}

async function checkAbRedirectAttribution(baseUrl) {
  const sid = findSid((bucket) => bucket < 10);
  const expected = {
    asset_id: "challenger-week0-cta-text-v1",
    content_id: "event-contract-ab-content",
    variant_id: `${AB_TEST_ID}:challenger`,
    sid,
    utm_source: "local",
    utm_medium: "event_contract_smoke",
    utm_campaign: "event-contract-ab-smoke",
  };
  const url = new URL(`/ab/${encodeURIComponent(AB_TEST_ID)}`, baseUrl);
  url.searchParams.set("sid", sid);
  url.searchParams.set("utm_source", expected.utm_source);
  url.searchParams.set("utm_medium", expected.utm_medium);
  url.searchParams.set("utm_campaign", expected.utm_campaign);
  url.searchParams.set("content_id", expected.content_id);

  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const redirectUrl = location ? new URL(location, baseUrl) : null;
  const observed = redirectUrl
    ? Object.fromEntries(["asset_id", "content_id", "variant_id", "sid", "utm_source", "utm_medium", "utm_campaign"].map((key) => [
        key,
        redirectUrl.searchParams.get(key),
      ]))
    : {};
  return {
    ok:
      response.status === 302 &&
      redirectUrl?.pathname === "/candidate" &&
      Object.entries(expected).every(([key, value]) => observed[key] === value),
    status: response.status,
    bucket: stableBucket(`${AB_TEST_ID}:${sid}`),
    location,
    observed,
    expected,
    external_effect: false,
  };
}

async function checkAbSidRejection(baseUrl, sid) {
  const url = new URL(`/ab/${encodeURIComponent(AB_TEST_ID)}`, baseUrl);
  url.searchParams.set("sid", sid);
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.json();
  return {
    ok: response.status === 400 && body?.error === "invalid_session_id",
    sid,
    status: response.status,
    error: body?.error ?? null,
  };
}

async function checkCorsContract(baseUrl) {
  const allowedOrigin = "https://3q-site.milk790.workers.dev";
  const deniedOrigin = "https://example.invalid";
  const preflight = await fetch(new URL("/e", baseUrl), {
    method: "OPTIONS",
    headers: {
      origin: allowedOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  const allowed = await postRawEvent(baseUrl, {
    asset_id: "champion-3q-line-v0",
    event_type: "page_view",
    source: "fixture",
    medium: "cors_contract_smoke",
    campaign: "cors-contract-smoke-allowed",
    metadata_json: { fixture: "cors_contract_smoke", isolated: true },
  }, { origin: allowedOrigin });
  const denied = await postRawEvent(baseUrl, {
    asset_id: "champion-3q-line-v0",
    event_type: "page_view",
    source: "fixture",
    medium: "cors_contract_smoke",
    campaign: "cors-contract-smoke-denied",
    metadata_json: { fixture: "cors_contract_smoke", isolated: true },
  }, { origin: deniedOrigin });
  const missingOrigin = await postRawEvent(baseUrl, {
    asset_id: "champion-3q-line-v0",
    event_type: "page_view",
    source: "fixture",
    medium: "cors_contract_smoke",
    campaign: "cors-contract-smoke-missing-origin",
    metadata_json: { fixture: "cors_contract_smoke", isolated: true },
  }, { origin: null });

  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  const allowMethods = preflight.headers.get("access-control-allow-methods") ?? "";
  return {
    ok:
      preflight.status === 204 &&
      allowOrigin === allowedOrigin &&
      allowMethods.includes("POST") &&
      allowed.status === 200 &&
      allowed.headers?.allow_origin === allowedOrigin &&
      denied.status === 403 &&
      denied.body?.error === "origin_not_allowed" &&
      missingOrigin.status === 403 &&
      missingOrigin.body?.error === "origin_not_allowed",
    allowed_origin: allowedOrigin,
    denied_origin: deniedOrigin,
    preflight: {
      status: preflight.status,
      allow_origin: allowOrigin,
      allow_methods: allowMethods,
      vary: preflight.headers.get("vary"),
    },
    allowed_post: allowed,
    denied_post: denied,
    missing_origin_post: missingOrigin,
    allowed_event_rows: null,
    denied_event_rows: null,
    external_effect: false,
  };
}

async function seedScheduledQualityRegressionFixture(stateDir, logPath) {
  const week = completedTaipeiWeek(new Date());
  const rows = [
    ...buildFixtureRows("champion-3q-line-v0", week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
    ...buildFixtureRows("challenger-week0-cta-text-v1", week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 4, deal: 1, quality_flag: 10, low_quality_flag: 2, test_days: 4 }),
  ];
  for (const [chunkIndex, chunk] of chunks(rows, 40).entries()) {
    const values = chunk.map((row) => `(${[
      sqlString(row.event_id),
      sqlString(row.occurred_at),
      sqlString(row.asset_id),
      sqlString(row.variant_id),
      sqlString(row.content_id),
      sqlString(row.session_id),
      sqlString(row.source),
      sqlString(row.medium),
      sqlString(row.campaign),
      sqlString(row.event_type),
      sqlString(row.url),
      sqlString(row.referrer),
      sqlString(row.user_agent_hash),
      sqlString(row.ip_country),
      row.value_amount === null ? "NULL" : String(row.value_amount),
      row.quality_score === null ? "NULL" : String(row.quality_score),
      sqlString(JSON.stringify(row.metadata_json)),
    ].join(", ")})`);
    const sql = `
      INSERT INTO lp_events (
        event_id,
        occurred_at,
        asset_id,
        variant_id,
        content_id,
        session_id,
        source,
        medium,
        campaign,
        event_type,
        url,
        referrer,
        user_agent_hash,
        ip_country,
        value_amount,
        quality_score,
        metadata_json
      ) VALUES ${values.join(",\n")};
    `;
    await runSqlite(stateDir, sql, logPath, { mode: "execute" });
  }
}

function buildFixtureRows(assetId, weekStart, counts) {
  const rows = [];
  const testDays = counts.test_days ?? 1;
  for (const [eventType, count] of Object.entries(counts)) {
    if (eventType === "test_days" || eventType === "low_quality_flag") continue;
    for (let index = 0; index < count; index += 1) {
      const date = new Date(`${weekStart}T10:00:00.000+08:00`);
      date.setUTCDate(date.getUTCDate() + (index % testDays));
      rows.push({
        event_id: `scheduled-quality-${assetId}-${eventType}-${index}`,
        occurred_at: date.toISOString(),
        asset_id: assetId,
        variant_id: "scheduled-quality-regression",
        content_id: "scheduled-quality-regression",
        session_id: `scheduled-quality-${assetId}-${index}`,
        source: "fixture",
        medium: "event_contract_smoke",
        campaign: "scheduled-quality-regression",
        event_type: eventType,
        url: null,
        referrer: null,
        user_agent_hash: null,
        ip_country: null,
        value_amount: null,
        quality_score: eventType === "quality_flag" ? (index < (counts.low_quality_flag ?? 0) ? 0 : 1) : null,
        metadata_json: {
          fixture: "scheduled_quality_regression",
          isolated: true,
        },
      });
    }
  }
  return rows;
}

async function triggerScheduled(baseUrl) {
  const response = await fetch(new URL("/cdn-cgi/handler/scheduled", baseUrl));
  const body = await response.text();
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    body_bytes: body.length,
  };
}

async function waitForScheduledQualityRegression(stateDir, logPath, timeoutMs) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeoutMs) {
    latest = await queryScheduledScores(stateDir, logPath);
    const challenger = latest.find((row) => row.asset_id === "challenger-week0-cta-text-v1");
    if (challenger) {
      const ok =
        Number(challenger.sample_threshold_met) === 1 &&
        Number(challenger.no_quality_regression) === 0 &&
        challenger.decision === "reject_quality_regression";
      return {
        ok,
        rows: latest,
        challenger,
      };
    }
    await delay(500);
  }
  return {
    ok: false,
    rows: latest ?? [],
    challenger: null,
  };
}

async function queryScheduledScores(stateDir, logPath) {
  const sql = `
    SELECT
      asset_id,
      link_clicks,
      visits,
      cta_clicks,
      line_adds,
      line_add_rate,
      sample_threshold_met,
      no_quality_regression,
      decision,
      metadata_json
    FROM weekly_growth_scores
    ORDER BY asset_id
  `;
  const rows = await runSqlite(stateDir, sql, logPath, { mode: "query" });
  return rows.map((row) => ({
    ...row,
    metadata: safeJson(row.metadata_json),
  }));
}

async function postRawEvent(baseUrl, payload, { origin = new URL(baseUrl).origin } = {}) {
  const headers = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  const response = await fetch(new URL("/e", baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return {
    status: response.status,
    body,
    headers: {
      allow_origin: response.headers.get("access-control-allow-origin"),
      vary: response.headers.get("vary"),
    },
  };
}

async function postOversizedBody(baseUrl, chunked) {
  const payload = "x".repeat(9000);
  const body = chunked
    ? new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      })
    : payload;
  const response = await fetch(new URL("/e", baseUrl), {
    method: "POST",
    headers: {
      origin: new URL(baseUrl).origin,
      "content-type": "application/json",
    },
    body,
    ...(chunked ? { duplex: "half" } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    chunked,
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

async function queryCounts(stateDir, logPath) {
  const sql = `
    SELECT event_type, COUNT(*) AS n
    FROM lp_events
    WHERE campaign = 'event-contract-smoke'
    GROUP BY event_type
    ORDER BY event_type
  `;
  const rows = await runSqlite(stateDir, sql, logPath, { mode: "query" });
  return Object.fromEntries(rows.map((row) => [row.event_type, row.n]));
}

async function queryCorsCounts(stateDir, logPath) {
  const sql = `
    SELECT campaign, COUNT(*) AS n
    FROM lp_events
    WHERE campaign IN ('cors-contract-smoke-allowed', 'cors-contract-smoke-denied')
    GROUP BY campaign
  `;
  const rows = await runSqlite(stateDir, sql, logPath, { mode: "query" });
  const counts = Object.fromEntries(rows.map((row) => [row.campaign, row.n]));
  return {
    allowed: counts["cors-contract-smoke-allowed"] ?? 0,
    denied: counts["cors-contract-smoke-denied"] ?? 0,
  };
}

async function querySensitiveRows(stateDir, logPath) {
  const sql = `
    SELECT COUNT(*) AS n
    FROM lp_events
    WHERE campaign = 'event-contract-smoke'
      AND (
        metadata_json LIKE '%email%'
        OR metadata_json LIKE '%phone%'
        OR metadata_json LIKE '%line_user_id%'
        OR metadata_json LIKE '%customer_name%'
        OR metadata_json LIKE '%payment%'
        OR session_id LIKE '%0912345678%'
        OR url LIKE '%example.com%'
        OR referrer LIKE '%example.com%'
      )
  `;
  const rows = await runSqlite(stateDir, sql, logPath, { mode: "query" });
  return rows[0]?.n ?? 0;
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

function parseD1Rows(stdout) {
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) {
    throw new Error("D1 query failed");
  }
  return first.results ?? [];
}

function spawnWranglerDev(stateDir, port, logPath) {
  appendLog(logPath, `[event-contract-smoke] starting wrangler dev at ${new Date().toISOString()} port=${port} health_timeout_ms=${WORKER_HEALTH_TIMEOUT_MS} state_dir=${stateDir}\n`);
  const child = spawn(wranglerBin(), [
    "dev",
    "--local",
    "--port",
    String(port),
    "--persist-to",
    stateDir,
    "--test-scheduled",
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

function buildStatus({
  ok,
  startedAt,
  stateDir,
  baseUrl,
  logPath,
  inserted,
  blockedPublicEvents,
  counts,
  sensitiveRows,
  sensitiveRejection,
  invalidEventRejection,
  sensitiveTokenRejection,
  phoneCampaignRejection,
  embeddedPhoneSessionRejection,
  numericPhoneMetadataRejection,
  urlPathPiiRejection,
  publicFieldRejection,
  oversizedDeclaredBody,
  oversizedChunkedBody,
  redirectAttribution,
  abRedirectAttribution,
  invalidAbSidRejection,
  embeddedPhoneAbSidRejection,
  corsContract,
  scheduledTrigger,
  scheduledQualityRegression,
  error,
}) {
  const finishedAt = new Date();
  return {
    ok,
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    mode: "isolated_local_event_contract_smoke",
    base_url: baseUrl,
    isolated_state_dir: stateDir,
    log_path: logPath,
    inserted_events: inserted,
    blocked_public_events: blockedPublicEvents ?? [],
    event_type_counts: counts,
    sensitive_rows_written: sensitiveRows,
    sensitive_rejection: sensitiveRejection
      ? {
          ok: sensitiveRejection.status === 400 && sensitiveRejection.body?.error === "blocked_metadata_key",
          status: sensitiveRejection.status,
          error: sensitiveRejection.body?.error,
        }
      : null,
    invalid_event_rejection: invalidEventRejection
      ? {
          ok: invalidEventRejection.status === 400 && invalidEventRejection.body?.error === "invalid_event_type",
          status: invalidEventRejection.status,
          error: invalidEventRejection.body?.error,
        }
      : null,
    sensitive_token_rejection: sensitiveTokenRejection
      ? {
          ok: sensitiveTokenRejection.status === 400 && sensitiveTokenRejection.body?.error === "invalid_session_id",
          status: sensitiveTokenRejection.status,
          error: sensitiveTokenRejection.body?.error,
        }
      : null,
    phone_campaign_rejection: phoneCampaignRejection
      ? {
          ok: phoneCampaignRejection.status === 400 && phoneCampaignRejection.body?.error === "invalid_campaign",
          status: phoneCampaignRejection.status,
          error: phoneCampaignRejection.body?.error,
        }
      : null,
    embedded_phone_session_rejection: embeddedPhoneSessionRejection
      ? {
          ok: embeddedPhoneSessionRejection.status === 400 && embeddedPhoneSessionRejection.body?.error === "invalid_session_id",
          status: embeddedPhoneSessionRejection.status,
          error: embeddedPhoneSessionRejection.body?.error,
        }
      : null,
    numeric_phone_metadata_rejection: numericPhoneMetadataRejection
      ? {
          ok: numericPhoneMetadataRejection.status === 400 && numericPhoneMetadataRejection.body?.error === "invalid_metadata_value",
          status: numericPhoneMetadataRejection.status,
          error: numericPhoneMetadataRejection.body?.error,
        }
      : null,
    url_path_pii_rejection: urlPathPiiRejection
      ? {
          ok: urlPathPiiRejection.status === 400 && urlPathPiiRejection.body?.error === "invalid_url",
          status: urlPathPiiRejection.status,
          error: urlPathPiiRejection.body?.error,
        }
      : null,
    public_event_field_rejection: publicFieldRejection
      ? {
          ok: publicFieldRejection.status === 400 && publicFieldRejection.body?.error === "public_event_fields_not_allowed",
          status: publicFieldRejection.status,
          error: publicFieldRejection.body?.error,
        }
      : null,
    body_limit: {
      declared_length_rejected: oversizedDeclaredBody?.status === 413 && oversizedDeclaredBody.body?.error === "payload_too_large",
      chunked_stream_rejected: oversizedChunkedBody?.status === 413 && oversizedChunkedBody.body?.error === "payload_too_large",
    },
    redirect_attribution: redirectAttribution ?? null,
    ab_redirect_attribution: abRedirectAttribution ?? null,
    invalid_ab_sid_rejection: invalidAbSidRejection ?? null,
    embedded_phone_ab_sid_rejection: embeddedPhoneAbSidRejection ?? null,
    cors_contract: corsContract ?? null,
    scheduled_trigger: scheduledTrigger ?? null,
    scheduled_quality_regression: scheduledQualityRegression ?? null,
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
    note: "Writes synthetic events only into an isolated temporary local D1 state. It does not write data/lp_events.jsonl or any remote D1.",
  };
}

function taipeiWeek(date) {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipeiDate);
  start.setDate(taipeiDate.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start: dateOnly(start),
    end: dateOnly(end),
  };
}

function completedTaipeiWeek(now) {
  const current = taipeiWeek(now);
  const previousAnchor = new Date(new Date(`${current.start}T00:00:00.000+08:00`).getTime() - 24 * 60 * 60 * 1000);
  return taipeiWeek(previousAnchor);
}

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function safeJson(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function findSid(predicate) {
  for (let index = 0; index < 10000; index += 1) {
    const sid = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const bucket = stableBucket(`${AB_TEST_ID}:${sid}`);
    if (predicate(bucket)) {
      return sid;
    }
  }
  throw new Error("Unable to find matching A/B smoke session id.");
}

function stableBucket(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

async function writeStatus(status) {
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
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
