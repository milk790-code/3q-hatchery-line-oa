import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const LAUNCH_READINESS_PATH = path.join(ROOT, "launch_readiness.json");
const APPROVAL_STATUS_PATH = path.join(ROOT, "data", "approval_resume_status.json");
const OWNER_INPUT_PATH = path.join(ROOT, "owner_approval_input.json");
const HTML_PATH = path.join(ROOT, "owner_approval_form.html");
const STATUS_PATH = path.join(ROOT, "data", "owner_approval_form_status.json");

const RED_LINE_FLAGS = {
  external_effect: false,
  data_lp_events_write_performed: false,
  public_link_change_performed: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
};

const APPROVAL_FIELDS = {
  remote_d1_create_and_migrate: [
    ["approved_by", "Owner alias"],
    ["approved_at", "Approved at"],
    ["cloudflare_account_alias", "Cloudflare account alias"],
    ["d1_database_name", "D1 database name"],
    ["d1_database_id", "D1 database id"],
  ],
  candidate_worker_production_deploy: [
    ["approved_by", "Owner alias"],
    ["approved_at", "Approved at"],
    ["worker_name", "Worker name"],
    ["worker_url", "Worker URL"],
    ["rollback_plan", "Rollback plan"],
  ],
  public_ab_small_traffic_link: [
    ["approved_by", "Owner alias"],
    ["approved_at", "Approved at"],
    ["champion_url", "Current champion URL"],
    ["public_surface", "Small-traffic surface"],
    ["rollback_url", "Rollback URL"],
  ],
  github_repo_branch_pr: [
    ["approved_by", "Owner alias"],
    ["approved_at", "Approved at"],
    ["repo_url", "GitHub repo URL"],
    ["branch_name", "Safe branch name"],
  ],
};

async function main() {
  const generatedAt = new Date();
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });

  const launchReadiness = JSON.parse(await readFile(LAUNCH_READINESS_PATH, "utf8"));
  const approvalStatus = await readOptionalJson(APPROVAL_STATUS_PATH, {});
  const ownerInputExists = await exists(OWNER_INPUT_PATH);
  const approvalGates = (launchReadiness.owner_gates ?? [])
    .filter((gate) => Object.hasOwn(APPROVAL_FIELDS, gate.id))
    .map((gate) => ({
      id: gate.id,
      display_label: gate.display_label ?? gate.id,
      operation_mode: gate.operation_mode ?? null,
      resource_create_required: Boolean(gate.resource_create_required),
      current_blocker: gate.current_blocker ?? null,
      owner_action: gate.owner_action ?? null,
      approval_id: gate.approval_id,
      risk_tier: gate.risk_tier,
      status: gate.status,
      prepared_artifact: gate.prepared_artifact,
      approval_defaults: gate.approval_defaults ?? {},
      fields: APPROVAL_FIELDS[gate.id].map(([name, label]) => ({ name, label })),
    }));
  const excludedManualGates = (launchReadiness.owner_gates ?? [])
    .filter((gate) => !Object.hasOwn(APPROVAL_FIELDS, gate.id))
    .map((gate) => gate.id);

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_approval_form",
    status: ownerInputExists
      ? "owner_approval_input_detected_review_before_overwrite"
      : "ready_local_owner_approval_form",
    form_path: HTML_PATH,
    status_path: STATUS_PATH,
    owner_input_path: OWNER_INPUT_PATH,
    owner_input_exists: ownerInputExists,
    approval_resume_status: approvalStatus.status ?? "unknown",
    launch_readiness_status: launchReadiness.status ?? "unknown",
    form_gate_count: approvalGates.length,
    excluded_manual_gate_count: excludedManualGates.length,
    excluded_manual_gates: excludedManualGates,
    required_owner_fields: Object.fromEntries(Object.entries(APPROVAL_FIELDS).map(([gateId, fields]) => [gateId, fields.map(([name]) => name)])),
    download_filename: "owner_approval_input.json",
    review_download_filename: "owner_approval_form.review.json",
    browser_only: true,
    browser_persistence: false,
    form_action: "none",
    network_calls_performed: false,
    live_input_files_created: false,
    approval_input_write_performed: false,
    ...RED_LINE_FLAGS,
    note: "Local browser-only owner approval metadata form. It downloads JSON only and performs no network calls, remote D1, deploy, GitHub, public link, post, LINE, payment, customer-data, or deletion action.",
  };

  await writeFile(HTML_PATH, renderHtml({ generatedAt, approvalGates, status }));
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
    owner_input_path: status.owner_input_path,
    owner_input_exists: status.owner_input_exists,
    approval_resume_status: status.approval_resume_status,
    launch_readiness_status: status.launch_readiness_status,
    form_gate_count: status.form_gate_count,
    excluded_manual_gate_count: status.excluded_manual_gate_count,
    excluded_manual_gates: status.excluded_manual_gates,
    required_owner_fields: status.required_owner_fields,
    download_filename: status.download_filename,
    review_download_filename: status.review_download_filename,
    browser_only: status.browser_only,
    browser_persistence: status.browser_persistence,
    form_action: status.form_action,
    network_calls_performed: status.network_calls_performed,
    live_input_files_created: status.live_input_files_created,
    approval_input_write_performed: status.approval_input_write_performed,
    ...RED_LINE_FLAGS,
  };
}

