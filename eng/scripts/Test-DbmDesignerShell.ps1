[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-designer-shell'
$packageJsonPath = Join-Path $packageRoot 'package.json'
$contractRoot = Join-Path $RepoRoot 'dbm-contract'
$contractPackageJsonPath = Join-Path $contractRoot 'package.json'
$designerCoreRoot = Join-Path $RepoRoot 'dbm-designer-core'
$designerCorePackageJsonPath = Join-Path $designerCoreRoot 'package.json'
$processExperienceRoot = Join-Path $RepoRoot 'dbm-process-experience'
$processExperiencePackageJsonPath = Join-Path $processExperienceRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM designer-shell package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM designer-shell package.json is missing: $packageJsonPath"
}

if (-not (Test-Path $contractRoot)) {
    throw "DBM contract package directory is missing: $contractRoot"
}

if (-not (Test-Path $contractPackageJsonPath)) {
    throw "DBM contract package.json is missing: $contractPackageJsonPath"
}

if (-not (Test-Path $designerCoreRoot)) {
    throw "DBM designer-core package directory is missing: $designerCoreRoot"
}

if (-not (Test-Path $designerCorePackageJsonPath)) {
    throw "DBM designer-core package.json is missing: $designerCorePackageJsonPath"
}

if (-not (Test-Path $processExperienceRoot)) {
    throw "DBM process-experience package directory is missing: $processExperienceRoot"
}

if (-not (Test-Path $processExperiencePackageJsonPath)) {
    throw "DBM process-experience package.json is missing: $processExperiencePackageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-contract dependencies for dbm-designer-shell"
    npm --prefix $contractRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Installing dbm-designer-core dependencies for dbm-designer-shell"
    npm --prefix $designerCoreRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-designer-core dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Installing dbm-process-experience dependencies for dbm-designer-shell"
    npm --prefix $processExperienceRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience dependency installation failed with exit code $LASTEXITCODE."
    }

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
