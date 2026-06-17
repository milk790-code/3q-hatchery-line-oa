param(
  [string]$DashboardJson,
  [string]$DashboardMarkdown,
  [string]$ShowDashboard
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'verify-dashboard-display.mjs'
$argsList = @($script)

if ($DashboardJson) {
  $argsList += '--dashboard-json'
  $argsList += $DashboardJson
}
if ($DashboardMarkdown) {
  $argsList += '--dashboard-markdown'
  $argsList += $DashboardMarkdown
}
if ($ShowDashboard) {
  $argsList += '--show-dashboard'
  $argsList += $ShowDashboard
}

node @argsList
exit $LASTEXITCODE
