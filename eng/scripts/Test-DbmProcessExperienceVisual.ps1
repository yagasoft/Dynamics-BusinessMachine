[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$InstallBrowsers,
    [switch]$UpdateSnapshots
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

$packageJson = Get-Content -Path $packageJsonPath -Raw
if ($packageJson -notmatch '"test:visual"\s*:') {
    throw 'dbm-process-experience package.json must define a test:visual script.'
}

if ($UpdateSnapshots -and $packageJson -notmatch '"test:visual:update"\s*:') {
    throw 'dbm-process-experience package.json must define a test:visual:update script when -UpdateSnapshots is used.'
}

Push-Location $packageRoot
try {
    Write-Host 'Installing dbm-contract dependencies for process-experience visual build'
    npm --prefix $contractRoot ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-contract dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Installing dbm-process-experience dependencies'
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience dependency installation failed with exit code $LASTEXITCODE."
    }

    if ($InstallBrowsers) {
        Write-Host 'Installing Playwright browsers for dbm-process-experience visual tests'
        npx playwright install
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright browser installation failed with exit code $LASTEXITCODE."
        }
    }

    $scriptName = if ($UpdateSnapshots) { 'test:visual:update' } else { 'test:visual' }
    Write-Host "Running dbm-process-experience $scriptName"
    npm run $scriptName
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-process-experience visual validation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host 'DBM process-experience visual validation passed.'
