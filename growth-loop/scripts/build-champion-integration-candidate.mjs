import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { inspectChampionSourceLock } from "./lib/champion-source-lock.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "integrations", "3q-site", "champion-integration.config.json");
const STATUS_PATH = path.join(ROOT, "data", "champion_integration_candidate_status.json");
const REPORT_PATH = path.join(ROOT, "champion_integration_candidate.md");

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const repoPath = argument("--repo") ?? process.env.THREE_Q_SITE_REPO ?? config.source_repo_path;
  const ref = argument("--ref") ?? config.source_ref;
  const sourceResult = await inspectChampionSourceLock({ config, repoPath, ref, root: ROOT });
  const {
    source,
    observedRefCommit,
    sourceMode,
    lockCommitIsAncestor,
    ancestryVerified,
    expectedTupleVerified,
    refFileMatchesLock,
    blobSha,
    sourceSha256,
  } = sourceResult;
  const commit = config.expected_commit;

  assert(sourceResult.releaseReady, sourceResult.failureReason ?? "Source lock is not release-ready.");

  const sourceSnapshotPath = path.join(ROOT, config.source_snapshot);
  if (sourceMode === "git_ref_pinned") {
    await mkdir(path.dirname(sourceSnapshotPath), { recursive: true });
    await writeFile(sourceSnapshotPath, source);
  }

  const candidate = transformWorker(source, config);
  const generatedWorkerPath = path.join(ROOT, config.generated_worker);
  const generatedPatchPath = path.join(ROOT, config.generated_patch);
  await mkdir(path.dirname(generatedWorkerPath), { recursive: true });
  await writeFile(generatedWorkerPath, candidate);

  const tempDir = await mkdtemp(path.join(tmpdir(), "3q-site-growth-loop-candidate-"));
  const basePath = path.join(tempDir, "worker.base.js");
  await writeFile(basePath, source);
  const patch = await unifiedDiff(basePath, generatedWorkerPath, config.source_path);
  await writeFile(generatedPatchPath, patch);

  const syntax = await command(process.execPath, ["--check", generatedWorkerPath], ROOT);
  const wranglerBin = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  const dryRun = await command(wranglerBin, ["deploy", "--dry-run", "--config", "integrations/3q-site/wrangler.jsonc"], ROOT);
  const checks = inspectCandidate(candidate, config);
  const ok = syntax.code === 0 && dryRun.code === 0 && Object.values(checks).every(Boolean);
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "champion_integration_candidate_local_only",
    source: {
      repository: config.source_repository,
      repo_path: repoPath,
      ref,
      mode: sourceMode,
      commit,
      observed_ref_commit: observedRefCommit,
      ref_advanced: observedRefCommit !== commit,
      lock_commit_is_ancestor: lockCommitIsAncestor,
      ancestry_verified: ancestryVerified,
      expected_lock_tuple_verified: expectedTupleVerified,
      ref_file_matches_lock: refFileMatchesLock,
      path: config.source_path,
      snapshot_path: config.source_snapshot,
      snapshot_refreshed: sourceMode === "git_ref_pinned",
      blob_sha: blobSha,
      sha256: sourceSha256,
      exact_source_lock_verified: sourceResult.releaseReady
    },
    outputs: {
      worker: config.generated_worker,
      patch: config.generated_patch,
      source_snapshot: config.source_snapshot,
      report: "champion_integration_candidate.md",
      status: "data/champion_integration_candidate_status.json"
    },
    checks,
    syntax_check: { ok: syntax.code === 0, exit_code: syntax.code },
    worker_dry_run: {
      ok: dryRun.code === 0 && dryRun.output.includes("--dry-run: exiting now."),
      exit_code: dryRun.code,
      total_upload_line: dryRun.output.split(/\r?\n/).find((line) => line.startsWith("Total Upload:")) ?? null
    },
    privacy_contract: {
      payload_keys: ["asset_id", "variant_id", "content_id", "session_id", "source", "medium", "campaign", "event_type", "url", "metadata_json"],
      customer_fields_collected: false,
      credentials_sent: false,
      line_add_inferred_from_click: false,
      note: "LINE CTA clicks are cta_click only. line_add, lead_submit, and deal require reviewed downstream evidence."
    },
    owner_gate: {
      status: "prepared_but_blocked_production_deploy",
      required: ["review generated patch", "set collector URL", "run local integration smoke", "approve production deploy and rollback"]
    },
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!ok) process.exitCode = 1;
}

