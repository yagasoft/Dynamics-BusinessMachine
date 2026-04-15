Set-StrictMode -Version 3

function Get-DbmPortalRuntimeRepoRoot {
    param(
        [string]$RepoRoot
    )

    if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    }

    return (Resolve-Path $RepoRoot).Path
}

function Resolve-DbmAbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$CandidatePath
    )

    if ([System.IO.Path]::IsPathRooted($CandidatePath)) {
        return [System.IO.Path]::GetFullPath($CandidatePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $CandidatePath))
}

function Read-DbmJsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        throw "JSON file is missing: $Path"
    }

    return Get-Content -Path $Path -Raw | ConvertFrom-Json
}

function ConvertTo-DbmJsonForJavaScript {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value
    )

    $json = $Value | ConvertTo-Json -Depth 100 -Compress
    $json = $json.Replace('</', '<\/')
    $json = $json.Replace([string][char]0x2028, '\u2028')
    $json = $json.Replace([string][char]0x2029, '\u2029')
    return $json
}

function Get-DbmPortalRuntimePlan {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [string]$PlanPath = 'power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/source/dbm-generated-metadata.plan.json'
    )

    $resolvedPlanPath = Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath $PlanPath
    $plan = Read-DbmJsonFile -Path $resolvedPlanPath
    if ($null -eq $plan.portalRuntime -or $null -eq $plan.portalRuntime.bootstrap -or $null -eq $plan.portalRuntime.processExperienceRuntime) {
        throw "Generated metadata plan '$resolvedPlanPath' is missing portalRuntime bootstrap/runtime content."
    }

    return [pscustomobject]@{
        Path = $resolvedPlanPath
        Value = $plan.portalRuntime
    }
}

function New-DbmPortalRuntimeContextScript {
    param(
        [Parameter(Mandatory = $true)]
        [object]$PortalRuntimePlan
    )

    $bootstrapJson = ConvertTo-DbmJsonForJavaScript -Value $PortalRuntimePlan.bootstrap
    $runtimeJson = ConvertTo-DbmJsonForJavaScript -Value $PortalRuntimePlan.processExperienceRuntime

    return @"
(function (global) {
  global.dbmPortalRuntimeBootstrap = $bootstrapJson;
  global.dbmPortalRuntimeProcessModel = $runtimeJson;
})(typeof window !== 'undefined' ? window : globalThis);
"@
}

