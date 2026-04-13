[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$packageRoot = Join-Path $RepoRoot 'dbm-dataverse-synthesis'
$packageJsonPath = Join-Path $packageRoot 'package.json'

if (-not (Test-Path $packageRoot)) {
    throw "DBM Dataverse synthesis package directory is missing: $packageRoot"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "DBM Dataverse synthesis package.json is missing: $packageJsonPath"
}

Push-Location $packageRoot
try {
    Write-Host "Installing dbm-dataverse-synthesis dependencies"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-dataverse-synthesis dependency installation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building dbm-dataverse-synthesis"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-dataverse-synthesis build failed with exit code $LASTEXITCODE."
    }

    Write-Host "Validating dbm-dataverse-synthesis"
    npm run validate
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-dataverse-synthesis validation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$validationRoot = Join-Path $RepoRoot 'artifacts\validate\dbm-dataverse-synthesis'
if (Test-Path $validationRoot) {
    Remove-Item -Path $validationRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $validationRoot -Force | Out-Null

Write-Host "Generating Dataverse synthesis plan evidence"
& (Join-Path $PSScriptRoot 'Invoke-DataverseSynthesis.ps1') `
    -RepoRoot $RepoRoot `
    -Mode Plan `
    -OutputPath (Join-Path $validationRoot 'plan.json')

Write-Host "Generating Dataverse synthesis source evidence"
& (Join-Path $PSScriptRoot 'Invoke-DataverseSynthesis.ps1') `
    -RepoRoot $RepoRoot `
    -Mode EmitSource `
    -OutputRoot (Join-Path $validationRoot 'generated-source')

Write-Host 'DBM Dataverse synthesis validation passed.'
