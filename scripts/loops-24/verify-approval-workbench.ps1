param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$WorkbenchJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $argsList = @((Join-Path $PSScriptRoot 'verify-approval-workbench.mjs'))
  if ($WorkbenchJson) {
    $argsList += '--workbench-json'
    $argsList += $WorkbenchJson
  }
  node @argsList
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
