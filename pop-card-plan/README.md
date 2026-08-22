# POP CARD 通用店家方案頁（靜態版）

LINE 圖文選單「店家老闆 → 方案與價格」那顆鈕指到這裡。

- **正本產生器**＝`~/Documents/Codex/carcare-shop-page`（`shops/pop.json` ＋ `src/worker.js` 的 `planPage`）。
  改內容改那邊的 JSON，重新 render 再覆蓋本檔，**不要直接手改 index.html**（下次重生會被蓋掉）。
- 為什麼是靜態版：carcare-shop Worker 要 `wrangler` 部署，本機 token 已過期；
  GitHub Pages 從 main 根目錄自動發佈，不需要任何憑證。等 wrangler 恢復後可改指
  `https://carcare-shop.milk790.workers.dev/s/pop/plan`（同一份內容）。
- 這是**產品方案頁不是客戶店頁**：不帶任何客戶 PII（電話／地址一律空）。
- 價格為 2026-08-23 定版：月費 799＋開通建置 1,500；預付 3/6/12 期 2,280／4,320／7,990。
  舊的 1,299 第二階與 6,000–12,000 導入費已作廢，不要復活。

重新產生：
```
cd ~/Documents/Codex/carcare-shop-page && node build.mjs
node <render script> src/worker.js /tmp/plan.html   # 見交付台帳
```
