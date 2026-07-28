#!/usr/bin/env bash
if [ "${DEPLOY_CONFIRMED:-}" != "1" ]; then printf "⚠️  deploy.sh 會 git push／wrangler 部署。輸入 DEPLOY 確認（或設 DEPLOY_CONFIRMED=1）："; read -r __c; [ "$__c" = "DEPLOY" ] || { echo "已取消。"; exit 1; }; fi
# 3Q Hatchery — 一鍵上傳同步腳本
# ───────────────────────────────────────────────────────────────────────────
# 用法：
#   ./deploy.sh [指令] ["commit 訊息"]
#
#   ./deploy.sh            等同 all
#   ./deploy.sh all        git push（→ 觸發 deploy.yml Action 自動部署）
#   ./deploy.sh gh         只做 git add / commit / push
#   ./deploy.sh richmenu   上傳 3 版 Rich Menu（需 CHANNEL_TOKEN）
#   ./deploy.sh worker     本機 wrangler deploy（需安裝 wrangler + CF 登入）
#   ./deploy.sh pages      印出 GitHub Pages 素材 URL
#
# 正式部署走 GitHub Actions：push 到 main 會自動部署 Worker + Rich Menu + D1。
# 在功能分支 push 只是同步原始碼，合併到 main 後才會實際上線。
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PAGES_BASE="https://milk790-code.github.io/3q-hatchery-line-oa"
PNG_BASE="$PAGES_BASE/assets/exports"

info()  { printf '\033[36m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m! %s\033[0m\n' "$*"; }

# ── git push（重試 4 次指數退避）────────────────────────────────────────────
push_with_retry() {
  local branch="$1" delay=2
  for attempt in 1 2 3 4 5; do
    if git push -u origin "$branch"; then
      ok "已 push 到 origin/$branch"
      return 0
    fi
    if [ "$attempt" -lt 5 ]; then
      warn "push 失敗（第 $attempt 次），${delay}s 後重試…"
      sleep "$delay"
      delay=$((delay * 2))
    fi
  done
  warn "push 連續失敗 — 請檢查網路或權限後手動重試"
  return 1
}

cmd_gh() {
  local branch msg
  branch="$(git rev-parse --abbrev-ref HEAD)"
  msg="${1:-sync: $(date '+%Y-%m-%d %H:%M:%S')}"
  info "分支：$branch"
  git add -A
  if git diff --cached --quiet; then
    info "沒有變更可提交，直接 push 現有 commit"
  else
    git commit -m "$msg"
    ok "已建立 commit：$msg"
  fi
  push_with_retry "$branch"
}

cmd_richmenu() {
  if [ -z "${CHANNEL_TOKEN:-}" ]; then
    warn "未設定 CHANNEL_TOKEN — 跳過 Rich Menu 上傳"
    warn "  設定方式：export CHANNEL_TOKEN=\"你的_long_lived_channel_access_token\"（或 make token）"
    return 0
  fi
  if [ ! -x scripts/upload-richmenu.sh ]; then
    chmod +x scripts/upload-richmenu.sh 2>/dev/null || true
  fi
  info "上傳 Rich Menu（scripts/upload-richmenu.sh）…"
  ( cd assets/exports && CHANNEL_TOKEN="$CHANNEL_TOKEN" bash "$REPO_ROOT/scripts/upload-richmenu.sh" )
}

cmd_worker() {
  if ! command -v wrangler >/dev/null 2>&1; then
    warn "本機未安裝 wrangler — 跳過。改用 ./deploy.sh gh，push 到 main 由 Action 部署 Worker"
    return 0
  fi
  info "wrangler deploy（webhook/）…"
  ( cd webhook && wrangler deploy )
}

cmd_pages() {
  info "GitHub Pages 素材 URL："
  echo "  首頁素材：$PAGES_BASE/"
  echo "  匯出 PNG：$PNG_BASE/"
  echo "  歡迎卡  ：$PNG_BASE/3Q-HATCHERY_welcome-card_1040x1040.png"
  echo "  會員卡背：$PNG_BASE/3Q-HATCHERY_member-card-bg_1040x585.png"
}

main() {
  local cmd="${1:-all}"
  case "$cmd" in
    all)      cmd_gh "${2:-}"; ;;
    gh)       cmd_gh "${2:-}"; ;;
    richmenu) cmd_richmenu; ;;
    worker)   cmd_worker; ;;
    pages)    cmd_pages; ;;
    *)        warn "未知指令：$cmd"; sed -n '2,18p' "$0"; exit 1; ;;
  esac
}

main "$@"
