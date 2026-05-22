#!/usr/bin/env bash
# 3Q Hatchery — LINE Rich Menu 一鍵建立 + 上傳素材
# ───────────────────────────────────────────────────────────────────────────
# 用途：
#   1. 用 LINE Messaging API 建 3 個 richmenu schema (A / B / C)
#   2. 把對應的 PNG 上傳到每個 schema
#   3. 把 A 版設為預設 (新好友加入自動看到)
#   4. 印出三個 RICHMENU_ID — 你拿去填到 worker.js 即可
# ──────────────────────────────────────────────────────────────────────────
# 使用：
#   export CHANNEL_TOKEN="你的_long_lived_channel_access_token"
#   cd /path/to/assets/exports/    # 必須在 PNG 同一個資料夾
#   ./upload-richmenu.sh
# ───────────────────────────────────────────────────────────────────────────

set -euo pipefail
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# ── --prune: 先列出並刪除所有現有 Rich Menu ────────────────────────────────
if [[ "${1:-}" == "--prune" ]]; then
  if [[ -z "${CHANNEL_TOKEN:-}" ]]; then
    echo "✗ --prune 需要 CHANNEL_TOKEN — 請 export"; exit 1
  fi
  echo "▸ --prune: 列出並刪除現有 Rich Menu…"
  EXISTING=$(curl -fsS -H "Authorization: Bearer ${CHANNEL_TOKEN}" \
    https://api.line.me/v2/bot/richmenu/list | \
    grep -oE '"richMenuId":"[^"]*"' | \
    sed 's/.*"\(richmenu-[^"]*\)".*/\1/')
  if [[ -z "$EXISTING" ]]; then
    echo "  ↳ 沒有現有 Rich Menu，跳過"
  else
    for rid in $EXISTING; do
      echo "  ↳ DELETE $rid"
      curl -fsS -X DELETE -H "Authorization: Bearer ${CHANNEL_TOKEN}" \
        -H "Content-Length: 0" \
        "https://api.line.me/v2/bot/richmenu/$rid" > /dev/null || true
    done
    echo "  ↳ 清完，繼續建新的"
  fi
fi


# ── 0) 檢查 ──────────────────────────────────────────────────────────────
if [[ -z "${CHANNEL_TOKEN:-}" ]]; then
  echo "✗ 環境變數 CHANNEL_TOKEN 沒設定"
  echo "  執行：export CHANNEL_TOKEN=\"你的 token\""
  exit 1
fi

for f in 3Q-HATCHERY_richmenu_a_2500x1686.png \
         3Q-HATCHERY_richmenu_b_2500x1686.png \
         3Q-HATCHERY_richmenu_c_2500x1686.png ; do
  if [[ ! -f "$f" ]]; then
    echo "✗ 找不到 $f — 請確認你在 assets/exports/ 資料夾"
    exit 1
  fi
done

API="https://api.line.me/v2/bot/richmenu"
API_DATA="https://api-data.line.me/v2/bot/richmenu"
AUTH="Authorization: Bearer ${CHANNEL_TOKEN}"

# ── 1) 三個 richmenu schema ──────────────────────────────────────────────
# 共用格：3 cols × 2 rows = 6 cells，hero 跨左上 2 cell (col 1-2 row 1)
# 每個 cell = 833×843，hero = 1666×843
read -r -d '' SCHEMA_A <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": true,
  "name": "RICHMENU_NEW",
  "chatBarText": "選單",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "說說你的店" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "品牌孵化是什麼" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "服務一覽" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "合作案例" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "聯絡我們" } }
  ]
}
JSON

read -r -d '' SCHEMA_B <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": false,
  "name": "RICHMENU_INQUIRED",
  "chatBarText": "進行中",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "預約諮詢" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "追蹤進度" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "看看報價" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "優化建議" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "聯絡顧問" } }
  ]
}
JSON

read -r -d '' SCHEMA_C <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": false,
  "name": "RICHMENU_CONVERTED",
  "chatBarText": "會員",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "你好，今天想做什麼" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "我的專案狀態" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "追加服務" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "VIP 資源庫" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "介紹新客戶" } }
  ]
}
JSON

# ── 2) helper：建 schema → 上傳 png → 回傳 id ───────────────────────────
upload_one() {
  local label="$1"
  local schema="$2"
  local png="$3"

  echo ""
  echo "▸ [$label] 建立 schema…"
  local resp
  resp=$(curl -fsS -X POST "$API" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    -d "$schema")
  local id
  id=$(echo "$resp" | sed -n 's/.*"richMenuId":"\([^"]*\)".*/\1/p')
  if [[ -z "$id" ]]; then
    echo "✗ [$label] 建立失敗：$resp"
    return 1
  fi
  echo "  ↳ schema 建好：$id"

  echo "▸ [$label] 上傳 $png…"
  curl -fsS -X POST "$API_DATA/$id/content" \
    -H "$AUTH" \
    -H "Content-Type: image/png" \
    --data-binary "@$png" > /dev/null
  echo "  ↳ 上傳完成"

  echo "$id"
}

# ── 3) 跑三個 ────────────────────────────────────────────────────────────
ID_A=$(upload_one "A · NEW"        "$SCHEMA_A" "3Q-HATCHERY_richmenu_a_2500x1686.png" | tail -1)
ID_B=$(upload_one "B · INQUIRED"   "$SCHEMA_B" "3Q-HATCHERY_richmenu_b_2500x1686.png" | tail -1)
ID_C=$(upload_one "C · CONVERTED"  "$SCHEMA_C" "3Q-HATCHERY_richmenu_c_2500x1686.png" | tail -1)

# ── 4) A 版設為新好友預設 ─────────────────────────────────────────────────
echo ""
echo "▸ 設定 A 版為預設 rich menu (新好友到達的)…"
curl -fsS -X POST "https://api.line.me/v2/bot/user/all/richmenu/$ID_A" \
  -H "$AUTH" -H "Content-Length: 0" > /dev/null
echo "  ↳ 預設已設"

# ── 5) 印結果 ─────────────────────────────────────────────────────────────
cat <<EOF

───────────────────────────────────────────────────────────────────────
  ✅ 三個 Rich Menu 都建好了。把下面 3 行貼到 worker.js：
───────────────────────────────────────────────────────────────────────

const RICHMENU_NEW       = '$ID_A';
const RICHMENU_INQUIRED  = '$ID_B';
const RICHMENU_CONVERTED = '$ID_C';

───────────────────────────────────────────────────────────────────────
  下一步：
  • 用測試帳號加 OA → 確認看到 A 版 (新好友自動)
  • Worker 觸發 INQUIRED 動作 → linkRichMenu(\$userId, RICHMENU_INQUIRED)
  • Worker 觸發 CONVERTED 動作 → linkRichMenu(\$userId, RICHMENU_CONVERTED)
───────────────────────────────────────────────────────────────────────
EOF
