# Go Go Go — 本機開發一鍵啟動

一鍵啟動 3Q Hatchery 本機開發環境，顯示狀態總覽，引導下一步。

## 用法

```
/gogogogo
/gogogogo serve       # 只啟動靜態伺服器
/gogogogo worker      # 只啟動 webhook worker（wrangler dev）
/gogogogo status      # 只顯示環境狀態，不啟動任何服務
```

## 你要做什麼

當用戶執行 `/gogogogo`，依序完成以下步驟：

### 1. 環境健康檢查

執行以下 Bash 指令，確認工具是否安裝：

```bash
echo "=== 環境檢查 ===" && \
node -v 2>/dev/null && echo "✓ Node.js" || echo "✗ Node.js 未安裝（brew install node）" && \
python3 --version 2>/dev/null && echo "✓ Python3" || echo "✗ Python3 未安裝" && \
wrangler --version 2>/dev/null && echo "✓ Wrangler" || echo "✗ Wrangler 未安裝（npm i -g wrangler）" && \
git -C . status --short 2>/dev/null | head -5 && echo "✓ Git 工作目錄"
```

### 2. 顯示專案狀態

```bash
echo "=== 分支狀態 ===" && git branch --show-current && git log --oneline -3
```

### 3. 啟動靜態伺服器

根據 `$ARGS` 決定行為：
- 無參數 or `serve`：輸出下面的指令，讓用戶在 Terminal 執行
- `worker`：輸出 wrangler dev 指令
- `status`：只顯示狀態，不輸出啟動指令

**靜態伺服器（Mac 推薦）：**

```bash
# 開新 Terminal 分頁，執行：
python3 -m http.server 8000
# 然後開瀏覽器訪問 http://localhost:8000
```

**Webhook Worker 本機測試：**

```bash
# 開新 Terminal 分頁，執行：
cd webhook && wrangler dev
# Worker 會監聽 http://localhost:8787
```

### 4. 顯示快速連結總覽

輸出以下資訊給用戶：

```
╔══════════════════════════════════════════════════╗
║         3Q Hatchery — 本機開發入口               ║
╠══════════════════════════════════════════════════╣
║  靜態前端    http://localhost:8000               ║
║  LINE OA 預覽 http://localhost:8000/ui_kits/line_oa/launch.html
║  Worker 測試 http://localhost:8787  （wrangler dev 啟動後）
╠══════════════════════════════════════════════════╣
║  線上正式站  https://milk790-code.github.io/3q-hatchery-line-oa/
║  Webhook     https://3q-hatchery-webhook.workers.dev
╠══════════════════════════════════════════════════╣
║  快捷指令                                        ║
║    make push     → git commit & push             ║
║    make worker   → wrangler deploy               ║
║    make richmenu → 上傳 Rich Menu                ║
╚══════════════════════════════════════════════════╝
```

### 5. 詢問下一步

問用戶：
- 想預覽 LINE OA 設計？（開靜態伺服器）
- 想測試 Webhook 邏輯？（wrangler dev）
- 想部署到正式環境？（`make push` → GitHub Actions）
- 想設定 Anthropic API Key？（使用 `line-oa-deploy-manager` agent）

---

## 補充：首次設定 Mac 開發環境

若環境檢查發現工具缺失，引導用戶執行以下完整安裝流程：

```bash
# 安裝 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安裝 Node.js
brew install node

# 安裝 Wrangler + Claude Code
npm install -g wrangler @anthropic-ai/claude-code

# 登入 Cloudflare（會開瀏覽器）
wrangler login
```

完成後回來再執行一次 `/gogogogo`。
