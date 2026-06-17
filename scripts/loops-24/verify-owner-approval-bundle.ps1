param(
  [string]$BundleJson
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'verify-owner-approval-bundle.mjs'

if ($BundleJson) {
  node $script --bundle-json $BundleJson
} else {
  node $script
}
