[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$designerCoreRoot = Join-Path $RepoRoot 'dbm-designer-core'
$packageJsonPath = Join-Path $designerCoreRoot 'package.json'

if (-not (Test-Path $designerCoreRoot)) {
    throw "DBM designer core package directory is missing: $designerCoreRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM designer core package.json is missing: $packageJsonPath"
}

Push-Location $designerCoreRoot
try {
    Write-Host "Installing dbm-designer-core dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-core dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-designer-core"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-core build failed with exit code $LASTEXITCODE."
    }

    Write-Host "Validating dbm-designer-core"
    npm run validate
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-core validation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM designer core validation passed.'
