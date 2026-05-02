[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\dataverse'),
    [ValidateSet('Full', 'UnmanagedOnly')]
    [string]$PackageSet = 'Full',
    [switch]$RunSolutionCheck = $true,
    [switch]$GenerateSettings = $true,
    [string]$ModelPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'dbm-contract\fixtures\valid\generic-process-matrix\linear-service-fulfilment.model.json')
)

$ErrorActionPreference = 'Stop'

function Resolve-DbmPacPath {
    if (-not [string]::IsNullOrWhiteSpace($env:POWERPLATFORMTOOLS_PACPATH) -and (Test-Path $env:POWERPLATFORMTOOLS_PACPATH)) {
        return (Resolve-Path $env:POWERPLATFORMTOOLS_PACPATH).Path
    }

    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if ($pac) {
        return $pac.Source
    }

    throw 'pac must be available on PATH or via POWERPLATFORMTOOLS_PACPATH to package Dataverse solution artifacts.'
}

function Set-DbmSolutionSourceVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$SolutionVersion
    )

    $solutionXmlPath = Join-Path $SourceRoot 'Other\Solution.xml'
    if (-not (Test-Path $solutionXmlPath)) {
        throw "Solution manifest is missing: $solutionXmlPath"
    }

    $solutionXml = [xml](Get-Content -Path $solutionXmlPath -Raw)
    $solutionXml.ImportExportXml.SolutionManifest.Version = $SolutionVersion
    $solutionXml.Save($solutionXmlPath)
}

function New-DbmManagedSourceRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$ManagedRoot
    )

    $managedSourceRoot = Join-Path $ManagedRoot 'src'
    if (Test-Path $ManagedRoot) {
        Remove-Item -Path $ManagedRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Path $managedSourceRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $SourceRoot '*') -Destination $managedSourceRoot -Recurse -Force

    $managedSolutionXmlPath = Join-Path $managedSourceRoot 'Other\Solution.xml'
    $managedSolutionXml = [xml](Get-Content -Path $managedSolutionXmlPath -Raw)
    $managedSolutionXml.ImportExportXml.SolutionManifest.Managed = '1'
    $managedSolutionXml.Save($managedSolutionXmlPath)

    return $managedSourceRoot
}

function Invoke-DbmSolutionPack {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PacPath,

        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$ZipFile,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Managed', 'Unmanaged')]
        [string]$PackageType
    )

    & $PacPath solution pack --folder $SourceRoot --zipfile $ZipFile --packagetype $PackageType --allowWrite --allowDelete
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution pack failed for $ZipFile"
    }
}

function Invoke-DbmSolutionCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PacPath,

        [Parameter(Mandatory = $true)]
        [string]$ZipFile,

        [Parameter(Mandatory = $true)]
        [string]$OutputDirectory
    )

    if (Test-Path $OutputDirectory) {
        Remove-Item -Path $OutputDirectory -Recurse -Force
    }

    & $PacPath solution check --path $ZipFile --outputDirectory $OutputDirectory --geo UnitedStates
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution check failed for $ZipFile"
    }
}

function Invoke-DbmCreateSettings {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PacPath,

        [Parameter(Mandatory = $true)]
        [string]$ManagedZip,

        [Parameter(Mandatory = $true)]
        [string]$SettingsFile
    )

    & $PacPath solution create-settings --solution-zip $ManagedZip --settings-file $SettingsFile
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution create-settings failed for $ManagedZip"
    }
}

$pacPath = Resolve-DbmPacPath
$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$coreSolutionName = [string]$version.solutionNames.core
$generatedMetadataSolutionName = [string]$version.solutionNames.generatedMetadata

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$coreSourceRoot = & (Join-Path $PSScriptRoot 'New-DataverseSolutionSource.ps1') `
    -RepoRoot $RepoRoot `
    -OutputRoot (Join-Path $OutputRoot 'staging-core')

$generatedOutputRoot = Join-Path $OutputRoot 'staging-generated'
& (Join-Path $PSScriptRoot 'Invoke-DataverseSynthesis.ps1') `
    -RepoRoot $RepoRoot `
    -ModelPath $ModelPath `
    -Mode EmitSource `
    -OutputRoot $generatedOutputRoot

