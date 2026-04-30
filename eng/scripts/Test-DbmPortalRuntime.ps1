[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-portal-runtime'
$packageJsonPath = Join-Path $packageRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM portal-runtime package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM portal-runtime package.json is missing: $packageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-portal-runtime dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-portal-runtime dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Testing dbm-portal-runtime"
    npm run test
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-portal-runtime tests failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-portal-runtime"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-portal-runtime build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM portal-runtime validation passed.'
