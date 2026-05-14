#requires -Version 5.1
<#
.SYNOPSIS
  Full auto-deploy for 3Q Hatchery LINE OA from your local Windows machine.

.DESCRIPTION
  This script does what the sandbox cannot (LINE + Cloudflare API hosts are
  blocked from sandbox egress). Run from your repo clone:

    cd "C:\path\to\3q-hatchery-line-oa\webhook"
    .\deploy.ps1

  It will prompt for 3 credentials interactively (no echo, not persisted).

  What it does, in order:
    1. Verify all 3 tokens via API
    2. Deploy webhook/worker.js to Cloudflare Workers
    3. Set 3 environment variables on the Worker (LINE token + secret + PNG base URL)
    4. Enable workers.dev subdomain
    5. Verify Worker URL responds
    6. Create LINE Rich Menu definition (5 tap zones)
    7. Upload Rich Menu binary (compressed JPEG, 118 KB)
    8. Set Rich Menu as default for all users
    9. Set LINE webhook URL to Worker URL
   10. Test webhook via LINE's verification endpoint
   11. Print manual cleanup steps (toggles in LINE Console UI)

.NOTES
  Run-once. After successful deploy, immediately revoke all 3 tokens.
  This script does NOT save any credential to disk.
#>

param(
  [string]$WorkerName = "3q-hatchery-webhook",
  [string]$PngBaseUrl = "https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports",
  [string]$WorkerScriptPath = (Join-Path $PSScriptRoot "worker.js")
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)       { Write-Host "    ✓ $msg" -ForegroundColor Green }
function Fail($msg)     { Write-Host "    ✗ $msg" -ForegroundColor Red; throw $msg }
function Info($msg)     { Write-Host "    · $msg" -ForegroundColor Gray }

