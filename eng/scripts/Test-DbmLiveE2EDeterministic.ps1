[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-live-e2e'
$packageJsonPath = Join-Path $packageRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM live-E2E package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM live-E2E package.json is missing: $packageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host 'Installing dbm-live-e2e dependencies'
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-live-e2e dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Building dbm-live-e2e'
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-live-e2e build failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Validating dbm-live-e2e case catalog'
    npm run validate:cases
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-live-e2e case validation failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Running dbm-live-e2e deterministic tests'
    npm run test
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-live-e2e deterministic tests failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM live-E2E deterministic validation passed.'
