param(
  [Parameter(Position = 0)]
  [string[]]$PluginNames = @(),

  [Parameter()]
  [string]$PluginListFile,

  [Parameter()]
  [string]$RepoRoot = '',

  [Parameter()]
  [string]$PluginCreatorRoot = (Join-Path $env:USERPROFILE '.codex\skills\.system\plugin-creator'),

  [Parameter()]
  [string]$PluginParent = '',

  [Parameter()]
  [string]$TemplatePath = '',

  [Parameter()]
  [switch]$UseTeamMarketplace = $true,

  [Parameter()]
  [string]$MarketplacePath = '',

  [Parameter()]
  [string]$TeamMarketplaceName = 'team-3q',

  [Parameter()]
  [switch]$WithMarketplace = $true,

  [Parameter()]
  [switch]$WithSkills = $true,

  [Parameter()]
  [switch]$WithHooks = $false,

  [Parameter()]
  [switch]$WithScripts = $false,

  [Parameter()]
  [switch]$WithAssets = $false,

  [Parameter()]
  [switch]$WithMcp = $false,

  [Parameter()]
  [switch]$WithApps = $false,

  [Parameter()]
  [string]$TemplateCategory = 'Productivity',

  [Parameter()]
  [string]$TemplateAuthor = 'Local developer',

  [Parameter()]
  [string]$TemplateDeveloper = 'Local developer',

  [Parameter()]
  [string]$TemplateDescription = '3q plugin scaffold.',

  [Parameter()]
  [string]$TemplateShortDescription = 'Use {DisplayName} in Codex.',

  [Parameter()]
  [string]$TemplateLongDescription = '{DisplayName} adds a local Codex plugin scaffold.',

  [Parameter()]
  [string]$TemplateDefaultPrompt = 'Help me use {DisplayName}.',

  [Parameter()]
  [switch]$SkipTemplate = $false,

  [Parameter()]
  [switch]$SkipValidate = $false,

  [Parameter()]
  [switch]$SkipCachebuster = $false,

  [Parameter()]
  [string]$Cachebuster = '',

  [Parameter()]
  [switch]$SkipReinstall = $false,

  [Parameter()]
  [switch]$DryRun = $false,

  [Parameter()]
  [int]$MaxRetries = 2,

  [Parameter()]
  [int]$ReinstallRetries = 1,

  [Parameter()]
  [switch]$AllowExisting = $false,

  [Parameter()]
  [switch]$SkipExisting = $false,

  [Parameter()]
  [switch]$ReinstallOnly = $false,

  [Parameter()]
  [string]$ReportJson = '',

  [Parameter()]
  [switch]$Force = $false
)

$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot -and $PSCommandPath) {
  $scriptRoot = Split-Path -Parent $PSCommandPath
}
if (-not $scriptRoot) {
  $scriptRoot = (Get-Location).Path
}
if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
}

if (-not $PluginNames -and -not $PluginListFile) {
  throw 'Provide at least one plugin by -PluginNames or -PluginListFile.'
}

$repoRoot = (Resolve-Path $RepoRoot).Path
if (-not $PluginParent) {
  $PluginParent = Join-Path $repoRoot 'plugins'
}
if (-not $TemplatePath) {
  $TemplatePath = Join-Path $scriptRoot 'plugin-manifest.template.json'
}

if ($UseTeamMarketplace) {
  if (-not $MarketplacePath) {
    $MarketplacePath = Join-Path $repoRoot '.agents\plugins\marketplace.json'
  }
} else {
  if (-not $MarketplacePath) {
    $MarketplacePath = Join-Path $env:USERPROFILE '.agents\plugins\marketplace.json'
  }
}

$pluginCreatorScriptPath = Join-Path $PluginCreatorRoot 'scripts'
$createPluginScript = Join-Path $pluginCreatorScriptPath 'create_basic_plugin.py'
$validatePluginScript = Join-Path $pluginCreatorScriptPath 'validate_plugin.py'
$cachebusterScript = Join-Path $pluginCreatorScriptPath 'update_plugin_cachebuster.py'

function Normalize-PluginName {
  param([string]$Value)
  $value = $Value.ToLowerInvariant().Trim()
  $value = [regex]::Replace($value, '[^a-z0-9]+', '-')
  $value = $value.Trim('-')
  $value = [regex]::Replace($value, '-{2,}', '-')
  return $value
}

