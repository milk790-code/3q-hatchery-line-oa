param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$OpenReport
)

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $env:USERPROFILE '.codex\automations\loops-24'
$latestPath = Join-Path $stateDir 'secret-gates\latest.json'

Push-Location $RepoRoot
try {
  $raw = & node (Join-Path $PSScriptRoot 'prepare-secret-gates.mjs')
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Output $raw
    exit $exitCode
  }

  if (-not (Test-Path -LiteralPath $latestPath)) {
    Write-Error "Secret gate report was not created: $latestPath"
    exit 1
  }

  $payload = Get-Content -LiteralPath $latestPath -Raw | ConvertFrom-Json
  Write-Host 'LOOPS secret gates'
  Write-Host "Report: $($payload.reportPath)"
  Write-Host "secrets.local.ps1: $($payload.localExists)"

  foreach ($gate in $payload.gates) {
    $status = if ($gate.runnerWrapperReady) { 'READY' } else { 'MISSING' }
    Write-Host "[$status] $($gate.id) - $($gate.title)"
    foreach ($variable in $gate.variables) {
      $source = if ($variable.currentProcessPresent) {
        'current-process'
      } elseif ($variable.localFileNonEmptyAssignment) {
        'secrets.local.ps1'
      } elseif ($variable.localFileAssignmentPresent) {
        'placeholder-or-empty'
      } else {
        'missing'
      }
      Write-Host "  - $($variable.name): $source"
    }
  }

  if ($OpenReport -and $payload.reportPath -and (Test-Path -LiteralPath $payload.reportPath)) {
    Invoke-Item -LiteralPath $payload.reportPath
  }

  if ($payload.summary.missing.Count -gt 0) {
    Write-Host "Missing gates: $($payload.summary.missing -join ', ')"
    exit 2
  }

  Write-Host 'All required secret gates are ready for the local runner wrapper.'
  exit 0
}
finally {
  Pop-Location
}
