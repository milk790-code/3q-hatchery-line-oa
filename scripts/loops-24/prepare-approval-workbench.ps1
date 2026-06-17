param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$BundleJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $argsList = @((Join-Path $PSScriptRoot 'prepare-approval-workbench.mjs'))
  if ($BundleJson) {
    $argsList += '--bundle-json'
    $argsList += $BundleJson
  }
  node @argsList
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
