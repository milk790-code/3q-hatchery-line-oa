import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "real_data_intake_status.json");
const REPORT_PATH = path.join(ROOT, "real_data_intake_plan.md");
const INTAKE_DIR = path.join(ROOT, "data", "real_data_intake");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");

const SOURCES = [
  {
    id: "funnel_aggregates",
    label: "Full-funnel aggregate CSV",
    input_path: path.join(ROOT, "data", "funnel_aggregates.csv"),
    example_path: path.join(ROOT, "data", "funnel_aggregates.example.csv"),
    preview_output_path: path.join(INTAKE_DIR, "funnel_aggregates.owner-preview.jsonl"),
    preview_status_path: path.join(INTAKE_DIR, "funnel_aggregate_intake_status.json"),
    importer_script: "scripts/import-funnel-aggregates.mjs",
    status_env_key: "FUNNEL_AGGREGATE_STATUS_PATH",
    apply_command: "npm run import:funnel:apply",
    expected_events: ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"],
    missing_action: "Copy data/funnel_aggregates.example.csv to data/funnel_aggregates.csv and fill aggregate counts from the latest reviewed analytics export.",
  },
  {
    id: "manual_conversions",
    label: "Manual LINE / lead / deal conversion CSV",
    input_path: path.join(ROOT, "data", "manual_conversions.csv"),
    example_path: path.join(ROOT, "data", "manual_conversions.example.csv"),
    preview_output_path: path.join(INTAKE_DIR, "manual_conversions.owner-preview.jsonl"),
    preview_status_path: path.join(INTAKE_DIR, "manual_conversion_intake_status.json"),
    importer_script: "scripts/import-manual-conversions.mjs",
    status_env_key: "MANUAL_CONVERSION_STATUS_PATH",
    apply_command: "npm run import:manual:apply",
    expected_events: ["line_add", "lead_submit", "deal", "quality_flag"],
    missing_action: "Copy data/manual_conversions.example.csv to data/manual_conversions.csv and fill aggregate counts from reviewed LINE/customer-service outcomes.",
  },
];

async function main() {
  const generatedAt = new Date();
  await mkdir(INTAKE_DIR, { recursive: true });
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const sourceStatuses = [];

  for (const source of SOURCES) {
    sourceStatuses.push(await inspectSource(source));
  }

  const readySources = sourceStatuses.filter((source) => source.ready_for_owner_apply);
  const missingSources = sourceStatuses.filter((source) => source.status === "missing_input");
  const blockedSources = sourceStatuses.filter((source) => source.status === "preview_blocked");
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "real_data_intake_plan",
    status: blockedSources.length > 0
      ? "input_attention_required"
      : readySources.length > 0
        ? "preview_ready_owner_apply_required"
        : "no_real_input_files",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    intake_dir: INTAKE_DIR,
    real_events_path: REAL_EVENTS_PATH,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    has_real_input_files: sourceStatuses.some((source) => source.input_exists),
    missing_input_count: missingSources.length,
    ready_apply_count: readySources.length,
    blocked_input_count: blockedSources.length,
    owner_review_required: true,
    owner_apply_commands: readySources.map((source) => ({
      source_id: source.id,
      command: source.apply_command,
      follow_up_commands: ["npm run event:quality", "npm run week0"],
      human_gate: "Run only after reviewing the owner preview/status and confirming the CSV is real aggregate data, not a copied example or customer-level export.",
    })),
    input_files: sourceStatuses,
    apply_performed: false,
    append_performed: false,
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
    note: "Preview/plan only. It may generate owner-preview JSONL files, but it never appends to data/lp_events.jsonl or performs external actions.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderMarkdown(status));
  console.log(JSON.stringify(status, null, 2));
}

