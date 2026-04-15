[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$ManifestPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'power-platform\solutions\DynamicsBusinessMachinePortalRuntime\source\manifest.json'),
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'

function Resolve-DbmAbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$CandidatePath
    )

    if ([System.IO.Path]::IsPathRooted($CandidatePath)) {
        return [System.IO.Path]::GetFullPath($CandidatePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $CandidatePath))
}

function Copy-DbmPortalAsset {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.ArrayList]$ManifestEntries
    )

    if (-not (Test-Path $SourcePath)) {
        throw "Portal runtime asset is missing: $SourcePath"
    }

    $destinationDirectory = Split-Path -Path $DestinationPath -Parent
    if (-not (Test-Path $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    Copy-Item -Path $SourcePath -Destination $DestinationPath -Force

    $ManifestEntries.Add([pscustomobject]@{
        source = $SourcePath
        destination = $DestinationPath
    }) | Out-Null
}

$resolvedManifestPath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath $ManifestPath
if (-not (Test-Path $resolvedManifestPath)) {
    throw "Portal runtime manifest is missing: $resolvedManifestPath"
}

$manifest = Get-Content -Path $resolvedManifestPath -Raw | ConvertFrom-Json
$resolvedOutputRoot = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    Join-Path $RepoRoot ("artifacts\portal-runtime\{0}" -f [string]$manifest.solutionName)
}
else {
    Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath $OutputRoot
}

if (Test-Path $resolvedOutputRoot) {
    Remove-Item -Path $resolvedOutputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedOutputRoot -Force | Out-Null

$copiedFiles = New-Object System.Collections.ArrayList

$bundleSourcePath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath ([string]$manifest.bundleSourcePath)
$bundleDestinationPath = Join-Path $resolvedOutputRoot 'web-files\dbm\portal-runtime\portal-runtime.js'
Copy-DbmPortalAsset -SourcePath $bundleSourcePath -DestinationPath $bundleDestinationPath -ManifestEntries $copiedFiles

$bootstrapSourcePath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath ([string]$manifest.bootstrapPath)
$bootstrapDestinationPath = Join-Path $resolvedOutputRoot ("bootstrap\{0}" -f [System.IO.Path]::GetFileName($bootstrapSourcePath))
Copy-DbmPortalAsset -SourcePath $bootstrapSourcePath -DestinationPath $bootstrapDestinationPath -ManifestEntries $copiedFiles

$siteSettingsSourcePath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath ([string]$manifest.siteSettingsPath)
$siteSettingsDestinationPath = Join-Path $resolvedOutputRoot ("site-settings\{0}" -f [System.IO.Path]::GetFileName($siteSettingsSourcePath))
Copy-DbmPortalAsset -SourcePath $siteSettingsSourcePath -DestinationPath $siteSettingsDestinationPath -ManifestEntries $copiedFiles

$permissionsSourcePath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath ([string]$manifest.permissionsPath)
$permissionsDestinationPath = Join-Path $resolvedOutputRoot ("permissions\{0}" -f [System.IO.Path]::GetFileName($permissionsSourcePath))
Copy-DbmPortalAsset -SourcePath $permissionsSourcePath -DestinationPath $permissionsDestinationPath -ManifestEntries $copiedFiles

foreach ($page in @($manifest.pages)) {
    $templateSourcePath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath ([string]$page.templatePath)
    $templateDestinationPath = Join-Path $resolvedOutputRoot ("web-templates\{0}" -f [System.IO.Path]::GetFileName($templateSourcePath))
    Copy-DbmPortalAsset -SourcePath $templateSourcePath -DestinationPath $templateDestinationPath -ManifestEntries $copiedFiles
}

$manifestCopyPath = Join-Path $resolvedOutputRoot 'manifest.json'
Copy-DbmPortalAsset -SourcePath $resolvedManifestPath -DestinationPath $manifestCopyPath -ManifestEntries $copiedFiles

$exportManifest = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    solutionName = [string]$manifest.solutionName
    bundlePackageName = [string]$manifest.bundlePackageName
    sourceManifest = $resolvedManifestPath
    outputRoot = $resolvedOutputRoot
    files = @($copiedFiles)
}

$exportManifestPath = Join-Path $resolvedOutputRoot 'export-manifest.json'
$exportManifest | ConvertTo-Json -Depth 6 | Set-Content -Path $exportManifestPath -Encoding UTF8

Write-Host "Portal runtime export root: $resolvedOutputRoot"
Write-Host "Portal runtime export manifest: $exportManifestPath"
