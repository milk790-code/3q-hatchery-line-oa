param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$DashboardJson
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $args = @((Join-Path $PSScriptRoot 'verify-dashboard-gates.mjs'))
  if ($DashboardJson) {
    $args += @('--dashboard-json', $DashboardJson)
  }
  node @args
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
