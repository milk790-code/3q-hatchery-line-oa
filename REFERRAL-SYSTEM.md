# 3Q 裂變系統 · 引薦引擎規格（第二輪推理）

> 狀態：**推理完成、待第三輪實作**。本文件是實作依據（grounded in `webhook/worker.js` v3.5）。
> 第一輪鎖定地基：①兩事業體共用引擎 ②回饋＝身份語言包裝實質折扣 ③諮詢／報名才計入。

裂變靈魂：**「你把信任的人引進這個房間，房間記得你。」**
表面給席位與禮遇，底層記點數與折扣，且只在對方真的坐下來（諮詢／報名）才結算。不是拉客，是引介。

---

## 一、核心循環（端到端）

```
[A 發碼]  引薦人在 LINE 打「引薦」→ bot 確保會員卡存在 → 由 member.num 生成引薦碼
          → 回「引薦卡」Flex：含 code + 兩種分享連結（官網美連結 / LINE 預填深連結）

[B 歸因]  被引薦人點連結 → 走兩條捕捉路徑之一 →（KV 暫存 pending_ref，不立即發獎）
          ├ 主路徑（站內）：line.me/R/oaMessage/@{basicId}/?引薦%20{code}
          │   開啟對話預填「引薦 H0042」→ 送出 → webhook 文字路由 ^引薦\s+(\S+) 命中
          └ 次路徑（官網）：?ref=CODE → localStorage + 帶入 LINE 深連結（非 lin.ee）

[C 結算]  被引薦人完成「諮詢 (flow:submit) / 報名 (campaign register)」那一刻
          → finalizeReferral()：防弊檢查 → 寫 referrals(qualified) → 雙向發 rewards
          → 更新引薦人 refCount / refTier → 雙向推播通知 → 消費 pending_ref（防重複）

[D 兌現]  rewards ledger 記實質折扣碼，對外以「席位 / 禮遇」語言呈現
```

**為什麼結算卡在「諮詢／報名」而不是「加好友」**：天然防刷——只加好友不算數，必須真的坐下來填表，刷量沒有經濟誘因。

---

## 二、歸因的技術根據（最關鍵）

| 方法 | 可行性 | 採用 |
|---|---|---|
| `lin.ee/xxx?ref=` 短連結帶參數 | ❌ 參數不進 webhook | 僅作官網 analytics + localStorage 橋接 |
| LIFF 帶 state | ✅ 但要建 LIFF app + 維運 | 不採用（過度工程） |
| **`line.me/R/oaMessage/@{basicId}/?{預填文字}`** | ✅ 開對話預填、無需 LIFF | **主採用** |
| Welcome 時問「誰介紹的」 | ✅ 但有摩擦、易亂填 | 備援，不主推 |

> **第三輪開工需要的值**：OA 的 basic ID（`@` 開頭，例如 `@123abcd`）。`lin.ee/UKKodJj` 對應的那個 @id。貢丸 OA 另一組。

文字路由（接在現有 `ev.type==='message'` text handler，與 `訂閱`/`取消訂閱` 同層）：

```js
const m = text.trim().match(/^引薦\s+([A-Za-z]\d{3,6})$/);
if (m) {                                   // 被引薦人送出預填訊息
  await capturePendingRef(uid, m[1], env);  // KV pending_ref:{uid} = {code, ts}, TTL 30d
  return replyMsg(replyToken, [seatWelcomeFlex(m[1])], env); // host 語氣：為你留了席
}
```

---

## 三、引薦碼規則

- **來源**：直接複用現有 `member:next_num` / `member.num`，不另設計數器。
- **格式**：`{OA前綴}{4位補零}`，孵化所 `H`、貢丸 `G`。例：member #42 → `H0042`。
  - 前綴隔開兩事業體命名空間 → **共用引擎不撞碼**（呼應地基①）。
  - 純英數、好念好打、適合預填訊息。
- **反查**：發碼時寫反向 KV `refcode:{CODE} = uid`，歸因時 O(1) 解析，免掃 D1。
- **生成點**：`issueMemberCard()` 時順手寫入 `card.code` 與 `refcode:` 反查鍵（向後相容：舊卡缺 code 時，第一次打「引薦」補寫）。

