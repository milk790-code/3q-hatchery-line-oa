param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'prepare-owner-approval-bundle.mjs')
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
