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
Add-Type -AssemblyName System.Web
$L = [System.Net.HttpListener]::new()
$L.Prefixes.Add('http://localhost:8000/')
$L.Start()
$mime = @{'.html'='text/html';'.css'='text/css';'.js'='application/javascript';'.jsx'='application/javascript';'.svg'='image/svg+xml';'.png'='image/png'}
while ($L.IsListening) {
  $c = $L.GetContext()
  $p = [System.Web.HttpUtility]::UrlDecode($c.Request.Url.LocalPath.TrimStart('/'))
  if (!$p) { $p = 'ui_kits/line_oa/launch.html' }
  $f = Join-Path $PWD $p
  if (Test-Path $f -PathType Leaf) {
    $b = [System.IO.File]::ReadAllBytes($f)
    $c.Response.ContentType = $mime[[IO.Path]::GetExtension($f).ToLower()] ?? 'application/octet-stream'
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
```

Then open: **http://localhost:8000/ui_kits/line_oa/launch.html**

## What you should see
8 sections: 00 上線清單 → 01 帳號身份 → 02 開始訊息 → 03 圖文選單 → 04 關鍵字自動回覆 → 05 輪播主推 → 06 非營業訊息 → 07 情境預覽.

Network requirements: Google Fonts + unpkg CDN (React/Babel). All work on a normal Windows machine with internet.