function transformWorker(source, config) {
  const alreadyIntegrated = source.includes("growth-loop-telemetry-v2")
    && source.includes("data-growth-loop-telemetry")
    && source.includes("data-growth-contact-mode=\"line-only\"")
    && source.includes("'/growth-loop/status'");
  if (alreadyIntegrated) {
    return source;
  }

  const contactStart = source.indexOf('  "/contact.html":');
  const contactEnd = source.indexOf('  "/assess.html":', contactStart);
  assert(contactStart >= 0 && contactEnd > contactStart, "Contact page segment not found.");
  let contact = source.slice(contactStart, contactEnd);

  const inputStart = contact.indexOf("const inputStyle = {");
  const appStart = contact.indexOf("function App() {", inputStart);
  assert(inputStart >= 0 && appStart > inputStart, "Contact input helpers not found.");
  contact = `${contact.slice(0, inputStart)}${contact.slice(appStart)}`;
  contact = replaceExact(contact, "  const [sent, setSent] = React.useState(false);\n", "");
  contact = replaceExact(
    contact,
    "                留下基本資料，我們先比對好你的條件再開始談——不浪費你的半小時。",
    "                為避免網頁保存個資，預約改由你主動開啟 LINE，再由客服接手。"
  );

  const formStart = contact.indexOf("              {sent ? (");
  const formEnd = contact.indexOf("            </div>\n          </Reveal>\n\n          {/* For investors / partners */}", formStart);
  assert(formStart >= 0 && formEnd > formStart, "False-success contact block not found.");
  const lineOnly = `              <div data-growth-contact-mode="line-only" style={{
                display: 'flex', flexDirection: 'column', gap: 16,
                padding: '28px 22px', background: 'var(--cream)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
              }}>
                <div className="h3" style={{ fontSize: 18, color: 'var(--lavd)' }}>改用 LINE 完成預約</div>
                <p className="caption">本站不在網頁收集姓名、電話、Email 或 LINE ID，也不顯示未送出的成功訊息。</p>
                <Button variant="primary" href="${config.line_url}" target="_blank">加 LINE 預約免費補助健檢 →</Button>
                <div className="caption">本頁僅自動送出不含姓名、電話、Email、LINE ID 的匿名瀏覽與 CTA 成效事件；LINE 訊息仍由你主動送出。</div>
              </div>
`;
  contact = `${contact.slice(0, formStart)}${lineOnly}${contact.slice(formEnd)}`;

  let candidate = `${source.slice(0, contactStart)}${contact}${source.slice(contactEnd)}`;
  const exportAnchor = "\nexport default {\n  async fetch(request) {";
  assert(candidate.includes(exportAnchor), "Worker fetch anchor not found.");
  candidate = candidate.replace(exportAnchor, `${telemetryHelper(config)}\nexport default {\n  async fetch(request, env) {`);
  candidate = replaceExact(
    candidate,
    "    const url = new URL(request.url);\n",
    "    const url = new URL(request.url);\n    if (url.pathname === '/growth-loop/status') { const collector = resolveGrowthLoopCollector(env); return new Response(JSON.stringify({ok:true,mode:'champion_integration_candidate',build:'growth-loop-telemetry-v2',collector_configured:Boolean(collector),collector_origin:collector || null,collector_url_matches_expected:Boolean(collector),external_effects:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}); }\n"
  );
  candidate = replaceExact(
    candidate,
    "    if (url.pathname === '/health') return new Response(JSON.stringify({ok:true,worker:'3q-site',ver:'v1.2',pages:Object.keys(FILES).filter(k=>k.endsWith('.html')).length}),{headers:{'Content-Type':'application/json'}});",
    "    if (url.pathname === '/health') return new Response(JSON.stringify({ok:true,worker:'3q-site',ver:'v1.2',build:'growth-loop-telemetry-v2',pages:Object.keys(FILES).filter(k=>k.endsWith('.html')).length}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});"
  );
  candidate = replaceExact(
    candidate,
    "    return new Response(f.body, { headers: { 'Content-Type': f.ct, 'Cache-Control': 'public, max-age=300' } });",
    "    const body = f.ct.startsWith('text/html') ? injectGrowthLoopTelemetry(f.body, env) : f.body;\n    const cacheControl = f.ct.startsWith('text/html') ? 'no-store' : 'public, max-age=300';\n    return new Response(body, { headers: { 'Content-Type': f.ct, 'Cache-Control': cacheControl } });"
  );
  return candidate;
}