---

## 四、資料模型（D1 migration `006_referrals.sql`）

```sql
CREATE TABLE IF NOT EXISTS referrals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL,                       -- 引薦人碼 H0042
  inviter_uid  TEXT NOT NULL,
  invitee_uid  TEXT NOT NULL,
  source_oa    TEXT DEFAULT '3q-hatchery',          -- 呼應現有 source_oa 欄位
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending|qualified|rewarded|review|void
  inquiry_id   INTEGER,                             -- 結算用的 inquiries/campaigns 列
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  qualified_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_uid); -- 每人一生只被歸因一次
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_code    ON referrals(code);

CREATE TABLE IF NOT EXISTS rewards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uid           TEXT NOT NULL,
  role          TEXT NOT NULL,                      -- inviter|invitee
  ref_id        INTEGER,                            -- referrals.id
  value_type    TEXT NOT NULL,                      -- discount_pct|discount_amt|credit|perk
  value         REAL,
  label_public  TEXT,                               -- 對外 host 語言（席位/禮遇）
  discount_code TEXT,                               -- 實際可兌換碼（後台）
  status        TEXT NOT NULL DEFAULT 'granted',    -- granted|redeemed|expired
  expires_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rewards_uid ON rewards(uid);
```

**會員卡 KV 擴充**（向後相容，缺欄位給預設）：`card.code`、`card.refCount`（累計合格引薦）、`card.refTier`。

---

## 五、回饋層：身份語言 ↔ 實質折扣對照（地基②）

對外只說席位與禮遇，後台真的記折扣碼。**數字為預設、待你拍板**。

| 累計合格引薦 | 對外身份（公開顯示） | 對內實質（rewards ledger） |
|---|---|---|
| 0 | 訪客 | — |
| 1 | 引薦人 · 留名 | 引薦人：一張 9 折券；被引薦人：首單 9 折「入席禮」 |
| 3 | 常引薦 · 入席 | 引薦人券升 85 折＋解鎖「優先排程」perk |
| 5 | 引薦夥伴 | 常態 8 折＋季節限定內容＋案例優先曝光 |
| 10 | 引薦核心 · inner circle | 專屬顧問窗口＋聯名曝光位 |

- **被引薦人**：每次合格固定發「入席禮」（首單折扣），與引薦人階梯獨立。
- 折扣以 `discount_code` 存於 ledger，對話中只出現 `label_public`（如「首單 · 入席禮」）。
- 階梯升級時自動 `updateMemberTier` 並可推播「席位前移」通知。

---

## 六、結算與防弊（`finalizeReferral`）

掛在兩個現有結算點：`flow:submit`（line 1311）後、campaign register（line 1337）後。

```
finalizeReferral(inviteeUid, inquiryId, sourceOa, env):
  p = KV pending_ref:{inviteeUid};  if !p: return
  code = p.code;  inviterUid = KV refcode:{code};  if !inviterUid: return
  ── 防弊閘門 ──
  1. 自我引薦：inviterUid === inviteeUid              → void
  2. 碼須早於被引薦人加入：inviter member.num 之 join < invitee join（ts 比對）
  3. 一生一次：referrals UNIQUE(invitee_uid) 已存在  → 跳過（idempotent）
  4. 速率：inviter 當週已結算數 > N（預設 20）        → status='review' 交 owner 審
  ── 通過 ──
  INSERT referrals(... status='qualified', inquiry_id, qualified_at)
  grantReward(inviterUid,'inviter', ladder(refCount+1))
  grantReward(inviteeUid,'invitee', 入席禮)
  card.refCount++ ; 必要時 refTier 升級 + updateMemberTier
  KV delete pending_ref:{inviteeUid}        // 防重複
  push 雙向通知（引薦人：你引薦的人入席了＋禮遇；被引薦人：入席禮已備好）
  if env.OWNER_USER_ID: 通知 owner（review 狀態額外標記）
```

