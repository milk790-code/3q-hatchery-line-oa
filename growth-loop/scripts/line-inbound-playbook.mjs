import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const PLAYBOOK_JSON_PATH = path.join(ROOT, "line_inbound_playbook.json");
const PLAYBOOK_MD_PATH = path.join(ROOT, "line_inbound_playbook.md");
const STATUS_PATH = path.join(ROOT, "data", "line_inbound_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "line_inbound_fixture_report.md");

const ALLOWED_COLUMNS = [
  "date",
  "asset_id",
  "event_type",
  "count",
  "source",
  "medium",
  "campaign",
  "content_id",
  "variant_id",
  "quality_score",
];

const ALLOWED_EVENT_TYPES = ["line_add", "lead_submit", "deal", "quality_flag"];
const SENSITIVE_FIELD_PATTERNS = [
  /phone/i,
  /tel/i,
  /mobile/i,
  /email/i,
  /mail/i,
  /line[_-]?user[_-]?id/i,
  /line[_-]?id/i,
  /customer/i,
  /customer[_-]?name/i,
  /name/i,
  /address/i,
  /payment/i,
  /card/i,
  /note/i,
  /memo/i,
  /message/i,
  /conversation/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/,
  /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{3,4}\b/,
];

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const generatedAt = new Date();
  const playbook = buildPlaybook(config, generatedAt);
  const status = buildFixtureStatus(playbook, generatedAt);

  await writeJson(PLAYBOOK_JSON_PATH, playbook);
  await writeFile(PLAYBOOK_MD_PATH, renderPlaybookMarkdown(playbook));
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderFixtureReport(status));

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPlaybook(config, generatedAt) {
  const challenger = config.assets.find((asset) => asset.role === "challenger") ?? config.assets[0];
  const champion = config.assets.find((asset) => asset.role === "champion") ?? config.assets[0];
  const campaign = config.current_round.round_id;

  return {
    generated_at: generatedAt.toISOString(),
    mode: "line_inbound_local_playbook",
    status: "ready_local_review",
    operator: config.operator,
    round: {
      round_id: campaign,
      changed_variable: config.current_round.changed_variable,
      one_variable_rule_ok: config.one_variable_per_round.includes(config.current_round.changed_variable),
      hypothesis: config.current_round.hypothesis,
    },
    policy: {
      inbound_only: true,
      manual_reply_only: true,
      no_line_push: true,
      no_formal_post: true,
      no_customer_data_storage: true,
      no_raw_chat_export: true,
      aggregate_or_pseudonymous_only: true,
      no_payment_action: true,
      no_delete_action: true,
      external_effect: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    },
    source_assets: {
      champion_asset_id: champion?.asset_id ?? null,
      challenger_asset_id: challenger?.asset_id ?? null,
      line_url: challenger?.line_url ?? champion?.line_url ?? null,
      changed_variable: challenger?.changed_variable ?? config.current_round.changed_variable,
    },
    qualification_buckets: [
      {
        field: "funnel_block_bucket",
        prompt: "目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。",
        allowed_values: ["click_no_line", "line_no_lead", "lead_no_deal", "unknown"],
        local_storage: "bucket_only_optional",
      },
      {
        field: "business_type_bucket",
        prompt: "你的服務比較像：在地服務 / 電商 / 課程顧問 / B2B / 其他。",
        allowed_values: ["local_service", "ecommerce", "course_consulting", "b2b", "other"],
        local_storage: "bucket_only_optional",
      },
      {
        field: "traffic_bucket_7d",
        prompt: "近 7 天大概點擊量：0-99 / 100-499 / 500+ / 不確定。",
        allowed_values: ["0_99", "100_499", "500_plus", "unknown"],
        local_storage: "bucket_only_optional",
      },
    ],
    blocked_local_fields: [
      "phone",
      "email",
      "line_user_id",
      "customer_name",
      "address",
      "payment",
      "card",
      "message",
      "conversation",
      "private_note",
    ],
    stages: [
      {
        stage: "line_add",
        event_type: "line_add",
        trigger: "User voluntarily adds LINE or sends the first inbound message after seeing a draft or candidate page.",
        operator_goal: "Acknowledge the inbound lead and keep the local metric as an aggregate LINE-add count.",
        reply_template: "我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。",
        requested_fields: ["funnel_block_bucket"],
        local_recording: "Add one aggregate line_add count for the matching asset_id. Do not store chat text or personal identifiers.",
        csv_example: aggregateRow({
          asset_id: challenger?.asset_id,
          event_type: "line_add",
          campaign,
          content_id: `${campaign}-line-inbound`,
          variant_id: challenger?.asset_id,
        }),
      },
      {
        stage: "lead_submit",
        event_type: "lead_submit",
        trigger: "User gives enough business context for a diagnostic follow-up inside the inbound LINE thread.",
        operator_goal: "Count a lead only when the user shares a business-type bucket and current funnel block bucket.",
        reply_template: "收到。我會用 48h 成交診斷看三件事：入口、CTA、LINE 後續。請用選項回：在地服務 / 電商 / 課程顧問 / B2B / 其他，還有近 7 天點擊量大概 0-99 / 100-499 / 500+ / 不確定。",
        requested_fields: ["business_type_bucket", "traffic_bucket_7d"],
        local_recording: "Add one aggregate lead_submit count only after business context is sufficient. Do not copy the conversation into local files.",
        csv_example: aggregateRow({
          asset_id: challenger?.asset_id,
          event_type: "lead_submit",
          campaign,
          content_id: `${campaign}-lead-qualified`,
          variant_id: challenger?.asset_id,
        }),
      },
      {
        stage: "deal",
        event_type: "deal",
        trigger: "Owner manually confirms a paid or committed conversion after separate review.",
        operator_goal: "Record only an aggregate deal count after the owner confirms the outcome.",
        reply_template: "這一步不自動成交、不收款、不改客戶資料。成交狀態只由學誼人工確認後，回填 aggregate deal count。",
        requested_fields: [],
        local_recording: "Add one aggregate deal count only after owner confirmation. Never process ECPay or payment actions here.",
        csv_example: aggregateRow({
          asset_id: challenger?.asset_id,
          event_type: "deal",
          campaign,
          content_id: `${campaign}-owner-confirmed-deal`,
          variant_id: challenger?.asset_id,
        }),
      },
      {
        stage: "quality_flag",
        event_type: "quality_flag",
        trigger: "Inbound thread is spam, irrelevant, duplicate, or lower-quality than the champion baseline.",
        operator_goal: "Protect no_quality_regression without storing raw chat content.",
        reply_template: "若這筆進線明顯不相關，只記 aggregate quality_flag，不保存對話內容。",
        requested_fields: ["quality_score_bucket"],
        local_recording: "Add aggregate quality_flag with quality_score only. Do not store the reason text if it contains customer details.",
        csv_example: aggregateRow({
          asset_id: challenger?.asset_id,
          event_type: "quality_flag",
          campaign,
          content_id: `${campaign}-quality-guard`,
          variant_id: challenger?.asset_id,
          quality_score: "0.25",
        }),
      },
    ],
    manual_conversion_contract: {
      artifact: "data/manual_conversions.example.csv",
      preview_command: "npm run import:manual:preview",
      apply_command: "npm run import:manual:apply",
      allowed_columns: ALLOWED_COLUMNS,
      allowed_event_types: ALLOWED_EVENT_TYPES,
      default_mode: "preview_only",
      apply_gate: "local_apply_requires_explicit_command_and_review",
    },
    outputs: {
      playbook_json: "line_inbound_playbook.json",
      playbook_md: "line_inbound_playbook.md",
      fixture_status: "data/line_inbound_fixture_status.json",
      fixture_report: "line_inbound_fixture_report.md",
    },
    external_effect: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

function aggregateRow({ asset_id, event_type, campaign, content_id, variant_id, quality_score = "" }) {
  return {
    date: "2026-07-08",
    asset_id,
    event_type,
    count: "1",
    source: "line_inbound_manual",
    medium: "line",
    campaign,
    content_id,
    variant_id,
    quality_score,
  };
}

function buildFixtureStatus(playbook, generatedAt) {
  const scenarios = [
    {
      id: "allowed_line_add_count_row",
      row: playbook.stages.find((stage) => stage.event_type === "line_add")?.csv_example,
      expect_ok: true,
    },
    {
      id: "allowed_lead_submit_count_row",
      row: playbook.stages.find((stage) => stage.event_type === "lead_submit")?.csv_example,
      expect_ok: true,
    },
    {
      id: "blocked_phone_column",
      row: { ...playbook.stages[0].csv_example, phone: "0912-345-678" },
      expect_ok: false,
    },
    {
      id: "blocked_email_value",
      row: { ...playbook.stages[0].csv_example, source: "buyer@example.com" },
      expect_ok: false,
    },
    {
      id: "blocked_chat_message_column",
      row: { ...playbook.stages[0].csv_example, message: "raw customer conversation" },
      expect_ok: false,
    },
    {
      id: "deal_stays_owner_confirmed_aggregate",
      row: playbook.stages.find((stage) => stage.event_type === "deal")?.csv_example,
      expect_ok: true,
      extra_ok: playbook.stages.find((stage) => stage.event_type === "deal")?.local_recording.includes("owner confirmation"),
    },
  ].map((scenario) => {
    const validation = validateAggregateRow(scenario.row);
    const ok = validation.ok === scenario.expect_ok && (scenario.extra_ok ?? true);
    return {
      id: scenario.id,
      ok,
      expected_valid: scenario.expect_ok,
      actual_valid: validation.ok,
      issues: validation.issues,
      external_effect: false,
    };
  });

  const requiredEventTypes = ["line_add", "lead_submit", "deal", "quality_flag"];
  const checks = [
    check("inbound_only_manual_reply", playbook.policy.inbound_only === true && playbook.policy.manual_reply_only === true && playbook.policy.no_line_push === true),
    check("aggregate_only_no_customer_storage", playbook.policy.aggregate_or_pseudonymous_only === true && playbook.policy.no_customer_data_storage === true && playbook.policy.no_raw_chat_export === true),
    check("required_event_types_mapped", requiredEventTypes.every((eventType) => playbook.stages.some((stage) => stage.event_type === eventType))),
    check("requested_fields_are_bucket_only", playbook.stages.every((stage) => stage.requested_fields.every((field) => !isSensitiveField(field)))),
    check("manual_contract_safe_columns", playbook.manual_conversion_contract.allowed_columns.every((column) => !isSensitiveField(column))),
    check("manual_contract_allowed_event_types", requiredEventTypes.every((eventType) => playbook.manual_conversion_contract.allowed_event_types.includes(eventType))),
    check("one_variable_context_preserved", playbook.round.one_variable_rule_ok === true),
    check("red_line_flags_false", redLineFlagsFalse(playbook)),
  ];

  return {
    ok: checks.every((item) => item.ok) && scenarios.every((item) => item.ok),
    generated_at: generatedAt.toISOString(),
    mode: "line_inbound_fixture_dry_run",
    playbook_json_path: PLAYBOOK_JSON_PATH,
    playbook_md_path: PLAYBOOK_MD_PATH,
    scenario_count: scenarios.length,
    checks,
    scenarios,
    execution_performed: false,
    external_effect: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    data_lp_events_write_performed: false,
    note: "Fixture-only LINE inbound playbook guard. It validates aggregate-only manual conversion rows and never sends LINE messages.",
  };
}

function validateAggregateRow(row = {}) {
  const issues = [];
  const keys = Object.keys(row);
  const unknown = keys.filter((key) => !ALLOWED_COLUMNS.includes(key));
  const sensitiveColumns = keys.filter((key) => isSensitiveField(key));
  const sensitiveValues = Object.entries(row)
    .filter(([, value]) => typeof value === "string" && SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value)))
    .map(([key]) => key);

  if (unknown.length > 0) issues.push(`unknown_columns=${unknown.join(",")}`);
  if (sensitiveColumns.length > 0) issues.push(`sensitive_columns=${sensitiveColumns.join(",")}`);
  if (sensitiveValues.length > 0) issues.push(`sensitive_values=${sensitiveValues.join(",")}`);
  if (!ALLOWED_EVENT_TYPES.includes(row.event_type)) issues.push(`invalid_event_type=${row.event_type}`);
  if (!Number.isInteger(Number(row.count)) || Number(row.count) < 1) issues.push("count_must_be_positive_integer");

  return { ok: issues.length === 0, issues };
}

