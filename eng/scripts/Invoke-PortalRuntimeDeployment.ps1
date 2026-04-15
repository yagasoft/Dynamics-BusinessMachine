[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('Dev')]
    [string]$TargetEnvironment = 'Dev',
    [string]$ManifestPath = 'power-platform/solutions/DynamicsBusinessMachinePortalRuntime/source/manifest.json',
    [string]$ExportOutputRoot,
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

function Invoke-DbmUpsertRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [Parameter(Mandatory = $true)]
        [string]$PrimaryIdAttribute,

        [Parameter(Mandatory = $true)]
        [string]$Filter,

        [Parameter(Mandatory = $true)]
        [hashtable]$Payload,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $existing = Get-DbmDataverseSingleRecord `
        -DataverseUrl $DataverseUrl `
        -AccessToken $AccessToken `
        -EntitySetName $EntitySetName `
        -SelectFields @($PrimaryIdAttribute) `
        -Filter $Filter `
        -Description $Description `
        -AllowMissing

    if ($null -ne $existing) {
        $recordId = ([guid][string]$existing.$PrimaryIdAttribute).Guid
        $uri = "{0}/{1}({2})" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl), $EntitySetName, $recordId
        Invoke-DbmDataverseRequest -Method PATCH -Uri $uri -AccessToken $AccessToken -Body $Payload | Out-Null
        return [pscustomobject]@{
            action = 'updated'
            entitySetName = $EntitySetName
            id = $recordId
            description = $Description
        }
    }

    $response = Invoke-DbmDataverseRequest `
        -Method POST `
        -Uri ("{0}/{1}" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl), $EntitySetName) `
        -AccessToken $AccessToken `
        -Body $Payload `
        -ReturnRawResponse

    return [pscustomobject]@{
        action = 'created'
        entitySetName = $EntitySetName
        id = Get-DbmCreatedRecordIdFromResponse -Response $response -PrimaryIdAttribute $PrimaryIdAttribute
        description = $Description
    }
}

function Resolve-DbmPortalWebFileComponent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$PowerPageSiteId,

        [Parameter(Mandatory = $true)]
        [string]$WebFilePath
    )

    $candidates = @($WebFilePath)
    $leafName = Split-Path -Path $WebFilePath -Leaf
    if ($leafName -ne $WebFilePath) {
        $candidates += $leafName
    }

    foreach ($candidate in $candidates) {
        for ($attempt = 1; $attempt -le 8; $attempt += 1) {
            $record = Get-DbmDataverseSingleRecord `
                -DataverseUrl $DataverseUrl `
                -AccessToken $AccessToken `
                -EntitySetName 'powerpagecomponents' `
                -SelectFields @('powerpagecomponentid', 'name') `
                -Filter ("powerpagecomponenttype eq 3 and _powerpagesiteid_value eq {0} and name eq {1}" -f ([guid]$PowerPageSiteId).Guid, (ConvertTo-DbmODataStringLiteral -Value $candidate)) `
                -Description "Power Pages component for web file '$candidate'" `
                -AllowMissing

            if ($null -ne $record) {
                return $record
            }

            Start-Sleep -Seconds 2
        }
    }

    throw "Power Pages did not materialize a powerpagecomponent for web file '$WebFilePath'."
}

function Set-DbmPortalWebFileContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$ComponentId,

        [Parameter(Mandatory = $true)]
        [string]$WebFilePath,

        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $uri = "{0}/powerpagecomponents({1})/filecontent?x-ms-file-name={2}" -f `
        (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl), `
        ([guid]$ComponentId).Guid, `
        ([System.Uri]::EscapeDataString((Split-Path -Path $WebFilePath -Leaf)))

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
    Invoke-DbmDataverseRequest `
        -Method PATCH `
        -Uri $uri `
        -AccessToken $AccessToken `
        -BinaryBody $bytes `
        -ContentType 'application/octet-stream' `
        -AdditionalHeaders @{ 'If-Match' = '*' } | Out-Null
}

function Publish-DbmDataverseCustomizations {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    Invoke-DbmDataverseRequest `
        -Method POST `
        -Uri ("{0}/PublishAllXml" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)) `
        -AccessToken $AccessToken `
        -Body @{} | Out-Null
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$assets = Get-DbmPortalRuntimeDeployableAssets -RepoRoot $resolvedRepoRoot -ManifestPath $ManifestPath
$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$accessToken = Get-DbmDataverseAccessToken -DataverseUrl $dataverseUrl
$siteContext = Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment -AccessToken $accessToken

$resolvedEvidenceRoot = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    Join-Path $resolvedRepoRoot ("artifacts\portal-runtime-deploy\{0}" -f $TargetEnvironment.ToLowerInvariant())
}
else {
    Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $EvidenceRoot
}

