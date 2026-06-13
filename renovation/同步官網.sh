#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# 同步官網.sh — 把 renovation/公開-客戶端/ 一鍵部署到官網
#
# 來源：renovation/公開-客戶端/（本開發分支，原始檔）
# 目標：main 分支的 home-renovation/（GitHub Pages 正式網址）
#       https://milk790-code.github.io/3q-hatchery-line-oa/home-renovation/
#
# 自動處理：
#   • 著陸頁 → index.html（乾淨網址），其餘去掉「客戶-」前綴
#   • 改寫頁面內部連結與 CSS 相對路徑
#   • 用 git worktree 取出 main，不會動到你目前的分支與工作目錄
#
# 用法：
#   bash renovation/同步官網.sh          # 會先顯示將變更的檔案，詢問後才推送
#   bash renovation/同步官網.sh -y       # 跳過確認，直接推送
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

AUTO_YES="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/renovation/公開-客戶端"
CSS="$ROOT/renovation/colors_and_type.css"
DEPLOY_DIR="home-renovation"
MAIN_BRANCH="main"

info(){ printf '\033[36m▸ %s\033[0m\n' "$*"; }
ok(){   printf '\033[32m✓ %s\033[0m\n' "$*"; }
err(){  printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }

# 0. 前置檢查 ──────────────────────────────────────────────────────────────────
[ -d "$SRC" ] || { err "找不到來源 $SRC（請在開發分支執行此腳本）"; exit 1; }
[ -f "$CSS" ] || { err "找不到樣式檔 $CSS"; exit 1; }
command -v perl >/dev/null || { err "需要 perl"; exit 1; }

# 1. 在暫存區產生「部署版本」（改名 + 改寫連結）────────────────────────────────
TMP="$(mktemp -d)"
WT=""
cleanup(){ [ -n "$WT" ] && git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

cp "$SRC/客戶-著陸頁.html"          "$TMP/index.html"
cp "$SRC/客戶-方案價格.html"        "$TMP/方案價格.html"
cp "$SRC/客戶-常見問題FAQ.html"     "$TMP/常見問題FAQ.html"
cp "$SRC/客戶-報價單模板.html"      "$TMP/報價單模板.html"
cp "$SRC/客戶-保固卡.html"          "$TMP/保固卡.html"
cp "$SRC/客戶-透明施工承諾書.html"  "$TMP/透明施工承諾書.html"
cp "$CSS"                           "$TMP/colors_and_type.css"

# 改寫：CSS 從 ../ 變同層；客戶頁連結改成部署後的乾淨檔名
perl -i -pe '
  s{href="\.\./colors_and_type\.css"}{href="colors_and_type.css"}g;
  s{href="客戶-著陸頁\.html"}{href="index.html"}g;
  s{href="客戶-方案價格\.html"}{href="方案價格.html"}g;
  s{href="客戶-常見問題FAQ\.html"}{href="常見問題FAQ.html"}g;
' "$TMP"/*.html
ok "已產生部署版本（7 個檔）"

# 2. 用 worktree 取出 main（不影響目前分支）──────────────────────────────────
info "抓取 origin/$MAIN_BRANCH …"
for i in 1 2 3 4; do git -C "$ROOT" fetch origin "$MAIN_BRANCH" && break || sleep $((2**i)); done
WT="$(mktemp -d)"
git -C "$ROOT" worktree add --force -B "$MAIN_BRANCH" "$WT" "origin/$MAIN_BRANCH" >/dev/null
ok "已取出 main 到暫存 worktree"

# 3. 覆蓋 home-renovation/ ──────────────────────────────────────────────────────
rm -rf "${WT:?}/$DEPLOY_DIR"
mkdir -p "$WT/$DEPLOY_DIR"
cp "$TMP"/* "$WT/$DEPLOY_DIR/"

cd "$WT"
if git diff --quiet && git diff --cached --quiet; then
  ok "官網內容無變化，無需同步。"
  exit 0
fi

git add "$DEPLOY_DIR"
echo
info "將變更以下官網檔案："
git -c color.status=always status --short "$DEPLOY_DIR" | sed 's/^/    /'
echo

# 4. 確認後推送 ────────────────────────────────────────────────────────────────
if [ "$AUTO_YES" != "-y" ]; then
  read -r -p "確定推送到 main（官網會更新）？[y/N] " ans
  case "$ans" in y|Y|yes) ;; *) err "已取消"; exit 1;; esac
fi

git commit -m "sync: 更新官網 home-renovation/（同步自 公開-客戶端/）" >/dev/null
for i in 1 2 3 4; do git push origin "$MAIN_BRANCH" && break || { err "push 失敗，${i}：重試"; sleep $((2**i)); }; done

ok "已同步！約 1～2 分鐘後生效："
echo "    https://milk790-code.github.io/3q-hatchery-line-oa/home-renovation/"
