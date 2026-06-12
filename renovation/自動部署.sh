#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# 自動部署.sh — 一鍵自動部署包（投餵一次，全部更新上線）
#
# 串起三步：
#   ① 重建手機 HTML（renovation/*.md → *.html，用 marked）
#   ② 提交並推送「資料中心」到開發分支（完整三層）
#   ③ 同步「公開-客戶端」到 main 的 home-renovation/（官網）
#
# 用法：
#   bash renovation/自動部署.sh                 # 自動帶預設 commit 訊息
#   bash renovation/自動部署.sh "我的更新說明"   # 自訂 commit 訊息
#   SKIP_SITE=1 bash renovation/自動部署.sh      # 只更新資料中心，不碰官網
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MSG="${1:-更新：重建手機 HTML 並同步資料中心}"

c_info(){ printf '\033[36m▸ %s\033[0m\n' "$*"; }
c_ok(){   printf '\033[32m✓ %s\033[0m\n' "$*"; }
c_step(){ printf '\n\033[1;33m━━ %s ━━\033[0m\n' "$*"; }
c_err(){  printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }

push_retry(){ # $1 = branch
  local b="$1" d=2
  for i in 1 2 3 4; do git push origin "$b" && return 0; c_err "push 失敗（$i），${d}s 後重試"; sleep "$d"; d=$((d*2)); done
  return 1
}

# ── ① 重建手機 HTML ───────────────────────────────────────────────────────────
c_step "① 重建手機 HTML"
if ! node -e "require.resolve('marked')" >/dev/null 2>&1; then
  c_info "安裝 marked …"; npm install marked@12 --no-save >/dev/null 2>&1 || { c_err "marked 安裝失敗（需要網路）"; exit 1; }
fi
node renovation/build-docs.mjs

# ── ② 提交並推送資料中心 ──────────────────────────────────────────────────────
c_step "② 提交並推送資料中心"
DEV="$(git branch --show-current)"
git add -A renovation/
if git diff --cached --quiet; then
  c_ok "資料中心無變化，免提交。"
else
  git commit -m "$MSG" >/dev/null
  c_ok "已提交：$MSG"
  push_retry "$DEV" && c_ok "已推送到 $DEV" || { c_err "推送失敗"; exit 1; }
fi

# ── ③ 同步公開層到官網 ────────────────────────────────────────────────────────
if [ "${SKIP_SITE:-}" = "1" ]; then
  c_step "③ 同步官網（已用 SKIP_SITE 略過）"
else
  c_step "③ 同步公開層到官網"
  bash renovation/同步官網.sh -y
fi

c_step "全部完成 🎉"
echo "  資料中心（開發分支 $DEV）："
echo "    導覽中心 renovation/index.html"
echo "  官網（約 1～2 分生效）："
echo "    https://milk790-code.github.io/3q-hatchery-line-oa/home-renovation/"