function renderHtml({ generatedAt, approvalGates, status }) {
  const safeStatus = JSON.stringify(compactStatus(status)).replaceAll("<", "\\u003c");
  const safeGates = JSON.stringify(approvalGates).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="zh-Hant-TW" data-external-effect="false" data-network="none">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>3Q Growth Loop Owner Approval Form</title>
  <style>
    :root {
      --ink: #18221d;
      --muted: #66736d;
      --line: #d9dfd9;
      --paper: #f7f8f4;
      --panel: #fff;
      --panel2: #eef2ec;
      --green: #2f6d52;
      --red: #8b2e2e;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body { margin: 0; min-width: 320px; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.1; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 380px); gap: 16px; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
    .panel { border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; margin-bottom: 14px; }
    .panel header { background: var(--panel2); border-bottom: 1px solid var(--line); padding: 12px 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .panel h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
    .body { padding: 14px; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .value { display: block; font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label.field { display: grid; gap: 6px; }
    input[type="text"], input[type="datetime-local"], textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px 9px;
      font: 13px var(--sans);
      background: #fff;
    }
    textarea { min-height: 74px; resize: vertical; }
    .check { display: flex; gap: 8px; align-items: center; margin: 10px 0; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; }
    button { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 6px; padding: 9px 11px; font: 600 13px var(--sans); cursor: pointer; }
    button.primary { background: var(--green); color: #fff; border-color: var(--green); }
    .status { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 10px; font: 12px/1.45 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; min-height: 54px; }
    .bad { color: var(--red); }
    code { font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      .shell { padding: 16px; }
      .top, .grid, .facts { grid-template-columns: 1fr; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div>
        <h1>Owner Approval Metadata</h1>
        <p>只整理非敏感 approval metadata。這不是執行按鈕，不會部署、不會建立 D1、不會 push GitHub、不會改公開連結。</p>
      </div>
      <section class="panel">
        <header><h2>Safety</h2><span class="value">download only</span></header>
        <div class="body facts">
          <div><span class="label">Generated</span><span class="value">${generatedAt.toISOString()}</span></div>
          <div><span class="label">Input exists</span><span class="value">${status.owner_input_exists ? "yes" : "no"}</span></div>
          <div><span class="label">Gates</span><span class="value">${status.form_gate_count}</span></div>
          <div><span class="label">Network</span><span class="value">none</span></div>
        </div>
      </section>
    </section>

    <form id="approval-form" action="none" autocomplete="off">
      <div id="gate-panels"></div>
      <section class="panel">
        <header><h2>Confirmations</h2><span class="value">required</span></header>
        <div class="body">
          <label class="check"><input name="owner_reviewed" type="checkbox"> <span>我確認這只是 metadata 準備，不代表自動執行任何外部 gate。</span></label>
          <label class="check"><input name="no_secrets" type="checkbox"> <span>我確認沒有填入 API key、token、password、cookie、客戶資料、付款或對話內容。</span></label>
          <label class="check"><input name="separate_execution_required" type="checkbox"> <span>我了解每個外部 gate 仍要在獨立回合明確拍板。</span></label>
          <div class="toolbar">
            <button class="primary" type="button" id="download">Download Owner Approval JSON</button>
            <button type="button" id="review">Download Review JSON</button>
          </div>
          <pre class="status" id="status">Ready.</pre>
        </div>
      </section>
    </form>
  </main>
  <script id="form-status" type="application/json">${safeStatus}</script>
  <script id="gate-data" type="application/json">${safeGates}</script>
  <script>
    const formStatus = JSON.parse(document.getElementById("form-status").textContent);
    const gates = JSON.parse(document.getElementById("gate-data").textContent);
    const form = document.getElementById("approval-form");
    const gatePanels = document.getElementById("gate-panels");
    const statusEl = document.getElementById("status");
    const sensitivePattern = /token|secret|password|passwd|cookie|session|authorization|bearer|api[_-]?key|private[_-]?key|client[_-]?secret|line_user_id|customer_name|phone|email|payment|card|chat|conversation|電話|手機|信箱|客戶|付款|訂單|對話/i;

    function fieldInput(gate, field) {
      const isTime = field.name === "approved_at";
      const isLong = field.name === "rollback_plan";
      const name = gate.id + "__" + field.name;
      const defaultValue = gate.approval_defaults && gate.approval_defaults[field.name] ? gate.approval_defaults[field.name] : "";
      if (isLong) {
        return '<label class="field"><span class="label">' + field.label + '</span><textarea name="' + name + '" placeholder="Use non-secret rollback reference only."></textarea></label>';
      }
      return '<label class="field"><span class="label">' + field.label + '</span><input name="' + name + '" type="' + (isTime ? "datetime-local" : "text") + '" value="' + escapeAttribute(defaultValue) + '"></label>';
    }

    function escapeAttribute(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
    }

    function renderGates() {
      gatePanels.innerHTML = gates.map((gate) => {
        return '<section class="panel" data-gate-id="' + gate.id + '">'
          + '<header><h2>' + escapeAttribute(gate.display_label || gate.id) + '</h2><span class="value">' + gate.risk_tier + '</span></header>'
          + '<div class="body">'
          + '<label class="check"><input name="' + gate.id + '__enabled" type="checkbox"> <span>Include this gate metadata</span></label>'
          + '<div class="facts">'
          + '<div><span class="label">Gate ID</span><span class="value">' + escapeAttribute(gate.id) + '</span></div>'
          + '<div><span class="label">Operation</span><span class="value">' + escapeAttribute(gate.operation_mode || 'n/a') + '</span></div>'
          + '<div><span class="label">Create resource</span><span class="value">' + (gate.resource_create_required ? 'required' : 'no') + '</span></div>'
          + '<div><span class="label">Blocker</span><span class="value">' + escapeAttribute(gate.current_blocker || 'n/a') + '</span></div>'
          + '</div>'
          + '<div class="grid">' + gate.fields.map((field) => fieldInput(gate, field)).join("") + '</div>'
          + '<p style="margin-top:10px;">Owner action: ' + escapeAttribute(gate.owner_action || 'Review this gate manually.') + '</p>'
          + '<p style="margin-top:10px;">Prepared artifact: <code>' + gate.prepared_artifact + '</code></p>'
          + '</div></section>';
      }).join("");
    }

    function normalizeDateTime(value) {
      if (!value) return "";
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? value : parsed.toISOString();
    }

    function collect() {
      const approvals = [];
      const issues = [];
      for (const gate of gates) {
        if (!form.elements[gate.id + "__enabled"].checked) continue;
        const row = { gate_id: gate.id };
        for (const field of gate.fields) {
          const element = form.elements[gate.id + "__" + field.name];
          const value = (element.value || "").trim();
          row[field.name] = field.name === "approved_at" ? normalizeDateTime(value) : value;
          if (!value) issues.push(gate.id + "." + field.name + " is required.");
          if (sensitivePattern.test(field.name) || sensitivePattern.test(value)) {
            issues.push(gate.id + "." + field.name + " looks sensitive.");
          }
        }
        approvals.push(row);
      }
      if (approvals.length === 0) issues.push("Choose at least one owner-approved gate.");
      if (!form.elements.owner_reviewed.checked) issues.push("Owner review confirmation is required.");
      if (!form.elements.no_secrets.checked) issues.push("No-secrets confirmation is required.");
      if (!form.elements.separate_execution_required.checked) issues.push("Separate execution confirmation is required.");

      return {
        generated_at: new Date().toISOString(),
        mode: "owner_approval_form_export",
        purpose: "Owner-reviewed non-secret approval metadata only. External gate execution remains separate.",
        approvals,
        confirmations: {
          owner_reviewed: form.elements.owner_reviewed.checked,
          no_secrets: form.elements.no_secrets.checked,
          separate_execution_required: form.elements.separate_execution_required.checked,
        },
        form_status: formStatus,
        issues,
      };
    }

    function download(filename, payload) {
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function handleDownload(filename, allowIssues) {
      const payload = collect();
      statusEl.textContent = JSON.stringify({ issues: payload.issues, approvals: payload.approvals.map((row) => row.gate_id) }, null, 2);
      statusEl.className = payload.issues.length ? "status bad" : "status";
      if (payload.issues.length && !allowIssues) return;
      download(filename, payload);
    }

    renderGates();
    document.getElementById("download").addEventListener("click", () => handleDownload(formStatus.download_filename, false));
    document.getElementById("review").addEventListener("click", () => handleDownload(formStatus.review_download_filename, true));
  </script>
</body>
</html>
`;
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