防弊涵蓋：刷量（必須諮詢/報名）、自我引薦、循環互薦（每人僅被歸因一次）、洗單（速率＋review 佇列）、過期（pending_ref TTL 30 天）。

---

## 七、觸點地圖（裂變入口）

| 觸點 | 改動 | 角色 |
|---|---|---|
| 文字 keyword `引薦` | 新增 handler → 回引薦卡 Flex | 發碼（出站） |
| 文字 `^引薦\s+CODE` | 新增 handler → capturePendingRef | 歸因（入站） |
| Rich Menu | 加「引薦」格 → 觸發 `引薦` keyword | 出站常駐入口 |
| `sendWelcome()` | 若有 pending_ref，加一行「你是 X 引薦來的，留了席」 | 入站儀式感 |
| `memberCardFlex()` | 加 code + refCount + 分享按鈕（URI action） | 出站 |
| 季節推播 cron | 偶爾插入「把好東西傳下去」軟性 nudge | 出站再激活 |
| `index.html`（已建） | `ref` 存在時 LINE CTA 改 oaMessage 深連結 | 入站閉環 |
| `invite.html` | 可選：個人化引薦人落地頁 `?ref=` | 入站 |

---

## 八、跨事業體（貢丸 Python bot）

兩 OA 共用 `referrals`/`rewards` D1 表與同套碼規則（前綴 `H`/`G`）。貢丸（FastAPI on Render）已有 `bots/gongwan/hatchery_api.py` 作為對接層。

> **第三輪開工需要你決定**：貢丸如何寫入共用資料 ——
> (a) 直接綁同一個 D1（需 Cloudflare binding / HTTP D1 API）；或
> (b) 經由 hatchery worker 開一個 `/referral` 內部端點，貢丸 HTTP 呼叫。
> 建議 (b)：邏輯集中在 worker，貢丸只當 thin client，防兩邊規則分叉。

---

## 九、第三輪開工前，需要你給的三件事

1. **OA basic ID**：孵化所與貢丸各自的 `@` id（預填深連結用）。
2. **回饋階梯數字**：第五節表格的折扣／perk 是否照預設，或你要調。
3. **貢丸對接方式**：第八節 (a) 直連 D1 或 (b) 經 worker 端點（建議 b）。

備齊後，第三輪一次落地：`006_referrals.sql` + worker 的 5 段 handler + `index.html` 深連結切換 + 會員卡/Welcome Flex + 貢丸 thin client。

---

## 十、成長迴圈擴充（第二輪追加）

定案：**單一引擎、貢丸為分支 thin client、不分家**。引薦引擎是地基，上面再疊三個自動累積流量的迴圈。

### 10.1 每日「霸王餐 / 免費做圖」抽獎（LINE 群組 + cron）

```
參加資格：當日「分享引薦連結」或打關鍵字「抽」→ KV lottery:{YYYY-MM-DD}:entries (uid set)
每日開獎：worker cron（已有 cron 基礎）固定時段 → 隨機抽 winner
領獎條件：winner 必須「分享」才能領（share-to-claim）→ 領獎動作本身回灌新流量
獎品：霸王餐福利 / 免費做圖一張 → 標記 claimed → 顧問交付
公告：群組 push(groupId) + 1:1 push(winner)
```

- **裂變閉環**：要參加得分享、要領獎得分享 → 每天自動產生新引薦入口。
- 抽獎與引薦共用同一套 `referrals` 歸因（分享連結即帶 code）。
- KV：`lottery:{date}:entries`、`lottery:{date}:winner`，TTL 自然過期。

> **開工需要**：(1) 在 LINE App 建群、加 bot → worker 用 `join` 事件抓 `groupId` 存 KV `group:main`；(2) 開獎時段（預設每日 20:00 TW）。

### 10.2 FB 公域（粉專）— 全自動，對齊 FB 算法

複用 `workers/social-publisher`（已能發 FB Page）。每日自動產出並發布：

