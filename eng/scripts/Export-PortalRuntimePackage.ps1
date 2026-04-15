[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$ManifestPath = 'power-platform/solutions/DynamicsBusinessMachinePortalRuntime/source/manifest.json',
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'PortalRuntimeDeployment.Common.ps1')

function Copy-DbmPortalAssetContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [Parameter(Mandatory = $true)]
        [string]$Content,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.ArrayList]$ManifestEntries,

        [Parameter(Mandatory = $true)]
        [string]$SourceReference
    )

    $destinationDirectory = Split-Path -Path $DestinationPath -Parent
    if (-not (Test-Path $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText($DestinationPath, $Content, [System.Text.UTF8Encoding]::new($false))

    $ManifestEntries.Add([pscustomobject]@{
        source = $SourceReference
        destination = $DestinationPath
    }) | Out-Null
}

function Copy-DbmPortalAssetFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.ArrayList]$ManifestEntries
    )

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

$assets = Get-DbmPortalRuntimeDeployableAssets -RepoRoot $RepoRoot -ManifestPath $ManifestPath
$resolvedOutputRoot = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    Join-Path $assets.manifest.RepoRoot ("artifacts\portal-runtime\{0}" -f $assets.manifest.solutionName)
}
else {
    Resolve-DbmAbsolutePath -BasePath $assets.manifest.RepoRoot -CandidatePath $OutputRoot
}

if (Test-Path $resolvedOutputRoot) {
    Remove-Item -Path $resolvedOutputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedOutputRoot -Force | Out-Null

$copiedFiles = New-Object System.Collections.ArrayList

foreach ($webFile in $assets.webFiles) {
    $destinationPath = Join-Path $resolvedOutputRoot $webFile.outputRelativePath
    Copy-DbmPortalAssetContent `
        -DestinationPath $destinationPath `
        -Content ([string]$webFile.content) `
        -ManifestEntries $copiedFiles `
        -SourceReference ([string]$webFile.sourcePath)
}

$bootstrapDestinationPath = Join-Path $resolvedOutputRoot ("bootstrap\{0}" -f [System.IO.Path]::GetFileName($assets.bootstrapPath))
Copy-DbmPortalAssetFile -SourcePath $assets.bootstrapPath -DestinationPath $bootstrapDestinationPath -ManifestEntries $copiedFiles

$siteSettingsDestinationPath = Join-Path $resolvedOutputRoot ("site-settings\{0}" -f [System.IO.Path]::GetFileName($assets.siteSettingsPath))
Copy-DbmPortalAssetFile -SourcePath $assets.siteSettingsPath -DestinationPath $siteSettingsDestinationPath -ManifestEntries $copiedFiles

$permissionsDestinationPath = Join-Path $resolvedOutputRoot ("permissions\{0}" -f [System.IO.Path]::GetFileName($assets.permissionsPath))
Copy-DbmPortalAssetFile -SourcePath $assets.permissionsPath -DestinationPath $permissionsDestinationPath -ManifestEntries $copiedFiles

foreach ($template in $assets.webTemplates) {
    $destinationPath = Join-Path $resolvedOutputRoot $template.outputRelativePath
    Copy-DbmPortalAssetFile -SourcePath $template.templatePath -DestinationPath $destinationPath -ManifestEntries $copiedFiles
}

$manifestCopyPath = Join-Path $resolvedOutputRoot 'manifest.json'
Copy-DbmPortalAssetFile -SourcePath $assets.manifest.Path -DestinationPath $manifestCopyPath -ManifestEntries $copiedFiles

$exportManifest = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    solutionName = $assets.manifest.solutionName
    bundlePackageName = $assets.manifest.bundlePackageName
    sourceManifest = $assets.manifest.Path
    outputRoot = $resolvedOutputRoot
    webFiles = @(
        $assets.webFiles | ForEach-Object {
            [ordered]@{
                webFilePath = $_.webFilePath
                kind = $_.kind
                source = $_.sourcePath
            }
        }
    )
    files = @($copiedFiles)
}

$exportManifestPath = Join-Path $resolvedOutputRoot 'export-manifest.json'
$exportManifest | ConvertTo-Json -Depth 8 | Set-Content -Path $exportManifestPath -Encoding UTF8

Write-Host "Portal runtime export root: $resolvedOutputRoot"
Write-Host "Portal runtime export manifest: $exportManifestPath"
