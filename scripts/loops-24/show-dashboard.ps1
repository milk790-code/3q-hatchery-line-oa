param(
  [string]$StateDir = (Join-Path $env:USERPROFILE '.codex\automations\loops-24'),
  [switch]$Open
)

$ErrorActionPreference = 'Stop'
$dashboardPath = Join-Path $StateDir 'dashboard\latest.md'

if (-not (Test-Path -LiteralPath $dashboardPath)) {
  Write-Error "No dashboard found: $dashboardPath. Run scripts\loops-24\run.ps1 first."
  exit 1
}

if ($Open) {
  Invoke-Item -LiteralPath $dashboardPath
} else {
  Get-Content -LiteralPath $dashboardPath
}
