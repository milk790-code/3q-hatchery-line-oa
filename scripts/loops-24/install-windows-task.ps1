param(
  [string]$TaskName = 'LOOPS-24-3Q-Hatchery',
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [int]$StartDelayMinutes = 5
)

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\loops-24\run.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Runner wrapper not found: $scriptPath"
}

$powershell = (Get-Command powershell.exe).Source
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$stateDir = Join-Path $env:USERPROFILE '.codex\automations\loops-24'

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$argument = @(
  '-NoProfile'
  '-ExecutionPolicy'
  'Bypass'
  '-File'
  "`"$scriptPath`""
  '-RepoRoot'
  "`"$RepoRoot`""
) -join ' '

$action = New-ScheduledTaskAction `
  -Execute $powershell `
  -Argument $argument `
  -WorkingDirectory $RepoRoot

$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes($StartDelayMinutes) `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 50) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

$principal = New-ScheduledTaskPrincipal `
  -UserId $user `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'LOOPS 24 hourly cross-session pusher for 3Q Hatchery' `
  -Force | Out-Null

Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State, TaskPath
