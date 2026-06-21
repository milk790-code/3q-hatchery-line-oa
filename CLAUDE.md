# 3Q Hatchery — Claude Code 開發指南

## 專案概述

**3Q貢丸・台灣在地品牌孵化所** LINE OA 系統。
技術棧：靜態 HTML/CSS + Cloudflare Workers (webhook) + GitHub Pages 前端。

---

## 蘋果筆記本（macOS）開發環境設定

### 第一步：安裝基礎工具

```bash
# 1. 安裝 Homebrew（Mac 套件管理器）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安裝 Node.js（v20+）
brew install node

# 3. 確認版本
node -v   # 應顯示 v20.x.x 以上
npm -v    # 應顯示 10.x.x 以上
```

### 第二步：安裝開發工具

```bash
# Wrangler CLI（Cloudflare Workers 部署工具）
npm install -g wrangler

# Claude Code CLI（AI 開發助理）
npm install -g @anthropic-ai/claude-code

# 確認安裝
wrangler --version
claude --version
```

### 第三步：登入 Cloudflare

```bash
wrangler login
# 會自動開瀏覽器 → 允許授權 → 回到 Terminal 即完成
```

### 第四步：Clone 專案

```bash
git clone https://github.com/milk790-code/3q-hatchery-line-oa.git
cd 3q-hatchery-line-oa
```

### 第五步：設定環境變數（選用）

```bash
# LINE Channel Access Token（上傳 Rich Menu 需要）
export CHANNEL_TOKEN="你的_long_lived_token"

# 或寫入 ~/.zshrc 永久生效
echo 'export CHANNEL_TOKEN="你的_token"' >> ~/.zshrc
source ~/.zshrc
```

---

## 常用指令

| 指令 | 功能 |
|------|------|
| `/gogogogo` | 一鍵啟動本機開發（靜態伺服器 + 狀態總覽） |
| `/popmonster-deploy` | PopMonster 產品線部署 checklist |
| `make push` | git add / commit / push |
| `make worker` | 本機 wrangler deploy |
| `make richmenu` | 上傳 3 版 Rich Menu（需 CHANNEL_TOKEN）|
| `make help` | 顯示所有 Makefile 指令 |

---

## 本機開發伺服器

```bash
# Python（推薦，Mac 內建）
python3 -m http.server 8000

# Node
npx http-server -p 8000 -c-1
```

開啟 → `http://localhost:8000`

---

## 專案結構速覽

```
3q-hatchery-line-oa/
├── webhook/          # Cloudflare Worker（LINE Webhook 主程式）
│   ├── worker.js
│   └── wrangler.toml
├── workers/          # 其他 Worker（outreach, pop-line-oa, ai-subsidy）
├── assets/           # Logo, icons, PNG 匯出
├── ui_kits/          # LINE OA & 社群元件庫（JSX）
├── scripts/          # Rich Menu 上傳腳本
├── deploy.sh         # 主部署腳本
├── Makefile          # 部署捷徑
└── .claude/
    ├── agents/       # 專屬 AI Agent
    └── commands/     # 自訂 slash 指令（/gogogogo 等）
```

---

## Worker 部署說明

```bash
# 本機測試 webhook worker
cd webhook
wrangler dev

# 正式部署（需 wrangler 登入 + CF 帳號）
wrangler deploy

# 或透過 git push main → 觸發 GitHub Actions 自動部署
make push
```

---

## 設計系統規則（勿破）

1. **調色盤只有 7 色** — 絕不增加
2. **禁止 emoji、unicode 符號圖示** — icon 一律 SVG hairline
3. **字體**：Cormorant Garamond + Noto Serif TC（Display）/ Inter + Noto Sans TC（Body）
4. **負空間 ≥ 50%** — 版面擁擠就刪內容
5. **語氣**：你（親密），不用您（疏遠）

詳見 `README.md`。
