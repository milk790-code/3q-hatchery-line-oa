param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$DirtyJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $argsList = @((Join-Path $PSScriptRoot 'prepare-dirty-review-workbench.mjs'))
  if ($DirtyJson) {
    $argsList += '--dirty-json'
    $argsList += $DirtyJson
  }
  node @argsList
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
