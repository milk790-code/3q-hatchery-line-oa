param(
  [string]$ChecklistJson
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'verify-worker-deploy-checklist.mjs'
$argsList = @($script)

if ($ChecklistJson) {
  $argsList += '--checklist-json'
  $argsList += $ChecklistJson
}

node @argsList
exit $LASTEXITCODE
