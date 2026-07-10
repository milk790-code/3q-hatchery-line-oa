import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PACKET_PATH = path.join(ROOT, "manual_publish_packet.json");
const EVIDENCE_STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_status.json");
const OWNER_INPUT_PATH = path.join(ROOT, "manual_publish_evidence.json");
const HTML_PATH = path.join(ROOT, "manual_publish_evidence_form.html");
const STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_form_status.json");

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

const REQUIRED_OWNER_FIELDS = [
  "packet_id",
  "published_at",
  "surface",
  "post_ref",
  "reviewer",
  "manual_publish_confirmed",
  "pii_checked",
  "published_packet_only",
];

async function main() {
  const generatedAt = new Date();
  const packet = JSON.parse(await readFile(PACKET_PATH, "utf8"));
  const evidenceStatus = await readOptionalJson(EVIDENCE_STATUS_PATH, {});
  const ownerInputExists = await exists(OWNER_INPUT_PATH);

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_evidence_form",
    status: ownerInputExists
      ? "manual_publish_evidence_input_detected_review_before_overwrite"
      : "ready_local_manual_publish_evidence_form",
    form_path: HTML_PATH,
    status_path: STATUS_PATH,
    owner_input_path: OWNER_INPUT_PATH,
    owner_input_exists: ownerInputExists,
    evidence_status: evidenceStatus.status ?? "unknown",
    packet_count: packet.packet_count ?? (packet.packets ?? []).length,
    required_owner_fields: REQUIRED_OWNER_FIELDS,
    download_filename: "manual_publish_evidence.json",
    review_download_filename: "manual_publish_evidence_form.review.json",
    browser_only: true,
    browser_persistence: false,
    form_action: "none",
    network_calls_performed: false,
    post_url_fetch_performed: false,
    live_input_files_created: false,
    ...RED_LINE_FLAGS,
    note: "Local browser-only manual publish evidence form. It downloads JSON only and performs no network calls, URL fetch, event writes, deploy, post, LINE push, public-link change, customer-data mutation, payment action, GitHub action, or deletion.",
  };

  await writeFile(HTML_PATH, renderHtml({ generatedAt, packet, status }));
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
    evidence_status: status.evidence_status,
    packet_count: status.packet_count,
    required_owner_fields: status.required_owner_fields,
    download_filename: status.download_filename,
    review_download_filename: status.review_download_filename,
    browser_only: status.browser_only,
    browser_persistence: status.browser_persistence,
    form_action: status.form_action,
    network_calls_performed: status.network_calls_performed,
    post_url_fetch_performed: status.post_url_fetch_performed,
    live_input_files_created: status.live_input_files_created,
    ...RED_LINE_FLAGS,
  };
}