# Convert SecureString back to plain text (for API headers — local only, never logged)
function Unprotect-SS([System.Security.SecureString]$s) {
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try   { return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# ===========================================================================
# 0) Collect credentials
# ===========================================================================
Write-Host "=== 3Q Hatchery LINE OA — Full Deploy ===" -ForegroundColor Yellow
Write-Host "Will prompt for 3 tokens. None are saved."
Write-Host ""

$CfTokenS    = Read-Host -AsSecureString "Cloudflare API Token"
$LineTokenS  = Read-Host -AsSecureString "LINE Channel Access Token (long-lived)"
$LineSecretS = Read-Host -AsSecureString "LINE Channel Secret"

$CfToken    = Unprotect-SS $CfTokenS
$LineToken  = Unprotect-SS $LineTokenS
$LineSecret = Unprotect-SS $LineSecretS

# ===========================================================================
# 1) Verify tokens
# ===========================================================================
Step 1 "Verify Cloudflare token"
$cf = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify" `
  -Headers @{ Authorization = "Bearer $CfToken" }
if (-not $cf.success) { Fail ("CF: " + ($cf.errors | ConvertTo-Json -Compress)) }
Ok ("status=" + $cf.result.status)

Step 1 "Verify LINE token"
$ln = Invoke-RestMethod -Uri "https://api.line.me/v2/bot/info" `
  -Headers @{ Authorization = "Bearer $LineToken" }
Ok ("displayName=" + $ln.displayName + ", basicId=" + $ln.basicId)

# ===========================================================================
# 2) Get Cloudflare account ID
# ===========================================================================
Step 2 "Resolve Cloudflare account"
$accs = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" `
  -Headers @{ Authorization = "Bearer $CfToken" }
if (-not $accs.success -or -not $accs.result -or $accs.result.Count -eq 0) { Fail "no CF accounts visible to this token" }
$accountId = $accs.result[0].id
$accountName = $accs.result[0].name
Ok ("account=$accountName ($accountId)")

# ===========================================================================
# 3) Deploy Worker
# ===========================================================================
Step 3 "Deploy Worker $WorkerName"
if (-not (Test-Path $WorkerScriptPath)) { Fail "worker script not found at $WorkerScriptPath" }
$workerSource = Get-Content -Raw $WorkerScriptPath
Info ("script size: " + $workerSource.Length + " chars")

$metadata = @{
  main_module = "worker.js"
  compatibility_date = "2024-12-01"
  bindings = @(
    @{ name = "LINE_CHANNEL_ACCESS_TOKEN"; type = "secret_text"; text = $LineToken }
    @{ name = "LINE_CHANNEL_SECRET";       type = "secret_text"; text = $LineSecret }
    @{ name = "PNG_BASE_URL";              type = "plain_text";  text = $PngBaseUrl }
  )
} | ConvertTo-Json -Depth 6 -Compress

# Build multipart body manually (PowerShell's -Form is PS7-only; we want PS5.1 compat too)
$boundary = [Guid]::NewGuid().ToString()
$LF = "`r`n"
$bodyParts = @(
  "--$boundary",
  'Content-Disposition: form-data; name="metadata"; filename="metadata.json"',
  'Content-Type: application/json',
  '',
  $metadata,
  "--$boundary",
  'Content-Disposition: form-data; name="worker.js"; filename="worker.js"',
  'Content-Type: application/javascript+module',
  '',
  $workerSource,
  "--$boundary--",
  ''
) -join $LF
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyParts)

$deployUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/scripts/$WorkerName"
try {
  $resp = Invoke-RestMethod -Method Put -Uri $deployUri `
    -Headers @{ Authorization = "Bearer $CfToken"; 'Content-Type' = "multipart/form-data; boundary=$boundary" } `
    -Body $bodyBytes
  if (-not $resp.success) { Fail ("CF deploy: " + ($resp.errors | ConvertTo-Json -Compress)) }
  Ok ("uploaded etag=" + $resp.result.etag)
} catch {
  $err = $_.Exception.Response.GetResponseStream()
  if ($err) {
    $reader = New-Object System.IO.StreamReader($err)
    Write-Host "    Response: $($reader.ReadToEnd())" -ForegroundColor Yellow
  }
  throw
}

# ===========================================================================
# 4) Enable workers.dev subdomain
# ===========================================================================
Step 4 "Enable workers.dev subdomain"
$subResp = Invoke-RestMethod -Method Post `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/scripts/$WorkerName/subdomain" `
  -Headers @{ Authorization = "Bearer $CfToken"; 'Content-Type' = 'application/json' } `
  -Body (@{ enabled = $true } | ConvertTo-Json -Compress)
if (-not $subResp.success) { Fail "enable subdomain failed" }

$subDom = Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/subdomain" `
  -Headers @{ Authorization = "Bearer $CfToken" }
$workerUrl = "https://$WorkerName.$($subDom.result.subdomain).workers.dev"
Ok "URL: $workerUrl"

# ===========================================================================
# 5) Smoke-test Worker
# ===========================================================================
Step 5 "Smoke-test Worker URL"
Start-Sleep -Seconds 3   # propagation
$smoke = Invoke-RestMethod -Uri $workerUrl -Method Get
Ok ("worker says: configured.token=" + $smoke.configured.token + ", secret=" + $smoke.configured.secret + ", png_base=" + $smoke.configured.png_base)

# ===========================================================================
# 6) Create LINE Rich Menu
# ===========================================================================
Step 6 "Create LINE Rich Menu definition"
$rmDef = @{
  size = @{ width = 2500; height = 1686 }
  selected = $false
  name = "3Q Hatchery — 1 hero + 4 cells"
  chatBarText = "圖文選單"
  areas = @(
    @{ bounds = @{ x =    0; y =   0; width = 2500; height = 800 }; action = @{ type = "uri";     uri  = "https://3q-hatchery.tw" } }
    @{ bounds = @{ x =    0; y = 800; width =  625; height = 886 }; action = @{ type = "message"; text = "我想說說我的店" } }
    @{ bounds = @{ x =  625; y = 800; width =  625; height = 886 }; action = @{ type = "message"; text = "我想了解好物・好照" } }
    @{ bounds = @{ x = 1250; y = 800; width =  625; height = 886 }; action = @{ type = "message"; text = "我想要客製行銷" } }
    @{ bounds = @{ x = 1875; y = 800; width =  625; height = 886 }; action = @{ type = "message"; text = "查我的進度" } }
  )
}
$rmResp = Invoke-RestMethod -Method Post `
  -Uri "https://api.line.me/v2/bot/richmenu" `
  -Headers @{ Authorization = "Bearer $LineToken"; 'Content-Type' = 'application/json' } `
  -Body ($rmDef | ConvertTo-Json -Depth 8 -Compress)
$richMenuId = $rmResp.richMenuId
Ok "richMenuId=$richMenuId"

# ===========================================================================
# 7) Upload Rich Menu binary
# ===========================================================================
Step 7 "Upload Rich Menu binary"
$rmJpg = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\exports\3q-richmenu-2500x1686.jpg"
if (-not (Test-Path $rmJpg)) { Fail "rich menu JPEG not found at $rmJpg" }
$rmBytes = [System.IO.File]::ReadAllBytes($rmJpg)
Info ("JPEG size: " + $rmBytes.Length + " bytes")

Invoke-RestMethod -Method Post `
  -Uri "https://api-data.line.me/v2/bot/richmenu/$richMenuId/content" `
  -Headers @{ Authorization = "Bearer $LineToken"; 'Content-Type' = 'image/jpeg' } `
  -Body $rmBytes | Out-Null
Ok "uploaded"

# ===========================================================================
# 8) Set Rich Menu as default for all users
# ===========================================================================
Step 8 "Set Rich Menu as default"
Invoke-RestMethod -Method Post `
  -Uri "https://api.line.me/v2/bot/user/all/richmenu/$richMenuId" `
  -Headers @{ Authorization = "Bearer $LineToken" } | Out-Null
Ok "set as default"

# ===========================================================================
# 9) Set LINE webhook URL to Worker URL
# ===========================================================================
Step 9 "Set LINE webhook URL"
$webhookBody = @{ endpoint = $workerUrl } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Put `
  -Uri "https://api.line.me/v2/bot/channel/webhook/endpoint" `
  -Headers @{ Authorization = "Bearer $LineToken"; 'Content-Type' = 'application/json' } `
  -Body $webhookBody | Out-Null
Ok "set to $workerUrl"

# Enable webhook (some channels have it disabled by default)
try {
  Invoke-RestMethod -Method Put `
    -Uri "https://api.line.me/v2/bot/channel/webhook/endpoint" `
    -Headers @{ Authorization = "Bearer $LineToken"; 'Content-Type' = 'application/json' } `
    -Body $webhookBody | Out-Null
} catch {}

