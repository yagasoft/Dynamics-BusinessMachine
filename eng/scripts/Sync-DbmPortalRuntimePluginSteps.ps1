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

function Add-DbmLookupBinding {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload,

        [Parameter(Mandatory = $true)]
        [string]$NavigationPropertyName,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [Parameter(Mandatory = $true)]
        [string]$Id
    )

    $Payload["$NavigationPropertyName@odata.bind"] = "/$EntitySetName($(([guid]$Id).Guid))"
}

function Get-DbmStepPrimaryId {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Record
    )

    return ([guid][string]$Record.sdkmessageprocessingstepid).Guid
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$accessToken = Get-DbmDataverseAccessToken -DataverseUrl $dataverseUrl

$resolvedEvidenceRoot = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    Join-Path $resolvedRepoRoot ("artifacts\portal-runtime-plugin-steps\{0}" -f $TargetEnvironment.ToLowerInvariant())
}
else {
    Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $EvidenceRoot
}

New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null

$pluginAssembly = Get-DbmDataverseSingleRecord `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'pluginassemblies' `
    -SelectFields @('pluginassemblyid', 'name') `
    -Filter ("name eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value 'Yagasoft.Dbm.Plugins')) `
    -Description "plugin assembly 'Yagasoft.Dbm.Plugins'"

