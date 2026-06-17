param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Idea,
  [string]$IdeaFile,
  [string]$Format,
  [int]$Duration,
  [switch]$FromInbox,
  [switch]$Demo,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

Push-Location $RepoRoot
try {
  $runnerArgs = @()
  if ($Idea) {
    $runnerArgs += '--idea'
    $runnerArgs += $Idea
  }
  if ($IdeaFile) {
    $runnerArgs += '--idea-file'
    $runnerArgs += $IdeaFile
  }
  if ($Format) {
    $runnerArgs += '--format'
    $runnerArgs += $Format
  }
  if ($Duration -gt 0) {
    $runnerArgs += '--duration'
    $runnerArgs += [string]$Duration
  }
  if ($FromInbox) {
    $runnerArgs += '--from-inbox'
  }
  if ($Demo) {
    $runnerArgs += '--demo'
  }
  if ($Force) {
    $runnerArgs += '--force'
  }
  node (Join-Path $PSScriptRoot 'prepare-material-factory.mjs') @runnerArgs
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
