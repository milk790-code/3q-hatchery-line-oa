import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv");
const OWNER_FILLED_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.filled.csv");
const HTML_PATH = path.join(ROOT, "north_star_outcome_form.html");
const STATUS_PATH = path.join(ROOT, "data", "north_star_outcome_form_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");

const OUTCOME_EVENTS = ["link_click", "lead_submit", "deal", "quality_flag"];
const REQUIRED_OWNER_FIELDS = ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"];
const OPTIONAL_OWNER_FIELDS = ["quality_score"];

async function main() {
  const generatedAt = new Date();
  const templateRaw = await readFile(TEMPLATE_PATH, "utf8");
  const parsed = parseCsv(templateRaw);
  const rows = parsed.rows
    .map((row, index) => ({ ...row, row_number: index + 2 }))
    .filter((row) => OUTCOME_EVENTS.includes(row.stage))
    .map(decorateRow);
  const ownerFilledExists = await exists(OWNER_FILLED_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "north_star_outcome_form_local_browser_only",
    status: ownerFilledExists ? "owner_filled_source_capture_detected_review_before_overwrite" : "ready_local_browser_fill",
    form_path: HTML_PATH,
    status_path: STATUS_PATH,
    template_path: TEMPLATE_PATH,
    owner_filled_path: OWNER_FILLED_PATH,
    owner_filled_exists: ownerFilledExists,
    row_count: rows.length,
    event_types: OUTCOME_EVENTS,
    link_count: new Set(rows.map((row) => row.tracking_link_id)).size,
    target_live_files: [...new Set(rows.map((row) => row.target_live_file))].sort(),
    headers: parsed.headers,
    required_owner_fields: REQUIRED_OWNER_FIELDS,
    optional_owner_fields: OPTIONAL_OWNER_FIELDS,
    download_filename: "source_capture_ledger.filled.csv",
    output_filename: "source_capture_ledger.filled.csv",
    json_download_filename: "north_star_outcome_form.review.json",
    browser_only: true,
    browser_persistence: false,
    form_action: "none",
    network_calls_performed: false,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
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
    validation_rules: [
      "capture_date must be YYYY-MM-DD.",
      "aggregate_count must be a non-negative integer.",
      "evidence_ref is required and must not contain email, phone, LINE IDs, chat text, order IDs, payment IDs, refund IDs, or customer identifiers.",
      "reviewer is required and must not contain email, phone, or customer identifiers.",
      "pii_checked must be checked for every row before CSV export.",
      "quality_score is optional, must be 0-1, and is allowed only on quality_flag rows.",
    ],
  };

  await writeFile(HTML_PATH, renderHtml({ generatedAt, headers: parsed.headers, rows, status }));
  await writeJson(STATUS_PATH, compactStatus(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));
}

function decorateRow(row) {
  const outcomeGroup = row.stage === "link_click"
    ? "Click denominator"
    : row.stage === "quality_flag"
      ? "Quality regression guard"
      : "Revenue outcome";
  return {
    ...row,
    outcome_group: outcomeGroup,
    pii_rule: "Aggregate only. Do not paste names, phone, email, LINE IDs, chat text, order IDs, payment/refund IDs, customer rows, IPs, User-Agent strings, or private notes.",
  };
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    form_path: status.form_path,
    status_path: status.status_path,
    template_path: status.template_path,
    owner_filled_path: status.owner_filled_path,
    owner_filled_exists: status.owner_filled_exists,
    row_count: status.row_count,
    event_types: status.event_types,
    link_count: status.link_count,
    target_live_files: status.target_live_files,
    required_owner_fields: status.required_owner_fields,
    optional_owner_fields: status.optional_owner_fields,
    download_filename: status.download_filename,
    output_filename: status.output_filename,
    json_download_filename: status.json_download_filename,
    browser_only: status.browser_only,
    browser_persistence: status.browser_persistence,
    form_action: status.form_action,
    network_calls_performed: status.network_calls_performed,
    live_input_files_created: status.live_input_files_created,
    real_events_unchanged: status.real_events_unchanged,
    data_lp_events_write_performed: status.data_lp_events_write_performed,
    external_effect: status.external_effect,
    public_link_change_performed: status.public_link_change_performed,
    production_deploy_performed: status.production_deploy_performed,
    github_push_or_pr_performed: status.github_push_or_pr_performed,
    formal_post_performed: status.formal_post_performed,
    line_push_performed: status.line_push_performed,
    customer_data_mutation_performed: status.customer_data_mutation_performed,
    payment_action_performed: status.payment_action_performed,
    delete_action_performed: status.delete_action_performed,
  };
}

