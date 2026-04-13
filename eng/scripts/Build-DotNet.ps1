[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$SolutionPath = 'DbmSolution\DbmSolution.sln',
    [string]$Configuration = 'Release',
    [switch]$EnableLegacyPackaging,
    [string]$AssemblyKeyFile
)

$msbuild = Get-Command msbuild -ErrorAction SilentlyContinue
if (-not $msbuild) {
    throw 'msbuild must be available on PATH to build the legacy .NET Framework solution.'
}

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$fullSolutionPath = Join-Path $RepoRoot $SolutionPath

$assemblyKey = & (Join-Path $PSScriptRoot 'Resolve-DbmAssemblyKeyFile.ps1') `
    -AssemblyKeyFile $AssemblyKeyFile `
    -Required:$EnableLegacyPackaging `
    -Purpose 'legacy Dataverse plugin build'
$resolvedAssemblyKeyFile = [string]$assemblyKey.path

$msbuildArguments = @(
    $fullSolutionPath,
    '/t:Build',
    "/p:Configuration=$Configuration",
    "/p:DbmVersionPrefix=$($version.versionPrefix)",
    "/p:DbmBuildNumber=$($version.buildNumber)",
    "/p:DbmVersionSuffix=$($version.prereleaseLabel)",
    "/p:DbmAssemblyVersion=$($version.assemblyVersion)",
    "/p:DbmFileVersion=$($version.fileVersion)",
    "/p:DbmInformationalVersion=$($version.informationalVersion)",
    "/p:DbmEnableLegacyPackaging=$($EnableLegacyPackaging.ToString().ToLowerInvariant())"
)

if ($resolvedAssemblyKeyFile) {
    $msbuildArguments += "/p:DbmAssemblyKeyFile=$resolvedAssemblyKeyFile"
}

if ($EnableLegacyPackaging) {
    Write-Host "Using DBM assembly signing key from $($assemblyKey.source): $resolvedAssemblyKeyFile"
}

& $msbuild.Source @msbuildArguments

if ($LASTEXITCODE -ne 0) {
    throw "MSBuild failed for $fullSolutionPath"
}

if ($EnableLegacyPackaging) {
    $pluginAssemblyPath = Join-Path $RepoRoot 'DbmSolution\Plugins\bin\Release\Yagasoft.Dbm.Plugins.dll'
    if (-not (Test-Path $pluginAssemblyPath)) {
        throw "Legacy packaging completed without producing the expected plugin assembly: $pluginAssemblyPath"
    }

    $pluginAssemblyName = [System.Reflection.AssemblyName]::GetAssemblyName($pluginAssemblyPath)
    $publicKeyToken = [System.BitConverter]::ToString($pluginAssemblyName.GetPublicKeyToken()).Replace('-', '').ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($publicKeyToken)) {
        throw "Legacy packaging was requested, but '$pluginAssemblyPath' is still unsigned."
    }

    Write-Host "Signed Dataverse plugin assembly: $pluginAssemblyPath"
    Write-Host "Plugin public key token: $publicKeyToken"
}
