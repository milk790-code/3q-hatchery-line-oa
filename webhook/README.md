# 3Q Hatchery LINE OA Webhook

Cloudflare Worker that handles LINE Messaging API webhook events for the
3Q Hatchery Official Account.

## Behavior

| LINE event | Worker response |
|---|---|
| `follow` (new friend) | Welcome card image + greeting text |
| `message` text matching a keyword | Auto-reply text (+ carousel for `實例`/`案例`/`看作品`) |
| `message` text not matching | Away message |
| Other events | Ignored |

## Environment variables

| Name | Type | Where |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | secret | `wrangler secret put` or dashboard "Secrets" |
| `LINE_CHANNEL_SECRET` | secret | same |
| `PNG_BASE_URL` | plain | `wrangler.toml` `[vars]` or dashboard "Variables" |

## Deploy

### Via Cloudflare dashboard

1. https://dash.cloudflare.com → Workers & Pages → Create application → Create Worker
2. Name it `3q-hatchery-webhook`
3. Click "Edit code" → paste contents of `worker.js`
4. Save and deploy
5. Settings → Variables → add 2 secrets + 1 plain var
6. Note the URL (`https://3q-hatchery-webhook.<your-subdomain>.workers.dev`)

### Via Wrangler

```bash
cd webhook
npx wrangler login         # one-time
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler deploy
```

## Configure LINE

In LINE Developers Console → your channel → Messaging API tab:

- Webhook URL: `https://3q-hatchery-webhook.<subdomain>.workers.dev`
- Use webhook: ON
- "Verify" button: should return 200
- Disable "Auto-reply messages" (so the webhook handles all replies)
- Disable "Greeting messages" (so the webhook's follow event handles welcome)

## Test

- Add the bot as a friend → should receive welcome image + greeting text
- Send "好物" → should receive 好物・好照 auto-reply
- Send "實例" → should receive 3 cases + carousel of 4 cards
- Send random text → should receive away message

## Signature verification

The worker rejects requests without a valid `X-Line-Signature` header.
Signature = `base64(hmac-sha256(channelSecret, requestBody))`.
This blocks anyone who finds the URL from triggering replies.
