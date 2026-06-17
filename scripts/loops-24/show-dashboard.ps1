param(
  [string]$StateDir = (Join-Path $env:USERPROFILE '.codex\automations\loops-24'),
  [switch]$Open,
  [switch]$NoSnapshotCheck
)

$ErrorActionPreference = 'Stop'
$dashboardPath = Join-Path $StateDir 'dashboard\latest.md'
if (-not (Test-Path -LiteralPath $dashboardPath)) {
  Write-Error "No dashboard found: $dashboardPath. Run scripts\loops-24\run.ps1 first."
  exit 1
}

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  try {
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  } catch {
    Write-Warning "Could not read JSON for dashboard snapshot check: $Path ($($_.Exception.Message))"
    return $null
  }
}

function Normalize-PathValue {
  param([object]$Path)

  if ($null -eq $Path) {
    return $null
  }

  $value = [string]$Path
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $null
  }

  try {
    return ([System.IO.Path]::GetFullPath($value)).TrimEnd('\')
  } catch {
    return $value.TrimEnd('\')
  }
}

function Get-NestedValue {
  param(
    [object]$Object,
    [string[]]$Path
  )

  $current = $Object
  foreach ($part in $Path) {
    if ($null -eq $current) {
      return $null
    }
    $property = $current.PSObject.Properties[$part]
    if ($null -eq $property) {
      return $null
    }
    $current = $property.Value
  }

  return $current
}

function Add-LatestArtifactWarning {
  param(
    [System.Collections.Generic.List[string]]$Warnings,
    [string]$Label,
    [object]$EmbeddedPath,
    [object]$LatestPath,
    [string]$RefreshCommand
  )

  $embedded = Normalize-PathValue $EmbeddedPath
  $latest = Normalize-PathValue $LatestPath

  if ($embedded -and $latest -and -not [string]::Equals($embedded, $latest, [System.StringComparison]::OrdinalIgnoreCase)) {
    $Warnings.Add("$Label latest artifact differs from the dashboard snapshot.") | Out-Null
    $Warnings.Add("  dashboard: $embedded") | Out-Null
    $Warnings.Add("  latest:    $latest") | Out-Null
    $Warnings.Add("  refresh:   $RefreshCommand") | Out-Null
  }
}

function Add-ExpiredTimestampWarning {
  param(
    [System.Collections.Generic.List[string]]$Warnings,
    [string]$Label,
    [object]$Timestamp,
    [string]$RefreshCommand
  )

  if ($null -eq $Timestamp -or [string]::IsNullOrWhiteSpace([string]$Timestamp)) {
    return
  }

  $parsed = [datetimeoffset]::MinValue
  if (-not [datetimeoffset]::TryParse([string]$Timestamp, [ref]$parsed)) {
    $Warnings.Add("$Label has an unparsable timestamp: $Timestamp") | Out-Null
    return
  }

  if ([datetimeoffset]::UtcNow -ge $parsed.ToUniversalTime()) {
    $Warnings.Add("$Label expired at $($parsed.ToUniversalTime().ToString('o')).") | Out-Null
    $Warnings.Add("  refresh: $RefreshCommand") | Out-Null
  }
}

function Get-DashboardSnapshotWarnings {
  param([string]$StateDir)

  $warnings = [System.Collections.Generic.List[string]]::new()
  $dashboard = Read-JsonFile (Join-Path $StateDir 'dashboard\latest.json')
  if ($null -eq $dashboard) {
    return ,$warnings
  }

  $ownerBundle = Read-JsonFile (Join-Path $StateDir 'owner-approval-bundles\latest.json')
  $approvalWorkbench = Read-JsonFile (Join-Path $StateDir 'approval-workbench\latest.json')
  $accountBindingWorkbench = Read-JsonFile (Join-Path $StateDir 'account-binding-workbench\latest.json')

  Add-LatestArtifactWarning `
    -Warnings $warnings `
    -Label 'Owner approval bundle' `
    -EmbeddedPath (Get-NestedValue $dashboard @('ownerApprovalBundle', 'jsonPath')) `
    -LatestPath (Get-NestedValue $ownerBundle @('jsonPath')) `
    -RefreshCommand 'powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal'

  Add-LatestArtifactWarning `
    -Warnings $warnings `
    -Label 'Approval workbench' `
    -EmbeddedPath (Get-NestedValue $dashboard @('approvalWorkbench', 'jsonPath')) `
    -LatestPath (Get-NestedValue $approvalWorkbench @('jsonPath')) `
    -RefreshCommand 'powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal'

  Add-LatestArtifactWarning `
    -Warnings $warnings `
    -Label 'Account binding workbench' `
    -EmbeddedPath (Get-NestedValue $dashboard @('accountBindingWorkbench', 'reportPath')) `
    -LatestPath (Get-NestedValue $accountBindingWorkbench @('reportPath')) `
    -RefreshCommand 'powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal'

  $latestApprovalExpiry = Get-NestedValue $approvalWorkbench @('summary', 'expiresAt')
  if ($null -eq $latestApprovalExpiry) {
    $latestApprovalExpiry = Get-NestedValue $dashboard @('approvalWorkbench', 'summary', 'expiresAt')
  }
  Add-ExpiredTimestampWarning `
    -Warnings $warnings `
    -Label 'Approval workbench' `
    -Timestamp $latestApprovalExpiry `
    -RefreshCommand 'powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal'

  $latestWakeupFreshUntil = Get-NestedValue $ownerBundle @('summary', 'wakeupFreshUntil')
  if ($null -eq $latestWakeupFreshUntil) {
    $latestWakeupFreshUntil = Get-NestedValue $dashboard @('ownerApprovalBundle', 'summary', 'wakeupFreshUntil')
  }
  Add-ExpiredTimestampWarning `
    -Warnings $warnings `
    -Label 'Owner approval wakeup freshness window' `
    -Timestamp $latestWakeupFreshUntil `
    -RefreshCommand 'powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal'

  return ,$warnings
}

function Write-DashboardSnapshotWarnings {
  param([System.Collections.Generic.List[string]]$Warnings)

  if ($null -eq $Warnings -or $Warnings.Count -eq 0) {
    return
  }

  Write-Output ''
  Write-Output '---'
  Write-Output 'Dashboard snapshot warnings'
  foreach ($warning in $Warnings) {
    Write-Output "- $warning"
  }
  Write-Output '---'
  Write-Output ''
}

$snapshotWarnings = [System.Collections.Generic.List[string]]::new()
if (-not $NoSnapshotCheck) {
  $snapshotWarnings = Get-DashboardSnapshotWarnings -StateDir $StateDir
}

if ($Open) {
  if ($snapshotWarnings.Count -gt 0) {
    foreach ($warning in $snapshotWarnings) {
      Write-Warning $warning
    }
  }
  Invoke-Item -LiteralPath $dashboardPath
} else {
  Write-DashboardSnapshotWarnings -Warnings $snapshotWarnings
  Get-Content -LiteralPath $dashboardPath
}
