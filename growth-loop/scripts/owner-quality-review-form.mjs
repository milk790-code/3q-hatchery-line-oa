import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const OWNER_SAMPLE_GATE_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const OWNER_QUALITY_STATUS_PATH = path.join(ROOT, "data", "owner_quality_review_status.json");
const OWNER_FILLED_PATH = path.join(ROOT, "data", "owner_quality_review.filled.json");
const HTML_PATH = path.join(ROOT, "owner_quality_review_form.html");
const STATUS_PATH = path.join(ROOT, "data", "owner_quality_review_form_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");

const REQUIRED_OWNER_FIELDS = [
  "reviewer",
  "pii_checked",
  "evidence_ref",
  "lead_rate_retention_vs_champion",
  "close_rate_retention_vs_champion",
  "spam_flag_rate",
];
const OPTIONAL_OWNER_FIELDS = ["low_quality_flag_count", "notes"];

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const ownerSampleGate = await readOptionalJson(OWNER_SAMPLE_GATE_PATH, {});
  const ownerQuality = await readOptionalJson(OWNER_QUALITY_STATUS_PATH, {});
  const ownerFilledExists = await exists(OWNER_FILLED_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const rules = qualityRules(config);
  const sampleRateWinCandidate = Boolean(ownerSampleGate.sample_rate_win_candidate)
    || ownerSampleGate.status === "sample_rate_win_needs_quality_review";

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_quality_review_form",
    status: ownerFilledExists
      ? "owner_quality_review_input_detected_review_before_overwrite"
      : sampleRateWinCandidate
        ? "ready_local_quality_review_fill"
        : "waiting_for_sample_rate_candidate_local_form_ready",
    form_path: HTML_PATH,
    status_path: STATUS_PATH,
    owner_filled_path: OWNER_FILLED_PATH,
    owner_filled_exists: ownerFilledExists,
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    owner_quality_review_status: ownerQuality.status ?? "unknown",
    sample_rate_win_candidate: sampleRateWinCandidate,
    required_owner_fields: REQUIRED_OWNER_FIELDS,
    optional_owner_fields: OPTIONAL_OWNER_FIELDS,
    download_filename: "owner_quality_review.filled.json",
    review_download_filename: "owner_quality_review_form.review.json",
    thresholds: rules,
    browser_only: true,
    browser_persistence: false,
    form_action: "none",
    network_calls_performed: false,
    validation_rules: [
      "reviewer is required and must not contain email, phone, LINE IDs, or customer identifiers.",
      "evidence_ref is required and must be aggregate-only.",
      "lead_rate_retention_vs_champion and close_rate_retention_vs_champion must be finite numbers.",
      `lead_rate_retention_vs_champion must be >= ${rules.min_lead_rate_retention_vs_champion}.`,
      `close_rate_retention_vs_champion must be >= ${rules.min_close_rate_retention_vs_champion}.`,
      `spam_flag_rate must be between 0 and ${rules.max_spam_flag_rate}.`,
      "pii_checked must be checked before JSON export.",
    ],
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: await countLines(REAL_EVENTS_PATH),
    real_events_unchanged: true,
    data_lp_events_write_performed: false,
    approval_queue_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    promotion_performed: false,
  };
  status.real_events_unchanged = status.real_events_before === status.real_events_after;

  await writeFile(HTML_PATH, renderHtml({ generatedAt, config, status }));
  await writeJson(STATUS_PATH, compactStatus(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    form_path: status.form_path,
    status_path: status.status_path,
    owner_filled_path: status.owner_filled_path,
    owner_filled_exists: status.owner_filled_exists,
    owner_sample_gate_status: status.owner_sample_gate_status,
    owner_quality_review_status: status.owner_quality_review_status,
    sample_rate_win_candidate: status.sample_rate_win_candidate,
    required_owner_fields: status.required_owner_fields,
    optional_owner_fields: status.optional_owner_fields,
    download_filename: status.download_filename,
    review_download_filename: status.review_download_filename,
    thresholds: status.thresholds,
    browser_only: status.browser_only,
    browser_persistence: status.browser_persistence,
    form_action: status.form_action,
    network_calls_performed: status.network_calls_performed,
    live_input_files_created: status.live_input_files_created,
    real_events_unchanged: status.real_events_unchanged,
    data_lp_events_write_performed: status.data_lp_events_write_performed,
    approval_queue_write_performed: status.approval_queue_write_performed,
    external_effect: status.external_effect,
    public_link_change_performed: status.public_link_change_performed,
    production_deploy_performed: status.production_deploy_performed,
    github_push_or_pr_performed: status.github_push_or_pr_performed,
    formal_post_performed: status.formal_post_performed,
    line_push_performed: status.line_push_performed,
    customer_data_mutation_performed: status.customer_data_mutation_performed,
    payment_action_performed: status.payment_action_performed,
    delete_action_performed: status.delete_action_performed,
    promotion_performed: status.promotion_performed,
  };
}