New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null

$resolvedExportOutputRoot = if ([string]::IsNullOrWhiteSpace($ExportOutputRoot)) {
    Join-Path $resolvedEvidenceRoot 'portal-package'
}
else {
    Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $ExportOutputRoot
}

& (Join-Path $PSScriptRoot 'Export-PortalRuntimePackage.ps1') `
    -RepoRoot $resolvedRepoRoot `
    -ManifestPath $ManifestPath `
    -OutputRoot $resolvedExportOutputRoot

$deploymentResults = New-Object System.Collections.ArrayList

$webTemplateResults = @{}
foreach ($template in $assets.webTemplates) {
    $payload = @{
        mspp_name = $template.webTemplateName
        mspp_source = $template.content
        mspp_mimetype = 'text/html'
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId

    $result = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webtemplates' `
        -PrimaryIdAttribute 'mspp_webtemplateid' `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $template.webTemplateName), $siteContext.WebsiteId) `
        -Payload $payload `
        -Description "web template '$($template.webTemplateName)'"

    $webTemplateResults[$template.webTemplateName] = $result.id
    $deploymentResults.Add($result) | Out-Null
}

$pageTemplateResults = @{}
foreach ($template in $assets.webTemplates) {
    $payload = @{
        mspp_name = $template.pageTemplateName
        mspp_type = 756150001
        mspp_usewebsiteheaderandfooter = $true
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_webtemplateid' -EntitySetName 'mspp_webtemplates' -Id $webTemplateResults[$template.webTemplateName]

    $result = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_pagetemplates' `
        -PrimaryIdAttribute 'mspp_pagetemplateid' `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $template.pageTemplateName), $siteContext.WebsiteId) `
        -Payload $payload `
        -Description "page template '$($template.pageTemplateName)'"

    $pageTemplateResults[$template.pageTemplateName] = $result.id
    $deploymentResults.Add($result) | Out-Null
}

$pageResultsByRoute = @{}
$orderedPages = @($assets.pages | Sort-Object { $_.routeSegments.Count })
foreach ($page in $orderedPages) {
    $payload = @{
        mspp_name = $page.webPageName
        mspp_title = $page.webPageName
        mspp_partialurl = $page.partialUrl
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_pagetemplateid' -EntitySetName 'mspp_pagetemplates' -Id $pageTemplateResults[$page.pageTemplateName]
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_publishingstateid' -EntitySetName 'mspp_publishingstates' -Id $siteContext.PublishingStateId
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_webpagelanguageid' -EntitySetName 'mspp_websitelanguages' -Id $siteContext.WebsiteLanguageId
    if (-not [string]::IsNullOrWhiteSpace($page.parentRoutePath)) {
        $parentId = $pageResultsByRoute[$page.parentRoutePath]
        if ([string]::IsNullOrWhiteSpace([string]$parentId)) {
            throw "Portal page '$($page.webPageName)' depends on parent route '$($page.parentRoutePath)', but that parent page was not resolved."
        }
        Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_parentpageid' -EntitySetName 'mspp_webpages' -Id $parentId
    }

    $result = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webpages' `
        -PrimaryIdAttribute 'mspp_webpageid' `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1} and _mspp_webpagelanguageid_value eq {2}" -f (ConvertTo-DbmODataStringLiteral -Value $page.webPageName), $siteContext.WebsiteId, $siteContext.WebsiteLanguageId) `
        -Payload $payload `
        -Description "web page '$($page.webPageName)'"

    $pageResultsByRoute[$page.routePath] = $result.id
    $deploymentResults.Add($result) | Out-Null
}

foreach ($webFile in $assets.webFiles) {
    $payload = @{
        mspp_name = $webFile.webFilePath
        mspp_title = $webFile.fileName
        mspp_partialurl = $webFile.webFilePath
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_publishingstateid' -EntitySetName 'mspp_publishingstates' -Id $siteContext.PublishingStateId

    $result = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_webfiles' `
        -PrimaryIdAttribute 'mspp_webfileid' `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $webFile.webFilePath), $siteContext.WebsiteId) `
        -Payload $payload `
        -Description "web file '$($webFile.webFilePath)'"

    $component = Resolve-DbmPortalWebFileComponent `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -PowerPageSiteId $siteContext.PowerPageSiteId `
        -WebFilePath $webFile.webFilePath

    Set-DbmPortalWebFileContent `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -ComponentId ([string]$component.powerpagecomponentid) `
        -WebFilePath $webFile.webFilePath `
        -Content ([string]$webFile.content)

    $deploymentResults.Add([pscustomobject]@{
        action = $result.action
        entitySetName = 'mspp_webfiles'
        id = $result.id
        description = "web file '$($webFile.webFilePath)' with uploaded filecontent"
    }) | Out-Null
}

