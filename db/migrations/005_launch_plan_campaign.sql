-- 005: 掘計畫推廣活動素材排程
-- 14 天 Facebook + Instagram 貼文內容
-- 使用 GitHub Pages CDN 圖片（assets/exports）
-- 發布前 Worker 會用 AI 展開 caption_seed 成完整文案
--
-- 運行方式：
--   wrangler d1 execute 3q-hatchery-crm --remote --file=db/migrations/005_launch_plan_campaign.sql
--
-- 圖片 CDN 基礎 URL：
--   https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/

-- ─────────────────────────────────────────────────
-- FACEBOOK 貼文（1 篇/天，連續 14 天）
-- ─────────────────────────────────────────────────

INSERT INTO content_queue (platform, image_url, caption_seed, topic_tag, scheduled_at, source_oa) VALUES

-- Day 1: 掘計畫宣告
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3Q-HATCHERY_welcome-card_1040x1040.png',
 '掘計畫正式啟動：免費幫5家台灣好品牌建官網，先用滿意再付費，每行業只收一名',
 NULL,
 datetime('now', '+1 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 2: 痛點故事
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-ink-1080x1040.png',
 '台灣小品牌最常見的3個困境：沒官網被忽視、有官網沒維護、有人維護收費貴',
 NULL,
 datetime('now', '+2 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 3: 案例展示 (s01)
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s01-1080x1040.png',
 '品牌設計案例：傳統麵攤到有質感官網，三天完成，客人第一次在網路上找到他們',
 NULL,
 datetime('now', '+3 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 4: 月費遞減邏輯說明
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-linen-1080x1040.png',
 '掘計畫月費為什麼前高後低：越早加入的人幫我們驗證模式，我們也對他們更用心',
 NULL,
 datetime('now', '+4 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 5: AI 生圖早鳥
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s02-1080x1040.png',
 '好物好照AI生圖：前10個行業限定100元體驗（市價500），好商品值得好照片',
 NULL,
 datetime('now', '+5 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 6: 互推邏輯
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-bowl-1080x1040.png',
 '為什麼掘計畫要互推：5家不同行業的好品牌，每家都有自己的受眾，互相介紹等於免費廣告',
 NULL,
 datetime('now', '+6 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 7: 案例展示 (s03)
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s03-1080x1040.png',
 '農產品品牌孵化案例：一束稻一個故事，包裝設計到官網一條龍，三個月後開始穩定出貨',
 NULL,
 datetime('now', '+7 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 8: 選配說明
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-stalk-1080x1040.png',
 '掘計畫不是一刀切套餐：落地頁800元月費、完整官網1500元、電商2500元，選你需要的',
 NULL,
 datetime('now', '+8 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 9: 案例展示 (s04)
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s04-1080x1040.png',
 '美容工作室品牌孵化：從IG到官網，每月調整一次，三個月後預約全滿',
 NULL,
 datetime('now', '+9 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 10: 稀缺提醒
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3Q-HATCHERY_welcome-card_1040x1040.png',
 '掘計畫已有3個行業確認席位，剩下2席，每行業只收一名，加LINE確認你的行業是否開放',
 NULL,
 datetime('now', '+10 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 11: 案例展示 (s05)
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s05-1080x1040.png',
 '手作工藝品牌：從市集攤位到有官網有IG，第一個月就有陌生客人從網路訂單下單',
 NULL,
 datetime('now', '+11 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 12: 先享後付說明
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-1080x1040.png',
 '先享後付是什麼意思：我們先把官網建好給你看，你滿意了再開始付月費，不滿意全額退還鎖席費',
 NULL,
 datetime('now', '+12 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 13: 案例展示 (s06)
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s06-1080x1040.png',
 '寵物用品品牌孵化案例：從無名到有官網有品牌識別，六個月後進入通路談判',
 NULL,
 datetime('now', '+13 days', 'start of day', '+9 hours'),
 '3q-hatchery'),

-- Day 14: 最終 CTA
('facebook',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3Q-HATCHERY_welcome-card_1040x1040.png',
 '掘計畫本期截止：最後兩席，加LINE說說你的行業，24小時內確認席位是否開放，不加就沒了',
 NULL,
 datetime('now', '+14 days', 'start of day', '+9 hours'),
 '3q-hatchery');

-- ─────────────────────────────────────────────────
-- INSTAGRAM 貼文（隔天1篇，7篇共14天）
-- ─────────────────────────────────────────────────

INSERT INTO content_queue (platform, image_url, caption_seed, topic_tag, scheduled_at, source_oa) VALUES

-- Day 1 IG: 掘計畫宣告
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3Q-HATCHERY_welcome-card_1040x1040.png',
 '掘計畫：免費建官網、先用再付、限定5席每行業1名，3Q品牌孵化所全新計畫',
 NULL,
 datetime('now', '+1 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 3 IG: 案例展示
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s01-1080x1040.png',
 '品牌官網3天完成：傳統小店從無到有，AI設計高質感頁面',
 NULL,
 datetime('now', '+3 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 5 IG: AI 生圖
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s02-1080x1040.png',
 'AI商品生圖100元：好商品值得被好好拍，前10個行業特惠',
 NULL,
 datetime('now', '+5 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 7 IG: 農產案例
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s03-1080x1040.png',
 '農產品牌孵化：一束稻一個故事，台灣在地農產包裝設計到網路銷售一條龍',
 NULL,
 datetime('now', '+7 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 9 IG: 互推說明
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-bowl-1080x1040.png',
 '掘計畫互推邏輯：5家不同行業好品牌，每家介紹自己的客人，互相曝光等於免費廣告',
 NULL,
 datetime('now', '+9 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 11 IG: 案例展示
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-sample-s05-1080x1040.png',
 '手作工藝品牌從市集到網路，官網上線第一個月就有陌生客人下單',
 NULL,
 datetime('now', '+11 days', 'start of day', '+10 hours'),
 '3q-hatchery'),

-- Day 13 IG: 最終席位
('instagram',
 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-campaign-poster-1080x1040.png',
 '掘計畫剩最後2席，截止前加LINE確認行業，錯過要等下期',
 NULL,
 datetime('now', '+13 days', 'start of day', '+10 hours'),
 '3q-hatchery');
