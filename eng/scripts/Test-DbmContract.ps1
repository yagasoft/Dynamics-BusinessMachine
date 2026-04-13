[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$contractRoot = Join-Path $RepoRoot 'dbm-contract'
$packageJsonPath = Join-Path $contractRoot 'package.json'

if (-not (Test-Path $contractRoot)) {
    throw "DBM contract package directory is missing: $contractRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM contract package.json is missing: $packageJsonPath"
}

Push-Location $contractRoot
try {
    Write-Host "Installing dbm-contract dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-contract"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract build failed with exit code $LASTEXITCODE."
    }

    Write-Host "Validating dbm-contract fixtures"
    npm run validate
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract validation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM contract validation passed.'