function Get-DbmPortalRuntimeManifest {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [string]$ManifestPath = 'power-platform/solutions/DynamicsBusinessMachinePortalRuntime/source/manifest.json'
    )

    $resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
    $resolvedManifestPath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath $ManifestPath
    $manifest = Read-DbmJsonFile -Path $resolvedManifestPath

    if (-not $manifest.solutionName) {
        throw "Portal runtime manifest '$resolvedManifestPath' is missing solutionName."
    }

    if (-not $manifest.webFiles -or @($manifest.webFiles).Count -eq 0) {
        throw "Portal runtime manifest '$resolvedManifestPath' is missing webFiles."
    }

    if (-not $manifest.pages -or @($manifest.pages).Count -eq 0) {
        throw "Portal runtime manifest '$resolvedManifestPath' is missing pages."
    }

    $resolvedWebFiles = @(
        foreach ($webFile in @($manifest.webFiles)) {
            $webFilePath = [string]$webFile.webFilePath
            if ([string]::IsNullOrWhiteSpace($webFilePath)) {
                throw "Portal runtime manifest '$resolvedManifestPath' contains a web file without webFilePath."
            }

            $kind = [string]$webFile.kind
            if ([string]::IsNullOrWhiteSpace($kind)) {
                throw "Portal runtime manifest '$resolvedManifestPath' contains web file '$webFilePath' without kind."
            }

            $sourcePath = $null
            $generatedPlanPath = $null
            switch ($kind) {
                'bundle' {
                    $sourcePath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$webFile.sourcePath)
                }
                'generated-context' {
                    $generatedPlanPath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$webFile.generatedPlanPath)
                }
                default {
                    throw "Portal runtime manifest '$resolvedManifestPath' contains unsupported web file kind '$kind'."
                }
            }

            [pscustomobject]@{
                kind = $kind
                webFilePath = $webFilePath.Replace('\', '/')
                fileName = Split-Path -Path $webFilePath -Leaf
                sourcePath = $sourcePath
                generatedPlanPath = $generatedPlanPath
            }
        }
    )

    $resolvedPages = @(
        foreach ($page in @($manifest.pages)) {
            $pageId = [string]$page.pageId
            $routePath = [string]$page.routePath
            $webPageName = [string]$page.webPageName
            $webTemplateName = [string]$page.webTemplateName
            $pageTemplateNameProperty = $page.PSObject.Properties['pageTemplateName']
            $templatePath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$page.templatePath)
            if ([string]::IsNullOrWhiteSpace($pageId) -or [string]::IsNullOrWhiteSpace($routePath) -or [string]::IsNullOrWhiteSpace($webPageName) -or [string]::IsNullOrWhiteSpace($webTemplateName)) {
                throw "Portal runtime manifest '$resolvedManifestPath' contains an incomplete page entry."
            }

            $normalizedRoute = if ($routePath.StartsWith('/')) { $routePath } else { "/$routePath" }
            $routeSegments = @(($normalizedRoute.Trim('/') -split '/') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            $partialUrl = if ($routeSegments.Count -gt 0) { $routeSegments[-1] } else { '' }
            if ([string]::IsNullOrWhiteSpace($partialUrl)) {
                throw "Portal runtime page '$pageId' must resolve to a non-empty partial URL."
            }

            [pscustomobject]@{
                pageId = $pageId
                routePath = $normalizedRoute
                routeSegments = @($routeSegments)
                parentRoutePath = if ($routeSegments.Count -gt 1) { '/' + (($routeSegments | Select-Object -First ($routeSegments.Count - 1)) -join '/') } else { $null }
                partialUrl = $partialUrl
                webPageName = $webPageName
                webTemplateName = $webTemplateName
                pageTemplateName = if ($pageTemplateNameProperty -and -not [string]::IsNullOrWhiteSpace([string]$pageTemplateNameProperty.Value)) { [string]$pageTemplateNameProperty.Value } else { "$webTemplateName Page Template" }
                templatePath = $templatePath
            }
        }
    )

    return [pscustomobject]@{
        Path = $resolvedManifestPath
        RepoRoot = $resolvedRepoRoot
        Value = $manifest
        solutionName = [string]$manifest.solutionName
        bundlePackageName = [string]$manifest.bundlePackageName
        webFiles = $resolvedWebFiles
        pages = $resolvedPages
        bootstrapPath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$manifest.bootstrapPath)
        siteSettingsPath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$manifest.siteSettingsPath)
        permissionsPath = Resolve-DbmAbsolutePath -BasePath $resolvedRepoRoot -CandidatePath ([string]$manifest.permissionsPath)
    }
}