function isSensitiveField(field) {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(String(field)));
}

function redLineFlagsFalse(playbook) {
  return playbook.external_effect === false &&
    playbook.formal_post_performed === false &&
    playbook.line_push_performed === false &&
    playbook.customer_data_mutation_performed === false &&
    playbook.payment_action_performed === false &&
    playbook.delete_action_performed === false &&
    playbook.policy.external_effect === false &&
    playbook.policy.line_push_performed === false &&
    playbook.policy.customer_data_mutation_performed === false &&
    playbook.policy.payment_action_performed === false &&
    playbook.policy.delete_action_performed === false;
}

function check(id, ok) {
  return { id, ok: Boolean(ok), external_effect: false };
}

function renderPlaybookMarkdown(playbook) {
  const stageBlocks = playbook.stages.map((stage) => `## ${stage.stage}

- Event type: ${stage.event_type}
- Trigger: ${stage.trigger}
- Operator goal: ${stage.operator_goal}
- Requested fields: ${stage.requested_fields.length > 0 ? stage.requested_fields.join(", ") : "none"}
- Local recording: ${stage.local_recording}

\`\`\`text
${stage.reply_template}
\`\`\`

Aggregate CSV example:

\`\`\`json
${JSON.stringify(stage.csv_example, null, 2)}
\`\`\`
`).join("\n");

  return `# LINE Inbound Playbook

BLUF: This is a local, inbound-only customer-service handoff for the 3Q growth loop. It gives manual reply templates and aggregate event mapping, but it does not send LINE messages, push broadcasts, store customer data, process payments, or mutate external systems.

Generated: ${playbook.generated_at}
Mode: ${playbook.mode}
Round: ${playbook.round.round_id}
Changed variable: ${playbook.round.changed_variable}
One-variable rule: ${playbook.round.one_variable_rule_ok ? "pass" : "fail"}

## Policy

- Inbound only: yes
- Manual reply only: yes
- LINE push performed: no
- Formal post performed: no
- Customer data storage: no
- Raw chat export: no
- Aggregate or pseudonymous metrics only: yes
- Payment action: no
- Delete action: no
- External effect: no

## Qualification Buckets

${playbook.qualification_buckets.map((item) => `- ${item.field}: ${item.allowed_values.join(" / ")}`).join("\n")}

## Blocked Local Fields

${playbook.blocked_local_fields.map((field) => `- ${field}`).join("\n")}

${stageBlocks}

## Manual Conversion Contract

- Artifact: ${playbook.manual_conversion_contract.artifact}
- Preview command: ${playbook.manual_conversion_contract.preview_command}
- Apply command: ${playbook.manual_conversion_contract.apply_command}
- Default mode: ${playbook.manual_conversion_contract.default_mode}
- Apply gate: ${playbook.manual_conversion_contract.apply_gate}
- Allowed columns: ${playbook.manual_conversion_contract.allowed_columns.join(", ")}
- Allowed event types: ${playbook.manual_conversion_contract.allowed_event_types.join(", ")}

## Human Gate

Formal LINE broadcast, proactive push, customer-data edits, payment/refund action, and production deploy remain owner-only gates. This playbook is copyable operating guidance and local aggregate mapping only.
`;
}

function renderFixtureReport(status) {
  const checkRows = status.checks
    .map((item) => `| ${item.id} | ${item.ok ? "ok" : "fail"} | ${item.external_effect ? "yes" : "no"} |`)
    .join("\n");
  const scenarioRows = status.scenarios
    .map((item) => `| ${item.id} | ${item.ok ? "ok" : "fail"} | ${item.expected_valid ? "valid" : "blocked"} | ${item.actual_valid ? "valid" : "blocked"} | ${item.issues.join("; ") || "none"} |`)
    .join("\n");

  return `# LINE Inbound Fixture Report

BLUF: ${status.ok ? "line_inbound_fixture_ok" : "line_inbound_fixture_failed"}。Fixture-only dry run for LINE inbound customer-service handoff. It performs no LINE send, no customer-data mutation, and no event write.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Execution performed: no
External effect: no

## Checks

| check | status | external_effect |
|---|---|---|
${checkRows}

## Scenarios

| scenario | status | expected | actual | issues |
|---|---|---|---|---|
${scenarioRows}

## Safety Invariants

- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
- data/lp_events.jsonl write performed: no
`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
