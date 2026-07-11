type FunnelEventType =
  | "link_click"
  | "page_view"
  | "cta_click"
  | "line_add"
  | "lead_submit"
  | "deal"
  | "quality_flag";

type IncomingEvent = {
  asset_id?: string;
  variant_id?: string;
  content_id?: string;
  session_id?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  event_type?: FunnelEventType;
  url?: string;
  referrer?: string;
  value_amount?: number;
  quality_score?: number;
  metadata_json?: Record<string, unknown>;
};

type AssetRow = {
  asset_id: string;
  role: "champion" | "challenger" | "retired";
  name: string;
  landing_url: string;
  changed_variable: "hook" | "offer" | "visual_claim" | "cta_text" | null;
};

type CountRow = {
  asset_id: string;
  event_type: FunnelEventType;
  n: number;
  low_quality_n: number;
  first_event_at: string | null;
  last_event_at: string | null;
};

type ScoreRow = {
  asset_id: string;
  role: string;
  link_clicks: number;
  visits: number;
  cta_clicks: number;
  line_adds: number;
  leads: number;
  deals: number;
  quality_flags: number;
  low_quality_flags: number;
  cta_rate: number;
  line_add_rate: number;
  lead_rate: number;
  close_rate: number;
  score: number;
  spam_flag_rate: number;
  lead_rate_retention_vs_champion: number | null;
  close_rate_retention_vs_champion: number | null;
  quality_regression_reasons: string[];
  sample_threshold_met: boolean;
  no_quality_regression: boolean;
  decision: string;
};

type AbRoutePlan = {
  test_id: string;
  champion_asset_id: string;
  challenger_asset_id: string;
  allocation: {
    champion: number;
    challenger: number;
  };
  champion_url: string;
  champion_url_ready: boolean;
  external_effects: false;
  human_gate: string;
};

const ALLOWED_EVENTS = new Set<FunnelEventType>([
  "link_click",
  "page_view",
  "cta_click",
  "line_add",
  "lead_submit",
  "deal",
  "quality_flag",
]);

const PUBLIC_INGEST_EVENTS = new Set<FunnelEventType>([
  "page_view",
  "cta_click",
]);

const BLOCKED_METADATA_KEYS = [
  "phone",
  "email",
  "line_user_id",
  "customer_name",
  "address",
  "payment",
  "card",
];

const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "content_id",
  "variant_id",
  "sid",
];