function Get-DbmPortalRuntimeDeployableAssets {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [string]$ManifestPath = 'power-platform/solutions/DynamicsBusinessMachinePortalRuntime/source/manifest.json'
    )

    $manifest = Get-DbmPortalRuntimeManifest -RepoRoot $RepoRoot -ManifestPath $ManifestPath
    $plan = Get-DbmPortalRuntimePlan -RepoRoot $manifest.RepoRoot

    $webFiles = @(
        foreach ($webFile in $manifest.webFiles) {
            $content = if ($webFile.kind -eq 'generated-context') {
                New-DbmPortalRuntimeContextScript -PortalRuntimePlan $plan.Value
            }
            else {
                Get-Content -Path $webFile.sourcePath -Raw
            }

            [pscustomobject]@{
                assetType = 'web-file'
                kind = $webFile.kind
                webFilePath = $webFile.webFilePath
                fileName = $webFile.fileName
                content = $content
                sourcePath = if ($webFile.kind -eq 'generated-context') { $plan.Path } else { $webFile.sourcePath }
                outputRelativePath = ('web-files/{0}' -f $webFile.webFilePath).Replace('/', '\')
            }
        }
    )

    $webTemplates = @(
        foreach ($page in $manifest.pages) {
            [pscustomobject]@{
                assetType = 'web-template'
                pageId = $page.pageId
                webTemplateName = $page.webTemplateName
                pageTemplateName = $page.pageTemplateName
                templatePath = $page.templatePath
                content = Get-Content -Path $page.templatePath -Raw
                outputRelativePath = ('web-templates/{0}' -f [System.IO.Path]::GetFileName($page.templatePath)).Replace('/', '\')
            }
        }
    )

    return [pscustomobject]@{
        manifest = $manifest
        plan = $plan
        webFiles = $webFiles
        webTemplates = $webTemplates
        pages = $manifest.pages
        bootstrapPath = $manifest.bootstrapPath
        bootstrap = Read-DbmJsonFile -Path $manifest.bootstrapPath
        siteSettingsPath = $manifest.siteSettingsPath
        siteSettings = Read-DbmJsonFile -Path $manifest.siteSettingsPath
        permissionsPath = $manifest.permissionsPath
        permissions = Read-DbmJsonFile -Path $manifest.permissionsPath
    }
}

function Get-DbmPortalRuntimeConfig {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [ValidateSet('Dev')]
        [string]$TargetEnvironment = 'Dev'
    )

    $resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
    $configPath = Join-Path $resolvedRepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    $config = Read-DbmJsonFile -Path $configPath

    if ([string]::IsNullOrWhiteSpace([string]$config.dataverseUrl)) {
        throw "Environment config '$configPath' is missing dataverseUrl."
    }

    if ($null -eq $config.powerPages) {
        throw "Environment config '$configPath' is missing the powerPages block."
    }

    return [pscustomobject]@{
        Path = $configPath
        Value = $config
    }
}

function Test-DbmPlaceholderValue {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $true
    }

    return $Value.Trim().StartsWith('SET-', [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-DbmDataverseApiBaseUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl
    )

    return "$($DataverseUrl.TrimEnd('/'))/api/data/v9.2"
}

function Get-DbmDataverseAccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl
    )

    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available to deploy or validate the portal runtime.'
    }

    $resource = $DataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'."
    }

    return $token.Trim()
}

function Merge-DbmHashtable {
    param(
        [hashtable]$Base,
        [hashtable]$Overlay
    )

    $merged = @{}
    foreach ($source in @($Base, $Overlay)) {
        if ($null -eq $source) {
            continue
        }

        foreach ($key in $source.Keys) {
            $merged[$key] = $source[$key]
        }
    }

    return $merged
}

function Get-DbmCreatedRecordIdFromResponse {
    param(
        [Parameter(Mandatory = $true)]
        [Microsoft.PowerShell.Commands.HtmlWebResponseObject]$Response,

        [Parameter(Mandatory = $true)]
        [string]$PrimaryIdAttribute
    )

    $entityIdHeader = $Response.Headers['OData-EntityId']
    if ([string]::IsNullOrWhiteSpace($entityIdHeader)) {
        $entityIdHeader = $Response.Headers['odata-entityid']
    }

    if (-not [string]::IsNullOrWhiteSpace($entityIdHeader)) {
        $match = [regex]::Match($entityIdHeader, '\(([0-9a-fA-F-]{36})\)$')
        if ($match.Success) {
            return ([guid]$match.Groups[1].Value).Guid
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($Response.Content)) {
        try {
            $payload = $Response.Content | ConvertFrom-Json
            $value = $payload.PSObject.Properties[$PrimaryIdAttribute]
            if ($value -and -not [string]::IsNullOrWhiteSpace([string]$value.Value)) {
                return ([guid][string]$value.Value).Guid
            }
        }
        catch {
        }
    }

    throw "Dataverse create response did not include '$PrimaryIdAttribute'."
}

function Invoke-DbmDataverseRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [AllowNull()]
        [object]$Body,

        [AllowNull()]
        [byte[]]$BinaryBody,

        [string]$ContentType = 'application/json; charset=utf-8',

        [hashtable]$AdditionalHeaders,

        [switch]$ReturnRawResponse
    )

    $headers = Merge-DbmHashtable -Base @{
        Authorization = "Bearer $AccessToken"
        Accept = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    } -Overlay $AdditionalHeaders

    $requestBody = $null
    if ($null -ne $BinaryBody) {
        $requestBody = $BinaryBody
    }
    elseif ($null -ne $Body) {
        $requestBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 -Compress }
    }

    try {
        $invokeParams = @{
            Method = $Method
            Uri = $Uri
            Headers = $headers
            ErrorAction = 'Stop'
        }

        if ($null -ne $requestBody) {
            $invokeParams['Body'] = $requestBody
            $invokeParams['ContentType'] = $ContentType
        }

        $response = Invoke-WebRequest @invokeParams
    }
    catch {
        $details = $_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($details) -and $_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $details = $reader.ReadToEnd()
            }
            catch {
            }
        }

        $message = if ([string]::IsNullOrWhiteSpace($details)) { $_.Exception.Message } else { "$($_.Exception.Message)`n$details" }
        throw "Dataverse request failed: $Method $Uri`n$message"
    }

    if ($ReturnRawResponse) {
        return $response
    }

    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }

    try {
        return $response.Content | ConvertFrom-Json
    }
    catch {
        return $response.Content
    }
}

