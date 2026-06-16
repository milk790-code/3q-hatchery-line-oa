param(
  [string]$Group = 'loops_control_plane',
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  node (Join-Path $PSScriptRoot 'prepare-slice-handoff.mjs') --group $Group
}
finally {
  Pop-Location
}
