[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment = 'Dev',

    [string]$DataverseUrl,
    [string]$EvidenceRoot,
    [switch]$AsJson
)

$ErrorActionPreference = 'Stop'

function Get-DbmDataverseAccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetDataverseUrl
    )

    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available on PATH to acquire a Dataverse Web API access token.'
    }

    $resource = $TargetDataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'. Run 'az login' and retry."
    }

    return $token.Trim()
}

function Invoke-DbmDataverseGet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $headers = @{
        Authorization = "Bearer $AccessToken"
        Accept = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    }

    return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
}

function Decode-DbmWebResourceContent {
    param(
        [AllowNull()]
        [string]$Content
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return ''
    }

    try {
        return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Content))
    }
    catch {
        return ''
    }
}

if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot ("artifacts\designer-validation\{0}" -f $TargetEnvironment.ToLowerInvariant())
}

$hostContext =
    & (Join-Path $PSScriptRoot 'Get-DbmDesignerHost.ps1') `
        -RepoRoot $RepoRoot `
        -TargetEnvironment $TargetEnvironment `
        -DataverseUrl $DataverseUrl `
        -AsJson |
    ConvertFrom-Json

$normalizedDataverseUrl = [string]$hostContext.dataverseUrl
$accessToken = Get-DbmDataverseAccessToken -TargetDataverseUrl $normalizedDataverseUrl
$requiredResourceNames = @(
    'ys_/dbm/apps/editor/index.html',
    'ys_/dbm/apps/editor/bundle.js',
    'ys_/dbm/libs/common.js',
    'ys_/dbm/libs/core.js'
)