foreach ($siteSetting in @($assets.siteSettings.siteSettings)) {
    $payload = @{
        mspp_name = [string]$siteSetting.name
        mspp_value = [string]$siteSetting.value
        mspp_source = 0
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId

    $result = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_sitesettings' `
        -PrimaryIdAttribute 'mspp_sitesettingid' `
        -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value ([string]$siteSetting.name)), $siteContext.WebsiteId) `
        -Payload $payload `
        -Description "site setting '$([string]$siteSetting.name)'"

    $deploymentResults.Add($result) | Out-Null
}

$webRoleName = [string]$assets.permissions.webRole
$webRolePayload = @{
    mspp_name = $webRoleName
}
Add-DbmLookupBinding -Payload $webRolePayload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId
$webRoleResult = Invoke-DbmUpsertRecord `
    -DataverseUrl $dataverseUrl `
    -AccessToken $accessToken `
    -EntitySetName 'mspp_webroles' `
    -PrimaryIdAttribute 'mspp_webroleid' `
    -Filter ("mspp_name eq {0} and _mspp_websiteid_value eq {1}" -f (ConvertTo-DbmODataStringLiteral -Value $webRoleName), $siteContext.WebsiteId) `
    -Payload $webRolePayload `
    -Description "web role '$webRoleName'"
$deploymentResults.Add($webRoleResult) | Out-Null

$scopeMap = @{
    global = 756150000
    contact = 756150001
    account = 756150002
    parent = 756150003
    self = 756150004
}

foreach ($tablePermission in @($assets.permissions.tablePermissions)) {
    $scopeKey = ([string]$tablePermission.scope).ToLowerInvariant()
    if (-not $scopeMap.ContainsKey($scopeKey)) {
        throw "Unsupported Power Pages table permission scope '$scopeKey'."
    }

    $access = @([string[]]$tablePermission.access) | ForEach-Object { $_.ToLowerInvariant() }
    $payload = @{
        mspp_entitylogicalname = [string]$tablePermission.tableLogicalName
        mspp_entityname = [string]$tablePermission.tableLogicalName
        mspp_scope = $scopeMap[$scopeKey]
        mspp_create = $access -contains 'create'
        mspp_read = $access -contains 'read'
        mspp_write = $access -contains 'write'
        mspp_append = $access -contains 'append'
        mspp_appendto = $access -contains 'appendto'
        mspp_delete = $access -contains 'delete'
    }
    Add-DbmLookupBinding -Payload $payload -NavigationPropertyName 'mspp_websiteid' -EntitySetName 'mspp_websites' -Id $siteContext.WebsiteId

    $permissionResult = Invoke-DbmUpsertRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $accessToken `
        -EntitySetName 'mspp_entitypermissions' `
        -PrimaryIdAttribute 'mspp_entitypermissionid' `
        -Filter ("mspp_entitylogicalname eq {0} and mspp_scope eq {1} and _mspp_websiteid_value eq {2}" -f (ConvertTo-DbmODataStringLiteral -Value ([string]$tablePermission.tableLogicalName)), $scopeMap[$scopeKey], $siteContext.WebsiteId) `
        -Payload $payload `
        -Description "table permission '$([string]$tablePermission.tableLogicalName)'"

    $associatedRoles = Invoke-DbmDataverseRequest `
        -Method GET `
        -Uri ("{0}/mspp_entitypermissions({1})/mspp_entitypermission_webrole?`$select=mspp_webroleid" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), $permissionResult.id) `
        -AccessToken $accessToken
    $associatedRoleIds = @($associatedRoles.value | ForEach-Object { ([guid][string]$_.mspp_webroleid).Guid })
    if ($associatedRoleIds -notcontains $webRoleResult.id) {
        Invoke-DbmDataverseRequest `
            -Method POST `
            -Uri ("{0}/mspp_entitypermissions({1})/mspp_entitypermission_webrole/`$ref" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), $permissionResult.id) `
            -AccessToken $accessToken `
            -Body @{
                '@odata.id' = "{0}/mspp_webroles({1})" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), $webRoleResult.id
            } | Out-Null
    }

    $deploymentResults.Add($permissionResult) | Out-Null
}

Publish-DbmDataverseCustomizations -DataverseUrl $dataverseUrl -AccessToken $accessToken

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $dataverseUrl
    websiteId = $siteContext.WebsiteId
    websiteName = $siteContext.WebsiteName
    siteOrigin = $siteContext.SiteOrigin
    exportOutputRoot = $resolvedExportOutputRoot
    results = @($deploymentResults)
}

$summaryPath = Join-Path $resolvedEvidenceRoot 'portal-runtime-deployment.json'
$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Portal runtime deployment summary: $summaryPath"
