#!/usr/bin/env bash
# 3Q Hatchery â LINE Rich Menu ä¸éµå»ºç« + ä¸å³è³æ¬
# âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
# ç¨éï¼
#   1. ç¨ LINE Messaging API å»º 3 å richmenu schema (A / B / C)
#   2. æå°æç PNG ä¸å³å°æ¯å schema
#   3. æ A çè¨­çºé è¨­ (æ°å¥½åå å¥èªåçå°)
#   4. å°åºä¸å RICHMENU_ID â ä½ æ¿å»å¡«å° worker.js å³å¯
# ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
# ä½¿ç¨ï¼
#   export CHANNEL_TOKEN="ä½ ç_long_lived_channel_access_token"
#   cd /path/to/assets/exports/    # å¿é å¨ PNG åä¸åè³æå¤¾
#   ./upload-richmenu.sh
# âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

set -euo pipefail

# ââ --prune: ååºä¸¦åªé¤ææç¾æ Rich Menu âââââââââââââââââââââââââââââââââ
if [[ "${1:-}" == "--prune" ]]; then
  if [[ -z "${CHANNEL_TOKEN:-}" ]]; then
    echo "â --prune éè¦ CHANNEL_TOKEN â å export"; exit 1
  fi
  echo "â¸ --prune: ååºä¸¦åªé¤ç¾æ Rich Menuâ¦"
  EXISTING=$(curl -fsS -H "Authorization: Bearer ${CHANNEL_TOKEN}" \
    https://api.line.me/v2/bot/richmenu/list | \
    grep -oE '"richMenuId":"[^"]*"' | \
    sed 's/.*"\(richmenu-[^"]*\)".*/\1/')
  if [[ -z "$EXISTING" ]]; then
    echo "  â³ æ²æç¾æ Rich Menuï¼è·³é"
  else
    for rid in $EXISTING; do
      echo "  â³ DELETE $rid"
      curl -fsS -X DELETE -H "Authorization: Bearer ${CHANNEL_TOKEN}" \
        "https://api.line.me/v2/bot/richmenu/$rid" > /dev/null || true
    done
    echo "  â³ æ¸å®ï¼ç¹¼çºå»ºæ°ç"
  fi
fi


# ââ 0) æª¢æ¥ ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
if [[ -z "${CHANNEL_TOKEN:-}" ]]; then
  echo "â ç°å¢è®æ¸ CHANNEL_TOKEN æ²è¨­å®"
  echo "  å·è¡ï¼export CHANNEL_TOKEN=\"ä½ ç token\""
  exit 1
fi

for f in 3Q-HATCHERY_richmenu_a_2500x1686.png \
         3Q-HATCHERY_richmenu_b_2500x1686.png \
         3Q-HATCHERY_richmenu_c_2500x1686.png ; do
  if [[ ! -f "$f" ]]; then
    echo "â æ¾ä¸å° $f â è«ç¢ºèªä½ å¨ assets/exports/ è³æå¤¾"
    exit 1
  fi
done

API="https://api.line.me/v2/bot/richmenu"
API_DATA="https://api-data.line.me/v2/bot/richmenu"
AUTH="Authorization: Bearer ${CHANNEL_TOKEN}"

# ââ 1) ä¸å richmenu schema âââââââââââââââââââââââââââââââââââââââââââââ
# å±ç¨çåï¼3 cols Ã 2 rows = 6 cellsï¼hero è·¨å·¦ä¸ 2 cell (col 1-2 row 1)
# æ¯å cell = 833Ã843ï¼hero = 1666Ã843
read -r -d '' SCHEMA_A <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": true,
  "name": "RICHMENU_NEW",
  "chatBarText": "é¸å®",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "èªªèªªæçåº" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "åçå­µåæ¯ä»éº¼" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "æåä¸è¦½" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "åä½æ¡ä¾" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "è¯çµ¡æå" } }
  ]
}
JSON