function ConvertTo-DbmODataStringLiteral {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return "'{0}'" -f $Value.Replace("'", "''")
}

function Invoke-DbmDataverseQuery {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [int]$Top = 50
    )

    $queryParts = @()
    if ($SelectFields -and $SelectFields.Count -gt 0) {
        $queryParts += "`$select=$([System.Uri]::EscapeDataString(($SelectFields -join ',')))"
    }
    if (-not [string]::IsNullOrWhiteSpace($Filter)) {
        $queryParts += "`$filter=$([System.Uri]::EscapeDataString($Filter))"
    }
    if (-not [string]::IsNullOrWhiteSpace($OrderBy)) {
        $queryParts += "`$orderby=$([System.Uri]::EscapeDataString($OrderBy))"
    }
    if ($Top -gt 0) {
        $queryParts += "`$top=$Top"
    }

    $uri = "{0}/{1}{2}" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl), $EntitySetName, ($(if ($queryParts.Count -gt 0) { '?' + ($queryParts -join '&') } else { '' }))
    $response = Invoke-DbmDataverseRequest -Method GET -Uri $uri -AccessToken $AccessToken
    if ($null -eq $response) {
        return @()
    }

    return @($response.value)
}

function Get-DbmDataverseSingleRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [string]$Description = $EntitySetName,
        [switch]$AllowMissing
    )

    $records = Invoke-DbmDataverseQuery -DataverseUrl $DataverseUrl -AccessToken $AccessToken -EntitySetName $EntitySetName -SelectFields $SelectFields -Filter $Filter -OrderBy $OrderBy -Top 2
    if ($records.Count -eq 0) {
        if ($AllowMissing) {
            return $null
        }

        throw "Dataverse query did not return a record for $Description."
    }

    if ($records.Count -gt 1) {
        throw "Dataverse query returned multiple records for $Description."
    }

    return $records[0]
}

function Resolve-DbmPublicOrigin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PrimaryDomainName
    )

    $trimmed = $PrimaryDomainName.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        throw 'Primary domain name is missing.'
    }

    if ($trimmed -match '^https?://') {
        return $trimmed.TrimEnd('/')
    }

    return "https://$($trimmed.TrimEnd('/'))"
}