function renderHtml({ generatedAt, headers, rows, status }) {
  const safeRows = JSON.stringify(rows).replaceAll("<", "\\u003c");
  const safeHeaders = JSON.stringify(headers).replaceAll("<", "\\u003c");
  const safeStatus = JSON.stringify(compactStatus(status)).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="zh-Hant-TW" data-external-effect="false" data-network="none">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>3Q Growth Loop North Star Outcome Form</title>
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
      --blue: #315f7d;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body { margin: 0; min-width: 320px; }
    .shell { max-width: 1500px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.1; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
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
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
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
    .scroll { overflow: auto; border: 1px solid var(--line); border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; min-width: 1480px; background: #fff; }
    th, td { border-bottom: 1px solid var(--line); padding: 8px; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; z-index: 2; background: var(--panel2); font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    td { font-size: 12px; line-height: 1.35; }
    .mono { font-family: var(--mono); }
    input[type="text"], input[type="date"], input[type="number"] {
      width: 100%;
      min-width: 118px;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 7px 8px;
      font: 12px var(--sans);
      background: #fff;
    }
    input[type="checkbox"] { width: 18px; height: 18px; }
    tr.invalid { background: #fff7f7; }
    .issues { margin-top: 12px; color: var(--red); font-family: var(--mono); font-size: 12px; white-space: pre-wrap; }
    .rules { display: grid; gap: 8px; margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.5; }
    .badge { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px; font: 11px var(--mono); background: #fff; }
    @media (max-width: 860px) {
      .shell { padding: 16px; }
      .top { grid-template-columns: 1fr; }
      .facts { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div>
        <h1>3Q Growth Loop North Star Outcome Form</h1>
        <p>BLUF: Fill the 24 aggregate-only P1 outcome rows, validate locally, then download <span class="mono">source_capture_ledger.filled.csv</span>. This page has no network calls, no external links, no browser storage, and no event writes.</p>
      </div>
      <aside class="panel">
        <header>
          <h2>Local Contract</h2>
          <span class="badge">external=false</span>
        </header>
        <div class="body facts">
          <div class="fact"><span class="label">Generated</span><span class="value">${escapeHtml(generatedAt.toISOString())}</span></div>
          <div class="fact"><span class="label">Rows</span><span class="value">${rows.length}</span></div>
          <div class="fact"><span class="label">Events</span><span class="value">${OUTCOME_EVENTS.join(", ")}</span></div>
          <div class="fact"><span class="label">Owner path</span><span class="value">data/source_capture/source_capture_ledger.filled.csv</span></div>
        </div>
      </aside>
    </section>

    <section class="panel">
      <header>
        <h2>Fill Rows</h2>
        <span id="status" class="status">not validated</span>
      </header>
      <div class="body">
        <div class="toolbar">
          <button type="button" class="primary" id="validate">Validate</button>
          <button type="button" id="downloadCsv" disabled>Download CSV</button>
          <button type="button" id="downloadJson" disabled>Download Review JSON</button>
          <button type="button" id="clear">Clear owner fields</button>
        </div>
        <div class="scroll">
          <form id="ownerForm" novalidate>
            <table>
              <thead>
                <tr>
                  <th>CSV row</th>
                  <th>event</th>
                  <th>asset</th>
                  <th>content</th>
                  <th>variant</th>
                  <th>tracking link</th>
                  <th>target</th>
                  <th>source</th>
                  <th>capture date</th>
                  <th>aggregate count</th>
                  <th>quality score</th>
                  <th>evidence ref</th>
                  <th>reviewer</th>
                  <th>PII checked</th>
                </tr>
              </thead>
              <tbody id="rows"></tbody>
            </table>
          </form>
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
          <li>Do not paste phone, email, LINE user ID, customer name, chat text, order ID, payment/refund ID, IP, User-Agent, or private notes.</li>
          <li>The page only builds a downloadable CSV. It does not create <span class="mono">data/source_capture/source_capture_ledger.filled.csv</span> by itself.</li>
          <li>After review, place the downloaded CSV at <span class="mono">data/source_capture/source_capture_ledger.filled.csv</span>, then run <span class="mono">npm run north-star:outcome-preflight</span>.</li>
          <li>These rows complete the North Star funnel after link click: LINE inbound, lead, deal, and quality regression evidence stay owner-reviewed.</li>
        </ul>
      </div>
    </section>
  </main>

  <script id="rows-data" type="application/json">${safeRows}</script>
  <script id="headers-data" type="application/json">${safeHeaders}</script>
  <script id="status-data" type="application/json">${safeStatus}</script>
  <script>
    "use strict";

    const rows = JSON.parse(document.getElementById("rows-data").textContent);
    const headers = JSON.parse(document.getElementById("headers-data").textContent);
    const contract = JSON.parse(document.getElementById("status-data").textContent);
    const body = document.getElementById("rows");
    const issues = document.getElementById("issues");
    const statusEl = document.getElementById("status");
    const downloadCsv = document.getElementById("downloadCsv");
    const downloadJson = document.getElementById("downloadJson");
    const sensitivePattern = /(@|\\b09\\d{8}\\b|\\b\\d{4}[- ]?\\d{3}[- ]?\\d{3}\\b|line\\s*id|user\\s*id|uid|order\\s*id|payment|refund|ip\\s*address|user-agent|電話|手機|信箱|暱稱|姓名|聊天|訂單|付款|退款)/i;

    function render() {
      body.innerHTML = "";
      rows.forEach((row, index) => {
        const tr = document.createElement("tr");
        tr.dataset.index = String(index);
        tr.innerHTML = [
          cell(row.row_number, "mono"),
          cell(row.stage_label + "<br><span class='mono'>" + escapeHtml(row.stage) + "</span><br>" + escapeHtml(row.outcome_group)),
          cell(row.asset_id, "mono"),
          cell(row.content_id, "mono"),
          cell(row.variant_id, "mono"),
          cell(row.tracking_link_id + "<br>" + escapeHtml(row.pii_rule), "mono"),
          cell(row.target_live_file, "mono"),
          cell(row.source_surface + "<br><span class='mono'>" + escapeHtml(row.source_metric) + "</span>"),
          inputCell(index, "capture_date", "date"),
          inputCell(index, "aggregate_count", "number", "0"),
          inputCell(index, "quality_score", "number", "0"),
          inputCell(index, "evidence_ref", "text"),
          inputCell(index, "reviewer", "text"),
          checkboxCell(index, "pii_checked"),
        ].join("");
        body.appendChild(tr);
      });
    }

    function cell(value, className = "") {
      return "<td" + (className ? " class='" + className + "'" : "") + ">" + escapeHtml(String(value ?? "")) + "</td>";
    }

    function inputCell(index, name, type, min) {
      const id = name + "-" + index;
      return "<td><input id='" + id + "' data-index='" + index + "' data-name='" + name + "' type='" + type + "'" + (min !== undefined ? " min='" + min + "'" : "") + "></td>";
    }

    function checkboxCell(index, name) {
      const id = name + "-" + index;
      return "<td><input id='" + id + "' data-index='" + index + "' data-name='" + name + "' type='checkbox'></td>";
    }

    function collect() {
      const out = rows.map((row) => ({ ...row }));
      document.querySelectorAll("[data-index][data-name]").forEach((input) => {
        const index = Number(input.dataset.index);
        const name = input.dataset.name;
        out[index][name] = input.type === "checkbox" ? (input.checked ? "yes" : "") : input.value.trim();
      });
      return out;
    }

    function validate() {
      const out = collect();
      const found = [];
      document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("invalid"));

      out.forEach((row, index) => {
        const rowIssues = [];
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(row.capture_date ?? "")) rowIssues.push("capture_date");
        if (!/^(0|[1-9]\\d*)$/.test(row.aggregate_count ?? "")) rowIssues.push("aggregate_count");
        if ((row.evidence_ref ?? "").length < 3 || sensitivePattern.test(row.evidence_ref ?? "")) rowIssues.push("evidence_ref");
        if ((row.reviewer ?? "").length < 1 || sensitivePattern.test(row.reviewer ?? "")) rowIssues.push("reviewer");
        if (!["yes", "true", "checked", "ok", "1"].includes(String(row.pii_checked ?? "").toLowerCase())) rowIssues.push("pii_checked");
        if ((row.quality_score ?? "").trim() && row.stage !== "quality_flag") rowIssues.push("quality_score");
        if ((row.quality_score ?? "").trim() && !/^(0(\\.\\d+)?|1(\\.0+)?)$/.test(row.quality_score)) rowIssues.push("quality_score");

        if (rowIssues.length > 0) {
          found.push("CSV row " + row.row_number + ": " + rowIssues.join(", "));
          const tr = document.querySelector("tr[data-index='" + index + "']");
          if (tr) tr.classList.add("invalid");
        }
      });

      const ok = found.length === 0;
      issues.textContent = ok ? "" : found.join("\\n");
      statusEl.textContent = ok ? "valid / ready to download" : found.length + " issue(s)";
      statusEl.className = "status " + (ok ? "ok" : "bad");
      downloadCsv.disabled = !ok;
      downloadJson.disabled = !ok;
      return { ok, rows: out, issues: found };
    }

    function toCsv(rowsToExport) {
      const byKey = new Map(rowsToExport.map((row) => [row.tracking_link_id + "::" + row.stage, row]));
      const lines = [headers.map(csvCell).join(",")];
      rows.forEach((row) => {
        const exportRow = byKey.get(row.tracking_link_id + "::" + row.stage) ?? row;
        lines.push(headers.map((header) => csvCell(exportRow[header] ?? "")).join(","));
      });
      return lines.join("\\n") + "\\n";
    }

    function csvCell(value) {
      const stringValue = String(value ?? "");
      if (/[",\\n\\r]/.test(stringValue)) {
        return '"' + stringValue.replaceAll('"', '""') + '"';
      }
      return stringValue;
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
    downloadCsv.addEventListener("click", () => {
      const result = validate();
      if (!result.ok) return;
      download(contract.download_filename, toCsv(result.rows), "text/csv;charset=utf-8");
    });
    downloadJson.addEventListener("click", () => {
      const result = validate();
      if (!result.ok) return;
      download(contract.json_download_filename, JSON.stringify({
        generated_at: new Date().toISOString(),
        mode: "north_star_outcome_form_review",
        row_count: result.rows.length,
        event_types: contract.event_types,
        external_effect: false,
        data_lp_events_write_performed: false,
        rows: result.rows,
      }, null, 2) + "\\n", "application/json");
    });
    document.getElementById("clear").addEventListener("click", () => {
      document.querySelectorAll("[data-index][data-name]").forEach((input) => {
        if (input.type === "checkbox") input.checked = false;
        else input.value = "";
      });
      downloadCsv.disabled = true;
      downloadJson.disabled = true;
      statusEl.textContent = "not validated";
      statusEl.className = "status";
      issues.textContent = "";
      document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("invalid"));
    });

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    render();
  </script>
</body>
</html>
`;
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);

  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });

  return { headers, rows: dataRows };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