function Normalize-DisplayName {
  param([string]$Slug)
  if (-not $Slug) {
    return ''
  }
  $parts = $Slug -split '-'
  $titleCase = foreach ($part in $parts) {
    if ($part) {
      ($part.Substring(0, 1).ToUpperInvariant() + $part.Substring(1))
    }
  }
  return ($titleCase -join ' ')
}

function Invoke-WithRetry {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [scriptblock]$Action,
    [Parameter()]
    [int]$MaxRetries = 2
  )

  for ($attempt = 1; $attempt -le ($MaxRetries + 1); $attempt++) {
    try {
      $result = & $Action
      return @{
        Success = $true
        Attempt = $attempt
        Output = $result
      }
    } catch {
      if ($attempt -gt $MaxRetries) {
        return @{
          Success = $false
          Attempt = $attempt
          Output = $_.Exception.Message
        }
      }
      Start-Sleep -Seconds ([math]::Pow(2, $attempt - 1))
    }
  }
  return @{ Success = $false; Attempt = $MaxRetries + 1; Output = 'unexpected retry failure' }
}

function Invoke-External {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string]$Command,
    [Parameter(Mandatory)]
    [string[]]$ArgumentList,
    [Parameter()]
    [int]$MaxRetries = 2,
    [Parameter()]
    [string]$Label
  )

  return Invoke-WithRetry -MaxRetries $MaxRetries -Action {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
      throw "Command not found: $Command"
    }

    $output = & $Command @ArgumentList 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed ($Label). ExitCode=$LASTEXITCODE. Output=$output"
    }
    return $output.Trim()
  }
}

function Get-MarketplaceName {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Marketplace file not found: $Path"
  }

  $payload = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if (-not $payload.PSObject.Properties.Name -contains 'name') {
    throw "Marketplace file missing name: $Path"
  }
  return [string]$payload.name
}

function Get-MarketplaceRoot {
  param([string]$Path)
  $resolvedPath = (Resolve-Path $Path).Path
  $pluginsDir = Split-Path -Parent $resolvedPath
  $agentsDir = Split-Path -Parent $pluginsDir
  if ((Split-Path -Leaf $resolvedPath) -eq 'marketplace.json' -and
      (Split-Path -Leaf $pluginsDir) -eq 'plugins' -and
      (Split-Path -Leaf $agentsDir) -eq '.agents') {
    return (Split-Path -Parent $agentsDir)
  }
  return (Split-Path -Parent $resolvedPath)
}

if (-not (Test-Path -LiteralPath $PluginCreatorRoot)) {
  throw "Plugin creator root not found: $PluginCreatorRoot"
}
if (-not (Test-Path -LiteralPath $createPluginScript)) {
  throw "Missing script: $createPluginScript"
}
if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template file not found: $TemplatePath"
}

$pluginParentDir = Split-Path -Parent $PluginParent
if ($pluginParentDir -and -not (Test-Path -LiteralPath $pluginParentDir)) {
  New-Item -ItemType Directory -Force -Path $pluginParentDir | Out-Null
}
$marketplaceDir = Split-Path -Parent $MarketplacePath
if ($marketplaceDir -and -not (Test-Path -LiteralPath $marketplaceDir)) {
  New-Item -ItemType Directory -Force -Path $marketplaceDir | Out-Null
}

$templateText = Get-Content -Raw -LiteralPath $TemplatePath

$requestedPlugins = New-Object System.Collections.Generic.List[string]
if ($PluginListFile) {
  if (-not (Test-Path -LiteralPath $PluginListFile)) {
    throw "PluginListFile not found: $PluginListFile"
  }
  Get-Content -LiteralPath $PluginListFile | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    $_.Split(',') | ForEach-Object {
      $item = $_.Trim()
      if ($item) { $requestedPlugins.Add($item) }
    }
  }
}
foreach ($name in $PluginNames) {
  if ($name -and $name.Trim()) {
    $requestedPlugins.Add($name.Trim())
  }
}

if ($requestedPlugins.Count -eq 0) {
  throw 'No valid plugin names loaded from PluginNames/PluginListFile.'
}