function renderHtml({ generatedAt, packet, status }) {
  const safeStatus = JSON.stringify(compactStatus(status)).replaceAll("<", "\\u003c");
  const safePackets = JSON.stringify((packet.packets ?? []).map((item) => ({
    packet_id: item.packet_id,
    content_id: item.content_id,
    variant_id: item.variant_id,
    cta_text: item.cta_text,
    surface: item.surface,
    tracking_url: item.tracking?.tracking_url ?? null,
  }))).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="zh-Hant-TW" data-external-effect="false" data-network="none">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>3Q Growth Loop Manual Publish Evidence Form</title>
  <style>
    :root {
      --ink: #17211b;
      --muted: #66736c;
      --line: #d9dfd9;
      --paper: #f7f8f4;
      --panel: #ffffff;
      --panel2: #eef2ec;
      --green: #2f6d52;
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
    .top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 380px); gap: 16px; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
    .panel { border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
    .panel header { background: var(--panel2); border-bottom: 1px solid var(--line); padding: 12px 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .panel h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
    .body { padding: 14px; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .value { display: block; font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label.field { display: grid; gap: 6px; }
    select, input[type="text"], input[type="datetime-local"], textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px 9px;
      font: 13px var(--sans);
      background: #fff;
    }
    textarea { min-height: 76px; resize: vertical; grid-column: 1 / -1; }
    .check { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; }
    button { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 6px; padding: 9px 11px; font: 600 13px var(--sans); cursor: pointer; }
    button.primary { background: var(--green); color: #fff; border-color: var(--green); }
    .status { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 10px; font: 12px/1.45 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; min-height: 54px; }
    .bad { color: var(--red); }
    .packet { margin-top: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
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
        <h1>Manual Publish Evidence</h1>
        <p>人工發文後，只填一筆非敏感證據。本表單只下載 JSON，不送出、不 fetch、不寫入真實事件。</p>
      </div>
      <section class="panel">
        <header><h2>Safety</h2><span class="value">local only</span></header>
        <div class="body facts">
          <div><span class="label">Generated</span><span class="value">${generatedAt.toISOString()}</span></div>
          <div><span class="label">Input exists</span><span class="value">${status.owner_input_exists ? "yes" : "no"}</span></div>
          <div><span class="label">Packets</span><span class="value">${status.packet_count}</span></div>
          <div><span class="label">Network</span><span class="value">none</span></div>
        </div>
      </section>
    </section>

    <section class="panel">
      <header><h2>Evidence Export</h2><span class="value">manual_publish_evidence.json</span></header>
      <div class="body">
        <form id="evidence-form" action="none" autocomplete="off">
          <div class="grid">
            <label class="field">
              <span class="label">Packet</span>
              <select name="packet_id" required></select>
            </label>
            <label class="field">
              <span class="label">Published At</span>
              <input name="published_at" type="datetime-local" required>
            </label>
            <label class="field">
              <span class="label">Surface</span>
              <input name="surface" type="text" value="Facebook Page manual post" required>
            </label>
            <label class="field">
              <span class="label">Reviewer</span>
              <input name="reviewer" type="text" value="Angelia" required>
            </label>
            <label class="field" style="grid-column: 1 / -1;">
              <span class="label">Post Ref</span>
              <textarea name="post_ref" required placeholder="貼公開貼文 URL 或本地截圖索引；不可貼客戶名稱、電話、Email、LINE ID、對話內容、訂單或付款資訊。"></textarea>
            </label>
          </div>
          <label class="check"><input name="manual_publish_confirmed" type="checkbox"> <span>我已人工發布，而且不是自動排程或自動送出。</span></label>
          <label class="check"><input name="pii_checked" type="checkbox"> <span>我確認沒有填入客戶個資、LINE ID、聊天內容、付款或訂單資料。</span></label>
          <label class="check"><input name="published_packet_only" type="checkbox"> <span>本次只發布一個 packet，沒有混用多個變體。</span></label>
          <div class="toolbar">
            <button class="primary" type="button" id="download">Download Evidence JSON</button>
            <button type="button" id="review">Download Review JSON</button>
          </div>
        </form>
        <div class="packet" id="packet-preview"></div>
        <pre class="status" id="status">Ready.</pre>
      </div>
    </section>
  </main>
  <script id="form-status" type="application/json">${safeStatus}</script>
  <script id="packet-data" type="application/json">${safePackets}</script>
  <script>
    const packets = JSON.parse(document.getElementById("packet-data").textContent);
    const formStatus = JSON.parse(document.getElementById("form-status").textContent);
    const form = document.getElementById("evidence-form");
    const packetSelect = form.elements.packet_id;
    const statusEl = document.getElementById("status");
    const preview = document.getElementById("packet-preview");
    const sensitivePattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|Bearer\\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+|line_user_id|phone=|email=|payment|credit card|customer_name|chat_text|電話|手機|信箱|地址|付款|訂單|對話/i;

    for (const packet of packets) {
      const option = document.createElement("option");
      option.value = packet.packet_id;
      option.textContent = packet.packet_id + " / " + packet.variant_id;
      packetSelect.appendChild(option);
    }

    function setDefaultDate() {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      form.elements.published_at.value = local;
    }

    function selectedPacket() {
      return packets.find((packet) => packet.packet_id === packetSelect.value) || packets[0] || {};
    }

    function updatePreview() {
      const packet = selectedPacket();
      preview.innerHTML = "<strong>" + escapeHtml(packet.cta_text || "n/a") + "</strong><br><code>" + escapeHtml(packet.content_id || "n/a") + " / " + escapeHtml(packet.variant_id || "n/a") + "</code><br><code>" + escapeHtml(packet.tracking_url || "missing") + "</code>";
    }

    function buildPayload() {
      const packet = selectedPacket();
      const publishedAt = form.elements.published_at.value ? new Date(form.elements.published_at.value).toISOString() : "";
      return {
        evidence: [
          {
            packet_id: packet.packet_id,
            published_at: publishedAt,
            surface: form.elements.surface.value.trim(),
            post_ref: form.elements.post_ref.value.trim(),
            reviewer: form.elements.reviewer.value.trim(),
            manual_publish_confirmed: form.elements.manual_publish_confirmed.checked,
            pii_checked: form.elements.pii_checked.checked,
            published_packet_only: form.elements.published_packet_only.checked
          }
        ]
      };
    }

    function validatePayload(payload) {
      const row = payload.evidence[0];
      const issues = [];
      for (const key of ["packet_id", "published_at", "surface", "post_ref", "reviewer"]) {
        if (!row[key]) issues.push(key + " is required.");
        if (typeof row[key] === "string" && sensitivePattern.test(row[key])) issues.push(key + " contains sensitive-looking text.");
      }
      for (const key of ["manual_publish_confirmed", "pii_checked", "published_packet_only"]) {
        if (row[key] !== true) issues.push(key + " must be checked.");
      }
      return issues;
    }

    function downloadJson(filename, payload) {
      const issues = validatePayload(payload);
      if (issues.length) {
        statusEl.innerHTML = "<span class='bad'>" + escapeHtml(issues.join("\\n")) + "</span>";
        return;
      }
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      statusEl.textContent = "Downloaded " + filename + ". Move it to the project root only after reviewing it.";
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    setDefaultDate();
    updatePreview();
    packetSelect.addEventListener("change", updatePreview);
    document.getElementById("download").addEventListener("click", () => downloadJson(formStatus.download_filename, buildPayload()));
    document.getElementById("review").addEventListener("click", () => downloadJson(formStatus.review_download_filename, { form_status: formStatus, payload: buildPayload() }));
  </script>
</body>
</html>
`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
