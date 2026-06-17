param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'verify-wakeup-health.mjs')
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