$summary = @{
  Total = 0
  Success = 0
  Failed = 0
  Created = 0
  TemplateApplied = 0
  Validated = 0
  Cachebusted = 0
  Reinstalled = 0
  Skipped = 0
  Records = New-Object System.Collections.Generic.List[PSObject]
  Warnings = New-Object System.Collections.Generic.List[string]
}

if (-not (Get-Command python3 -ErrorAction SilentlyContinue)) {
  throw 'python3 command is not found. Install Python 3 or place python3 on PATH.'
}
$codexAvailable = $null -ne (Get-Command codex -ErrorAction SilentlyContinue)
if ($codexAvailable) {
  $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
  if ($codexCommand.Source -like '*WindowsApps*') {
    $summary.Warnings.Add("codex CLI resolves to WindowsApps and is not runnable from this PowerShell session. Reinstall steps are skipped.")
    $SkipReinstall = $true
  }
}
if ($UseTeamMarketplace -and -not $SkipReinstall -and -not $DryRun -and -not $codexAvailable) {
  $summary.Warnings.Add('codex CLI not found. Reinstall and marketplace add steps are skipped.')
  $SkipReinstall = $true
}

$marketplaceName = $null
if ($UseTeamMarketplace -and $WithMarketplace -and -not $SkipReinstall -and -not $DryRun) {
  $marketplaceRoot = Get-MarketplaceRoot -Path $MarketplacePath
  $marketplaceAddResult = Invoke-External -Command 'codex' -ArgumentList @('plugin', 'marketplace', 'add', $marketplaceRoot) -MaxRetries $ReinstallRetries -Label 'codex plugin marketplace add'
  if (-not $marketplaceAddResult.Success) {
    $summary.Warnings.Add("Failed to add team marketplace: $($marketplaceAddResult.Output)")
  }
}

if ($WithMarketplace -and (Test-Path -LiteralPath $MarketplacePath)) {
  try {
    $marketplaceName = Get-MarketplaceName -Path $MarketplacePath
  } catch {
    $summary.Warnings.Add("Could not read marketplace name from $MarketplacePath; reinstall will be skipped.")
    $SkipReinstall = $true
  }
}

