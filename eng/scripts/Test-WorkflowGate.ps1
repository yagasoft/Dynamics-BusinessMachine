[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$WorkflowFileName,

    [string]$HeadSha = $env:GITHUB_SHA,
    [string]$Repository = $env:GITHUB_REPOSITORY,
    [int]$MaxRunsToInspect = 20
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
    throw 'GITHUB_TOKEN must be available to validate workflow gates.'
}

if ([string]::IsNullOrWhiteSpace($Repository)) {
    throw 'Repository must be supplied explicitly or through GITHUB_REPOSITORY.'
}

if ([string]::IsNullOrWhiteSpace($HeadSha)) {
    throw 'Head SHA must be supplied explicitly or through GITHUB_SHA.'
}

$apiUrl = if ([string]::IsNullOrWhiteSpace($env:GITHUB_API_URL)) {
    'https://api.github.com'
}
else {
    $env:GITHUB_API_URL.TrimEnd('/')
}

$escapedWorkflowFileName = [System.Uri]::EscapeDataString($WorkflowFileName)
$requestUri = "$apiUrl/repos/$Repository/actions/workflows/$escapedWorkflowFileName/runs?per_page=$MaxRunsToInspect&head_sha=$HeadSha"
$headers = @{
    Authorization = "Bearer $($env:GITHUB_TOKEN)"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$response = Invoke-RestMethod -Method Get -Uri $requestUri -Headers $headers
$runs = @($response.workflow_runs)

if ($runs.Count -eq 0) {
    throw "No workflow runs were found for '$WorkflowFileName' on commit '$HeadSha' in '$Repository'."
}

$latestRun = $runs |
    Sort-Object { [datetimeoffset]$_.created_at } -Descending |
    Select-Object -First 1

$successfulRun = $runs |
    Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'success' } |
    Sort-Object { [datetimeoffset]$_.created_at } -Descending |
    Select-Object -First 1

if (-not $successfulRun) {
    if ($latestRun.status -ne 'completed') {
        throw "Workflow gate '$WorkflowFileName' has not completed successfully for commit '$HeadSha' yet. Latest run status: '$($latestRun.status)'. Run URL: $($latestRun.html_url)"
    }

    throw "Workflow gate '$WorkflowFileName' did not complete successfully for commit '$HeadSha'. Latest conclusion: '$($latestRun.conclusion)'. Run URL: $($latestRun.html_url)"
}

Write-Host "Workflow gate '$WorkflowFileName' satisfied by run $($successfulRun.id) on commit '$HeadSha'."
Write-Host "Run URL: $($successfulRun.html_url)"
