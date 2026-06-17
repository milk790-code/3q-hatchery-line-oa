param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$OnlySafeLocal
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($OnlySafeLocal) {
    $runnerArgs += '--only-safe-local'
  }
  node (Join-Path $PSScriptRoot 'check-connector-health.mjs') @runnerArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
