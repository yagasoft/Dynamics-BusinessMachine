[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-designer-shell'
$packageJsonPath = Join-Path $packageRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM designer-shell package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM designer-shell package.json is missing: $packageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-designer-shell dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-shell dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Testing dbm-designer-shell"
    npm run test
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-shell tests failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-designer-shell"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-shell build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM designer-shell validation passed.'