const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,79}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_LIKE_PATTERN = /(?:\+?886[\s._~:()-]?)?0?9(?:[\s._~:()-]?\d){8}|0[2-8](?:[\s._~:()-]?\d){7,8}/;
const MAX_PUBLIC_EVENT_BODY_BYTES = 8192;
const ALLOWED_PUBLIC_METADATA_KEYS = new Set([
  "fixture",
  "integration",
  "isolated",
  "page",
  "surface",
]);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({
          ok: true,
          service: "3q-growth-loop-candidate",
          build: "origin-pii-v2",
          security_contract: "origin-pii-v2",
          environment: env.ENVIRONMENT,
          external_effects: false,
          human_gates: [
            "production_deploy",
            "primary_link_change",
            "formal_post",
            "line_push",
            "payment",
            "customer_data_mutation",
          ],
        });
      }

      if (request.method === "GET" && url.pathname === "/candidate") {
        return html(renderCandidateHtml(env, url));
      }

      if (request.method === "GET" && url.pathname === "/weekly/status") {
        const latest = await env.DB.prepare(
          `SELECT * FROM weekly_growth_scores ORDER BY created_at DESC LIMIT 20`,
        ).all();
        return json({
          ok: true,
          external_effects: false,
          scores: latest.results,
        });
      }

      if (request.method === "GET" && url.pathname === "/ab/status") {
        return json({
          ok: true,
          ...buildAbRoutePlan(env),
          public_link_change_performed: false,
          production_deploy_performed: false,
        });
      }

      if (request.method === "GET" && url.pathname.startsWith("/ab/")) {
        return handleAbRoute(request, env, ctx, url);
      }

      if (request.method === "GET" && url.pathname.startsWith("/r/")) {
        const assetId = sanitizeRequiredToken(
          decodeURIComponent(url.pathname.replace("/r/", "")) || "challenger-week0-cta-text-v1",
          "asset_id",
        );
        const target = url.searchParams.get("to") ?? "challenger";
        const event = buildEventFromRequest(request, assetId, "link_click", url);
        ctx.waitUntil(insertEvent(env, event));
        return Response.redirect(resolveRedirectTarget(env, target, url, assetId), 302);
      }

      if (request.method === "OPTIONS" && url.pathname === "/e") {
        const origin = request.headers.get("origin");
        if (!isAllowedEventOrigin(origin, url, env)) {
          return json({ ok: false, error: "origin_not_allowed" }, 403);
        }
        return new Response(null, {
          status: 204,
          headers: eventCorsHeaders(origin),
        });
      }

      if (request.method === "POST" && url.pathname === "/e") {
        const origin = request.headers.get("origin");
        if (!isAllowedEventOrigin(origin, url, env)) {
          return json({ ok: false, error: "origin_not_allowed" }, 403);
        }
        const contentLength = request.headers.get("content-length");
        if (contentLength && !/^\d+$/.test(contentLength)) {
          return json({ ok: false, error: "invalid_content_length" }, 400, eventCorsHeaders(origin));
        }
        if (contentLength && Number(contentLength) > MAX_PUBLIC_EVENT_BODY_BYTES) {
          return json({ ok: false, error: "payload_too_large" }, 413, eventCorsHeaders(origin));
        }

        const bodyText = await readBoundedRequestBody(request, MAX_PUBLIC_EVENT_BODY_BYTES);
        let parsedPayload: unknown;
        try {
          parsedPayload = JSON.parse(bodyText || "{}");
        } catch {
          throw new Error("invalid_json_body");
        }
        if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
          throw new Error("invalid_event_payload");
        }
        const payload = parsedPayload as IncomingEvent;
        const event = sanitizeIncomingEvent(payload, request, url);
        await insertEvent(env, event);
        return json({ ok: true, event_id: event.event_id }, 200, eventCorsHeaders(origin));
      }

      return json({ ok: false, error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      const origin = request.headers.get("origin");
      const corsHeaders = url.pathname === "/e" && isAllowedEventOrigin(origin, url, env)
        ? eventCorsHeaders(origin)
        : {};
      if (message === "payload_too_large") {
        return json({ ok: false, error: message }, 413, corsHeaders);
      }
      if (
        [
          "asset_id_required",
          "invalid_event_type",
          "event_type_not_allowed_public",
          "public_event_fields_not_allowed",
          "blocked_metadata_key",
          "invalid_metadata_value",
        ].includes(message)
        || message.startsWith("invalid_")
      ) {
        return json({ ok: false, error: message }, 400, corsHeaders);
      }
      if (/FOREIGN KEY constraint failed/i.test(message)) {
        return json({ ok: false, error: "unknown_asset_id" }, 400, corsHeaders);
      }
      console.log(JSON.stringify({ level: "error", message }));
      return json({ ok: false, error: "internal_error" }, 500, corsHeaders);
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runWeeklyGrowthLoop(env, controller.cron));
  },
} satisfies ExportedHandler<Env>;

