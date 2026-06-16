param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$ReportOnly
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($ReportOnly) {
    $runnerArgs += '--report-only'
  } else {
    $runnerArgs += '--auto-complete'
  }
  node (Join-Path $PSScriptRoot 'run.mjs') @runnerArgs
}
finally {
  Pop-Location
}
