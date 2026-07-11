import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const METRICS_PATH = path.join(ROOT, "data", "cloudflare_3q_site_metrics_observation.json");
const STATUS_PATH = path.join(ROOT, "data", "champion_contract_audit_status.json");
const REPORT_PATH = path.join(ROOT, "champion_contract_audit.md");

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const metrics = await readOptionalJson(METRICS_PATH);
  const champion = (config.assets ?? []).find((asset) => asset.role === "champion");
  const championUrl = new URL(champion.landing_url);
  const healthUrl = new URL("/health", championUrl);
  const contactUrl = new URL("/contact", championUrl);

  const [health, landing, contact, line] = await Promise.all([
    fetchObservation(healthUrl, { json: true }),
    fetchObservation(championUrl),
    fetchObservation(contactUrl),
    fetchObservation(champion.line_url, { redirect: "manual" }),
  ]);

  const contactHtml = contact.body ?? "";
  const lineUrls = [...new Set(contactHtml.match(/https:\/\/lin\.ee\/[A-Za-z0-9]+/g) ?? [])];
  const lineLocation = line.headers?.location ?? null;
  const configuredLineId = extractLineBasicId(lineLocation);
  const formElementDetected = /<form(?:\s|>)/i.test(contactHtml);
  const formSubmitHandlerDetected = /onSubmit\s*=|action\s*=/i.test(contactHtml);
  const localSuccessOnlyDetected = /setSent\(true\)/.test(contactHtml);
  const lineOnlyContactDetected = /data-growth-contact-mode=["']line-only["']/.test(contactHtml);
  const leadCaptureTransportDetected = formElementDetected && formSubmitHandlerDetected;
  const misleadingSuccessStateDetected = localSuccessOnlyDetected && !leadCaptureTransportDetected;
  const liveReadOk = [health, landing, contact, line].every((item) => item.ok);

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "champion_contract_audit_read_only",
    status: !liveReadOk
      ? "live_observation_incomplete"
      : misleadingSuccessStateDetected
        ? "prepared_but_blocked_champion_form_transport_missing"
        : lineOnlyContactDetected
          ? "champion_line_only_contract_observed"
          : "champion_contract_observed",
    champion: {
      asset_id: champion.asset_id,
      url: championUrl.toString(),
      configured_line_url: champion.line_url,
      configured_line_basic_id: configuredLineId,
      status: champion.status,
    },
    observations: {
      health,
      landing: summarizeResponse(landing),
      contact: summarizeResponse(contact),
      line_redirect: summarizeResponse(line),
      live_contact_line_urls: lineUrls,
      form_element_detected: formElementDetected,
      form_submit_handler_detected: formSubmitHandlerDetected,
      local_success_only_detected: localSuccessOnlyDetected,
      line_only_contact_detected: lineOnlyContactDetected,
      lead_capture_transport_detected: leadCaptureTransportDetected,
      misleading_success_state_detected: misleadingSuccessStateDetected,
    },
    cloudflare_metrics: metrics,
    scoring_policy: {
      worker_invocations_scoring_eligible: false,
      champion_form_submission_scoring_eligible: false,
      reason: misleadingSuccessStateDetected
        ? "Invocations are not visits, and the observed contact success state has no submission transport."
        : lineOnlyContactDetected
          ? "Invocations are not visits, and the observed LINE-only contact page has no in-page lead submission."
          : "Invocations are not visits, and no validated in-page lead submission contract was observed.",
    },
    prepared_but_blocked: misleadingSuccessStateDetected
      ? {
          action: "repair_or_remove_champion_contact_form_false_success",
          blocked_by: "Changing the live 3q-site Worker requires owner approval and a production deploy.",
          prepared_artifact: "champion_contract_audit.md",
          resume_when: "Owner approves a no-PII LINE-only CTA repair or an explicitly designed aggregate-safe lead transport.",
        }
      : null,
    live_read_ok: liveReadOk,
    data_lp_events_write_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
}

async function fetchObservation(input, options = {}) {
  try {
    const response = await fetch(input, {
      redirect: options.redirect ?? "follow",
      signal: AbortSignal.timeout(15000),
    });
    const body = options.json ? await response.json() : await response.text();
    return {
      ok: response.ok || (options.redirect === "manual" && response.status >= 300 && response.status < 400),
      status: response.status,
      url: response.url,
      headers: { location: response.headers.get("location") },
      body,
    };
  } catch (error) {
    return { ok: false, status: null, url: String(input), headers: {}, body: null, error: String(error) };
  }
}

function summarizeResponse(observation) {
  return {
    ok: observation.ok,
    status: observation.status,
    url: observation.url,
    location: observation.headers?.location ?? null,
    error: observation.error ?? null,
  };
}

function extractLineBasicId(location) {
  if (!location) return null;
  const match = location.match(/\/(@[^?/#]+)/);
  return match?.[1] ?? null;
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function renderReport(status) {
  const metrics = status.cloudflare_metrics?.metrics ?? {};
  const bluf = status.observations.misleading_success_state_detected
    ? "The live champion URL and LINE destination are verified read-only, but the contact page shows a success state without submission transport. It remains blocked from lead scoring."
    : status.observations.line_only_contact_detected
      ? "The live champion URL and LINE destination are verified read-only. The contact page is LINE-only, with no local false-success state or in-page lead transport; browser UI remains ineligible for lead scoring."
      : "The live champion URL and LINE destination are verified read-only. No validated in-page lead transport was observed, so browser UI remains ineligible for lead scoring.";
  return `# 3Q Champion Contract Audit

BLUF: ${bluf}

Generated: ${status.generated_at}
Status: ${status.status}
External effect: no

## Verified Live Contract

- Champion: ${status.champion.url}
- LINE URL: ${status.champion.configured_line_url}
- LINE Basic ID: ${status.champion.configured_line_basic_id ?? "unresolved"}
- Health: ${status.observations.health.status ?? "unavailable"}
- Contact page: ${status.observations.contact.status ?? "unavailable"}
- Contact LINE links: ${status.observations.live_contact_line_urls.join(", ") || "none"}

## Conversion Integrity

- Form element detected: ${status.observations.form_element_detected ? "yes" : "no"}
- Submit transport detected: ${status.observations.lead_capture_transport_detected ? "yes" : "no"}
- Local-only success state detected: ${status.observations.local_success_only_detected ? "yes" : "no"}
- LINE-only contact detected: ${status.observations.line_only_contact_detected ? "yes" : "no"}
- Safe to count form success as lead: no

## Diagnostic Traffic

- Past 24h Worker invocations: ${metrics.past_24_hours?.invocations ?? "unavailable"}
- Selected past 7d Worker invocations: ${metrics.selected_past_7_days?.invocations ?? "unavailable"}
- Scoring eligible: no; Worker invocations are not landing-page visits.

## PreparedButBlocked

${status.prepared_but_blocked ? `- Action: ${status.prepared_but_blocked.action}\n- Blocked by: ${status.prepared_but_blocked.blocked_by}\n- Resume when: ${status.prepared_but_blocked.resume_when}` : "- None."}

No form was submitted, no customer data was read or changed, and no public URL or production Worker was modified.
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