foreach ($rawPlugin in $requestedPlugins) {
  $summary.Total++
  $raw = $rawPlugin.Trim()
  $slug = Normalize-PluginName -Value $raw
  if (-not $slug) {
    $summary.Failed++
    $summary.Records.Add([PSCustomObject]@{
      Raw = $raw
      Slug = ''
      PluginPath = ''
      Result = 'FAILED'
      Step = 'normalize'
      Detail = 'Plugin name normalizes to empty'
      Attempts = 0
    })
    continue
  }

  $displayName = Normalize-DisplayName -Slug $slug
  $pluginPath = Join-Path $PluginParent $slug
  $manifestPath = Join-Path $pluginPath '.codex-plugin\plugin.json'
  $record = [PSCustomObject]@{
    Raw = $raw
    Slug = $slug
    PluginPath = $pluginPath
    Result = 'FAILED'
    Step = ''
    Detail = ''
    Attempts = 0
    TemplateApplied = $false
    Validated = $false
    Cachebusted = $false
    Reinstalled = $false
  }

  if ($DryRun) {
    $record.Result = 'SKIPPED'
    $record.Step = 'dry-run'
    $record.Detail = "Predicted path: $pluginPath"
    $summary.Skipped++
    $summary.Records.Add($record)
    continue
  }

  if (Test-Path -LiteralPath $pluginPath) {
    if ($SkipExisting -and -not $ReinstallOnly) {
      $record.Result = 'SKIPPED'
      $record.Step = 'skip-existing'
      $record.Detail = "Plugin directory already exists: $pluginPath"
      $summary.Skipped++
      $summary.Records.Add($record)
      continue
    }
    if (-not $ReinstallOnly -and -not $AllowExisting -and -not $Force) {
      $summary.Failed++
      $record.Step = 'precheck'
      $record.Detail = "Plugin directory already exists: $pluginPath"
      $summary.Records.Add($record)
      continue
    }
  } elseif ($ReinstallOnly) {
    $summary.Failed++
    $record.Step = 'precheck'
    $record.Detail = "Plugin directory not found for ReinstallOnly: $pluginPath"
    $summary.Records.Add($record)
    continue
  }

  if (-not $ReinstallOnly) {
    $createArgs = @($createPluginScript, $raw, '--path', $PluginParent)
    if ($WithMarketplace) { $createArgs += '--with-marketplace' }
    if ($WithSkills) { $createArgs += '--with-skills' }
    if ($WithHooks) { $createArgs += '--with-hooks' }
    if ($WithScripts) { $createArgs += '--with-scripts' }
    if ($WithAssets) { $createArgs += '--with-assets' }
    if ($WithMcp) { $createArgs += '--with-mcp' }
    if ($WithApps) { $createArgs += '--with-apps' }
    if ($UseTeamMarketplace -and $MarketplacePath) {
      $createArgs += '--marketplace-path'
      $createArgs += $MarketplacePath
    }
    if ($UseTeamMarketplace -and $WithMarketplace -and -not (Test-Path -LiteralPath $MarketplacePath) -and $TeamMarketplaceName -ne 'personal') {
      $createArgs += '--marketplace-name'
      $createArgs += $TeamMarketplaceName
    }

    $createResult = Invoke-External -Command 'python3' -ArgumentList $createArgs -MaxRetries $MaxRetries -Label "create plugin $raw"
    $record.Attempts = $createResult.Attempt
    if (-not $createResult.Success) {
      $summary.Failed++
      $record.Step = 'scaffold'
      $record.Detail = $createResult.Output
      $summary.Records.Add($record)
      continue
    }
    $summary.Created++
  }

  if (-not $SkipTemplate -and -not $ReinstallOnly) {
    try {
      $shortDescription = $TemplateShortDescription.Replace('{DisplayName}', $displayName).Replace('{PluginName}', $slug)
      $longDescription = $TemplateLongDescription.Replace('{DisplayName}', $displayName).Replace('{PluginName}', $slug)
      $defaultPrompt = $TemplateDefaultPrompt.Replace('{DisplayName}', $displayName).Replace('{PluginName}', $slug)
      $desc = $TemplateDescription.Replace('{DisplayName}', $displayName).Replace('{PluginName}', $slug)

      $resolvedTemplateText = $templateText
      $tokens = @{
        '{{PLUGIN_NAME}}' = $slug
        '{{DISPLAY_NAME}}' = $displayName
        '{{DESCRIPTION}}' = $desc
        '{{AUTHOR_NAME}}' = $TemplateAuthor
        '{{DEVELOPER_NAME}}' = $TemplateDeveloper
        '{{CATEGORY}}' = $TemplateCategory
        '{{SHORT_DESCRIPTION}}' = $shortDescription
        '{{LONG_DESCRIPTION}}' = $longDescription
        '{{DEFAULT_PROMPT}}' = $defaultPrompt
      }
      foreach ($token in $tokens.Keys) {
        $resolvedTemplateText = $resolvedTemplateText.Replace($token, $tokens[$token])
      }

      $manifest = ConvertFrom-Json $resolvedTemplateText
      if ($manifest.PSObject.Properties.Name -contains 'name') {
        $manifest.name = $slug
      } else {
        Add-Member -InputObject $manifest -MemberType NoteProperty -Name 'name' -Value $slug
      }
      $json = $manifest | ConvertTo-Json -Depth 64
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $manifestPath) | Out-Null
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      [System.IO.File]::WriteAllText($manifestPath, $json, $utf8NoBom)
      $record.TemplateApplied = $true
      $summary.TemplateApplied++
    } catch {
      $summary.Warnings.Add("Template write failed for ${slug}: $($_.Exception.Message)")
      $record.Detail = "Template failed: $($_.Exception.Message)"
      $summary.Failed++
      $summary.Records.Add($record)
      continue
    }
  }

  if (-not $SkipValidate -and (Test-Path -LiteralPath $validatePluginScript)) {
    $validateResult = Invoke-External -Command 'python3' -ArgumentList @($validatePluginScript, $pluginPath) -MaxRetries 1 -Label "validate $slug"
    if (-not $validateResult.Success) {
      $summary.Warnings.Add("Validation failed for ${slug}: $($validateResult.Output)")
      $record.Detail = "Validation failed: $($validateResult.Output)"
      $summary.Records.Add($record)
      $summary.Failed++
      continue
    } else {
      $record.Validated = $true
      $summary.Validated++
    }
  }

  if (-not $SkipCachebuster -and (Test-Path -LiteralPath $cachebusterScript)) {
    $cacheArgs = @($cachebusterScript, $pluginPath)
    if ($Cachebuster) {
      $cacheArgs += '--cachebuster'
      $cacheArgs += $Cachebuster
    }
    $cacheResult = Invoke-External -Command 'python3' -ArgumentList $cacheArgs -MaxRetries 1 -Label "cachebuster $slug"
    if (-not $cacheResult.Success) {
      $summary.Warnings.Add("Cachebuster failed for ${slug}: $($cacheResult.Output)")
    } else {
      $record.Cachebusted = $true
      $summary.Cachebusted++
    }
  }

  if (-not $SkipReinstall -and $WithMarketplace -and $codexAvailable -and (Get-Command codex -ErrorAction SilentlyContinue)) {
    if (-not $marketplaceName -and (Test-Path -LiteralPath $MarketplacePath)) {
      try {
        $marketplaceName = Get-MarketplaceName -Path $MarketplacePath
      } catch {
        $summary.Warnings.Add("Could not refresh marketplace name from $MarketplacePath; skip reinstall for ${slug}.")
      }
    }
    if (-not $marketplaceName) {
      $summary.Warnings.Add("Marketplace name still missing. Skip reinstall for ${slug}.")
      $record.Detail = 'Reinstall skipped: marketplace name not resolved.'
    } else {
      $reinstallResult = Invoke-External -Command 'codex' -ArgumentList @('plugin', 'add', "$slug@$marketplaceName") -MaxRetries $ReinstallRetries -Label "reinstall $slug"
      if (-not $reinstallResult.Success) {
        $summary.Warnings.Add("Reinstall failed for ${slug}: $($reinstallResult.Output)")
        $record.Detail = "Reinstall failed: $($reinstallResult.Output)"
      } else {
        $record.Reinstalled = $true
        $summary.Reinstalled++
      }
    }
  }

  $record.Result = 'SUCCESS'
  $record.Step = 'complete'
  $summary.Success++
  $summary.Records.Add($record)
}

