[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('Dev')]
    [string]$TargetEnvironment = 'Dev',
    [string]$EvidenceRoot,
    [string]$BaseUrl = 'http://127.0.0.1:4173'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'PortalRuntimeDeployment.Common.ps1')
. (Join-Path $PSScriptRoot 'DbmLiveE2ESession.Common.ps1')

function Assert-DbmCondition {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Expand-DbmLiveSessionStateIfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    $sessionPaths = Get-DbmLiveSessionPaths -TargetEnvironment $TargetEnvironment
    $metadata = Read-DbmLiveSessionMetadata -MetadataPath $sessionPaths.MetadataPath
    if ($null -eq $metadata -or -not (Test-Path $sessionPaths.ProtectedStatePath)) {
        return $null
    }

    $sessionStatePath = Join-Path $WorkingDirectory 'model-driven-session-state.json'
    Unprotect-DbmLiveSessionStateFile -ProtectedPath $sessionPaths.ProtectedStatePath -DestinationPath $sessionStatePath
    return $sessionStatePath
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$resolvedEvidenceRoot = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    Join-Path $resolvedRepoRoot ("artifacts\r3-portal-runtime-local-smoke\{0}" -f $TargetEnvironment.ToLowerInvariant())
}
else {
    Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $EvidenceRoot
}
New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null

$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$accessToken = Get-DbmDataverseAccessToken -DataverseUrl $dataverseUrl
$planRecord = Get-DbmPortalRuntimePlan -RepoRoot $resolvedRepoRoot
$bootstrap = $planRecord.Value.bootstrap
$runtimeModel = $planRecord.Value.processExperienceRuntime
$health = Wait-DbmPortalRuntimeLocalProofHealth -BaseUrl $BaseUrl

Assert-DbmCondition -Condition ([string]$health.status -eq 'ready') -Message "Local proof host at '$BaseUrl' did not report a ready status."
Assert-DbmCondition -Condition ([string]$health.dataverseUrl -eq $dataverseUrl) -Message "Local proof host dataverseUrl '$([string]$health.dataverseUrl)' did not match tracked config '$dataverseUrl'."

$entryUrl = '{0}{1}' -f $BaseUrl.TrimEnd('/'), [string]$bootstrap.routes.entryPath
$requestShellUrl = '{0}{1}' -f $BaseUrl.TrimEnd('/'), [string]$bootstrap.routes.statusPath
$entryResponse = Invoke-WebRequest -Uri $entryUrl -Method GET -UseBasicParsing -ErrorAction Stop
Assert-DbmCondition -Condition ($entryResponse.Content -match 'dbm-local-proof-root') -Message "Local SPA entry route '$entryUrl' did not render the expected root shell."

$hiddenStage = @($runtimeModel.stages | Where-Object { [string]$_.portalVisibility -eq 'hidden' })[0]
$hiddenLabels = @()
if ($null -ne $hiddenStage) {
    $hiddenLabels += [string]$hiddenStage.displayName
    foreach ($hiddenStep in @($runtimeModel.steps | Where-Object { [string]$_.stageId -eq [string]$hiddenStage.id })) {
        $hiddenLabels += [string]$hiddenStep.displayName
    }
}

$expectedPortalStatus = [string](@($runtimeModel.statuses | Where-Object { [string]$_.id -eq 'under-review' })[0].displayName)
if ([string]::IsNullOrWhiteSpace($expectedPortalStatus)) {
    $expectedPortalStatus = 'Under Review'
}

$smokeWorkingDirectory = Join-Path $resolvedEvidenceRoot 'browser-smoke'
New-Item -ItemType Directory -Path $smokeWorkingDirectory -Force | Out-Null
$sessionStatePath = Expand-DbmLiveSessionStateIfPresent -TargetEnvironment $TargetEnvironment -WorkingDirectory $smokeWorkingDirectory

$requestTitle = 'Local SPA Smoke ' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$browserConfigPath = Join-Path $smokeWorkingDirectory 'portal-runtime-browser-smoke.json'
$browserOutputPath = Join-Path $smokeWorkingDirectory 'portal-runtime-browser-smoke.result.json'