function telemetryHelper(config) {
  const expectedCollectorUrl = new URL(config.collector_public_url);
  assert(
    expectedCollectorUrl.protocol === "https:"
      && !expectedCollectorUrl.username
      && !expectedCollectorUrl.password
      && expectedCollectorUrl.pathname === "/"
      && !expectedCollectorUrl.search
      && !expectedCollectorUrl.hash,
    "Collector public URL must be an HTTPS origin without credentials, path, query, or fragment."
  );
  const expectedCollectorLiteral = JSON.stringify(config.collector_public_url);
  return `
function resolveGrowthLoopCollector(env) {
  const expectedCollector = ${expectedCollectorLiteral};
  const configuredCollector = String(env.${config.collector_env} || '');
  return configuredCollector === expectedCollector ? expectedCollector : '';
}

function injectGrowthLoopTelemetry(body, env) {
  const collector = resolveGrowthLoopCollector(env);
  if (!collector || !body.includes('</body>')) return body;
  const collectorLiteral = JSON.stringify(collector).replaceAll('<', '\\\\u003c');
  const script = \`<script data-growth-loop-telemetry>
(() => {
  const collector = \${collectorLiteral};
  const params = new URLSearchParams(location.search);
  const storageKey = '3q_growth_loop_attribution_v1';
  const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,79}$/;
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const emailLikePattern = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+[.][A-Z]{2,}/i;
  const phoneLikePattern = /[+]?[0-9][0-9 ._~:()-]{5,23}[0-9]/g;
  const containsPiiLike = (value) => {
    const candidates = [value];
    let decoded = value;
    for (let index = 0; index < 2; index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        candidates.push(next);
        decoded = next;
      } catch { break; }
    }
    return candidates.some((candidate) => {
      const phoneCandidates = candidate.match(phoneLikePattern) || [];
      const containsPhoneLike = phoneCandidates.some((phoneCandidate) => {
        const digitCount = phoneCandidate.replace(/[^0-9]/g, '').length;
        const hasPhoneSeparator = /[+ ._~:()-]/.test(phoneCandidate);
        return digitCount >= 7 && digitCount <= 15 && (hasPhoneSeparator || digitCount >= 10);
      });
      return emailLikePattern.test(candidate) || containsPhoneLike;
    });
  };
  const safeToken = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return tokenPattern.test(normalized) && !containsPiiLike(normalized) ? normalized : null;
  };
  const safeSessionId = (value) => typeof value === 'string' && uuidV4Pattern.test(value.trim()) ? value.trim().toLowerCase() : null;
  let stored = {};
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    if (parsed && typeof parsed === 'object') stored = parsed;
  } catch {}
  const fromUrl = {
    session_id: safeSessionId(params.get('sid')),
    variant_id: safeToken(params.get('variant_id')),
    content_id: safeToken(params.get('content_id')),
    source: safeToken(params.get('utm_source')),
    medium: safeToken(params.get('utm_medium')),
    campaign: safeToken(params.get('utm_campaign'))
  };
  const attribution = {
    session_id: fromUrl.session_id || safeSessionId(stored.session_id)
  };
  for (const key of ['variant_id', 'content_id', 'source', 'medium', 'campaign']) {
    attribution[key] = fromUrl[key] || safeToken(stored[key]);
  }
  if (!attribution.session_id) {
    if (typeof crypto.randomUUID !== 'function') return;
    attribution.session_id = crypto.randomUUID();
  }
  attribution.source ||= '3q_site';
  attribution.medium ||= 'champion_page';
  try { sessionStorage.setItem(storageKey, JSON.stringify(attribution)); } catch {}
  const send = (eventType) => {
    const payload = {
      asset_id: '${config.champion_asset_id}',
      variant_id: attribution.variant_id,
      content_id: attribution.content_id,
      session_id: attribution.session_id,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      event_type: eventType,
      url: location.origin + location.pathname,
      metadata_json: { integration: '3q_site_champion_v1', page: location.pathname }
    };
    fetch(collector + '/e', {
      method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    }).catch(() => {});
  };
  send('page_view');
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target && typeof target.closest === 'function' ? target.closest('a[href^="https://lin.ee/"]') : null;
    if (link) send('cta_click');
  }, { capture: true });
})();
</script>\`;
  return body.replace('</body>', script + '</body>');
}
`;
}

