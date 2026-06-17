param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'classify-dirty-worktree.mjs')
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