read -r -d '' SCHEMA_B <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": false,
  "name": "RICHMENU_INQUIRED",
  "chatBarText": "é²è¡ä¸­",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "é ç´è«®è©¢" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "è¿½è¹¤é²åº¦" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "ççå ±å¹" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "åªåå»ºè­°" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "è¯çµ¡é¡§å" } }
  ]
}
JSON

read -r -d '' SCHEMA_C <<'JSON' || true
{
  "size": { "width": 2500, "height": 1686 },
  "selected": false,
  "name": "RICHMENU_CONVERTED",
  "chatBarText": "æå¡",
  "areas": [
    { "bounds": { "x": 0,    "y": 0,    "width": 1666, "height": 843 },
      "action": { "type": "message", "text": "ä½ å¥½ï¼ä»å¤©æ³åä»éº¼" } },
    { "bounds": { "x": 1666, "y": 0,    "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "æçå°æ¡çæ" } },
    { "bounds": { "x": 0,    "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "è¿½å æå" } },
    { "bounds": { "x": 833,  "y": 843,  "width": 834,  "height": 843 },
      "action": { "type": "message", "text": "VIP è³æºåº«" } },
    { "bounds": { "x": 1667, "y": 843,  "width": 833,  "height": 843 },
      "action": { "type": "message", "text": "ä»ç´¹æ°å®¢æ¶" } }
  ]
}
JSON

# ââ 2) helperï¼å»º schema â ä¸å³ png â åå³ id âââââââââââââââââââââââââââ
upload_one() {
  local label="$1"
  local schema="$2"
  local png="$3"

  echo ""
  echo "â¸ [$label] å»ºç« schemaâ¦"
  local resp
  resp=$(curl -fsS -X POST "$API" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    -d "$schema")
  local id
  id=$(echo "$resp" | sed -n 's/.*"richMenuId":"\([^"]*\)".*/\1/p')
  if [[ -z "$id" ]]; then
    echo "â [$label] å»ºç«å¤±æï¼$resp"
    return 1
  fi
  echo "  â³ schema å»ºå¥½ï¼$id"

  echo "â¸ [$label] ä¸å³ $pngâ¦"
  curl -fsS -X POST "$API_DATA/$id/content" \
    -H "$AUTH" \
    -H "Content-Type: image/png" \
    --data-binary "@$png" > /dev/null
  echo "  â³ ä¸å³å®æ"

  echo "$id"
}

# ââ 3) è·ä¸å ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
ID_A=$(upload_one "A Â· NEW"        "$SCHEMA_A" "3Q-HATCHERY_richmenu_a_2500x1686.png")
ID_B=$(upload_one "B Â· INQUIRED"   "$SCHEMA_B" "3Q-HATCHERY_richmenu_b_2500x1686.png")
ID_C=$(upload_one "C Â· CONVERTED"  "$SCHEMA_C" "3Q-HATCHERY_richmenu_c_2500x1686.png")

# ââ 4) A çè¨­çºæ°å¥½åé è¨­ ââââââââââââââââââââââââââââââââââââââââââââââ
echo ""
echo "â¸ è¨­å® A ççºé è¨­ rich menu (æ°å¥½åçå°ç)â¦"
curl -fsS -X POST "https://api.line.me/v2/bot/user/all/richmenu/$ID_A" \
  -H "$AUTH" > /dev/null
echo "  â³ é è¨­å·²è¨­"

# ââ 5) å°çµæ ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
cat <<EOF

âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  â ä¸ç Rich Menu é½å»ºå¥½äºãæä¸é¢ 3 è¡è²¼å° worker.jsï¼
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const RICHMENU_NEW       = '$ID_A';
const RICHMENU_INQUIRED  = '$ID_B';
const RICHMENU_CONVERTED = '$ID_C';

âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  ä¸ä¸æ­¥ï¼
  â¢ ç¨æ¸¬è©¦å¸³èå  OA â ç¢ºèªçå° A ç (æ°å¥½åèªå)
  â¢ Worker è§¸ç¼ INQUIRED åæ â linkRichMenu(\$userId, RICHMENU_INQUIRED)
  â¢ Worker è§¸ç¼ CONVERTED åæ â linkRichMenu(\$userId, RICHMENU_CONVERTED)
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
EOF
