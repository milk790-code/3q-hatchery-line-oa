# Running locally

Pick one — they all serve the same files from this directory.

## Python (recommended)
```powershell
cd <this-folder>
python -m http.server 8000
```

## Node (already installed on your machine)
```powershell
npx http-server -p 8000 -c-1
```

## PowerShell (no Python/Node)
```powershell
.\serve.ps1
```
Or with custom port:
```powershell
.\serve.ps1 -Port 3000
```
Serves from this directory on `http://localhost:8000` (or custom port). Built-in MIME types for html, css, js, jsx, svg, png, jpg, gif, json, woff, woff2, etc.

Then open: **http://localhost:8000/ui_kits/line_oa/launch.html**

## What you should see
8 sections: 00 上線清單 → 01 帳號身份 → 02 開始訊息 → 03 圖文選單 → 04 關鍵字自動回覆 → 05 輪播主推 → 06 非營業訊息 → 07 情境預覽.

Network requirements: Google Fonts + unpkg CDN (React/Babel). All work on a normal Windows machine with internet.