$resourceClauses = $requiredResourceNames | ForEach-Object { "name eq '$($_.Replace("'", "''"))'" }
$resourceFilter = [System.Uri]::EscapeDataString(($resourceClauses -join ' or '))
$resourceUri = "$normalizedDataverseUrl/api/data/v9.2/webresourceset?`$select=webresourceid,name,displayname&`$filter=$resourceFilter"
$resourceResponse = Invoke-DbmDataverseGet -Uri $resourceUri -AccessToken $accessToken
$resourceMap = @{}
foreach ($resource in @($resourceResponse.value)) {
    $resourceMap[[string]$resource.name] = $resource
}

$configResourceUri =
    "$normalizedDataverseUrl/api/data/v9.2/webresourceset?" +
    "`$select=webresourceid,name,content&" +
    "`$filter=$([System.Uri]::EscapeDataString(""startswith(name,'ys_/dbm/forms/config/')"" ))"
$configResourceResponse = Invoke-DbmDataverseGet -Uri $configResourceUri -AccessToken $accessToken
$processHostConfigs = @(
    foreach ($resource in @($configResourceResponse.value | Where-Object { [string]$_.name -like 'ys_/dbm/forms/config/*.js' })) {
        $decodedContent = Decode-DbmWebResourceContent -Content ([string]$resource.content)
        if ([string]::IsNullOrWhiteSpace($decodedContent) -or $decodedContent -notmatch '"processHost"\s*:') {
            continue
        }

        [ordered]@{
            name = [string]$resource.name
            designerEntryUsesData = [bool]($decodedContent -match '"designerEntryUrl"\s*:\s*"[^"]*data=')
            designerEntryUsesLegacyPackageName = [bool]($decodedContent -match '"designerEntryUrl"\s*:\s*"[^"]*packageName=')
        }
    }
)

$modelDocumentsUri =
    "$normalizedDataverseUrl/api/data/v9.2/webresourceset?" +
    "`$select=webresourceid,name&" +
    "`$filter=$([System.Uri]::EscapeDataString(""startswith(name,'ys_/dbm/data/models/')"" ))"
$modelDocumentsResponse = Invoke-DbmDataverseGet -Uri $modelDocumentsUri -AccessToken $accessToken

$requiredResources = @(
    foreach ($name in $requiredResourceNames) {
        $resource = $resourceMap[$name]
        [ordered]@{
            name = $name
            displayName = if ($resource) { [string]$resource.displayname } else { $null }
            webResourceId = if ($resource) { [string]$resource.webresourceid } else { $null }
            present = [bool]$resource
        }
    }
)

$missingResources = @($requiredResources | Where-Object { -not $_.present })
if ($missingResources.Count -gt 0) {
    throw "Designer host validation found missing required web resources in '$TargetEnvironment': $($missingResources.name -join ', ')"
}

if ($processHostConfigs.Count -lt 1) {
    throw "Designer host validation could not find any generated process-host config web resources to validate the designer-entry contract in '$TargetEnvironment'."
}

$invalidProcessHostConfigs = @(
    $processHostConfigs |
        Where-Object { -not $_.designerEntryUsesData -or $_.designerEntryUsesLegacyPackageName }
)

if ($invalidProcessHostConfigs.Count -gt 0) {
    throw "Designer host validation found invalid designerEntryUrl contracts in '$TargetEnvironment': $($invalidProcessHostConfigs.name -join ', ')"
}

$result = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $normalizedDataverseUrl
    appModule = $hostContext.appModule
    navigation = $hostContext.navigation
    designerWebResource = $hostContext.designerWebResource
    designerUrl = [string]$hostContext.designerUrl
    requiredResources = $requiredResources
    processHostConfigs = $processHostConfigs
    modelDocumentCount = @($modelDocumentsResponse.value).Count
    status = 'pass'
    automatedChecks = @(
        [ordered]@{
            name = 'designer-app-module-exists'
            passed = $true
            details = "Found app module '$($hostContext.appModule.uniqueName)' with id '$($hostContext.appModule.appModuleId)'."
        },
        [ordered]@{
            name = 'designer-webresource-exists'
            passed = $true
            details = "Found designer web resource '$($hostContext.designerWebResource.name)'."
        },
        [ordered]@{
            name = 'designer-runtime-assets-exist'
            passed = $true
            details = 'Found the tracked DBM editor HTML, bundle, common, and core web resources.'
        },
        [ordered]@{
            name = 'designer-entry-uses-supported-data-contract'
            passed = $true
            details = "Validated $($processHostConfigs.Count) generated process-host config web resources and confirmed they use 'designerEntryUrl' with the supported 'data=' payload contract."
        }
    )
    manualFollowUp = @(
        'Open the hosted designer URL and confirm the model browser renders.',
        'Create one new model document, save it, refresh, and reopen it.',
        'Edit one stage, one step, one form state, and one metadata field, then save successfully.'
    )
}

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$resultPath = Join-Path $EvidenceRoot 'designer-host-results.json'
$summaryPath = Join-Path $EvidenceRoot 'designer-host-summary.md'
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $resultPath -Encoding UTF8

$summaryLines = @(
    '# Designer Host Validation Summary',
    '',
    "- Environment: $TargetEnvironment",
    "- Dataverse URL: $normalizedDataverseUrl",
    "- App module: $($hostContext.appModule.uniqueName) ($($hostContext.appModule.appModuleId))",
    "- Designer web resource: $($hostContext.designerWebResource.name)",
    "- Designer URL: $($hostContext.designerUrl)",
    "- Existing model documents: $(@($modelDocumentsResponse.value).Count)",
    '',
    '## Automated checks'
)

foreach ($check in $result.automatedChecks) {
    $summaryLines += "- PASS: $($check.details)"
}

$summaryLines += ''
$summaryLines += '## Manual follow-up'
foreach ($step in $result.manualFollowUp) {
    $summaryLines += "- $step"
}

$summaryLines | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Designer host validation evidence: $resultPath"
Write-Host "Designer host validation summary: $summaryPath"
Write-Host "Designer URL: $($hostContext.designerUrl)"

if ($AsJson) {
    $result | ConvertTo-Json -Depth 8
    return
}
