#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")/.."

WORKER_NAME="luxury-line-oa"
HEALTH_URL="https://luxury-line-oa.milk790.workers.dev/health"
WEBHOOK_URL="https://luxury-line-oa.milk790.workers.dev/"

echo "== luxury-line-oa LINE credential gate =="
echo "Worker: ${WORKER_NAME}"
echo "Secrets go directly to Cloudflare Wrangler and are not saved to disk."
echo "Use the LINE Developers values for Angel @186 / 精品私圈 only."
echo

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler not found. Use npm script fallback first:"
  echo "  npm run dry-run"
  exit 1
fi

echo "Checking Cloudflare auth..."
wrangler whoami >/dev/null

echo
echo "Current public health:"
curl -sS "${HEALTH_URL}" || true
echo

echo
echo "Paste LINE_CHANNEL_ACCESS_TOKEN, then press Enter:"
IFS= read -rs LINE_CHANNEL_ACCESS_TOKEN
echo
if [[ -z "${LINE_CHANNEL_ACCESS_TOKEN}" ]]; then
  echo "LINE_CHANNEL_ACCESS_TOKEN is empty; aborting."
  exit 1
fi
printf "%s" "${LINE_CHANNEL_ACCESS_TOKEN}" | wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --name "${WORKER_NAME}"
unset LINE_CHANNEL_ACCESS_TOKEN

echo
echo "Paste LINE_CHANNEL_SECRET if you want to rotate/rewrite it."
echo "Press Enter with an empty value to keep the existing secret."
IFS= read -rs LINE_CHANNEL_SECRET
echo
if [[ -n "${LINE_CHANNEL_SECRET}" ]]; then
  printf "%s" "${LINE_CHANNEL_SECRET}" | wrangler secret put LINE_CHANNEL_SECRET --name "${WORKER_NAME}"
else
  echo "Skipped LINE_CHANNEL_SECRET."
fi
unset LINE_CHANNEL_SECRET

echo
echo "Optional: paste ADMIN_KEY if /admin/* should be enabled."
echo "Press Enter with an empty value to skip."
IFS= read -rs ADMIN_KEY
echo
if [[ -n "${ADMIN_KEY}" ]]; then
  printf "%s" "${ADMIN_KEY}" | wrangler secret put ADMIN_KEY --name "${WORKER_NAME}"
else
  echo "Skipped ADMIN_KEY."
fi
unset ADMIN_KEY

echo
echo "Current secret names:"
wrangler secret list --name "${WORKER_NAME}"

echo
echo "Public health after secret writes:"
curl -sS "${HEALTH_URL}" || true
echo

echo
echo "Fake-signature webhook probe:"
status="$(curl -sS -o /tmp/luxury-line-oa-fake-signature.json -w '%{http_code}' -X POST "${WEBHOOK_URL}" \
  -H 'content-type: application/json' \
  -H 'x-line-signature: invalid' \
  --data '{"events":[]}')"
echo "status=${status}"
cat /tmp/luxury-line-oa-fake-signature.json || true
echo
echo "Target before LINE Verify: status=401 Unauthorized, not 503 token/secret missing."

echo
echo "LINE Developers Console:"
echo "1. Messaging API -> Webhook URL = ${WEBHOOK_URL}"
echo "2. Press Verify and confirm Success"
echo "3. Turn on Use webhook"
echo "4. Turn off Auto-reply messages"
echo "5. Send test message: Chanel CF 的真偽重點"
