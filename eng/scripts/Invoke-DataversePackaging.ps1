[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\dataverse'),
    [switch]$RunSolutionCheck = $true,
    [switch]$GenerateSettings = $true
)

$pacPath = $null

if (-not [string]::IsNullOrWhiteSpace($env:POWERPLATFORMTOOLS_PACPATH) -and (Test-Path $env:POWERPLATFORMTOOLS_PACPATH)) {
    $pacPath = (Resolve-Path $env:POWERPLATFORMTOOLS_PACPATH).Path
}
else {
    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if ($pac) {
        $pacPath = $pac.Source
    }
}

if (-not $pacPath) {
    throw 'pac must be available on PATH or via POWERPLATFORMTOOLS_PACPATH to package Dataverse solution artifacts.'
}

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$solutionName = $version.solutionName
$sourceRoot = & (Join-Path $PSScriptRoot 'New-DataverseSolutionSource.ps1') -RepoRoot $RepoRoot -OutputRoot (Join-Path $OutputRoot 'staging')
$managedSourceRoot = Join-Path $OutputRoot 'staging-managed\src'

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$unmanagedZip = Join-Path $OutputRoot "$solutionName-$($version.solutionVersion)-unmanaged.zip"
$managedZip = Join-Path $OutputRoot "$solutionName-$($version.solutionVersion)-managed.zip"
$checkOutput = Join-Path $OutputRoot 'solution-check'

& $pacPath solution pack --folder $sourceRoot --zipfile $unmanagedZip --packagetype Unmanaged --allowWrite --allowDelete
if ($LASTEXITCODE -ne 0) {
    throw "pac solution pack failed for $unmanagedZip"
}

if (Test-Path $managedSourceRoot) {
    Remove-Item -Path $managedSourceRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $managedSourceRoot -Force | Out-Null
Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $managedSourceRoot -Recurse -Force

$managedSolutionXmlPath = Join-Path $managedSourceRoot 'Other\Solution.xml'
$managedSolutionXml = [xml](Get-Content -Path $managedSolutionXmlPath -Raw)
$managedSolutionXml.ImportExportXml.SolutionManifest.Managed = '1'
$managedSolutionXml.Save($managedSolutionXmlPath)

& $pacPath solution pack --folder $managedSourceRoot --zipfile $managedZip --packagetype Managed --allowWrite --allowDelete
if ($LASTEXITCODE -ne 0) {
    throw "pac solution pack failed for $managedZip"
}

if ($RunSolutionCheck) {
    if (Test-Path $checkOutput) {
        Remove-Item -Path $checkOutput -Recurse -Force
    }

    & $pacPath solution check --path $unmanagedZip --outputDirectory $checkOutput --geo UnitedStates
    if ($LASTEXITCODE -ne 0) {
        throw 'pac solution check failed.'
    }
}

if ($GenerateSettings) {
    & $pacPath solution create-settings --solution-zip $managedZip --settings-file (Join-Path $OutputRoot 'SampleDeploymentSettings.json')
    if ($LASTEXITCODE -ne 0) {
        throw 'pac solution create-settings failed.'
    }
}

Write-Host "Unmanaged package: $unmanagedZip"
Write-Host "Managed package: $managedZip"
