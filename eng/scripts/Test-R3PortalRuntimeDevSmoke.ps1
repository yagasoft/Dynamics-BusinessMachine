[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('Dev')]
    [string]$TargetEnvironment = 'Dev',
    [string]$EvidenceRoot
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

function Expand-DbmLiveSessionState {
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
        throw "A persisted live E2E session is required for the model-driven smoke check. Run '.\\eng\\scripts\\Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment $TargetEnvironment' first."
    }

    $sessionStatePath = Join-Path $WorkingDirectory 'model-driven-session-state.json'
    Unprotect-DbmLiveSessionStateFile -ProtectedPath $sessionPaths.ProtectedStatePath -DestinationPath $sessionStatePath
    return $sessionStatePath
}

function Wait-DbmAnonymousPortalEntry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EntryUrl,

        [int]$MaxAttempts = 24,
        [int]$DelaySeconds = 5
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
        try {
            $response = Invoke-WebRequest -Uri $EntryUrl -Method GET -ErrorAction Stop
            if ($response.Content -match 'portal-runtime-context\.js' -and $response.Content -match 'portal-runtime\.js') {
                return $response
            }
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw
            }
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    throw "Timed out waiting for '$EntryUrl' to reference both portal runtime scripts."
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$resolvedEvidenceRoot = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    Join-Path $resolvedRepoRoot ("artifacts\r3-portal-runtime-smoke\{0}" -f $TargetEnvironment.ToLowerInvariant())
}
else {
    Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $EvidenceRoot
}
New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null

$assets = Get-DbmPortalRuntimeDeployableAssets -RepoRoot $resolvedRepoRoot
$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$accessToken = Get-DbmDataverseAccessToken -DataverseUrl $dataverseUrl
$siteContext = Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment -AccessToken $accessToken

foreach ($webFile in $assets.webFiles) {
    $record = Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webfiles' `
        -SelectFields @('mspp_webfileid', 'mspp_name') `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $webFile.webFilePath), $siteContext.WebsiteId) `
        -Description "deployed web file '$($webFile.webFilePath)'"
    Assert-DbmCondition -Condition (-not [string]::IsNullOrWhiteSpace([string]$record.mspp_webfileid)) -Message "Missing deployed web file '$($webFile.webFilePath)'."
}

foreach ($template in $assets.webTemplates) {
    Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webtemplates' `
        -SelectFields @('mspp_webtemplateid', 'mspp_name') `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $template.webTemplateName), $siteContext.WebsiteId) `
        -Description "deployed web template '$($template.webTemplateName)'" | Out-Null
}

foreach ($page in $assets.pages) {
    Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webpages' `
        -SelectFields @('mspp_webpageid', 'mspp_name') `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1} and _mspp_webpagelanguageid_value eq {2}" -f (ConvertTo-DbmODataStringLiteral -Value $page.webPageName), $siteContext.WebsiteId, $siteContext.WebsiteLanguageId) `
        -Description "deployed web page '$($page.webPageName)'" | Out-Null
}

foreach ($siteSetting in @($assets.siteSettings.siteSettings)) {
    Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_sitesettings' `
        -SelectFields @('mspp_sitesettingid', 'mspp_name', 'mspp_value') `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value ([string]$siteSetting.name)), $siteContext.WebsiteId) `
        -Description "deployed site setting '$([string]$siteSetting.name)'" | Out-Null
}

$webRole = Get-DbmDataverseSingleRecord `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'mspp_webroles' `
    -SelectFields @('mspp_webroleid', 'mspp_name') `
    -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value ([string]$assets.permissions.webRole)), $siteContext.WebsiteId) `
    -Description "deployed web role '$([string]$assets.permissions.webRole)'"

$scopeMap = @{
    global = 756150000
}