$generatedSourceRoot = Join-Path $generatedOutputRoot 'src'
if (-not (Test-Path $generatedSourceRoot)) {
    throw "Generated metadata solution source is missing: $generatedSourceRoot"
}

Set-DbmSolutionSourceVersion -SourceRoot $generatedSourceRoot -SolutionVersion ([string]$version.solutionVersion)

$solutionDefinitions = @(
    [pscustomobject]@{
        Name = $coreSolutionName
        SourceRoot = $coreSourceRoot
        StagingRoot = Join-Path $OutputRoot 'staging-core'
        ManagedStagingRoot = Join-Path $OutputRoot 'staging-managed-core'
        SettingsFile = Join-Path $OutputRoot "SampleDeploymentSettings.$coreSolutionName.json"
        EmitLegacySettingsAlias = $true
    },
    [pscustomobject]@{
        Name = $generatedMetadataSolutionName
        SourceRoot = $generatedSourceRoot
        StagingRoot = $generatedOutputRoot
        ManagedStagingRoot = Join-Path $OutputRoot 'staging-managed-generated'
        SettingsFile = Join-Path $OutputRoot "SampleDeploymentSettings.$generatedMetadataSolutionName.json"
        EmitLegacySettingsAlias = $false
    }
)

$packagedArtifacts = @()

foreach ($definition in $solutionDefinitions) {
    $unmanagedZip = Join-Path $OutputRoot "$($definition.Name)-$($version.solutionVersion)-unmanaged.zip"
    $managedZip = Join-Path $OutputRoot "$($definition.Name)-$($version.solutionVersion)-managed.zip"

    Invoke-DbmSolutionPack -PacPath $pacPath -SourceRoot $definition.SourceRoot -ZipFile $unmanagedZip -PackageType Unmanaged

    if ($PackageSet -eq 'Full') {
        $managedSourceRoot = New-DbmManagedSourceRoot -SourceRoot $definition.SourceRoot -ManagedRoot $definition.ManagedStagingRoot
        Invoke-DbmSolutionPack -PacPath $pacPath -SourceRoot $managedSourceRoot -ZipFile $managedZip -PackageType Managed
    }
    elseif (Test-Path $managedZip) {
        Remove-Item -Path $managedZip -Force
    }

    if ($RunSolutionCheck) {
        Invoke-DbmSolutionCheck `
            -PacPath $pacPath `
            -ZipFile $unmanagedZip `
            -OutputDirectory (Join-Path $OutputRoot ("solution-check\{0}" -f $definition.Name))
    }

    if ($PackageSet -eq 'Full' -and $GenerateSettings) {
        Invoke-DbmCreateSettings -PacPath $pacPath -ManagedZip $managedZip -SettingsFile $definition.SettingsFile

        if ($definition.EmitLegacySettingsAlias) {
            Copy-Item -Path $definition.SettingsFile -Destination (Join-Path $OutputRoot 'SampleDeploymentSettings.json') -Force
        }
    }
    elseif (Test-Path $definition.SettingsFile) {
        Remove-Item -Path $definition.SettingsFile -Force
    }

    $packagedArtifacts += [pscustomobject]@{
        solutionName = $definition.Name
        unmanagedZip = $unmanagedZip
        managedZip = if ($PackageSet -eq 'Full') { $managedZip } else { $null }
        settingsFile = if ($PackageSet -eq 'Full' -and $GenerateSettings) { $definition.SettingsFile } else { $null }
    }
}

if (($PackageSet -ne 'Full' -or -not $GenerateSettings) -and (Test-Path (Join-Path $OutputRoot 'SampleDeploymentSettings.json'))) {
    Remove-Item -Path (Join-Path $OutputRoot 'SampleDeploymentSettings.json') -Force
}

$manifestPath = Join-Path $OutputRoot 'package-manifest.json'
[ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    solutionVersion = [string]$version.solutionVersion
    packageSet = $PackageSet
    solutions = $packagedArtifacts
} | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

foreach ($artifact in $packagedArtifacts) {
    Write-Host "Unmanaged package [$($artifact.solutionName)]: $($artifact.unmanagedZip)"
    if ($PackageSet -eq 'Full') {
        Write-Host "Managed package   [$($artifact.solutionName)]: $($artifact.managedZip)"
    }
}

Write-Host "Package manifest: $manifestPath"