function renderHtml({ generatedAt, config, status }) {
  const safeStatus = JSON.stringify(compactStatus(status)).replaceAll("<", "\\u003c");
  const safeCurrentRound = JSON.stringify(config.current_round ?? {}).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="zh-Hant-TW" data-external-effect="false" data-network="none">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>3Q Growth Loop Quality Review Form</title>
  <style>
    :root {
      --ink: #17211b;
      --muted: #66736c;
      --line: #d9dfd9;
      --paper: #f7f8f4;
      --panel: #ffffff;
      --panel2: #eef2ec;
      --green: #2f6d52;
      --amber: #875b17;
      --red: #8b2e2e;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body { margin: 0; min-width: 320px; }
    .shell { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.1; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
      gap: 16px;
      padding-bottom: 18px;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--line);
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      overflow: hidden;
    }
    .panel header {
      background: var(--panel2);
      border-bottom: 1px solid var(--line);
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .panel h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
    .body { padding: 14px; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .fact { min-width: 0; }
    .label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .value { display: block; font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label.field { display: grid; gap: 6px; }
    input[type="text"], input[type="number"], textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px 9px;
      font: 13px var(--sans);
      background: #fff;
    }
    textarea { min-height: 84px; resize: vertical; grid-column: 1 / -1; }
    .check { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; }
    button {
      appearance: none;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      border-radius: 6px;
      padding: 9px 11px;
      font: 600 13px var(--sans);
      cursor: pointer;
    }
    button.primary { background: var(--green); color: #fff; border-color: var(--green); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .status {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 6px;
      padding: 9px 11px;
      font-family: var(--mono);
      font-size: 12px;
    }
    .status.ok { border-color: color-mix(in srgb, var(--green) 36%, var(--line)); color: var(--green); }
    .status.bad { border-color: color-mix(in srgb, var(--red) 36%, var(--line)); color: var(--red); }
    .mono { font-family: var(--mono); }
    .issues { margin-top: 12px; color: var(--red); font-family: var(--mono); font-size: 12px; white-space: pre-wrap; }
    .rules { display: grid; gap: 8px; margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.5; }
    .badge { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px; font: 11px var(--mono); background: #fff; }
    @media (max-width: 760px) {
      .shell { padding: 16px; }
      .top, .grid { grid-template-columns: 1fr; }
      .facts { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div>
        <h1>3Q Growth Loop Quality Review Form</h1>
        <p>BLUF: Fill aggregate quality evidence only, validate locally, then download <span class="mono">owner_quality_review.filled.json</span>. This page has no network calls, no external links, no browser storage, no event writes, and no promotion action.</p>
      </div>
      <aside class="panel">
        <header>
          <h2>Local Contract</h2>
          <span class="badge">external=false</span>
        </header>
        <div class="body facts">
          <div class="fact"><span class="label">Generated</span><span class="value">${escapeHtml(generatedAt.toISOString())}</span></div>
          <div class="fact"><span class="label">Sample win</span><span class="value">${status.sample_rate_win_candidate ? "yes" : "no"}</span></div>
          <div class="fact"><span class="label">Download</span><span class="value">owner_quality_review.filled.json</span></div>
          <div class="fact"><span class="label">Owner path</span><span class="value">data/owner_quality_review.filled.json</span></div>
        </div>
      </aside>
    </section>

    <section class="panel">
      <header>
        <h2>Aggregate Quality Evidence</h2>
        <span id="status" class="status">not validated</span>
      </header>
      <div class="body">
        <form id="qualityForm" action="about:blank" method="dialog" novalidate>
          <div class="grid">
            <label class="field">
              <span class="label">Reviewer</span>
              <input id="reviewer" name="reviewer" type="text" autocomplete="off" placeholder="owner">
            </label>
            <label class="field">
              <span class="label">Evidence ref</span>
              <input id="evidence_ref" name="evidence_ref" type="text" autocomplete="off" placeholder="aggregate-quality-review/week0-cta-text">
            </label>
            <label class="field">
              <span class="label">Lead rate retention vs champion</span>
              <input id="lead_rate_retention_vs_champion" name="lead_rate_retention_vs_champion" type="number" min="0" step="0.0001" placeholder="${status.thresholds.min_lead_rate_retention_vs_champion}">
            </label>
            <label class="field">
              <span class="label">Close rate retention vs champion</span>
              <input id="close_rate_retention_vs_champion" name="close_rate_retention_vs_champion" type="number" min="0" step="0.0001" placeholder="${status.thresholds.min_close_rate_retention_vs_champion}">
            </label>
            <label class="field">
              <span class="label">Spam flag rate</span>
              <input id="spam_flag_rate" name="spam_flag_rate" type="number" min="0" max="1" step="0.0001" placeholder="${status.thresholds.max_spam_flag_rate}">
            </label>
            <label class="field">
              <span class="label">Low quality flag count</span>
              <input id="low_quality_flag_count" name="low_quality_flag_count" type="number" min="0" step="1" placeholder="0">
            </label>
            <label class="field">
              <span class="label">Notes</span>
              <textarea id="notes" name="notes" placeholder="Aggregate-only notes. Do not paste names, phone, emails, LINE IDs, messages, payment data, or customer rows."></textarea>
            </label>
          </div>
          <label class="check">
            <input id="pii_checked" name="pii_checked" type="checkbox">
            <span>PII checked: evidence is aggregate-only and contains no customer identifiers.</span>
          </label>
        </form>
        <div class="toolbar">
          <button type="button" class="primary" id="validate">Validate</button>
          <button type="button" id="downloadJson" disabled>Download JSON</button>
          <button type="button" id="downloadReview" disabled>Download Review JSON</button>
          <button type="button" id="clear">Clear owner fields</button>
        </div>
        <div id="issues" class="issues" aria-live="polite"></div>
      </div>
    </section>

    <section class="panel" style="margin-top:14px">
      <header>
        <h2>Hard Rules</h2>
        <span class="badge">aggregate only</span>
      </header>
      <div class="body">
        <ul class="rules">
          <li>Do not paste phone, email, LINE user ID, customer name, chat text, order ID, payment/refund ID, or private notes.</li>
          <li>The page only builds downloadable JSON. It does not create <span class="mono">data/owner_quality_review.filled.json</span> by itself.</li>
          <li>After review, place the downloaded JSON at <span class="mono">data/owner_quality_review.filled.json</span>, then run <span class="mono">npm run owner:quality-review</span>.</li>
          <li>Passing quality review only queues owner promotion review. It never changes public links, deploys, posts, pushes LINE, or promotes a challenger.</li>
        </ul>
      </div>
    </section>
  </main>

  <script id="contract-data" type="application/json">${safeStatus}</script>
  <script id="round-data" type="application/json">${safeCurrentRound}</script>
  <script>
    "use strict";

    const contract = JSON.parse(document.getElementById("contract-data").textContent);
    const currentRound = JSON.parse(document.getElementById("round-data").textContent);
    const statusEl = document.getElementById("status");
    const issues = document.getElementById("issues");
    const downloadJson = document.getElementById("downloadJson");
    const downloadReview = document.getElementById("downloadReview");
    const sensitivePattern = /(@|\\b09\\d{8}\\b|\\b\\d{4}[- ]?\\d{3}[- ]?\\d{3}\\b|line\\s*id|user\\s*id|uid|order\\s*id|payment|refund|電話|手機|信箱|暱稱|姓名|聊天|訂單|付款|退款)/i;

    function collect() {
      return {
        reviewer: value("reviewer"),
        pii_checked: document.getElementById("pii_checked").checked ? "yes" : "",
        evidence_ref: value("evidence_ref"),
        lead_rate_retention_vs_champion: numberValue("lead_rate_retention_vs_champion"),
        close_rate_retention_vs_champion: numberValue("close_rate_retention_vs_champion"),
        spam_flag_rate: numberValue("spam_flag_rate"),
        low_quality_flag_count: integerValue("low_quality_flag_count"),
        notes: value("notes"),
      };
    }

    function validate() {
      const out = collect();
      const found = [];
      if (!out.reviewer || sensitivePattern.test(out.reviewer)) found.push("reviewer");
      if (!out.evidence_ref || out.evidence_ref.length < 3 || sensitivePattern.test(out.evidence_ref)) found.push("evidence_ref");
      if (typeof out.lead_rate_retention_vs_champion !== "number" || !Number.isFinite(out.lead_rate_retention_vs_champion)) found.push("lead_rate_retention_vs_champion");
      if (typeof out.close_rate_retention_vs_champion !== "number" || !Number.isFinite(out.close_rate_retention_vs_champion)) found.push("close_rate_retention_vs_champion");
      if (typeof out.spam_flag_rate !== "number" || !Number.isFinite(out.spam_flag_rate) || out.spam_flag_rate < 0 || out.spam_flag_rate > 1) found.push("spam_flag_rate");
      if (!Number.isInteger(out.low_quality_flag_count) || out.low_quality_flag_count < 0) found.push("low_quality_flag_count");
      if (out.notes && sensitivePattern.test(out.notes)) found.push("notes");
      if (out.pii_checked !== "yes") found.push("pii_checked");
      if (Number.isFinite(out.lead_rate_retention_vs_champion) && out.lead_rate_retention_vs_champion < contract.thresholds.min_lead_rate_retention_vs_champion) found.push("lead_retention_below_threshold");
      if (Number.isFinite(out.close_rate_retention_vs_champion) && out.close_rate_retention_vs_champion < contract.thresholds.min_close_rate_retention_vs_champion) found.push("close_retention_below_threshold");
      if (Number.isFinite(out.spam_flag_rate) && out.spam_flag_rate > contract.thresholds.max_spam_flag_rate) found.push("spam_rate_above_threshold");

      const ok = found.length === 0;
      issues.textContent = ok ? "" : found.join("\\n");
      statusEl.textContent = ok ? "valid / ready to download" : found.length + " issue(s)";
      statusEl.className = "status " + (ok ? "ok" : "bad");
      downloadJson.disabled = !ok;
      downloadReview.disabled = !ok;
      return { ok, value: out, issues: found };
    }

    function value(id) {
      return document.getElementById(id).value.trim();
    }

    function numberValue(id) {
      const text = value(id);
      return text ? Number(text) : Number.NaN;
    }

    function integerValue(id) {
      const text = value(id);
      if (!text) return 0;
      return Number(text);
    }

    function payload(result) {
      return {
        ...result.value,
        current_round_id: currentRound.round_id ?? null,
        generated_by: "owner_quality_review_form",
      };
    }

    function download(filename, text, type) {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    document.getElementById("validate").addEventListener("click", validate);
    downloadJson.addEventListener("click", () => {
      const result = validate();
      if (!result.ok) return;
      download(contract.download_filename, JSON.stringify(payload(result), null, 2) + "\\n", "application/json");
    });
    downloadReview.addEventListener("click", () => {
      const result = validate();
      if (!result.ok) return;
      download(contract.review_download_filename, JSON.stringify({
        generated_at: new Date().toISOString(),
        mode: "owner_quality_review_form_review",
        sample_rate_win_candidate: contract.sample_rate_win_candidate,
        external_effect: false,
        data_lp_events_write_performed: false,
        approval_queue_write_performed: false,
        payload: payload(result),
      }, null, 2) + "\\n", "application/json");
    });
    document.getElementById("clear").addEventListener("click", () => {
      document.querySelectorAll("input, textarea").forEach((input) => {
        if (input.type === "checkbox") input.checked = false;
        else input.value = "";
      });
      downloadJson.disabled = true;
      downloadReview.disabled = true;
      statusEl.textContent = "not validated";
      statusEl.className = "status";
      issues.textContent = "";
    });
  </script>
</body>
</html>
`;
}

function qualityRules(config) {
  return {
    min_lead_rate_retention_vs_champion: Number(config.quality_rules?.min_lead_rate_retention_vs_champion ?? 0.8),
    min_close_rate_retention_vs_champion: Number(config.quality_rules?.min_close_rate_retention_vs_champion ?? 0.8),
    max_spam_flag_rate: Number(config.quality_rules?.max_spam_flag_rate ?? 0.05),
    blocked_metadata_keys: config.quality_rules?.blocked_metadata_keys ?? ["phone", "email", "line_user_id", "customer_name", "address", "payment", "card"],
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
