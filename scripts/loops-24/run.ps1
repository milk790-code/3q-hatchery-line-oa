param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$ReportOnly,
  [switch]$OnlySafeLocal
)

$ErrorActionPreference = 'Stop'
$exitCode = 0
$stateDir = Join-Path $env:USERPROFILE '.codex\automations\loops-24'
$secretsPath = Join-Path $stateDir 'secrets.local.ps1'
$secretsExamplePath = Join-Path $stateDir 'secrets.example.ps1'

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

if (-not (Test-Path -LiteralPath $secretsExamplePath)) {
  @'
# Copy this file to secrets.local.ps1 and fill values on this machine only.
# Do not commit real secrets to the repository.

# Google Places prospecting
$env:GOOGLE_MAPS_API_KEY = ''
# $env:GOOGLE_PLACES_API_KEY = ''

# 3Q social-publisher live queue probe
$env:SOCIAL_PUBLISHER_TOKEN = ''
# $env:TRIGGER_TOKEN = ''
# $env:SOCIAL_PUBLISHER_URL = 'https://3q-social-publisher.milk790.workers.dev'
'@ | Set-Content -LiteralPath $secretsExamplePath -Encoding UTF8
}

if (Test-Path -LiteralPath $secretsPath) {
  . $secretsPath
}

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($ReportOnly) {
    $runnerArgs += '--report-only'
  } else {
    $runnerArgs += '--auto-complete'
  }
  if ($OnlySafeLocal) {
    $runnerArgs += '--only-safe-local'
  }
  node (Join-Path $PSScriptRoot 'run.mjs') @runnerArgs
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $exitCode
