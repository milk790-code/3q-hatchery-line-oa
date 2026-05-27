# 自訂網域綁定說明 — `3q-hatchery.tw`

> **目前狀態**：官網以 GitHub Pages 預設網址運行。
> 自訂網域 DNS 尚未指向 GitHub，因此 `CNAME` 檔案**尚未加入 repo**。
> 請依下列步驟完成後再提交 `CNAME`，否則會導致 Pages 301 到無法解析的網域而整站掛掉。

---

## 綁定步驟

### 1. 網域商設定 DNS

在你的域名商後台（例如 Gandi、Cloudflare、TWNIC 代理商）擇一設定：

**方案 A — 根網域 CNAME 不支援時，設 4 筆 A Record：**

| 類型 | 主機名稱 | 值 |
|------|---------|----|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**方案 B — 設定 CNAME（適用 `www` 子網域或支援 CNAME Flattening 的服務商）：**

| 類型 | 主機名稱 | 值 |
|------|---------|----|
| CNAME | `www` | `milk790-code.github.io` |

### 2. 等待 DNS 生效

DNS 傳播通常需要 10 分鐘 ~ 48 小時。可用以下指令確認：

```bash
dig 3q-hatchery.tw +noall +answer
# 應出現 4 筆 185.199.x.153
```

### 3. 提交 `CNAME` 檔至 repo 根目錄

DNS 確認生效後，在 repo 根目錄新增一個名為 `CNAME` 的檔案，內容只有一行：

```
3q-hatchery.tw
```

提交並 push 到 `main` 分支。

### 4. GitHub Pages 設定

- 前往 `https://github.com/milk790-code/3q-hatchery-line-oa/settings/pages`
- 確認 Custom domain 欄位顯示 `3q-hatchery.tw`
- 勾選 **Enforce HTTPS**（需等 GitHub 取得 TLS 憑證，通常 15 分鐘內完成）

### 5. 更新 `index.html` 中的絕對路徑

網域生效後，將 `index.html` 的以下 meta 標籤網域從：

```
https://milk790-code.github.io/3q-hatchery-line-oa/
```

改為：

```
https://3q-hatchery.tw/
```

影響的標籤：`canonical`、`og:url`、`og:image`、`twitter:image`。

同樣更新 `sitemap.xml` 的 `<loc>`。

---

## 現行網址

| 環境 | 網址 |
|------|------|
| 現在（GitHub Pages）| `https://milk790-code.github.io/3q-hatchery-line-oa/` |
| 未來（自訂網域）| `https://3q-hatchery.tw/` |