async function inspectSource(source) {
  const inputExists = await exists(source.input_path);
  if (!inputExists) {
    return {
      id: source.id,
      label: source.label,
      status: "missing_input",
      input_exists: false,
      input_path: source.input_path,
      example_path: source.example_path,
      preview_output_path: source.preview_output_path,
      preview_status_path: source.preview_status_path,
      expected_events: source.expected_events,
      ready_for_owner_apply: false,
      apply_command: source.apply_command,
      missing_action: source.missing_action,
      apply_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
    };
  }

  const result = await runImporter(source);
  const importerStatus = await readOptionalJson(source.preview_status_path);
  const previewOk = result.exit_code === 0
    && importerStatus?.ok === true
    && importerStatus?.apply_performed === false
    && importerStatus?.data_lp_events_write_performed === false
    && importerStatus?.external_effect === false
    && importerStatus?.contains_sensitive_columns === false
    && importerStatus?.contains_sensitive_values === false;

  return {
    id: source.id,
    label: source.label,
    status: previewOk ? "preview_ready" : "preview_blocked",
    input_exists: true,
    input_path: source.input_path,
    example_path: source.example_path,
    preview_output_path: source.preview_output_path,
    preview_status_path: source.preview_status_path,
    expected_events: source.expected_events,
    importer_command: result.command,
    importer_exit_code: result.exit_code,
    importer_stdout_bytes: result.stdout.length,
    importer_stderr_bytes: result.stderr.length,
    importer_error: result.exit_code === 0 ? null : result.stderr.trim() || result.stdout.trim() || "importer_failed",
    preview_ok: previewOk,
    preview_events_written: importerStatus?.events_written ?? 0,
    preview_counts_by_event_type: importerStatus?.counts_by_event_type ?? {},
    contains_sensitive_columns: Boolean(importerStatus?.contains_sensitive_columns),
    contains_sensitive_values: Boolean(importerStatus?.contains_sensitive_values),
    apply_performed: Boolean(importerStatus?.apply_performed),
    append_performed: Boolean(importerStatus?.append_performed),
    data_lp_events_write_performed: Boolean(importerStatus?.data_lp_events_write_performed),
    external_effect: Boolean(importerStatus?.external_effect),
    ready_for_owner_apply: previewOk,
    apply_command: source.apply_command,
    follow_up_commands: ["npm run event:quality", "npm run week0"],
    human_gate: "Owner must confirm this is reviewed real aggregate data before running the local apply command.",
  };
}

function runImporter(source) {
  const commandArgs = [
    source.importer_script,
    `--input=${relative(source.input_path)}`,
    `--output=${relative(source.preview_output_path)}`,
  ];
  const command = `node ${commandArgs.join(" ")}`;
  return new Promise((resolve) => {
    const child = spawn("node", commandArgs, {
      cwd: ROOT,
      env: {
        ...process.env,
        [source.status_env_key]: source.preview_status_path,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        command,
        exit_code: 1,
        stdout,
        stderr: `${stderr}${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolve({
        command,
        exit_code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function renderMarkdown(status) {
  const sourceRows = status.input_files
    .map((source) => `| ${source.id} | ${source.status} | ${source.input_exists ? "yes" : "no"} | ${source.preview_events_written ?? 0} | ${source.ready_for_owner_apply ? "yes" : "no"} | ${source.data_lp_events_write_performed ? "yes" : "no"} | ${source.input_exists ? source.preview_status_path : source.missing_action} |`)
    .join("\n");
  const commandBlocks = status.owner_apply_commands.length > 0
    ? status.owner_apply_commands
      .map((item) => `## ${item.source_id}\n\nHuman gate: ${item.human_gate}\n\n\`\`\`zsh\n${[item.command, ...item.follow_up_commands].join("\n")}\n\`\`\``)
      .join("\n\n")
    : "No owner apply commands are ready because no reviewed real input CSV exists yet.";

  return `# 3Q Growth Loop Real Data Intake Plan

BLUF: ${status.status === "preview_ready_owner_apply_required" ? "Reviewed real aggregate input exists and preview passed; local apply still requires owner review." : status.status === "input_attention_required" ? "A real input file exists but preview failed or was blocked; fix the CSV before applying." : "No real input CSV exists yet; the weekly loop is healthy but still waiting for aggregate data."}

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
External effect: no
data/lp_events.jsonl write performed: no
Real events unchanged: ${status.real_events_unchanged ? "yes" : "no"}

## Input Status

| source | status | input exists | preview events | ready for owner apply | data write | evidence / next action |
|---|---|---|---:|---|---|---|
${sourceRows}

## Owner Apply Commands

${commandBlocks}

## Rules

- Preview files are not scored.
- Apply commands are local-only but change data/lp_events.jsonl, so owner review is required.
- CSVs must be aggregate-only and must not include phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, or conversation text.
- Copied example/template CSVs are blocked by the importer even when --confirm-real-data is present.
- After apply, run event quality and regenerate Week 0 artifacts before interpreting winners.
`;
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

async function readOptionalJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "real_data_intake_plan",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    apply_performed: false,
    append_performed: false,
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
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
