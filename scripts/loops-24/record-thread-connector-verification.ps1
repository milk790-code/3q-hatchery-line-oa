param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('github_app', 'gmail_app', 'google_drive_app', 'slack_app', 'chrome_plugin')]
  [string]$Connector,

  [ValidateSet('ready', 'attention', 'failed')]
  [string]$Status = 'ready',

  [string]$Probe = 'read-only connector probe',
  [string]$Evidence = 'Thread-side read-only connector probe completed.',
  [string]$Source = 'codex-thread',
  [string]$RepoFullName,
  [string]$RepoId,
  [int]$TtlMinutes = 1440,
  [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

Push-Location $RepoRoot
try {
  $runnerArgs = @(
    '--connector', $Connector,
    '--status', $Status,
    '--probe', $Probe,
    '--evidence', $Evidence,
    '--source', $Source,
    '--ttl-minutes', "$TtlMinutes"
  )
  if ($RepoFullName) {
    $runnerArgs += @('--repo-full-name', $RepoFullName)
  }
  if ($RepoId) {
    $runnerArgs += @('--repo-id', $RepoId)
  }
  node (Join-Path $PSScriptRoot 'record-thread-connector-verification.mjs') @runnerArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