function inspectCandidate(candidate, config) {
  const contactStart = candidate.indexOf('  "/contact.html":');
  const contactEnd = candidate.indexOf('  "/assess.html":', contactStart);
  const contact = candidate.slice(contactStart, contactEnd);
  return {
    false_success_state_removed: !contact.includes("setSent(true)") && !contact.includes("const [sent"),
    personal_input_controls_removed: !contact.includes("<Field ") && !contact.includes("const inputStyle"),
    line_only_contact_mode_present: contact.includes('data-growth-contact-mode="line-only"'),
    configured_line_url_present: contact.includes(config.line_url),
    telemetry_disclosure_accurate: contact.includes("匿名瀏覽與 CTA 成效事件") && !contact.includes("本頁不會自動送出任何資料"),
    telemetry_injection_present: candidate.includes("data-growth-loop-telemetry") && candidate.includes("send('page_view')") && candidate.includes("send('cta_click')"),
    attribution_persisted_across_pages: candidate.includes("3q_growth_loop_attribution_v1") && candidate.includes("JSON.stringify(attribution)"),
    client_tokens_sanitized: candidate.includes("const safeToken = (value)") && candidate.includes("containsPiiLike"),
    embedded_pii_rejected: candidate.includes("phoneLikePattern") && candidate.includes("emailLikePattern"),
    session_uuid_only: candidate.includes("const safeSessionId = (value)") && candidate.includes("uuidV4Pattern"),
    cryptographic_session_only: candidate.includes("typeof crypto.randomUUID !== 'function'") && !candidate.includes("Math.random()"),
    collector_binding_exact: candidate.includes("configuredCollector === expectedCollector"),
    collector_literal_script_safe: candidate.includes("replaceAll('<', '\\\\u003c')"),
    collector_env_present: candidate.includes(`env.${config.collector_env}`),
    credentials_omitted: candidate.includes("credentials: 'omit'"),
    line_add_not_inferred: !candidate.includes("send('line_add')"),
    local_status_endpoint_present: candidate.includes("/growth-loop/status") && candidate.includes("collector_origin") && candidate.includes("collector_url_matches_expected"),
    build_marker_present: candidate.includes("growth-loop-telemetry-v2"),
    html_cache_disabled: candidate.includes("f.ct.startsWith('text/html') ? 'no-store'")
  };
}

function renderReport(status) {
  const checkRows = Object.entries(status.checks).map(([id, ok]) => `| ${id} | ${ok ? "pass" : "fail"} |`).join("\n");
  return `# 3Q Site Champion Integration Candidate

BLUF: Local candidate is ${status.ok ? "ready for owner review" : "not ready"}. It removes the false-success contact form, uses a LINE-only contact path, and prepares privacy-safe page_view / cta_click telemetry. Nothing was deployed or pushed.

Generated: ${status.generated_at}
Source commit: ${status.source.commit}
Observed ref commit: ${status.source.observed_ref_commit}
Ref advanced without target-file drift: ${status.source.ref_advanced && status.source.ref_file_matches_lock ? "yes" : "no"}
Source blob: ${status.source.blob_sha}
Source mode: ${status.source.mode}
Source snapshot: ${status.source.snapshot_path}
Exact source lock: ${status.source.exact_source_lock_verified ? "yes" : "no"}
Worker dry run: ${status.worker_dry_run.ok ? "pass" : "fail"}

## Checks

| check | result |
|---|---|
${checkRows}

## Privacy Contract

- Customer fields collected: no
- Credentials sent: no
- LINE add inferred from click: no
- Events: page_view and cta_click only
- Downstream line_add / lead / deal: reviewed evidence required

## Human Gate

- Review patch: ${status.outputs.patch}
- Review candidate: ${status.outputs.worker}
- Configure the deployed collector URL only after approval.
- Production deploy, public link changes, GitHub push/PR, and LINE sends remain blocked.
`;
}

async function unifiedDiff(basePath, candidatePath, sourcePath) {
  const result = await command("diff", ["-u", "--label", `a/${sourcePath}`, "--label", `b/${sourcePath}`, basePath, candidatePath], ROOT);
  if (result.code === 0) {
    return `# No source diff: Growth Loop integration is already present in locked source ${sourcePath}.\n`;
  }
  assert(result.code === 1 && result.output.trim(), `Unexpected diff exit code: ${result.code}`);
  return result.output;
}

async function command(bin, args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, { cwd, maxBuffer: 10_000_000 });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function replaceExact(value, before, after) {
  const count = value.split(before).length - 1;
  assert(count === 1, `Expected one exact replacement, found ${count}.`);
  return value.replace(before, after);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "champion_integration_candidate_local_only",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(failed, null, 2)}\n`);
  await writeFile(REPORT_PATH, `# 3Q Site Champion Integration Candidate\n\nBLUF: FAILED. No candidate is release-ready and no external action was performed.\n\n- Generated: ${failed.generated_at}\n- Error: ${failed.error}\n- Production deploy performed: no\n- GitHub push or PR performed: no\n`);
  console.error(error);
  process.exitCode = 1;
});
