param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$WorkbenchJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($WorkbenchJson) {
    $runnerArgs += '--workbench-json'
    $runnerArgs += $WorkbenchJson
  }
  node (Join-Path $PSScriptRoot 'verify-account-binding-workbench.mjs') @runnerArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
