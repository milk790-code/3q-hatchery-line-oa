-- 008: 3Q 獲客首批 — 泡泡怪獸 FB 軟置入 ×3(每 3 天 1 篇)
-- caption 直出(不走 AI 展開);link_url 發布後自動進首留言。
-- 文案已過品牌聲腔安全網:無金融雷字、無假稀缺、無最高級宣稱。
-- 排程:UTC 01:00 = 台灣 09:00。

INSERT INTO content_queue (platform, image_url, caption_seed, caption, topic_tag, scheduled_at, link_url, source_oa) VALUES

-- A1|開店的你,被找到了嗎(Day 1)
('facebook',
 NULL,
 NULL,
 '開洗車場、做汽美的老闆,這篇是給你的。

客人現在找店,第一個動作是掏手機查。
查不到你,他就去了查得到的那家。
你連被比較的機會都沒有。

我們團隊平常幫店家做一件事:
免費做一個官網,做給你看,喜歡再合作。
每個行業只收一位,做得對才敢做給你看。

想知道你的店在網路上長什麼樣子,
私訊「貢丸＋你的行業」,我幫你看。
LINE:@121lkspe',
 NULL,
 datetime('now', '+1 days', 'start of day', '+1 hours'),
 'https://line.me/R/ti/p/@121lkspe',
 '3q-hatchery'),

-- A3|三缺一診斷(Day 4)
('facebook',
 NULL,
 NULL,
 '店家老闆,你的生意卡住,通常是這三件缺一件:

被找到——客人搜尋的時候,有你嗎?
被相信——找到了,但作品、評價撐得起來嗎?
被下單——想買了,動線會不會讓他放棄?

缺哪一件,打法完全不同。
亂補,等於白花錢。

我們做了一個免費的品牌畫像診斷,
10 題,3 分鐘,告訴你缺哪件、先補哪裡。

私訊「貢丸」開始,或 LINE:@121lkspe',
 NULL,
 datetime('now', '+4 days', 'start of day', '+1 hours'),
 'https://3q-art-portfolio.milk790.workers.dev/experience/',
 '3q-hatchery'),

-- A2|一個老闆的真實路徑(Day 7,去識別化)
('facebook',
 NULL,
 NULL,
 '上個月,一個做生活服務整合的老闆
從我們的留言區私訊進來。

聊完發現他缺的不是技術,是系統:
客人從哪來、怎麼相信你、怎麼下單,
這三件事沒有一條線串起來。

三週後,他有了自己的官網、
24 小時會接客的 AI 客服、
和一張看得懂的獲客路線圖。

他說:走了三個月的路,原來有人能直接帶。

你的店如果也卡在「做得好但沒人知道」,
私訊「貢丸＋你的行業」,第一步免費。',
 NULL,
 datetime('now', '+7 days', 'start of day', '+1 hours'),
 'https://line.me/R/ti/p/@121lkspe',
 '3q-hatchery');
