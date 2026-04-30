[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-process-experience'
$packageJsonPath = Join-Path $packageRoot 'package.json'
$contractRoot = Join-Path $RepoRoot 'dbm-contract'
$contractPackageJsonPath = Join-Path $contractRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM process-experience package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM process-experience package.json is missing: $packageJsonPath"
}

if (-not (Test-Path $contractRoot)) {
    throw "DBM contract package directory is missing: $contractRoot"
}

if (-not (Test-Path $contractPackageJsonPath)) {
    throw "DBM contract package.json is missing: $contractPackageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-contract dependencies for dbm-process-experience"
    npm --prefix $contractRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract dependency installation failed with exit code $LASTEXITCODE."
    }

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
