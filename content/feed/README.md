# content/feed/ — 投餵自動部署包

把貼文批次丟進這個資料夾、push 到 main,CI 自動投進生產發文佇列。
不用再寫 SQL migration、不用手動 dispatch、不怕重複(worker v2.3 對 pending 同文去重)。

## 用法(3 步)

1. 建一個 JSON 檔,例如 `content/feed/wave6.json`(格式見下)
2. 本機先驗(可選):`node scripts/validate-feed.mjs content/feed/wave6.json`
3. commit + push main → `feed-content.yml` 自動:驗證 → 確認 worker ≥2.3 → 打 `/queue/add` → Actions summary 列出 added / skipped / new ids

漏觸發或要補投:Actions → **Feed content queue (投餵)** → Run workflow → 填檔名。

## 格式

一個檔 = 一個 JSON array(≤50 筆),每筆:

| 欄位 | 必填 | 說明 |
|---|---|---|
| `platform` | ✅ | `facebook` / `instagram` / `threads` / `tiktok` / `google_biz` |
| `caption` | ✅(或 caption_seed) | 完整文案。`caption_seed` = 只給關鍵字讓 Workers AI 展開 |
| `image_url` | IG 必填 | 公開 URL(GitHub Pages CDN 最穩);FB/Threads 可純文字 |
| `link_url` | 建議 | 引流連結,FB 會進首留言;**記得帶 utm_content 變體標記**(CTR 歸因靠它) |
| `scheduled_at` | 建議 | `2026-06-20T12:00:00Z`(UTC,台北 -8h)。**不填 = 排在所有過期排程之後**,積壓期間會等很久 |
| `topic_tag` | 選 | Threads 專用,一篇一個 |
| `source_oa` | 選 | 預設 `3q-hatchery`;土地公內容填 `tudigong` |

範例:`example.json.disabled`(改名去掉 `.disabled` 才會被吃)。

## 行為與保險

- **去重**:與佇列中 pending 列的 platform+caption+caption_seed+image_url 完全相同 → skip(回報 `duplicate_of`)。已 published 的同文**不會**被擋——但 workflow 只投「本次 push 變更的檔案」,舊檔不動就不會重投。
- **發布節奏**:cron 09:00 二~四 / 12:00 三 / 20:30 每日(台北),每輪每平台最多 1 篇;日上限 FB 3 / IG 2 / Threads 3。佇列順序 = `scheduled_at` 越早越先(過期積壓會優先消化)。
- **品牌聲腔**:驗證器會對驚嘆號出警告(不擋)。金融雷字/假稀缺/最高級宣稱請自律,worker 不檢查。
- 一次 push 多個 commit 時只比對最後一個 commit 的變更;沒吃到就用手動 dispatch 補。

## 分工(與既有管道的關係)

- **這裡(content/feed/)**:日常內容投餵 → 走 worker `/queue/add`(吃到去重與驗證)
- `seed-content-queue.yml` + `db/migrations/*.sql`:schema 變更與歷史批次(raw SQL,**繞過去重**,內容投餵請改走這裡)
- `publish-now.yml`:手動催發 / backfill 引流連結