async function runWeeklyGrowthLoop(env: Env, cron: string): Promise<void> {
  // Score the most recently COMPLETED Taipei week (Mon–Sun), never the in-progress one,
  // so no day is ever dropped regardless of the exact cron minute.
  const week = completedTaipeiWeek(new Date());
  const assetsResult = await env.DB.prepare(
    `SELECT asset_id, role, name, landing_url, changed_variable FROM lp_assets WHERE role IN ('champion', 'challenger') ORDER BY role`,
  ).all<AssetRow>();
  const countsResult = await env.DB.prepare(
    `SELECT
      asset_id,
      event_type,
      COUNT(*) AS n,
      SUM(
        CASE
          WHEN event_type = 'quality_flag'
            AND COALESCE(quality_score, CAST(json_extract(metadata_json, '$.quality_score') AS REAL), 1) < 0.5
          THEN 1
          ELSE 0
        END
      ) AS low_quality_n,
      MIN(occurred_at) AS first_event_at,
      MAX(occurred_at) AS last_event_at
    FROM lp_events
    WHERE occurred_at >= ? AND occurred_at <= ?
    GROUP BY asset_id, event_type`,
  )
    .bind(week.startUtc, week.endUtc)
    .all<CountRow>();

  const scores = calculateD1Scores(assetsResult.results ?? [], countsResult.results ?? []);
  const scoreStatements = scores.map((score) =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO weekly_growth_scores (
        score_id,
        week_start,
        week_end,
        asset_id,
        link_clicks,
        visits,
        cta_clicks,
        line_adds,
        leads,
        deals,
        cta_rate,
        line_add_rate,
        lead_rate,
        close_rate,
        score,
        sample_threshold_met,
        no_quality_regression,
        decision,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      `${week.start}:${score.asset_id}`,
      week.start,
      week.end,
      score.asset_id,
      score.link_clicks,
      score.visits,
      score.cta_clicks,
      score.line_adds,
      score.leads,
      score.deals,
      score.cta_rate,
      score.line_add_rate,
      score.lead_rate,
      score.close_rate,
      score.score,
      score.sample_threshold_met ? 1 : 0,
      score.no_quality_regression ? 1 : 0,
      score.decision,
      JSON.stringify({
        source: "scheduled_candidate_worker",
        role: score.role,
        quality_flags: score.quality_flags,
        low_quality_flags: score.low_quality_flags,
        spam_flag_rate: score.spam_flag_rate,
        quality_regression_reasons: score.quality_regression_reasons,
        lead_rate_retention_vs_champion: score.lead_rate_retention_vs_champion,
        close_rate_retention_vs_champion: score.close_rate_retention_vs_champion,
      }),
    ),
  );

  if (scoreStatements.length > 0) {
    await env.DB.batch(scoreStatements);
  }

  const challenger = scores.find((score) => score.role === "challenger");
  const summary =
    challenger && challenger.sample_threshold_met
      ? "Weekly growth loop scored. Challenger sample ready for human review."
      : "Weekly growth loop scored. Sample insufficient; champion remains unchanged.";

  await env.DB.prepare(
    `INSERT OR REPLACE INTO approval_queue (
      queue_id,
      type,
      risk_tier,
      status,
      human_gate,
      summary,
      payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `weekly_growth_loop_review:${week.start}`,
      "weekly_growth_loop_review",
      "T2",
      "pending_human",
      "Review weekly report and approve any external action manually.",
      summary,
      JSON.stringify({
        cron,
        week,
        scores,
        external_effects: false,
        blocked_actions: [
          "formal_post",
          "primary_link_change",
          "challenger_promotion",
          "line_push",
          "production_deploy",
          "customer_data_mutation",
          "payment",
          "delete_data",
        ],
      }),
    )
    .run();
}

function calculateD1Scores(assets: AssetRow[], counts: CountRow[]): ScoreRow[] {
  const rows = new Map<string, ScoreRow & { first_event_at: string | null; last_event_at: string | null }>();

  for (const asset of assets) {
    rows.set(asset.asset_id, {
      asset_id: asset.asset_id,
      role: asset.role,
      link_clicks: 0,
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      leads: 0,
      deals: 0,
      quality_flags: 0,
      low_quality_flags: 0,
      cta_rate: 0,
      line_add_rate: 0,
      lead_rate: 0,
      close_rate: 0,
      score: 0,
      spam_flag_rate: 0,
      lead_rate_retention_vs_champion: null,
      close_rate_retention_vs_champion: null,
      quality_regression_reasons: [],
      sample_threshold_met: false,
      no_quality_regression: true,
      decision: asset.role === "champion" ? "keep_champion_until_challenger_beats_rule" : "keep_testing_sample_insufficient",
      first_event_at: null,
      last_event_at: null,
    });
  }

  for (const count of counts) {
    const row = rows.get(count.asset_id);
    if (!row) {
      continue;
    }
    if (count.event_type === "link_click") row.link_clicks = count.n;
    if (count.event_type === "page_view") row.visits = count.n;
    if (count.event_type === "cta_click") row.cta_clicks = count.n;
    if (count.event_type === "line_add") row.line_adds = count.n;
    if (count.event_type === "lead_submit") row.leads = count.n;
    if (count.event_type === "deal") row.deals = count.n;
    if (count.event_type === "quality_flag") {
      row.quality_flags = count.n;
      row.low_quality_flags = count.low_quality_n ?? 0;
    }
    row.first_event_at = earliest(row.first_event_at, count.first_event_at);
    row.last_event_at = latest(row.last_event_at, count.last_event_at);
  }

  for (const row of rows.values()) {
    // Use page-view (visits) as the shared denominator so champion and challenger are
    // compared on the same basis — both surfaces emit page_view, only routed traffic emits link_click.
    const denominator = row.visits || row.link_clicks;
    row.cta_rate = roundNumber(safeRatio(row.cta_clicks, row.visits || denominator));
    // line_add_rate is the champion-vs-challenger comparison basis and must stay
    // visits-only: if page_view telemetry breaks (visits=0) the rate is 0 rather than
    // a link_click-based number that could bless a challenger against a falsely-low champion.
    row.line_add_rate = roundNumber(safeRatio(row.line_adds, row.visits));
    row.lead_rate = roundNumber(safeRatio(row.leads, row.line_adds || denominator));
    row.close_rate = roundNumber(safeRatio(row.deals, row.leads || row.line_adds || denominator));
    row.score = roundNumber(row.line_add_rate * 50 + row.lead_rate * 30 + row.close_rate * 20);
    row.spam_flag_rate = roundNumber(safeRatio(row.low_quality_flags, row.quality_flags));
    row.sample_threshold_met =
      row.visits >= 100 &&
      row.cta_clicks >= 20 &&
      row.line_adds >= 5 &&
      testDays(row.first_event_at, row.last_event_at) >= 3;
  }

  const champion = Array.from(rows.values()).find((row) => row.role === "champion");
  for (const row of rows.values()) {
    const qualityGate = buildQualityGate(row, champion);
    row.spam_flag_rate = qualityGate.spam_flag_rate;
    row.lead_rate_retention_vs_champion = qualityGate.lead_rate_retention_vs_champion;
    row.close_rate_retention_vs_champion = qualityGate.close_rate_retention_vs_champion;
    row.quality_regression_reasons = qualityGate.reasons;
    row.no_quality_regression = qualityGate.ok;

    if (row.role === "challenger") {
      const championRate = champion?.line_add_rate ?? 0;
      const beatsChampion = championRate > 0 && row.line_add_rate > championRate * 1.15;
      if (row.sample_threshold_met && beatsChampion && row.no_quality_regression) {
        row.decision = "eligible_for_human_promotion_review";
      } else if (row.sample_threshold_met && !row.no_quality_regression) {
        row.decision = "reject_quality_regression";
      } else if (row.sample_threshold_met) {
        row.decision = "retire_or_rework_candidate";
      } else {
        row.decision = "keep_testing_sample_insufficient";
      }
    }
  }

  return Array.from(rows.values()).map(({ first_event_at, last_event_at, ...row }) => row);
}

function buildQualityGate(row: ScoreRow, champion?: ScoreRow): {
  ok: boolean;
  spam_flag_rate: number;
  lead_rate_retention_vs_champion: number | null;
  close_rate_retention_vs_champion: number | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  const spamFlagRate = roundNumber(safeRatio(row.low_quality_flags, row.quality_flags));
  let leadRetention: number | null = null;
  let closeRetention: number | null = null;

  if (row.quality_flags > 0 && spamFlagRate > 0.05) {
    reasons.push("spam_flag_rate_above_limit");
  }

  if (row.role === "challenger" && champion) {
    if (champion.lead_rate > 0 && row.line_adds >= 5) {
      leadRetention = roundNumber(safeRatio(row.lead_rate, champion.lead_rate));
      if (leadRetention < 0.8) {
        reasons.push("lead_rate_retention_below_champion");
      }
    }

    if (champion.close_rate > 0 && champion.leads > 0 && row.leads > 0) {
      closeRetention = roundNumber(safeRatio(row.close_rate, champion.close_rate));
      if (closeRetention < 0.8) {
        reasons.push("close_rate_retention_below_champion");
      }
    }
  }

  return {
    ok: reasons.length === 0,
    spam_flag_rate: spamFlagRate,
    lead_rate_retention_vs_champion: leadRetention,
    close_rate_retention_vs_champion: closeRetention,
    reasons,
  };
}

function handleAbRoute(request: Request, env: Env, ctx: ExecutionContext, url: URL): Response {
  const requestedTestId = decodeURIComponent(url.pathname.replace("/ab/", "")) || env.AB_TEST_ID;
  const plan = buildAbRoutePlan(env);
  if (requestedTestId !== plan.test_id) {
    return json({ ok: false, error: "unknown_ab_test", expected_test_id: plan.test_id }, 404);
  }

  const sessionKey = routeSessionKey(url);
  const bucket = stableBucket(`${plan.test_id}:${sessionKey}`);
  const selectedTarget = bucket < plan.allocation.challenger ? "challenger" : "champion";
  const selectedAssetId = selectedTarget === "challenger" ? plan.challenger_asset_id : plan.champion_asset_id;

  if (selectedTarget === "champion" && !plan.champion_url_ready) {
    return json(
      {
        ok: false,
        error: "champion_url_placeholder",
        message: "Champion URL is still a placeholder. Keep A/B route in local review until owner confirms the current main funnel URL.",
        plan,
      },
      409,
    );
  }

  const event = buildEventFromRequest(request, selectedAssetId, "link_click", url, {
    route: "ab",
    test_id: plan.test_id,
    bucket,
    selected_target: selectedTarget,
    selected_asset_id: selectedAssetId,
    allocation: plan.allocation,
    public_link_change_performed: false,
  });
  event.variant_id = sanitizeOptionalToken(url.searchParams.get("variant_id"), "variant_id") ?? `${plan.test_id}:${selectedTarget}`;
  event.content_id = sanitizeOptionalToken(url.searchParams.get("content_id"), "content_id") ?? `${taipeiWeek(new Date()).start}:ab-route`;
  event.session_id = sanitizeSessionId(url.searchParams.get("sid")) ?? sessionKey;
  event.campaign = sanitizeOptionalToken(url.searchParams.get("utm_campaign"), "campaign") ?? plan.test_id;

  const redirectSourceUrl = buildRedirectSourceUrl(url, event);
  ctx.waitUntil(insertEvent(env, event));
  return Response.redirect(resolveRedirectTarget(env, selectedTarget, redirectSourceUrl, selectedAssetId), 302);
}

function buildRedirectSourceUrl(url: URL, event: NormalizedEvent): URL {
  const redirectUrl = new URL(url.toString());
  const attribution = [
    ["variant_id", event.variant_id],
    ["content_id", event.content_id],
    ["sid", event.session_id],
    ["utm_source", event.source],
    ["utm_medium", event.medium],
    ["utm_campaign", event.campaign],
  ];

  for (const [key, value] of attribution) {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  return redirectUrl;
}

function buildEventFromRequest(
  request: Request,
  assetId: string,
  eventType: FunnelEventType,
  url: URL,
  metadata: Record<string, unknown> = {},
): NormalizedEvent {
  return {
    event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    asset_id: sanitizeRequiredToken(assetId, "asset_id"),
    variant_id: sanitizeOptionalToken(url.searchParams.get("variant_id"), "variant_id"),
    content_id: sanitizeOptionalToken(url.searchParams.get("content_id"), "content_id"),
    session_id: sanitizeSessionId(url.searchParams.get("sid")),
    source: sanitizeOptionalToken(url.searchParams.get("utm_source"), "source"),
    medium: sanitizeOptionalToken(url.searchParams.get("utm_medium"), "medium"),
    campaign: sanitizeOptionalToken(url.searchParams.get("utm_campaign"), "campaign"),
    event_type: eventType,
    url: sanitizeHttpUrl(url.toString(), "url"),
    referrer: sanitizeHttpUrl(request.headers.get("referer"), "referrer"),
    user_agent_hash: null,
    ip_country: request.headers.get("cf-ipcountry"),
    value_amount: null,
    quality_score: null,
    metadata_json: JSON.stringify(metadata),
  };
}

type NormalizedEvent = {
  event_id: string;
  occurred_at: string;
  asset_id: string;
  variant_id: string | null;
  content_id: string | null;
  session_id: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  event_type: FunnelEventType;
  url: string | null;
  referrer: string | null;
  user_agent_hash: string | null;
  ip_country: string | null;
  value_amount: number | null;
  quality_score: number | null;
  metadata_json: string;
};

function sanitizeIncomingEvent(payload: IncomingEvent, request: Request, url: URL): NormalizedEvent {
  if (!payload.asset_id) {
    throw new Error("asset_id_required");
  }

  if (!payload.event_type || !ALLOWED_EVENTS.has(payload.event_type)) {
    throw new Error("invalid_event_type");
  }

  if (!PUBLIC_INGEST_EVENTS.has(payload.event_type)) {
    throw new Error("event_type_not_allowed_public");
  }

  if (payload.value_amount !== undefined || payload.quality_score !== undefined) {
    throw new Error("public_event_fields_not_allowed");
  }

  const metadata = sanitizePublicMetadata(payload.metadata_json ?? {});

  return {
    event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    asset_id: sanitizeRequiredToken(payload.asset_id, "asset_id"),
    variant_id: sanitizeOptionalToken(payload.variant_id, "variant_id"),
    content_id: sanitizeOptionalToken(payload.content_id, "content_id"),
    session_id: sanitizeSessionId(payload.session_id),
    source: sanitizeOptionalToken(payload.source ?? url.searchParams.get("utm_source"), "source"),
    medium: sanitizeOptionalToken(payload.medium ?? url.searchParams.get("utm_medium"), "medium"),
    campaign: sanitizeOptionalToken(payload.campaign ?? url.searchParams.get("utm_campaign"), "campaign"),
    event_type: payload.event_type,
    url: sanitizeHttpUrl(payload.url, "url"),
    referrer: sanitizeHttpUrl(payload.referrer ?? request.headers.get("referer"), "referrer"),
    user_agent_hash: null,
    ip_country: request.headers.get("cf-ipcountry"),
    value_amount: null,
    quality_score: null,
    metadata_json: JSON.stringify(metadata),
  };
}

function sanitizeRequiredToken(value: unknown, field: string): string {
  const sanitized = sanitizeOptionalToken(value, field);
  if (!sanitized) {
    throw new Error(`invalid_${field}`);
  }
  return sanitized;
}

function sanitizeOptionalToken(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`invalid_${field}`);
  }
  const normalized = value.trim();
  if (!SAFE_TOKEN_PATTERN.test(normalized) || containsPiiLike(normalized)) {
    throw new Error(`invalid_${field}`);
  }
  return normalized;
}

function sanitizeSessionId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string" || !UUID_V4_PATTERN.test(value.trim())) {
    throw new Error("invalid_session_id");
  }
  return value.trim().toLowerCase();
}

function containsPiiLike(value: string): boolean {
  const candidates = [value];
  let decoded = value;
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      candidates.push(next);
      decoded = next;
    } catch {
      break;
    }
  }
  return candidates.some((candidate) =>
    EMAIL_LIKE_PATTERN.test(candidate) || PHONE_LIKE_PATTERN.test(candidate)
  );
}

async function readBoundedRequestBody(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("payload_too_large");
        throw new Error("payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function sanitizeHttpUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error(`invalid_${field}`);
  }
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`invalid_${field}`);
    }
    parsed.search = "";
    parsed.hash = "";
    if (containsPiiLike(`${parsed.hostname}${parsed.pathname}`)) {
      throw new Error(`invalid_${field}`);
    }
    const sanitized = parsed.toString();
    if (sanitized.length > 512) {
      throw new Error(`invalid_${field}`);
    }
    return sanitized;
  } catch (error) {
    if (error instanceof Error && error.message === `invalid_${field}`) throw error;
    throw new Error(`invalid_${field}`);
  }
}

function sanitizePublicMetadata(metadata: unknown): Record<string, string | boolean | number | null> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("invalid_metadata_value");
  }
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length > 8) {
    throw new Error("invalid_metadata_value");
  }
  const sanitized: Record<string, string | boolean | number | null> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.toLowerCase();
    if (
      !ALLOWED_PUBLIC_METADATA_KEYS.has(key)
      || BLOCKED_METADATA_KEYS.some((blocked) => key.includes(blocked))
    ) {
      throw new Error("blocked_metadata_key");
    }
    if (rawValue === null || typeof rawValue === "boolean") {
      sanitized[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      if (Number.isInteger(rawValue) && containsPiiLike(String(rawValue))) {
        throw new Error("invalid_metadata_value");
      }
      sanitized[key] = rawValue;
      continue;
    }
    if (typeof rawValue !== "string" || rawValue.length > 256) {
      throw new Error("invalid_metadata_value");
    }
    if (containsPiiLike(rawValue)) {
      throw new Error("invalid_metadata_value");
    }
    sanitized[key] = rawValue;
  }
  return sanitized;
}

async function insertEvent(env: Env, event: NormalizedEvent): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO lp_events (
      event_id,
      occurred_at,
      asset_id,
      variant_id,
      content_id,
      session_id,
      source,
      medium,
      campaign,
      event_type,
      url,
      referrer,
      user_agent_hash,
      ip_country,
      value_amount,
      quality_score,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      event.event_id,
      event.occurred_at,
      event.asset_id,
      event.variant_id,
      event.content_id,
      event.session_id,
      event.source,
      event.medium,
      event.campaign,
      event.event_type,
      event.url,
      event.referrer,
      event.user_agent_hash,
      event.ip_country,
      event.value_amount,
      event.quality_score,
      event.metadata_json,
    )
    .run();
}

function resolveRedirectTarget(env: Env, target: string, sourceUrl?: URL, assetId?: string): string {
  if (target === "line") {
    return env.LINE_URL;
  }
  if (target === "champion") {
    // Champion arm must carry the same attribution params as the challenger arm,
    // otherwise the champion site's telemetry mints a fresh session and the
    // AB link_click can never be joined to champion-arm page_view/cta_click.
    return appendAttributionParams(new URL(env.CHAMPION_URL), sourceUrl, assetId).toString();
  }
  if (target === "challenger") {
    return appendAttributionParams(new URL(env.CHALLENGER_URL, env.PUBLIC_BASE_URL), sourceUrl, assetId).toString();
  }
  return appendAttributionParams(new URL("/candidate", env.PUBLIC_BASE_URL), sourceUrl, assetId).toString();
}

function appendAttributionParams(targetUrl: URL, sourceUrl?: URL, assetId?: string): URL {
  if (!sourceUrl) {
    return targetUrl;
  }

  const fields: Record<string, string> = {
    utm_source: "source",
    utm_medium: "medium",
    utm_campaign: "campaign",
    content_id: "content_id",
    variant_id: "variant_id",
    sid: "session_id",
  };
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = sourceUrl.searchParams.get(key);
    if (value) {
      const sanitized = sanitizeOptionalToken(value, fields[key] ?? key);
      if (sanitized) targetUrl.searchParams.set(key, sanitized);
    }
  }

  const resolvedAssetId = sanitizeOptionalToken(assetId ?? sourceUrl.searchParams.get("asset_id"), "asset_id");
  if (resolvedAssetId) {
    targetUrl.searchParams.set("asset_id", resolvedAssetId);
  }

  return targetUrl;
}

function buildAbRoutePlan(env: Env): AbRoutePlan {
  const challengerPercent = parsePercent(env.AB_CHALLENGER_PERCENT, 10);
  const championUrlReady = !env.CHAMPION_URL.includes("replace-with-current") && env.CHAMPION_URL !== "PENDING_CURRENT_MAIN_LINK";
  return {
    test_id: env.AB_TEST_ID,
    champion_asset_id: env.CHAMPION_ASSET_ID,
    challenger_asset_id: env.CHALLENGER_ASSET_ID,
    allocation: {
      champion: 100 - challengerPercent,
      challenger: challengerPercent,
    },
    champion_url: env.CHAMPION_URL,
    champion_url_ready: championUrlReady,
    external_effects: false,
    human_gate: "Do not place /ab/:testId in public traffic until owner approves the exact URL, traffic share, duration, and rollback path.",
  };
}

function routeSessionKey(url: URL): string {
  const sid = url.searchParams.get("sid");
  if (sid) {
    return sanitizeSessionId(sid) as string;
  }
  return crypto.randomUUID();
}

function parsePercent(raw: string, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), 0), 100);
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function isAllowedEventOrigin(origin: string | null, requestUrl: URL, env: Env): boolean {
  if (!origin) {
    return false;
  }
  return origin === requestUrl.origin || origin === env.CHAMPION_ORIGIN;
}

function eventCorsHeaders(origin: string | null): HeadersInit {
  if (!origin) {
    return {};
  }
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function renderCandidateHtml(env: Env, url: URL): string {
  const requestedAssetId = url.searchParams.get("asset_id");
  // Reflected-XSS guard: only accept a strict id, else fall back to the default.
  // Prevents breaking out of the inline <script> (JSON.stringify does not neutralize </script>).
  const assetId =
    requestedAssetId && /^[A-Za-z0-9_-]{1,64}$/.test(requestedAssetId)
      ? requestedAssetId
      : "challenger-week0-cta-text-v1";
  const lineUrl = env.LINE_URL;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3Q 48h 成交診斷</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1d2528;
      --paper: #f7f3ea;
      --signal: #00a676;
      --clay: #b85c38;
      --line: #d8c7a3;
      --panel: #fffaf0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--paper);
      color: var(--ink);
    }
    main {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      padding: clamp(24px, 6vw, 72px);
    }
    .sheet {
      width: min(100%, 1040px);
      max-width: 1040px;
      margin: 0 auto;
      border-top: 3px solid var(--ink);
      border-bottom: 1px solid var(--line);
      padding: clamp(28px, 5vw, 64px) 0;
    }
    .label {
      width: fit-content;
      padding: 6px 10px;
      background: var(--signal);
      color: white;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
    }
    h1 {
      max-width: 900px;
      margin: 22px 0 18px;
      font-size: 72px;
      line-height: 1.02;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: clamp(24px, 5vw, 72px);
      align-items: end;
    }
    p {
      max-width: 640px;
      font-size: 20px;
      line-height: 1.55;
    }
    .proof {
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 18px;
    }
    .proof strong {
      display: block;
      font-size: 34px;
      line-height: 1;
      color: var(--clay);
    }
    .cta {
      display: inline-flex;
      min-height: 52px;
      align-items: center;
      justify-content: center;
      margin-top: 22px;
      padding: 0 22px;
      border: 0;
      background: var(--ink);
      color: white;
      font-weight: 850;
      text-decoration: none;
    }
    .small {
      margin-top: 14px;
      font-size: 14px;
      line-height: 1.45;
      color: #5c686c;
    }
    @media (max-width: 1100px) {
      h1 { font-size: 56px; }
    }
    @media (max-width: 760px) {
      main {
        align-items: start;
        padding: 28px 20px;
      }
      .sheet { padding: 28px 0; }
      .grid { grid-template-columns: 1fr; }
      h1 {
        margin-top: 18px;
        font-size: 42px;
        line-height: 1.08;
      }
      p { font-size: 18px; }
      .cta {
        width: 100%;
        padding: 12px 18px;
        text-align: center;
      }
      .proof strong { font-size: 28px; }
    }
    @media (max-width: 420px) {
      h1 { font-size: 36px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="sheet">
      <div class="label">3Q Growth Loop / Candidate</div>
      <h1>48 小時內，把你的頁面改成會有人加 LINE 的版本。</h1>
      <div class="grid">
        <div>
          <p>丟一個現有頁面或貼文，我先抓出流量漏在哪：hook、offer、視覺主張或 CTA。這輪只測 CTA，不動主連結、不承諾成交、不碰客戶資料。</p>
          <a class="cta" href="${escapeHtml(lineUrl)}" data-asset-id="${escapeHtml(assetId)}">加 LINE 領 48h 成交診斷</a>
          <div class="small">送出前由學誼人工確認；本頁是候選頁，不是正式主頁。</div>
        </div>
        <aside class="proof">
          <strong>1 變因</strong>
          本輪只改 CTA text。樣本不足時保留冠軍頁，挑戰頁不會自動扶正。
        </aside>
      </div>
    </section>
  </main>
  <script>
    const assetId = ${JSON.stringify(assetId)};
    const params = new URLSearchParams(window.location.search);
    const attribution = {
      asset_id: assetId,
      variant_id: params.get("variant_id"),
      content_id: params.get("content_id"),
      session_id: params.get("sid"),
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
    };
    function sendCandidateEvent(eventType) {
      navigator.sendBeacon?.("/e", JSON.stringify({
        ...attribution,
        event_type: eventType,
        url: window.location.href,
        referrer: document.referrer || null,
        metadata_json: { surface: "candidate" },
      }));
    }
    sendCandidateEvent("page_view");
    document.querySelector(".cta")?.addEventListener("click", () => {
      sendCandidateEvent("cta_click");
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type WeekBounds = { start: string; end: string; startUtc: string; endUtc: string };

function taipeiWeek(date: Date): WeekBounds {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipeiDate);
  start.setDate(taipeiDate.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const startDate = dateOnly(start);
  const endDate = dateOnly(end);
  // occurred_at is stored as UTC ISO (…Z). Convert the Taipei-local week boundaries
  // (UTC+8) to UTC instants so the string comparison against stored timestamps is correct.
  return {
    start: startDate,
    end: endDate,
    startUtc: new Date(`${startDate}T00:00:00.000+08:00`).toISOString(),
    endUtc: new Date(`${endDate}T23:59:59.999+08:00`).toISOString(),
  };
}

function completedTaipeiWeek(now: Date): WeekBounds {
  // Step back into the previous Taipei week so the whole Mon–Sun window is already in the past.
  const current = taipeiWeek(now);
  const previousAnchor = new Date(new Date(`${current.start}T00:00:00.000+08:00`).getTime() - 24 * 60 * 60 * 1000);
  return taipeiWeek(previousAnchor);
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeRatio(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function earliest(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return next < current ? next : current;
}

function latest(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return next > current ? next : current;
}

function testDays(first: string | null, last: string | null): number {
  if (!first || !last) {
    return 0;
  }
  const start = new Date(first);
  const end = new Date(last);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 0;
  }
  return Math.max(Math.floor((end.valueOf() - start.valueOf()) / 86400000) + 1, 1);
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  return Response.json(body, {
    status,
    headers: responseHeaders,
  });
}
