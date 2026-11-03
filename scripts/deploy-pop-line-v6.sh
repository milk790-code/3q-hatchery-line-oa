#!/bin/bash
# 泡泡怪獸 LINE 談單腦 v6.1 一鍵上線(學誼本人跑;這支會 push main 觸發 worker 部署與 GitHub Pages)
# 用法:bash "/Users/mac/Documents/文件 - mac的MacBook Air/GitHub/3q-hatchery-line-oa/scripts/deploy-pop-line-v6.sh"
set -euo pipefail
REPO="/Users/mac/Documents/文件 - mac的MacBook Air/GitHub/3q-hatchery-line-oa"
cd "$REPO"
echo "① GitHub 登入檢查"
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "   gh 登入失效,開瀏覽器登入(照畫面按 Authorize)"
  gh auth login -h github.com -p https -w
fi
echo "② 閘門:資料同步 / AI_EMPLOYEE 同步 / 三套本機測試"
node scripts/pop-line-gen-data.mjs --check
python3 scripts/pop-line-copy-gate.py || { echo "❌ 對客文字閘沒過(痛點/賣點/保守字/他的名字/未查證數字),先修 data/pop-line 再跑"; exit 4; }
node scripts/check-sync.mjs
( cd workers/pop-line-oa && node test-v6.mjs >/dev/null && node test-b-disclosure.mjs >/dev/null && node test-menu-postback.mjs >/dev/null ) && echo "   三套測試全綠"
echo "③ 只加這次的檔(.wrangler / sanfinger 刪除 一概不碰)"
git add workers/pop-line-oa/worker.js workers/pop-line-oa/test-v6.mjs workers/pop-line-oa/test-b-disclosure.mjs workers/pop-line-oa/test-menu-postback.mjs
git add .github/workflows/deploy-pop-line-oa.yml scripts/pop-line-gen-data.mjs scripts/pop-line-video-prep.py scripts/deploy-pop-line-v6.sh scripts/pop-line-copy-gate.py
git add data/pop-line assets/pop/pricelist-1103-*.jpg assets/pop/pricelist-1028-map
[ -d assets/pop/video ] && git add assets/pop/video
for f in assets/pop/richmenu-driver-v9.jpg assets/pop/richmenu-shop-v9.jpg assets/pop/cover-v7.jpg assets/pop/cover-v7-wide.jpg assets/pop/cover-v7-wide-phone.jpg scripts/pop-richmenu-build-v9.py scripts/pop-richmenu-deploy.py scripts/pop-cover-build.py assets/pop/cover-v7-phone.jpg workers/pop-line-oa/GO_LIVE.md; do
  [ -e "$f" ] && git add "$f"
done
git status --short | grep -v "^ D\|^??" ||assets/pop/pricelist-1103-1.jpg | true
echo "④ commit + push(push 就會觸發 Cloudflare 部署與 GitHub Pages)"
git diff --cached --quiet && echo "   已提交過,略過 commit" || git commit -m "feat(pop-line-oa): v6.1 談單腦——加好友價格表、蝦皮產品卡、自家影片、貼圖限流、reply-first 省額度、鄭經說心理學

- follow 一次 reply:價格表圖 → 歡迎貼圖 → 介紹(AI 揭露)+ 分流 quick reply
- [PROD] 標籤 / 別名命中 → Flex 產品卡(蝦皮主圖、價格表定價、痛點、賣點、蝦皮購買、看施工影片)
- [VID] 標籤 / 影片時機 → 自家一剪到底 mp4(GitHub Pages),同線 7 天一次;videoPlayComplete 落庫
- stickerGate:每 3 則最多 1 次、每日 2 次、抱怨/售後不送
- SEED_GENOME / EMPLOYEE_RULES v6;DIRECTIVES 第二 system block(主 block 快取不破)
- 正本 data/pop-line/*.json → scripts/pop-line-gen-data.mjs;deploy yml 加 --check 與三套 harness 閘
- B2C 成交回蝦皮;SHOP_FLEX 改賣場卡;/img/pricelist 代理;/admin/catalog /admin/card /admin/welcome
- v6.1:主回覆 reply 不 push、「價格表」直回、拍照選品 quickReply、事件去重、多張照片合併、老闆通知合併、蝦皮連結外開、DO alarm 競態修正

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" || echo "   沒有新變更可 commit(可能已經 commit 過),繼續"
git push origin main
echo "⑤ 等 GitHub Actions 部署 worker(通常 1–2 分鐘)"
sleep 20
RUN_ID=$(gh run list --workflow deploy-pop-line-oa.yml -L 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
echo "⑥ 驗 worker 活體 seed"
curl -sS https://pop-line-oa.milk790.workers.dev/health | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('   seed =', d.get('seed'), '| reply_first =', d.get('reply_first'), '| ack_text =', d.get('ack_text'), '| catalog =', d.get('catalog'), '| videos =', d.get('videos'), '| welcome_pack =', d.get('welcome_pack'), '| token =', d.get('token'), '| owner =', d.get('owner'))
ok = d.get('seed')=='v6.1.12' and d.get('reply_first') is True and d.get('ack_text')!='on' and (d.get('catalog') or 0)>=30 and d.get('welcome_pack')==2
print('   活體檢查', '通過' if ok else '❌ 沒過:seed 要 v6.1.12、reply_firstassets/pop/pricelist-1103-1.jpg | true、ack_text 不是 on、catalog>=30、welcome_pack==2')
sys.exit(0 if ok else 7)"
echo "⑦ 驗 GitHub Pages 素材(價格表圖要回 image/jpeg)"
for i in 1 2 3 4 5 6; do
  CT=$(curl -sI https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/pricelist-1103-1.jpg | tr| tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')
  [ "$CT" = "image/jpeg" ] && break
  echo "   Pages 還在建(第 $i 次),30 秒後再看"; sleep 30
done
echo "   pricelist content-type = ${CT:-尚未就緒}"
if [ -e assets/pop/richmenu-driver-v9.jpg ]; then
  echo "⑧ 圖文選單 v7:先建立再設預設(worker 已部署,順序正確)"
  python3 scripts/pop-richmenu-deploy.py
  python3 scripts/pop-richmenu-deploy.py --set-default
fi
echo "⑨ 把 webhook 網址指到這支 worker(token 從 ~/.config/line-oa/.env 讀,不印出來)"
TOK=$(grep -i 'TOKEN' ~/.config/line-oa/.env | head -1 | cut -d= -f2- |assets/pop/pricelist-1103-1.jpg | tr -d '[:space:]"'"'"'')
curl -sS -X PUT https://api.line.me/v2/bot/channel/webhook/endpoint -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"endpoint":"https://pop-line-oa.milk790.workers.dev/webhook"}' >/dev/null && echo "   webhook URL 已設"
curl -sS https://api.line.me/v2/bot/channel/webhook/endpoint -H "Authorization: Bearer $TOK" | python3 -c "import json,sys; d=json.load(sys.stdin); print('   endpoint =', d.get('endpoint'), '| active =', d.get('active'))"
echo
echo "完成。剩下三步只有 OA 後台能做(manager.line.biz → 泡泡怪獸 → 回應設定;細節在 workers/pop-line-oa/GO_LIVE.md):"
echo "   1. 自動回應訊息 → 關   2. 加入好友的歡迎訊息 → 關(worker 會自己送)   3. Webhook → 開"
echo "   然後用你自己的手機傳一句「拾號怎麼用」給泡泡怪獸,應該只回一則,而且附一張蝦皮產品卡。"
