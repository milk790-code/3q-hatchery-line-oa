$ErrorActionPreference = 'Stop'

node (Join-Path $PSScriptRoot 'prepare-manual-gate-adapter.mjs')