function Resolve-DbmPowerPagesSiteContext {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [ValidateSet('Dev')]
        [string]$TargetEnvironment = 'Dev',
        [string]$AccessToken
    )

    $configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $RepoRoot -TargetEnvironment $TargetEnvironment
    $config = $configRecord.Value
    $dataverseUrl = [string]$config.dataverseUrl
    $powerPages = $config.powerPages
    $websiteId = [string]$powerPages.websiteId
    $websiteName = [string]$powerPages.websiteName

    if ((Test-DbmPlaceholderValue -Value $websiteId) -or (Test-DbmPlaceholderValue -Value $websiteName)) {
        throw "Environment config '$($configRecord.Path)' must declare real powerPages.websiteId and powerPages.websiteName values before Dev portal deployment can run."
    }

    $normalizedWebsiteId = try { ([guid]$websiteId).Guid } catch { throw "powerPages.websiteId '$websiteId' in '$($configRecord.Path)' is not a valid GUID." }
    if ([string]::IsNullOrWhiteSpace($AccessToken)) {
        $AccessToken = Get-DbmDataverseAccessToken -DataverseUrl $dataverseUrl
    }

    $website = Invoke-DbmDataverseRequest -Method GET -Uri ("{0}/mspp_websites({1})?`$select=mspp_websiteid,mspp_name,mspp_primarydomainname,_mspp_defaultlanguage_value" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), $normalizedWebsiteId) -AccessToken $AccessToken
    if ([string]$website.mspp_name -ne $websiteName) {
        throw "Configured powerPages.websiteName '$websiteName' does not match website '$([string]$website.mspp_name)' for websiteId '$normalizedWebsiteId'."
    }

    $powerPageSite = Get-DbmDataverseSingleRecord `
        -DataverseUrl $dataverseUrl `
        -AccessToken $AccessToken `
        -EntitySetName 'powerpagesites' `
        -SelectFields @('powerpagesiteid', 'name', 'primarydomainname') `
        -Filter ("name eq {0}" -f (ConvertTo-DbmODataStringLiteral -Value $websiteName)) `
        -Description "Power Pages site '$websiteName'"

    $publishingStates = Invoke-DbmDataverseQuery `
        -DataverseUrl $dataverseUrl `
        -AccessToken $AccessToken `
        -EntitySetName 'mspp_publishingstates' `
        -SelectFields @('mspp_publishingstateid', 'mspp_name', 'mspp_isdefault') `
        -Filter ("_mspp_websiteid_value eq {0}" -f $normalizedWebsiteId) `
        -Top 10

    if ($publishingStates.Count -eq 0) {
        throw "Power Pages website '$websiteName' does not have any publishing states."
    }

    $defaultPublishingStates = @($publishingStates | Where-Object { $_.mspp_isdefault -eq $true })
    $publishingState = if ($defaultPublishingStates.Count -eq 1) {
        $defaultPublishingStates[0]
    }
    elseif ($publishingStates.Count -eq 1) {
        $publishingStates[0]
    }
    else {
        throw "Power Pages website '$websiteName' does not resolve to a single default publishing state."
    }

    $websiteLanguageId = [string]$website.'_mspp_defaultlanguage_value'
    if ([string]::IsNullOrWhiteSpace($websiteLanguageId)) {
        throw "Power Pages website '$websiteName' is missing mspp_defaultlanguage."
    }

    $websiteLanguage = Invoke-DbmDataverseRequest `
        -Method GET `
        -Uri ("{0}/mspp_websitelanguages({1})?`$select=mspp_websitelanguageid,mspp_name,mspp_displayname,mspp_languagecode,mspp_lcid" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $dataverseUrl), ([guid]$websiteLanguageId).Guid) `
        -AccessToken $AccessToken

    $languageCandidates = Invoke-DbmDataverseQuery `
        -DataverseUrl $dataverseUrl `
        -AccessToken $AccessToken `
        -EntitySetName 'powerpagesitelanguages' `
        -SelectFields @('powerpagesitelanguageid', 'name', 'displayname', 'languagecode', 'lcid', '_powerpagesiteid_value') `
        -Filter ("_powerpagesiteid_value eq {0}" -f ([guid][string]$powerPageSite.powerpagesiteid).Guid) `
        -Top 10

    $matchingPowerPageLanguages = @(
        $languageCandidates | Where-Object {
            ([string]$_.languagecode -eq [string]$websiteLanguage.mspp_languagecode) -or
            ([int]$_.lcid -eq [int]$websiteLanguage.mspp_lcid)
        }
    )

    if ($matchingPowerPageLanguages.Count -ne 1) {
        throw "Power Pages site '$websiteName' does not resolve to a single powerpagesitelanguage for '$([string]$websiteLanguage.mspp_languagecode)'."
    }

    return [pscustomobject]@{
        Config = $config
        ConfigPath = $configRecord.Path
        DataverseUrl = $dataverseUrl
        Website = $website
        WebsiteId = $normalizedWebsiteId
        WebsiteName = $websiteName
        PrimaryDomainName = [string]$website.mspp_primarydomainname
        SiteOrigin = Resolve-DbmPublicOrigin -PrimaryDomainName ([string]$website.mspp_primarydomainname)
        PowerPageSite = $powerPageSite
        PowerPageSiteId = ([guid][string]$powerPageSite.powerpagesiteid).Guid
        WebsiteLanguage = $websiteLanguage
        WebsiteLanguageId = ([guid][string]$websiteLanguage.mspp_websitelanguageid).Guid
        PowerPageSiteLanguage = $matchingPowerPageLanguages[0]
        PowerPageSiteLanguageId = ([guid][string]$matchingPowerPageLanguages[0].powerpagesitelanguageid).Guid
        PublishingState = $publishingState
        PublishingStateId = ([guid][string]$publishingState.mspp_publishingstateid).Guid
    }
}

function Get-DbmPortalRuntimePluginStepDefinitions {
    return @(
        [pscustomobject]@{
            name = 'DBM Portal Runtime - Create dbm_request'
            messageName = 'Create'
            primaryEntityLogicalName = 'dbm_request'
            stage = 20
            stageLabel = 'PreOperation'
            mode = 0
            modeLabel = 'Synchronous'
            rank = 1
            supportedDeployment = 0
            filteringAttributes = $null
        },
        [pscustomobject]@{
            name = 'DBM Portal Runtime - Update dbm_request portal submit'
            messageName = 'Update'
            primaryEntityLogicalName = 'dbm_request'
            stage = 20
            stageLabel = 'PreOperation'
            mode = 0
            modeLabel = 'Synchronous'
            rank = 1
            supportedDeployment = 0
            filteringAttributes = 'dbm_portalcommand'
        }
    )
}

function Get-DbmPortalRuntimePluginStepDrift {
    param(
        [Parameter(Mandatory = $true)]
        [object]$ExpectedStep,

        [AllowNull()]
        [object]$ActualStep
    )

    if ($null -eq $ActualStep) {
        return [pscustomobject]@{
            exists = $false
            requiresUpdate = $true
            differences = @('step-missing')
        }
    }

    $normalizeFilter = {
        param([AllowNull()][string]$Value)
        if ([string]::IsNullOrWhiteSpace($Value)) {
            return ''
        }

        return (@($Value.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ }) | Sort-Object) -join ','
    }

    $differences = New-Object System.Collections.Generic.List[string]
    if ([int]$ActualStep.stage -ne [int]$ExpectedStep.stage) {
        $differences.Add('stage')
    }
    if ([int]$ActualStep.mode -ne [int]$ExpectedStep.mode) {
        $differences.Add('mode')
    }
    if ([int]$ActualStep.rank -ne [int]$ExpectedStep.rank) {
        $differences.Add('rank')
    }
    if ([int]$ActualStep.supporteddeployment -ne [int]$ExpectedStep.supportedDeployment) {
        $differences.Add('supporteddeployment')
    }
    if ((& $normalizeFilter $ActualStep.filteringattributes) -ne (& $normalizeFilter $ExpectedStep.filteringAttributes)) {
        $differences.Add('filteringattributes')
    }

    return [pscustomobject]@{
        exists = $true
        requiresUpdate = $differences.Count -gt 0
        differences = @($differences)
    }
}

function New-DbmR3PortalRuntimeEvidenceManifest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$Status,

        [Parameter(Mandatory = $true)]
        [string]$EvidenceRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$Steps
    )

    return [ordered]@{
        generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
        targetEnvironment = $TargetEnvironment
        status = $Status
        evidenceRoot = $EvidenceRoot
        steps = @($Steps)
    }
}
