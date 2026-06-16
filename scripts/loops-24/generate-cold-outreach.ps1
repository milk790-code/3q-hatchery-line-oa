param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$argsList = @((Join-Path $PSScriptRoot 'generate-cold-outreach.mjs'))
if ($DryRun) {
  $argsList += '--dry-run'
}

Push-Location $RepoRoot
try {
  node @argsList
}
finally {
  Pop-Location
}
