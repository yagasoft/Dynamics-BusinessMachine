[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-portal-runtime'
$packageJsonPath = Join-Path $packageRoot 'package.json'
$contractRoot = Join-Path $RepoRoot 'dbm-contract'
$contractPackageJsonPath = Join-Path $contractRoot 'package.json'
$processExperienceRoot = Join-Path $RepoRoot 'dbm-process-experience'
$processExperiencePackageJsonPath = Join-Path $processExperienceRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM portal-runtime package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM portal-runtime package.json is missing: $packageJsonPath"
}

if (-not (Test-Path $contractRoot)) {
    throw "DBM contract package directory is missing: $contractRoot"
}

if (-not (Test-Path $contractPackageJsonPath)) {
    throw "DBM contract package.json is missing: $contractPackageJsonPath"
}

if (-not (Test-Path $processExperienceRoot)) {
    throw "DBM process-experience package directory is missing: $processExperienceRoot"
}

if (-not (Test-Path $processExperiencePackageJsonPath)) {
    throw "DBM process-experience package.json is missing: $processExperiencePackageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-contract dependencies for dbm-portal-runtime"
    npm --prefix $contractRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Installing dbm-process-experience dependencies for dbm-portal-runtime"
    npm --prefix $processExperienceRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience dependency installation failed with exit code $LASTEXITCODE."
    }

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
