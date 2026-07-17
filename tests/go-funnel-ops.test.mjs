import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ADMIN_KEY = "test-only-admin-key";
const WORKERS = ["3q-line-oa", "tudigong-line-oa", "luxury-line-oa", "pop-line-oa"];
const WORKFLOW_PATHS = [
  "../.github/workflows/deploy-3q-line-oa.yml",
  "../.github/workflows/deploy-tudigong.yml",
  "../.github/workflows/deploy-luxury-line-oa.yml",
  "../.github/workflows/deploy-pop-line-oa.yml",
];

function metric(worker, source = "social") {
  return {
    ok: true,
    feature: "go-funnel-v1",
    slug: worker,
    range: { from: "2026-07-01", to: "2026-07-17", days: 17 },
    totals: {
      starts: 2,
      firstAnswers: 1,
      thirdAnswers: 1,
      deliveries: 1,
      firstAnswerRate: 0.5,
      thirdAnswerRate: 0.5,
      deliveryRate: 0.5,
      averageDeliveryMinutes: 10,
    },
    sources: [{
      source,
      starts: 2,
      firstAnswers: 1,
      thirdAnswers: 1,
      deliveries: 1,
      firstAnswerRate: 0.5,
      thirdAnswerRate: 0.5,
      deliveryRate: 0.5,
      averageDeliveryMinutes: 10,
    }],
  };
}

test("summary all fetches four protected OA reports and returns weighted totals", async () => {
  const { runGoFunnelOps } = await import("../scripts/go-funnel-ops.mjs");
  const calls = [];
  const report = await runGoFunnelOps(["summary", "--worker", "all", "--days", "17"], {
    adminKey: ADMIN_KEY,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      const worker = WORKERS.find((name) => String(url).includes(name));
      return Response.json(metric(worker));
    },
    stdout() {},
  });

  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.options.headers["X-Admin-Key"] === ADMIN_KEY));
  assert.ok(calls.every((call) => call.url.endsWith("/admin/go-funnel?days=17")));
  assert.equal(calls.some((call) => call.url.includes(ADMIN_KEY)), false);
  assert.deepEqual(report.totals, {
    starts: 8,
    firstAnswers: 4,
    thirdAnswers: 4,
    deliveries: 4,
    firstAnswerRate: 0.5,
    thirdAnswerRate: 0.5,
    deliveryRate: 0.5,
    averageDeliveryMinutes: 10,
  });
  assert.equal(report.sources[0].source, "social");
  assert.equal(report.sources[0].thirdAnswerRate, 0.5);
});

test("delivered posts only the anonymous case id to one Worker", async () => {
  const { runGoFunnelOps } = await import("../scripts/go-funnel-ops.mjs");
  const calls = [];
  const result = await runGoFunnelOps([
    "delivered",
    "--worker", "pop-line-oa",
    "--case", "GO-ABCDEF123456",
  ], {
    adminKey: ADMIN_KEY,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json({ ok: true, caseId: "GO-ABCDEF123456", deliveryMinutes: 12.5, duplicate: false });
    },
    stdout() {},
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://pop-line-oa.milk790.workers.dev/admin/go-funnel/delivered");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Admin-Key"], ADMIN_KEY);
  assert.deepEqual(JSON.parse(calls[0].options.body), { caseId: "GO-ABCDEF123456" });
  assert.equal(calls[0].options.body.includes(ADMIN_KEY), false);
  assert.equal(result.deliveryMinutes, 12.5);
});

test("operations fail closed when GO_FUNNEL_ADMIN_KEY is missing", async () => {
  const { runGoFunnelOps } = await import("../scripts/go-funnel-ops.mjs");
  await assert.rejects(
    runGoFunnelOps(["summary"], { adminKey: "", fetchImpl: async () => assert.fail("must not fetch"), stdout() {} }),
    /GO_FUNNEL_ADMIN_KEY/,
  );
});

test("CLI rejects admin keys and unknown flags in argv", async () => {
  const { parseArgs } = await import("../scripts/go-funnel-ops.mjs");
  assert.throws(() => parseArgs(["summary", "--admin-key", "must-not-enter-argv"]), /不支援的參數.*admin-key/);
  assert.throws(() => parseArgs(["summary", "--unknown", "value"]), /不支援的參數.*unknown/);
  assert.throws(() => parseArgs(["delivered", "--worker", "pop-line-oa", "--case", "GO-ABCDEF123456", "--days", "30"]), /不支援的參數.*days/);
});

test("all four deploy workflows preserve the analytics admin secret", async () => {
  for (const workflowPath of WORKFLOW_PATHS) {
    const source = await readFile(new URL(workflowPath, import.meta.url), "utf8");
    assert.match(source, /GO_FUNNEL_ADMIN_KEY:\s+\$\{\{ secrets\.GO_FUNNEL_ADMIN_KEY \}\}/, workflowPath);
    assert.match(source, /name:["']?GO_FUNNEL_ADMIN_KEY["']?/, workflowPath);
    assert.doesNotMatch(source, /\|\|\s*echo\s+['"]\[\]['"]/, `${workflowPath} must fail closed when settings lookup fails`);
    assert.match(source, /curl\s+-fsS[^\n]*Authorization: Bearer/, `${workflowPath} must fail closed on settings API errors`);
    assert.match(source, /existing=\$\(printf[\s\S]{0,300}\.success\s*==\s*true/, `${workflowPath} must reject a Cloudflare API error envelope`);
    assert.match(source, /\.result\.bindings\s*\|\s*type\s*==\s*["']array["']/, `${workflowPath} must reject a settings response with missing bindings`);
    assert.match(source, /select\(\.type\s*==\s*["']secret_text["']\)/, `${workflowPath} must discover all existing secret bindings`);
    assert.match(source, /map\(\{name:\s*\.,\s*type:\s*["']inherit["']\}\)/, `${workflowPath} must inherit every existing secret binding`);
    assert.match(source, /workers\/scripts\/\$\{WORKER_NAME\}\/?.*bindings_inherit=strict/, `${workflowPath} must make unresolved inherit bindings fail the deployment`);
    assert.doesNotMatch(source, /echo[^\n]*\$\{?GO_FUNNEL_ADMIN_KEY/, `${workflowPath} must not print the admin secret value`);
  }
});
