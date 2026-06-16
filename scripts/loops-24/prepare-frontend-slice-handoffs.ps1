param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'prepare-frontend-slice-handoffs.mjs')
}
finally {
  Pop-Location
}