Write-Host ''
Write-Host 'Plugin scaffold batch completed'
Write-Host "Total: $($summary.Total)"
Write-Host "Success: $($summary.Success)"
Write-Host "Failed: $($summary.Failed)"
Write-Host "Skipped: $($summary.Skipped)"
Write-Host "Created: $($summary.Created)"
Write-Host "Template applied: $($summary.TemplateApplied)"
Write-Host "Validated: $($summary.Validated)"
Write-Host "Cachebusted: $($summary.Cachebusted)"
Write-Host "Reinstalled: $($summary.Reinstalled)"
if ($summary.Warnings.Count -gt 0) {
  Write-Host ''
  Write-Host 'Warnings:'
  $summary.Warnings | ForEach-Object { Write-Host " - $_" }
}

Write-Host ''
Write-Host 'Details:'
$summary.Records | Sort-Object Slug | Format-Table Raw, Slug, Result, Step, Detail -AutoSize

if ($ReportJson) {
  $reportDir = Split-Path -Parent $ReportJson
  if ($reportDir -and -not (Test-Path -LiteralPath $reportDir)) {
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
  }

  $report = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString('o')
    repoRoot = $repoRoot
    pluginParent = $PluginParent
    marketplacePath = $MarketplacePath
    marketplaceName = $marketplaceName
    totals = [PSCustomObject]@{
      total = $summary.Total
      success = $summary.Success
      failed = $summary.Failed
      skipped = $summary.Skipped
      created = $summary.Created
      templateApplied = $summary.TemplateApplied
      validated = $summary.Validated
      cachebusted = $summary.Cachebusted
      reinstalled = $summary.Reinstalled
    }
    warnings = @($summary.Warnings)
    records = @($summary.Records)
  }

  $jsonReport = $report | ConvertTo-Json -Depth 64
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ReportJson, $jsonReport, $utf8NoBom)
  Write-Host ''
  Write-Host "Report JSON: $ReportJson"
}

if ($summary.Failed -gt 0 -and -not $Force) {
  exit 1
}
exit 0
