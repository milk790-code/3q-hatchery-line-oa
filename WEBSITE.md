# 官網發佈與自訂網域

## 現況：GitHub Pages 已上線

合併到 `main` 後，GitHub Pages 會自動重建，官網首頁即顯示於：

> https://milk790-code.github.io/3q-hatchery-line-oa/

- 首頁正本：`index.html`（含 SEO / Open Graph / favicon / LINE CTA 來源追蹤）。
- `Landing Page.html` 維持為設計系統 deliverable，內容與首頁相同但不含對外 meta。
- `robots.txt`、`sitemap.xml` 供搜尋引擎索引。

### 分享預覽（Open Graph）
分享連結到 LINE / FB / IG 時，預覽卡會顯示標題、描述與圖片
（`assets/exports/3q-campaign-poster-bowl-1080x1040.png`）。
若改了內容卻看到舊預覽，到對應平台的偵錯工具清快取
（FB Sharing Debugger）即可。

### LINE CTA 來源追蹤
三處 CTA 各帶 UTM 參數（`utm_medium` 分別為 `nav` / `hero` / `footer_cta`）。
注意：`lin.ee` 短連結通常**不會**把 query 帶進 LINE OA 後台，所以這些參數
主要用於網站端分析與意圖標記。若要真正辨識「加好友來源」，未來可：
- 各管道改用不同的 `lin.ee` 連結，或
- 讓 CTA 先經由現有 Cloudflare Worker 轉址並記錄來源。

---

## 綁定自訂網域 `3q-hatchery.tw`（DNS 就緒後再做）

> 重要：**先不要**在 repo 加 `CNAME` 檔。DNS 尚未指向前就提交 CNAME，
> GitHub Pages 會把 `github.io` 網址 301 導到還無法解析的網域，導致網站從
> 兩邊都打不開。請務必先把 DNS 設好、生效，再做下面第 2 步。

1. **設定 DNS**（在網域註冊商後台）
   - Apex 網域 `3q-hatchery.tw` → 新增 4 筆 A record：
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - （選用）`www.3q-hatchery.tw` → CNAME 指向 `milk790-code.github.io`。
   - 用 `dig 3q-hatchery.tw +short` 確認已指向上述 IP 再繼續。

2. **啟用網域**：在 repo 根目錄新增 `CNAME` 檔，內容一行：
   ```
   3q-hatchery.tw
   ```
   push 到 `main` 後，到 repo Settings → Pages 確認 Custom domain 顯示綠勾，
   並勾選 **Enforce HTTPS**（憑證簽發可能需數分鐘）。

3. **更新對外網址**：把下列檔案中的網域由
   `https://milk790-code.github.io/3q-hatchery-line-oa/` 改為
   `https://3q-hatchery.tw/`：
   - `index.html`：`canonical`、`og:url`、`og:image`、`twitter:image`
   - `robots.txt`：`Sitemap:`
   - `sitemap.xml`：`<loc>`

4. **驗證**：開 `https://3q-hatchery.tw/` 確認正常、HTTPS 綠鎖、分享預覽圖正常。
