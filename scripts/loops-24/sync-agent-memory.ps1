$ErrorActionPreference = 'Stop'

node (Join-Path $PSScriptRoot 'sync-agent-memory.mjs') @args

