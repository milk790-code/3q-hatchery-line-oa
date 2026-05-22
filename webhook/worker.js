// Cloudflare Worker — LINE OA webhook for 3Q Hatchery.
// v3.6 — A: lead scoring, owner quick-reply Flex, booking flow
//         B: rich menu switching, member card, subscriber list + seasonal push
//         + 15 Rich Menu keyword routes + project status query
//
// Env vars required:
//   LINE_CHANNEL_ACCESS_TOKEN   LINE_CHANNEL_SECRET   PNG_BASE_URL
// Optional:
//   OWNER_USER_ID       — your LINE userId; receives push when inquiry submitted
//   TRIGGER_TOKEN       — bearer token for /api/csv export
//   RICHMENU_NEW        — rich menu ID for first-time visitors
//   RICHMENU_INQUIRED   — rich menu ID for users who submitted an inquiry
//   RICHMENU_CONVERTED  — rich menu ID for paying customers
// KV binding required:
//   SESSION  — KV namespace for conversation state (2-hour TTL)
// D1 binding required:
//   CRM      — D1 database `3q-hatchery-crm` for inquiries persistence
// AI binding (optional):
//   AI       — Workers AI for unmatched keyword fallback