[ordered]@{
    entryUrl = $entryUrl
    requestShellUrl = $requestShellUrl
    dataverseUrl = $dataverseUrl
    entityLogicalName = [string]$bootstrap.requestEntityLogicalName
    requestTitle = $requestTitle
    requestAmount = '1250'
    assignedApprover = 'manager@example.com'
    expectedPortalStatus = $expectedPortalStatus
    hiddenLabels = @($hiddenLabels)
    persistedSessionStatePath = $sessionStatePath
} | ConvertTo-Json -Depth 6 | Set-Content -Path $browserConfigPath -Encoding UTF8

if (-not (Test-Path (Join-Path $resolvedRepoRoot 'dbm-live-e2e\node_modules'))) {
    Push-Location (Join-Path $resolvedRepoRoot 'dbm-live-e2e')
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed for dbm-live-e2e with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $env:LOCALAPPDATA 'ms-playwright'))) {
    Push-Location $resolvedRepoRoot
    try {
        npm exec --prefix dbm-live-e2e -- playwright install chromium
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright browser installation failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

Push-Location $resolvedRepoRoot
try {
    npm exec --prefix dbm-live-e2e -- tsx src/portal-runtime-smoke.ts --config $browserConfigPath --output $browserOutputPath
    if ($LASTEXITCODE -ne 0) {
        throw "Portal runtime browser smoke failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$browserResult = Get-Content -Path $browserOutputPath -Raw | ConvertFrom-Json
Assert-DbmCondition -Condition (-not [string]::IsNullOrWhiteSpace([string]$browserResult.requestId)) -Message 'Portal runtime browser smoke did not return a requestId.'

$requestIdField = '{0}id' -f [string]$bootstrap.requestEntityLogicalName
$requestRecord = Invoke-DbmDataverseRequest `
    -Method GET `
    -Uri ("{0}/{1}({2})?`$select={3}" -f `
        (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), `
        [string]$bootstrap.requestEntitySetName, `
        ([guid][string]$browserResult.requestId).Guid, `
        ([string[]]@(
            $requestIdField,
            'dbm_title',
            [string]$bootstrap.runtimeStateFieldLogicalNames.stageId,
            [string]$bootstrap.runtimeStateFieldLogicalNames.stepId,
            [string]$bootstrap.runtimeStateFieldLogicalNames.formStateId,
            [string]$bootstrap.runtimeStateFieldLogicalNames.internalStatusId,
            [string]$bootstrap.runtimeStateFieldLogicalNames.portalStatusId
        ) -join ',')) `
    -AccessToken $accessToken

Assert-DbmCondition -Condition ([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stageId) -eq 'internal-screening-stage') -Message "Local SPA smoke expected stageId = internal-screening-stage but found '$([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stageId))'."
Assert-DbmCondition -Condition ([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stepId) -eq 'screen-request') -Message "Local SPA smoke expected stepId = screen-request but found '$([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stepId))'."
Assert-DbmCondition -Condition ([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.portalStatusId) -eq 'under-review') -Message "Local SPA smoke expected portalStatusId = under-review but found '$([string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.portalStatusId))'."

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $dataverseUrl
    baseUrl = $BaseUrl
    entryUrl = $entryUrl
    requestShellUrl = $requestShellUrl
    requestId = ([guid][string]$browserResult.requestId).Guid
    requestTitle = [string]$browserResult.requestTitle
    requestRuntimeState = [ordered]@{
        stageId = [string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stageId)
        stepId = [string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.stepId)
        formStateId = [string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.formStateId)
        internalStatusId = [string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.internalStatusId)
        portalStatusId = [string]$requestRecord.$([string]$bootstrap.runtimeStateFieldLogicalNames.portalStatusId)
    }
    modelDriven = [ordered]@{
        sessionDetected = -not [string]::IsNullOrWhiteSpace($sessionStatePath)
        executed = [bool]$browserResult.modelDriven.executed
        passed = [bool]$browserResult.modelDriven.passed
    }
    browserSmoke = $browserResult
}

$summaryPath = Join-Path $resolvedEvidenceRoot 'portal-runtime-local-smoke.json'
$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Portal runtime local smoke summary: $summaryPath"
