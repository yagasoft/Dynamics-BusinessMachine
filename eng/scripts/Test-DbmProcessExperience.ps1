[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-process-experience'
$packageJsonPath = Join-Path $packageRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM process-experience package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM process-experience package.json is missing: $packageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-process-experience dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Testing dbm-process-experience"
    npm run test
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience tests failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-process-experience"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM process-experience validation passed.'
