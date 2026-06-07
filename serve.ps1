param([int]$Port = 8000)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$mimeTypes = @{
    '.html'  = 'text/html; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.js'    = 'application/javascript; charset=utf-8'
    '.jsx'   = 'application/javascript; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.svg'   = 'image/svg+xml'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.gif'   = 'image/gif'
    '.webp'  = 'image/webp'
    '.txt'   = 'text/plain; charset=utf-8'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
}

$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://localhost:$Port/")
$http.Start()
Write-Host "Server started on http://localhost:$Port/" -ForegroundColor Green
Write-Host "Default index: ui_kits/line_oa/launch.html" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

while ($http.IsListening) {
    try {
        $context = $http.GetContext()
        $path = [System.Web.HttpUtility]::UrlDecode($context.Request.Url.LocalPath.TrimStart('/'))

        if ([string]::IsNullOrEmpty($path)) {
            $path = 'ui_kits/line_oa/launch.html'
        }

        $filePath = Join-Path $scriptDir $path

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [IO.Path]::GetExtension($filePath).ToLower()
            $contentType = $mimeTypes[$ext] ?? 'application/octet-stream'

            $context.Response.ContentType = $contentType
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)

            Write-Host "[200] $path" -ForegroundColor Green
        } else {
            $context.Response.StatusCode = 404
            Write-Host "[404] $path" -ForegroundColor Red
        }

        $context.Response.Close()
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}
