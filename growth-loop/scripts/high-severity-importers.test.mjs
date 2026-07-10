import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

async function runImporter(script, input, output, statusEnv, statusPath, realPathEnv) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      script,
      `--input=${input}`,
      `--output=${output}`,
      "--append",
      "--apply",
      "--confirm-real-data",
    ], {
      cwd: ROOT,
      env: { ...process.env, [statusEnv]: statusPath, [realPathEnv]: output },
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return { exitCode: Number(error.code) || 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

for (const fixture of [
  {
    name: "funnel",
    script: "scripts/import-funnel-aggregates.mjs",
    statusEnv: "FUNNEL_AGGREGATE_STATUS_PATH",
    realPathEnv: "FUNNEL_REAL_EVENTS_PATH",
    header: "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score",
    row: "2026-07-08,challenger-week0-cta-text-v1,page_view,2,owner,aggregate,week0-cta-text,post-x,challenger-v1,",
  },
  {
    name: "manual",
    script: "scripts/import-manual-conversions.mjs",
    statusEnv: "MANUAL_CONVERSION_STATUS_PATH",
    realPathEnv: "MANUAL_REAL_EVENTS_PATH",
    header: "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score",
    row: "2026-07-08,challenger-week0-cta-text-v1,line_add,2,owner,aggregate,week0-cta-text,post-x,challenger-v1,",
  },
]) {
  test(`${fixture.name} importer is idempotent across repeated apply`, async (t) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), `3q-${fixture.name}-idempotent-`));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const input = path.join(dir, `${fixture.name}.csv`);
    const output = path.join(dir, "lp_events.jsonl");
    const statusPath = path.join(dir, "status.json");
    await writeFile(input, `${fixture.header}\n${fixture.row}\n`);

    const first = await runImporter(fixture.script, input, output, fixture.statusEnv, statusPath, fixture.realPathEnv);
    assert.equal(first.exitCode, 0, first.stderr);
    const firstRows = (await readFile(output, "utf8")).trim().split(/\r?\n/);
    assert.equal(firstRows.length, 2);

    const second = await runImporter(fixture.script, input, output, fixture.statusEnv, statusPath, fixture.realPathEnv);
    assert.equal(second.exitCode, 0, second.stderr);
    const secondRows = (await readFile(output, "utf8")).trim().split(/\r?\n/);
    const status = JSON.parse(await readFile(statusPath, "utf8"));
    assert.equal(secondRows.length, 2);
    assert.equal(status.events_written, 0);
    assert.equal(status.existing_event_ids_skipped, 2);
  });

  test(`${fixture.name} importer rejects duplicate rows inside one batch`, async (t) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), `3q-${fixture.name}-duplicate-`));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const input = path.join(dir, `${fixture.name}.csv`);
    const output = path.join(dir, "lp_events.jsonl");
    const statusPath = path.join(dir, "status.json");
    await writeFile(input, `${fixture.header}\n${fixture.row}\n${fixture.row}\n`);

    const result = await runImporter(fixture.script, input, output, fixture.statusEnv, statusPath, fixture.realPathEnv);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /duplicate event_id inside input batch/);
  });
}