foreach ($tablePermission in @($assets.permissions.tablePermissions)) {
    $permission = Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_entitypermissions' `
        -SelectFields @('mspp_entitypermissionid', 'mspp_entitylogicalname', 'mspp_scope', 'mspp_create', 'mspp_read', 'mspp_write') `
        -Filter ("mspp_entitylogicalname eq {0} and mspp_scope eq {1} and _mspp_websiteid_value eq {2}" -f (ConvertTo-DbmODataStringLiteral -Value ([string]$tablePermission.tableLogicalName)), $scopeMap[([string]$tablePermission.scope).ToLowerInvariant()], $siteContext.WebsiteId) `
        -Description "deployed table permission '$([string]$tablePermission.tableLogicalName)'"

    $roleBindings = Invoke-DbmDataverseRequest `
        -Method GET `
        -Uri ("{0}/mspp_entitypermissions({1})/mspp_entitypermission_webrole?`$select=mspp_webroleid" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), ([guid][string]$permission.mspp_entitypermissionid).Guid) `
        -AccessToken $accessToken
    $boundRoleIds = @($roleBindings.value | ForEach-Object { ([guid][string]$_.mspp_webroleid).Guid })
    Assert-DbmCondition -Condition ($boundRoleIds -contains ([guid][string]$webRole.mspp_webroleid).Guid) -Message "Table permission '$([string]$tablePermission.tableLogicalName)' is not bound to the expected web role."
}

$stepDefinitions = Get-DbmPortalRuntimePluginStepDefinitions
$pluginType = Get-DbmDataverseSingleRecord `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'plugintypes' `
    -SelectFields @('plugintypeid', 'typename') `
    -Filter ("typename eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value 'Yagasoft.Dbm.Plugins.PortalRuntime.DbmRequestPortalRuntime')) `
    -Description 'portal runtime plugintype'
$sdkMessages = Invoke-DbmDataverseQuery `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'sdkmessages' `
    -SelectFields @('sdkmessageid', 'name') `
    -Filter ("name eq {0} or name eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value 'Create'), (ConvertTo-DbmODataStringLiteral -Value 'Update')) `
    -Top 10
$sdkMessageMap = @{}
foreach ($sdkMessage in $sdkMessages) {
    $sdkMessageMap[[string]$sdkMessage.name] = ([guid][string]$sdkMessage.sdkmessageid).Guid
}
$sdkMessageFilters = Invoke-DbmDataverseQuery `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'sdkmessagefilters' `
    -SelectFields @('sdkmessagefilterid', '_sdkmessageid_value', 'primaryobjecttypecode') `
    -Filter ("primaryobjecttypecode eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value 'dbm_request')) `
    -Top 50

foreach ($stepDefinition in $stepDefinitions) {
    $messageId = $sdkMessageMap[[string]$stepDefinition.messageName]
    $messageFilter = @($sdkMessageFilters | Where-Object { ([guid][string]$_.'_sdkmessageid_value').Guid -eq $messageId })
    Assert-DbmCondition -Condition ($messageFilter.Count -eq 1) -Message "Smoke could not resolve the sdkmessagefilter for '$([string]$stepDefinition.messageName)'."

    $step = Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'sdkmessageprocessingsteps' `
        -SelectFields @('sdkmessageprocessingstepid', 'name', 'stage', 'mode', 'rank', 'filteringattributes', 'supporteddeployment', '_sdkmessageid_value', '_sdkmessagefilterid_value', '_eventhandler_value') `
        -Filter ("_eventhandler_value eq {0} and _sdkmessageid_value eq {1} and _sdkmessagefilterid_value eq {2}" -f ([guid][string]$pluginType.plugintypeid).Guid, $messageId, ([guid][string]$messageFilter[0].sdkmessagefilterid).Guid) `
        -Description "plugin step '$([string]$stepDefinition.name)'"

    $drift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinition -ActualStep $step
    Assert-DbmCondition -Condition (-not $drift.requiresUpdate) -Message "Plugin step '$([string]$stepDefinition.name)' drifted from the expected contract: $($drift.differences -join ', ')."
}

$entryUrl = '{0}{1}' -f $siteContext.SiteOrigin, $assets.pages[0].routePath
$requestShellPage = @($assets.pages | Where-Object pageId -eq 'approval-request-request-shell')[0]
$requestShellUrl = '{0}{1}' -f $siteContext.SiteOrigin, $requestShellPage.routePath
$entryResponse = Wait-DbmAnonymousPortalEntry -EntryUrl $entryUrl
Assert-DbmCondition -Condition ($entryResponse.Content -match 'portal-runtime-context\.js') -Message "Anonymous entry page did not include portal-runtime-context.js."
Assert-DbmCondition -Condition ($entryResponse.Content -match 'portal-runtime\.js') -Message "Anonymous entry page did not include portal-runtime.js."

$smokeWorkingDirectory = Join-Path $resolvedEvidenceRoot 'browser-smoke'
New-Item -ItemType Directory -Path $smokeWorkingDirectory -Force | Out-Null
$sessionStatePath = Expand-DbmLiveSessionState -TargetEnvironment $TargetEnvironment -WorkingDirectory $smokeWorkingDirectory

$requestTitle = 'Portal Smoke ' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$browserConfigPath = Join-Path $smokeWorkingDirectory 'portal-runtime-browser-smoke.json'
$browserOutputPath = Join-Path $smokeWorkingDirectory 'portal-runtime-browser-smoke.result.json'

[ordered]@{
    entryUrl = $entryUrl
    requestShellUrl = $requestShellUrl
    dataverseUrl = $dataverseUrl
    entityLogicalName = 'dbm_request'
    requestTitle = $requestTitle
    requestAmount = '1250'
    assignedApprover = 'manager@example.com'
    expectedPortalStatus = 'Under Review'
    hiddenLabels = @('Internal Screening', 'Screen Request')
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
Assert-DbmCondition -Condition ($browserResult.modelDriven.executed -and $browserResult.modelDriven.passed) -Message 'Portal runtime browser smoke did not complete the model-driven host verification.'

$requestRecord = Invoke-DbmDataverseRequest `
    -Method GET `
    -Uri ("{0}/dbm_requests({1})?`$select=dbm_requestid,dbm_title,dbm_currentstageid,dbm_currentstepid,dbm_currentformstateid,dbm_internalstatusid,dbm_portalstatusid" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), ([guid][string]$browserResult.requestId).Guid) `
    -AccessToken $accessToken

Assert-DbmCondition -Condition ([string]$requestRecord.dbm_currentstageid -eq 'internal-screening-stage') -Message "Portal smoke expected dbm_currentstageid = internal-screening-stage but found '$([string]$requestRecord.dbm_currentstageid)'."
Assert-DbmCondition -Condition ([string]$requestRecord.dbm_currentstepid -eq 'screen-request') -Message "Portal smoke expected dbm_currentstepid = screen-request but found '$([string]$requestRecord.dbm_currentstepid)'."
Assert-DbmCondition -Condition ([string]$requestRecord.dbm_internalstatusid -eq 'internal-screening') -Message "Portal smoke expected dbm_internalstatusid = internal-screening but found '$([string]$requestRecord.dbm_internalstatusid)'."
Assert-DbmCondition -Condition ([string]$requestRecord.dbm_portalstatusid -eq 'under-review') -Message "Portal smoke expected dbm_portalstatusid = under-review but found '$([string]$requestRecord.dbm_portalstatusid)'."

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $dataverseUrl
    entryUrl = $entryUrl
    requestShellUrl = $requestShellUrl
    requestId = ([guid][string]$browserResult.requestId).Guid
    requestTitle = [string]$browserResult.requestTitle
    requestRuntimeState = [ordered]@{
        stageId = [string]$requestRecord.dbm_currentstageid
        stepId = [string]$requestRecord.dbm_currentstepid
        formStateId = [string]$requestRecord.dbm_currentformstateid
        internalStatusId = [string]$requestRecord.dbm_internalstatusid
        portalStatusId = [string]$requestRecord.dbm_portalstatusid
    }
    browserSmoke = $browserResult
}

$summaryPath = Join-Path $resolvedEvidenceRoot 'portal-runtime-dev-smoke.json'
$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Portal runtime Dev smoke summary: $summaryPath"
