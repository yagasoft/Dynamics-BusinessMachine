[CmdletBinding()]
param(
    [string]$OutputPath,
    [string]$CommitSha = $env:GITHUB_SHA,
    [string]$WorkflowRunId = $env:GITHUB_RUN_ID,
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$evidence = [ordered]@{
    version = $version.semVer
    tag = $version.tag
    solutionVersion = $version.solutionVersion
    commitSha = $CommitSha
    workflowRunId = $WorkflowRunId
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
}

$evidence | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8
