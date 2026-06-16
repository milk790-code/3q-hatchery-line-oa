param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$ReportOnly
)

$ErrorActionPreference = 'Stop'
$exitCode = 0

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($ReportOnly) {
    $runnerArgs += '--report-only'
  } else {
    $runnerArgs += '--auto-complete'
  }
  node (Join-Path $PSScriptRoot 'run.mjs') @runnerArgs
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $exitCode
