param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'review-frontend-artifacts.mjs')
}
finally {
  Pop-Location
}