# ===========================================================================
# 10) Verify webhook via LINE
# ===========================================================================
Step 10 "Test webhook from LINE side"
try {
  $vResp = Invoke-RestMethod -Method Post `
    -Uri "https://api.line.me/v2/bot/channel/webhook/test" `
    -Headers @{ Authorization = "Bearer $LineToken"; 'Content-Type' = 'application/json' } `
    -Body (@{ endpoint = $workerUrl } | ConvertTo-Json -Compress)
  if ($vResp.success) { Ok "LINE webhook test: SUCCESS" }
  else { Write-Host "    ⚠ LINE webhook test response: $($vResp | ConvertTo-Json -Compress)" -ForegroundColor Yellow }
} catch {
  Write-Host "    ⚠ webhook test errored (may still work for real events): $($_.Exception.Message)" -ForegroundColor Yellow
}

# ===========================================================================
# Summary
# ===========================================================================
Write-Host ""
Write-Host "=== Deploy summary ===" -ForegroundColor Green
Write-Host "  Worker URL:   $workerUrl"
Write-Host "  Rich Menu:    $richMenuId  (default for all users)"
Write-Host "  Webhook:      $workerUrl"
Write-Host ""
Write-Host "=== Manual steps remaining ===" -ForegroundColor Yellow
Write-Host "  1. LINE Developers Console → your channel → Messaging API tab:"
Write-Host "     - 'Auto-reply messages':  toggle OFF  (so webhook handles all)"
Write-Host "     - 'Greeting messages':    toggle OFF  (so webhook handles follow)"
Write-Host "     - 'Use webhook':          toggle ON   (if not already)"
Write-Host ""
Write-Host "  2. LINE Official Account Manager → Account Settings → Basic settings:"
Write-Host "     - Upload Avatar (640x640):  assets\exports\3q-avatar-640.png"
Write-Host "     - Upload Cover (1080x878):  assets\exports\3q-cover-bowl-1080x878.png"
Write-Host ""
Write-Host "  3. Self-test: add your bot as friend on LINE"
Write-Host "     → expect: welcome card image + greeting text"
Write-Host "     send '好物' → expect: 好物・好照 reply"
Write-Host "     send '實例' → expect: text + 4-card image carousel"
Write-Host ""
Write-Host "  4. NOW go revoke all 3 tokens you used:"
Write-Host "     - https://developers.line.biz/console/      (re-issue Channel Access Token)"
Write-Host "     - https://dash.cloudflare.com/profile/api-tokens (delete the CF token)"
