[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\power-platform\DynamicsBusinessMachine')
)

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$coreSolutionName = [string]$version.solutionNames.core
$baselineRoot = Join-Path $RepoRoot "power-platform\solutions\$coreSolutionName\baseline"
$manifestPath = Join-Path $RepoRoot 'power-platform\manifests\webresources.yml'
$manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
$stagingRoot = Join-Path $OutputRoot 'src'
$otherRoot = Join-Path $stagingRoot 'Other'

function Get-DbmAssemblyPublicKeyToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AssemblyPath
    )

    $assemblyName = [System.Reflection.AssemblyName]::GetAssemblyName($AssemblyPath)
    return [System.BitConverter]::ToString($assemblyName.GetPublicKeyToken()).Replace('-', '').ToLowerInvariant()
}

if (Test-Path $stagingRoot) {
    Remove-Item -Path $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
Copy-Item -Path (Join-Path $baselineRoot '*') -Destination $stagingRoot -Recurse -Force
New-Item -ItemType Directory -Path $otherRoot -Force | Out-Null

Move-Item -Path (Join-Path $stagingRoot 'solution.xml') -Destination (Join-Path $otherRoot 'Solution.xml') -Force
Move-Item -Path (Join-Path $stagingRoot 'customizations.xml') -Destination (Join-Path $otherRoot 'Customizations.xml') -Force

$solutionXmlPath = Join-Path $otherRoot 'Solution.xml'
$solutionXml = [xml](Get-Content -Path $solutionXmlPath -Raw)
$solutionXml.ImportExportXml.SolutionManifest.Version = $version.solutionVersion
$solutionXml.Save($solutionXmlPath)

$customizationsXmlPath = Join-Path $otherRoot 'Customizations.xml'
$customizationsXml = [xml](Get-Content -Path $customizationsXmlPath -Raw)
$introducedVersionNodes = $customizationsXml.SelectNodes('//*[local-name()="IntroducedVersion"]')
foreach ($node in $introducedVersionNodes) {
    $node.InnerText = $version.solutionVersion
}

foreach ($entry in $manifest.files) {
    $sourcePath = Join-Path $RepoRoot $entry.source
    if (-not (Test-Path $sourcePath)) {
        throw "Dataverse asset source is missing: $sourcePath"
    }

    $destinationPath = Join-Path $stagingRoot $entry.stagePath
    $destinationDirectory = Split-Path -Path $destinationPath -Parent
    if (-not (Test-Path $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    Copy-Item -Path $sourcePath -Destination $destinationPath -Force

    if ($entry.componentType -ne 'pluginassembly') {
        continue
    }

    $publicKeyToken = Get-DbmAssemblyPublicKeyToken -AssemblyPath $destinationPath
    if ([string]::IsNullOrWhiteSpace($publicKeyToken)) {
        throw "Dataverse solution staging requires a signed plugin assembly, but '$sourcePath' is unsigned. Rebuild with .\eng\scripts\Build-DotNet.ps1 -EnableLegacyPackaging -AssemblyKeyFile <official.snk> or set DBM_ASSEMBLY_KEY_FILE first."
    }

    $assemblyName = [System.Reflection.AssemblyName]::GetAssemblyName($destinationPath)
    $fullName = $assemblyName.FullName
    $assemblyQualifiedName = "{0}, {1}" -f $entry.pluginTypeName, $fullName
    $workflowActivityGroupName = "{0} ({1})" -f $assemblyName.Name, $assemblyName.Version

    foreach ($rootComponent in $solutionXml.ImportExportXml.SolutionManifest.RootComponents.RootComponent) {
        if ($rootComponent.type -eq '91') {
            $rootComponent.SetAttribute('schemaName', $fullName)
        }
    }

    foreach ($pluginAssembly in $customizationsXml.ImportExportXml.SolutionPluginAssemblies.PluginAssembly) {
        $pluginAssembly.SetAttribute('FullName', $fullName)
        foreach ($pluginTypeNode in $pluginAssembly.PluginTypes.PluginType) {
            $pluginTypeNode.SetAttribute('AssemblyQualifiedName', $assemblyQualifiedName)
            $pluginTypeNode.SetAttribute('Name', $entry.pluginTypeName)
            $pluginTypeNode.WorkflowActivityGroupName = $workflowActivityGroupName
        }
    }
}

$solutionXml.Save($solutionXmlPath)
$customizationsXml.Save($customizationsXmlPath)

Write-Output $stagingRoot
