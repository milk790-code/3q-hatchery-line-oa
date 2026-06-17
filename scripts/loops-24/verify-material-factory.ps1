param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$FactoryJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($FactoryJson) {
    $runnerArgs += '--factory-json'
    $runnerArgs += $FactoryJson
  }
  node (Join-Path $PSScriptRoot 'verify-material-factory.mjs') @runnerArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