$pluginType = Get-DbmDataverseSingleRecord `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'plugintypes' `
    -SelectFields @('plugintypeid', 'name', 'typename', '_pluginassemblyid_value') `
    -Filter ("typename eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value 'Yagasoft.Dbm.Plugins.PortalRuntime.DbmRequestPortalRuntime')) `
    -Description "plugintype 'Yagasoft.Dbm.Plugins.PortalRuntime.DbmRequestPortalRuntime'" `
    -AllowMissing

if ($null -eq $pluginType) {
    throw "The plugin type 'Yagasoft.Dbm.Plugins.PortalRuntime.DbmRequestPortalRuntime' is not registered after deployment."
}

if (([guid][string]$pluginType.'_pluginassemblyid_value').Guid -ne ([guid][string]$pluginAssembly.pluginassemblyid).Guid) {
    throw "The portal runtime plugintype is not associated with the expected plugin assembly 'Yagasoft.Dbm.Plugins'."
}

$sdkMessages = Invoke-DbmDataverseQuery `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'sdkmessages' `
    -SelectFields @('sdkmessageid', 'name') `
    -Filter ("name eq {0} or name eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value 'Create'), (ConvertTo-DbmODataStringLiteral -Value 'Update')) `
    -Top 10
$sdkMessageMap = @{}
foreach ($message in $sdkMessages) {
    $sdkMessageMap[[string]$message.name] = ([guid][string]$message.sdkmessageid).Guid
}

$filters = Invoke-DbmDataverseQuery `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'sdkmessagefilters' `
    -SelectFields @('sdkmessagefilterid', 'primaryobjecttypecode', '_sdkmessageid_value') `
    -Filter ("primaryobjecttypecode eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value 'dbm_request')) `
    -Top 50

$stepDefinitions = Get-DbmPortalRuntimePluginStepDefinitions
$stepResults = New-Object System.Collections.ArrayList

foreach ($stepDefinition in $stepDefinitions) {
    $sdkMessageId = $sdkMessageMap[[string]$stepDefinition.messageName]
    if ([string]::IsNullOrWhiteSpace([string]$sdkMessageId)) {
        throw "Could not resolve sdkmessage '$([string]$stepDefinition.messageName)'."
    }

    $sdkMessageFilter = @(
        $filters | Where-Object {
            ([guid][string]$_.'_sdkmessageid_value').Guid -eq $sdkMessageId
        }
    )

    if ($sdkMessageFilter.Count -ne 1) {
        throw "Could not resolve a single sdkmessagefilter for '$([string]$stepDefinition.messageName)' on '$([string]$stepDefinition.primaryEntityLogicalName)'."
    }

    $existingCandidates = Invoke-DbmDataverseQuery `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'sdkmessageprocessingsteps' `
        -SelectFields @('sdkmessageprocessingstepid', 'name', 'stage', 'mode', 'rank', 'filteringattributes', 'supporteddeployment', '_sdkmessageid_value', '_sdkmessagefilterid_value', '_eventhandler_value') `
        -Filter ("_eventhandler_value eq {0} and _sdkmessageid_value eq {1} and _sdkmessagefilterid_value eq {2}" -f ([guid][string]$pluginType.plugintypeid).Guid, $sdkMessageId, ([guid][string]$sdkMessageFilter[0].sdkmessagefilterid).Guid) `
        -Top 5

    if ($existingCandidates.Count -gt 1) {
        throw "Multiple existing sdkmessageprocessingsteps already target '$([string]$stepDefinition.messageName)' for the portal runtime plugintype. Resolve the ambiguity before rerunning the sync."
    }

    $existing = if ($existingCandidates.Count -eq 1) { $existingCandidates[0] } else { $null }
    $drift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinition -ActualStep $existing

    if ($null -eq $existing) {
        $payload = @{
            name = [string]$stepDefinition.name
            stage = [int]$stepDefinition.stage
            mode = [int]$stepDefinition.mode
            rank = [int]$stepDefinition.rank
            supporteddeployment = [int]$stepDefinition.supportedDeployment
            filteringattributes = [string]$stepDefinition.filteringAttributes
        }
        Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'sdkmessageid' -EntitySetName 'sdkmessages' -Id ([string]$sdkMessageId)
        Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'sdkmessagefilterid' -EntitySetName 'sdkmessagefilters' -Id ([string]$sdkMessageFilter[0].sdkmessagefilterid)
        Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'eventhandler_plugintype' -EntitySetName 'plugintypes' -Id ([string]$pluginType.plugintypeid)

        $response = Invoke-DbmDataverseRequest `
            -Method POST `
            -Uri ("{0}/sdkmessageprocessingsteps" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl)) `
            -AccessToken $accessToken `
            -Body $payload `
            -ReturnRawResponse

        $stepResults.Add([pscustomobject]@{
            action = 'created'
            name = $stepDefinition.name
            id = Get-DbmCreatedRecordIdFromResponse -Response $response -PrimaryIdAttribute 'sdkmessageprocessingstepid'
            differences = @('step-missing')
        }) | Out-Null
        continue
    }

    if ($drift.requiresUpdate) {
        $payload = @{
            name = [string]$stepDefinition.name
            stage = [int]$stepDefinition.stage
            mode = [int]$stepDefinition.mode
            rank = [int]$stepDefinition.rank
            supporteddeployment = [int]$stepDefinition.supportedDeployment
            filteringattributes = [string]$stepDefinition.filteringAttributes
        }
        $stepId = Get-DbmStepPrimaryId -Record $existing
        Invoke-DbmDataverseRequest `
            -Method PATCH `
            -Uri ("{0}/sdkmessageprocessingsteps({1})" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), $stepId) `
            -AccessToken $accessToken `
            -Body $payload | Out-Null

        $stepResults.Add([pscustomobject]@{
            action = 'updated'
            name = $stepDefinition.name
            id = $stepId
            differences = @($drift.differences)
        }) | Out-Null
        continue
    }

    $stepResults.Add([pscustomobject]@{
        action = 'unchanged'
        name = $stepDefinition.name
        id = Get-DbmStepPrimaryId -Record $existing
        differences = @()
    }) | Out-Null
}

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $dataverseUrl
    pluginAssemblyId = ([guid][string]$pluginAssembly.pluginassemblyid).Guid
    pluginTypeId = ([guid][string]$pluginType.plugintypeid).Guid
    results = @($stepResults)
}

$summaryPath = Join-Path $resolvedEvidenceRoot 'portal-runtime-plugin-steps.json'
$summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Portal runtime plugin-step summary: $summaryPath"
