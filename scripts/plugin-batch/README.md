# Batch plugin scaffold (PowerShell)

用途：一次輸入多個 Codex plugin 名稱，批次 scaffold、套用共用 `plugin.json` 模板、寫入 team marketplace、更新 cachebuster，並在可用時執行 reinstall。

## 快速使用

直接用參數名單：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 -PluginNames @(
  'line-oa-ops'
  'social-report'
) -UseTeamMarketplace
```

使用名單檔：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 `
  -PluginListFile .\scripts\plugin-batch\plugins.txt `
  -UseTeamMarketplace
```

先預覽，不建立檔案：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 `
  -PluginListFile .\scripts\plugin-batch\plugins.txt `
  -UseTeamMarketplace `
  -DryRun
```

## 重跑模式

遇到已存在 plugin 時跳過：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 `
  -PluginListFile .\scripts\plugin-batch\plugins.txt `
  -UseTeamMarketplace `
  -SkipExisting
```

只針對已存在 plugin 做 validate、cachebuster、reinstall：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 `
  -PluginListFile .\scripts\plugin-batch\plugins.txt `
  -UseTeamMarketplace `
  -ReinstallOnly
```

輸出 JSON 報告：

```powershell
.\scripts\plugin-batch\Batch-PluginScaffold.ps1 `
  -PluginListFile .\scripts\plugin-batch\plugins.txt `
  -UseTeamMarketplace `
  -ReinstallOnly `
  -ReportJson .\scripts\plugin-batch\reports\latest.json
```

若目前 PowerShell 無法執行 WindowsApps 版 `codex.exe`，腳本會自動略過 reinstall，並在摘要列出 warning。

## 常用參數

- `-PluginNames`：直接傳入 plugin 名稱陣列。
- `-PluginListFile`：名單檔路徑，每行一個名稱，也支援逗號分隔。
- `-PluginParent`：plugin 輸出目錄，預設為 repo 的 `plugins`。
- `-UseTeamMarketplace`：使用 repo team marketplace，預設啟用。
- `-MarketplacePath`：marketplace JSON 路徑，預設為 `.agents/plugins/marketplace.json`。
- `-TeamMarketplaceName`：新 marketplace 名稱，預設 `team-3q`。
- `-WithMarketplace`：寫入 marketplace entry，預設啟用。
- `-WithSkills`：建立 `skills/`，預設啟用。
- `-SkipExisting`：已存在 plugin 直接跳過。
- `-ReinstallOnly`：不 scaffold，只 validate/cachebuster/reinstall 已存在 plugin。
- `-ReportJson`：輸出機器可讀 JSON 摘要。
- `-SkipTemplate`、`-SkipValidate`、`-SkipCachebuster`、`-SkipReinstall`：跳過指定步驟。
- `-Cachebuster`：指定 cachebuster 版本字串。
- `-MaxRetries`、`-ReinstallRetries`：重試次數。
- `-DryRun`：只預覽，不建立檔案。
- `-Force`：允許覆蓋既有項目。

## Template tokens

`plugin-manifest.template.json` 支援：

- `{{PLUGIN_NAME}}`
- `{{DISPLAY_NAME}}`
- `{{DESCRIPTION}}`
- `{{AUTHOR_NAME}}`
- `{{DEVELOPER_NAME}}`
- `{{CATEGORY}}`
- `{{SHORT_DESCRIPTION}}`
- `{{LONG_DESCRIPTION}}`
- `{{DEFAULT_PROMPT}}`

`{DisplayName}` 與 `{PluginName}` 可用在命令列模板參數中，腳本會先替換成顯示名稱與 slug。

## 輸出摘要

腳本結尾會列出：

- `Total` / `Success` / `Failed` / `Skipped`
- `Created` / `Template applied` / `Validated` / `Cachebusted` / `Reinstalled`
- 每個 plugin 的 `Raw`、`Slug`、`Result`、`Step`、`Detail`
