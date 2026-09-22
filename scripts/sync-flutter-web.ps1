# Builds Flutter Web and copies into quotation_frontend/public/m/
# Usage (from quotation_frontend):
#   .\scripts\sync-flutter-web.ps1
#   .\scripts\sync-flutter-web.ps1 -SkipBuild
#   .\scripts\sync-flutter-web.ps1 -ApiTarget local

param(
  [switch]$SkipBuild,
  [ValidateSet('prod', 'local')]
  [string]$ApiTarget = 'prod'
)

$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$env:API_TARGET = $ApiTarget

Push-Location $frontendRoot
try {
  if ($SkipBuild) {
    node .\scripts\sync-flutter-web.mjs --skip-build
  } else {
    node .\scripts\sync-flutter-web.mjs
  }
} finally {
  Pop-Location
}