- 內容：今日得主 / 免費做圖案例 / 孵化前後對比（原生圖優先）。
- **對齊 FB 算法的底層規則**（寫進發文模組）：
  - 原生圖片/影片優先，**外連放第一則留言**（避免外連降觸及）。
  - 固定節奏（沿用 `DAILY_LIMITS` facebook:1，不洗版觸發 spam 訊號）。
  - 互動鉤子：引導留言「+1 / 我要」→ 高互動拉自然觸及。
  - UGC 回灌：得主分享的截圖 → 隔日素材，自我增強。
- 導流：留言／私訊關鍵字 → 自動回 LINE 加入連結（公域 → 私域）。

### 10.3 FB 私域（社團）— 平台限制與務實解

> ⚠️ **Meta 2024 起關閉 Groups API**：app 無法用 API 自動發文/讀社團。平台硬限制。

務實三選一：
- **(a) 粉專全自動 + 社團半自動（建議）**：bot 每日把社團文案＋圖產到 KV/Drive，管理員一鍵貼。
- **(b) 只做粉專公域 + LINE 群組私域**，暫不碰 FB 社團（全自動、零人工）。
- **(c) 仍要社團**：僅能「一鍵貼」半自動，無法全自動。

### 10.4 自動累積的底層架構（資料流）

```
公域(FB粉專/IG/Threads · social-publisher) ──導流──┐
                                                   ▼
私域(LINE OA + 群組) ── 引薦引擎(referrals) ── 每日抽獎(share-to-claim)
        ▲                                           │
        └────────── UGC/得主分享 回灌公域素材 ────────┘
```
每一圈都把「分享」設為解鎖條件 → 流量自我累積，不靠付費廣告。

---

## 十一、第三輪開工前補充需要的值

4. **貢丸 OA basic ID**（`@`），並確認孵化所為 `@121Ikspe`。
5. **LINE 群組**：建群 + 加 bot（之後自動抓 groupId）＋ 開獎時段。
6. **FB 私域策略**：10.3 的 (a)/(b)/(c) 擇一。
7. **FB_PAGE_ID / token** 是否已在 social-publisher 設好（決定粉專自動發文能否即刻啟用）。

---

## 十二、已實作對照（v3.7，本 PR）

| 規格 | 落地位置 | 狀態 |
|---|---|---|
| referrals + rewards 表 | `db/migrations/006_referrals.sql` | ✅ |
| 引薦碼/反查/防弊/雙向發獎 | `webhook/worker.js`（referral 區） | ✅ |
| 歸因深連結捕捉 | text `引薦 CODE` + index.html CTA | ✅ |
| 結算 hook | `flow:submit`、campaign register | ✅ |
| 會員卡顯示引薦碼 | `memberCardFlex` | ✅ |
| 每日霸王餐抽獎 | cron `0 12 * * *`、`抽` keyword、`join` 抓 groupId、share-to-claim | ✅ |
| 跨 OA API | `/api/referral/{code,capture,finalize}` | ✅ |
| 貢丸 thin client | `bots/gongwan/{hatchery_api,main}.py` | ✅ |
| FB 粉專自動 + 外連首留言 | `workers/social-publisher`（`seedDailyContent`, `publishToFacebook`） | ✅ |
| FB 社團半自動 | KV `fbgroup:today` + `GET /fbgroup/today` | ✅ |
| 折扣階梯數字 | `inviterReward()`（預設值，待確認可調） | ⚠️ 預設 |

## 十三、上線清單（部署時）

1. 套 D1 migration：`wrangler d1 migrations apply 3q-hatchery-crm --remote`（含 006、007）。
2. 部署兩個 worker：`webhook/`（含新 cron）、`workers/social-publisher/`。
3. 確認 `LINE_BASIC_ID`（worker + index.html）= 真實 basic id；非 `@121Ikspe` 則改兩處。
4. 貢丸（Render）設 `HATCHERY_WORKER_URL`、`TRIGGER_TOKEN`（與 CF secret 同值）。
5. 建 LINE 群、加 bot（自動寫 `group:main`）。
6. social-publisher 確認 `FB_PAGE_ACCESS_TOKEN` secret 已設。
7. 社團每日內容：管理員開 `GET /fbgroup/today?format=text` 一鍵複製貼上。
