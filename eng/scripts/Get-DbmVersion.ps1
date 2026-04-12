[CmdletBinding()]
param(
    [switch]$AsJson,
    [switch]$AsGitHubOutput,
    [string]$GitHubOutputPath = $env:GITHUB_OUTPUT,
    [string]$VersionFile = (Join-Path $PSScriptRoot '..\version.json'),
    [string]$SourceRevisionId = $env:GITHUB_SHA
)

$versionConfig = Get-Content -Path $VersionFile -Raw | ConvertFrom-Json

$versionPrefix = [string]$versionConfig.version
$buildNumber = [int]$versionConfig.build
$prereleaseLabel = [string]$versionConfig.prereleaseLabel
$solutionName = [string]$versionConfig.solutionName

$semVer = if ([string]::IsNullOrWhiteSpace($prereleaseLabel)) {
    $versionPrefix
} else {
    "$versionPrefix-$prereleaseLabel"
}

$tag = "v$semVer"
$solutionVersion = "$versionPrefix.$buildNumber"
$sourceRevision = if ([string]::IsNullOrWhiteSpace($SourceRevisionId)) {
    'local'
} else {
    $SourceRevisionId
}
$informationalVersion = "$semVer+$sourceRevision"

$result = [ordered]@{
    versionPrefix = $versionPrefix
    buildNumber = $buildNumber
    prereleaseLabel = $prereleaseLabel
    semVer = $semVer
    tag = $tag
    solutionVersion = $solutionVersion
    assemblyVersion = $solutionVersion
    fileVersion = $solutionVersion
    informationalVersion = $informationalVersion
    solutionName = $solutionName
}

if ($AsGitHubOutput) {
    if ([string]::IsNullOrWhiteSpace($GitHubOutputPath)) {
        throw 'GITHUB_OUTPUT is not set and no GitHub output path was provided.'
    }

    foreach ($item in $result.GetEnumerator()) {
        Add-Content -Path $GitHubOutputPath -Value "$($item.Key)=$($item.Value)"
    }

    return
}

if ($AsJson) {
    $result | ConvertTo-Json -Depth 5
    return
}

$result.GetEnumerator() | Sort-Object Name | ForEach-Object {
    "$($_.Key)=$($_.Value)"
}
