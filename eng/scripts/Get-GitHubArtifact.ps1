[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactName,

    [Parameter(Mandatory = $true)]
    [string]$OutputRoot,

    [string]$Repository = $env:GITHUB_REPOSITORY,
    [string]$GitHubToken = $env:GITHUB_TOKEN
)

if ([string]::IsNullOrWhiteSpace($Repository)) {
    throw 'GITHUB_REPOSITORY is not set and no repository was provided.'
}

if ([string]::IsNullOrWhiteSpace($GitHubToken)) {
    throw 'GITHUB_TOKEN is not set and no GitHub token was provided.'
}

$headers = @{
    Authorization         = "Bearer $GitHubToken"
    Accept                = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$artifactListUri = "https://api.github.com/repos/$Repository/actions/artifacts?per_page=100"
$artifactResponse = Invoke-RestMethod -Uri $artifactListUri -Headers $headers -Method Get
$artifact = $artifactResponse.artifacts |
    Where-Object {
        $_.name -eq $ArtifactName -and -not $_.expired
    } |
    Sort-Object created_at -Descending |
    Select-Object -First 1

if (-not $artifact) {
    throw "GitHub artifact '$ArtifactName' was not found in the latest 100 repository artifacts."
}

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$archivePath = Join-Path $OutputRoot "$ArtifactName.zip"

Invoke-WebRequest -Uri $artifact.archive_download_url -Headers $headers -OutFile $archivePath

$extractRoot = Join-Path $OutputRoot $ArtifactName
if (Test-Path $extractRoot) {
    Remove-Item -Path $extractRoot -Recurse -Force
}

Expand-Archive -Path $archivePath -DestinationPath $extractRoot -Force

Write-Output $extractRoot
