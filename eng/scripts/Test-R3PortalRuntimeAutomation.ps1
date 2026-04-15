[CmdletBinding()]
param(
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'PortalRuntimeDeployment.Common.ps1')

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

function Assert-DbmThrowsLike {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,

        [Parameter(Mandatory = $true)]
        [string]$Pattern,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    try {
        & $Action
    }
    catch {
        if ([string]$_.Exception.Message -match $Pattern) {
            return
        }

        throw "Unexpected error for '$Message': $([string]$_.Exception.Message)"
    }

    throw $Message
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$assets = Get-DbmPortalRuntimeDeployableAssets -RepoRoot $resolvedRepoRoot
$contextScript = New-DbmPortalRuntimeContextScript -PortalRuntimePlan $assets.plan.Value

Assert-DbmCondition -Condition ($contextScript -match 'dbmPortalRuntimeBootstrap') -Message 'Generated portal context script is missing dbmPortalRuntimeBootstrap.'
Assert-DbmCondition -Condition ($contextScript -match 'dbmPortalRuntimeProcessModel') -Message 'Generated portal context script is missing dbmPortalRuntimeProcessModel.'
Assert-DbmCondition -Condition (@($assets.webFiles).Count -eq 2) -Message 'Portal runtime deployable assets should include exactly two web files.'
Assert-DbmCondition -Condition ((@($assets.webFiles | Where-Object webFilePath -eq 'dbm/portal-runtime/portal-runtime-context.js')).Count -eq 1) -Message 'Portal runtime context web file is missing from the deployable asset map.'
Assert-DbmCondition -Condition ((@($assets.pages | Where-Object routePath -eq '/approval-request')).Count -eq 1) -Message 'Approval request entry route was not resolved from manifest.'
Assert-DbmCondition -Condition ((@($assets.pages | Where-Object routePath -eq '/approval-request/status')).Count -eq 1) -Message 'Approval request status route was not resolved from manifest.'

$stepDefinitions = Get-DbmPortalRuntimePluginStepDefinitions
Assert-DbmCondition -Condition (@($stepDefinitions).Count -eq 2) -Message 'Portal runtime plugin step definitions should contain exactly two steps.'

$missingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[0] -ActualStep $null
Assert-DbmCondition -Condition ($missingDrift.requiresUpdate -and $missingDrift.differences -contains 'step-missing') -Message 'Missing step drift should require an update.'

$matchingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[1] -ActualStep ([pscustomobject]@{
    stage = 20
    mode = 0
    rank = 1
    supporteddeployment = 0
    filteringattributes = 'dbm_portalcommand'
})
Assert-DbmCondition -Condition (-not $matchingDrift.requiresUpdate) -Message 'Matching step drift should not require an update.'

$evidenceManifest = New-DbmR3PortalRuntimeEvidenceManifest `
    -TargetEnvironment 'Dev' `
    -Status 'passed' `
    -EvidenceRoot (Join-Path $resolvedRepoRoot 'artifacts\test-r3-portal-runtime-automation') `
    -Steps @(
        [pscustomobject]@{
            name = 'sample-step'
            status = 'passed'
        }
    )

Assert-DbmCondition -Condition (@($evidenceManifest.steps).Count -eq 1) -Message 'Evidence manifest did not preserve the supplied step payload.'
Assert-DbmCondition -Condition ([string]$evidenceManifest.targetEnvironment -eq 'Dev') -Message 'Evidence manifest did not preserve the target environment.'

$script:MockPortalRuntimeConfig = $null
$script:MockInvokeDataverseRequest = $null
$script:MockInvokeDataverseQuery = $null
$script:MockGetSingleRecord = $null

function Set-DbmHappyPathSiteContextMocks {
    $script:MockPortalRuntimeConfig = [pscustomobject]@{
        Path = 'C:\mock\dev.json'
        Value = [pscustomobject]@{
            dataverseUrl = 'https://example.crm.dynamics.com/'
            powerPages = [pscustomobject]@{
                websiteId = '11111111-1111-1111-1111-111111111111'
                websiteName = 'DBM Dev Portal'
            }
        }
    }

    $script:MockInvokeDataverseRequest = {
        param(
            [string]$Method,
            [string]$Uri,
            [string]$AccessToken,
            [object]$Body,
            [byte[]]$BinaryBody,
            [string]$ContentType,
            [hashtable]$AdditionalHeaders,
            [switch]$ReturnRawResponse
        )

        switch -Regex ($Uri) {
            'mspp_websites\(' {
                return [pscustomobject]@{
                    mspp_websiteid = '11111111-1111-1111-1111-111111111111'
                    mspp_name = 'DBM Dev Portal'
                    mspp_primarydomainname = 'dbm-dev.powerappsportals.com'
                    _mspp_defaultlanguage_value = '22222222-2222-2222-2222-222222222222'
                }
            }
            'mspp_websitelanguages\(' {
                return [pscustomobject]@{
                    mspp_websitelanguageid = '22222222-2222-2222-2222-222222222222'
                    mspp_name = 'English'
                    mspp_displayname = 'English'
                    mspp_languagecode = 'en-US'
                    mspp_lcid = 1033
                }
            }
            default {
                throw "Unexpected Dataverse request URI in test double: $Uri"
            }
        }
    }

    $script:MockInvokeDataverseQuery = {
        param(
            [string]$DataverseUrl,
            [string]$AccessToken,
            [string]$EntitySetName,
            [string[]]$SelectFields,
            [string]$Filter,
            [string]$OrderBy,
            [int]$Top
        )

        switch ($EntitySetName) {
            'mspp_publishingstates' {
                return @(
                    [pscustomobject]@{
                        mspp_publishingstateid = '33333333-3333-3333-3333-333333333333'
                        mspp_name = 'Published'
                        mspp_isdefault = $true
                    }
                )
            }
            'powerpagesitelanguages' {
                return @(
                    [pscustomobject]@{
                        powerpagesitelanguageid = '55555555-5555-5555-5555-555555555555'
                        name = 'English'
                        displayname = 'English'
                        languagecode = 'en-US'
                        lcid = 1033
                        _powerpagesiteid_value = '44444444-4444-4444-4444-444444444444'
                    }
                )
            }
            default {
                throw "Unexpected Dataverse query entity set in test double: $EntitySetName"
            }
        }
    }

    $script:MockGetSingleRecord = {
        param(
            [string]$DataverseUrl,
            [string]$AccessToken,
            [string]$EntitySetName,
            [string[]]$SelectFields,
            [string]$Filter,
            [string]$OrderBy,
            [string]$Description,
            [switch]$AllowMissing
        )

        if ($EntitySetName -eq 'powerpagesites') {
            return [pscustomobject]@{
                powerpagesiteid = '44444444-4444-4444-4444-444444444444'
                name = 'DBM Dev Portal'
                primarydomainname = 'dbm-dev.powerappsportals.com'
            }
        }

        throw "Unexpected single-record entity set in test double: $EntitySetName"
    }
}

function Get-DbmPortalRuntimeConfig {
    param(
        [string]$RepoRoot,
        [string]$TargetEnvironment
    )

    if ($null -eq $script:MockPortalRuntimeConfig) {
        throw 'Test double for Get-DbmPortalRuntimeConfig was not configured.'
    }

    return $script:MockPortalRuntimeConfig
}

function Invoke-DbmDataverseRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccessToken,
        [object]$Body,
        [byte[]]$BinaryBody,
        [string]$ContentType,
        [hashtable]$AdditionalHeaders,
        [switch]$ReturnRawResponse
    )

    if ($null -eq $script:MockInvokeDataverseRequest) {
        throw 'Test double for Invoke-DbmDataverseRequest was not configured.'
    }

    return & $script:MockInvokeDataverseRequest @PSBoundParameters
}

function Invoke-DbmDataverseQuery {
    param(
        [string]$DataverseUrl,
        [string]$AccessToken,
        [string]$EntitySetName,
        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [int]$Top
    )

    if ($null -eq $script:MockInvokeDataverseQuery) {
        throw 'Test double for Invoke-DbmDataverseQuery was not configured.'
    }

    return @(& $script:MockInvokeDataverseQuery @PSBoundParameters)
}

function Get-DbmDataverseSingleRecord {
    param(
        [string]$DataverseUrl,
        [string]$AccessToken,
        [string]$EntitySetName,
        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [string]$Description,
        [switch]$AllowMissing
    )

    if ($null -eq $script:MockGetSingleRecord) {
        throw 'Test double for Get-DbmDataverseSingleRecord was not configured.'
    }

    return & $script:MockGetSingleRecord @PSBoundParameters
}

Set-DbmHappyPathSiteContextMocks
$script:MockPortalRuntimeConfig.Value.powerPages.websiteId = 'SET-POWER-PAGES-WEBSITE-ID'
$script:MockPortalRuntimeConfig.Value.powerPages.websiteName = 'SET-POWER-PAGES-WEBSITE-NAME'

Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'must declare real powerPages\.websiteId and powerPages\.websiteName values' `
    -Message 'Placeholder powerPages values should fail before deployment starts.'

$script:MockPortalRuntimeConfig.Value.powerPages.websiteId = 'not-a-guid'
$script:MockPortalRuntimeConfig.Value.powerPages.websiteName = 'DBM Dev Portal'
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'is not a valid GUID' `
    -Message 'Invalid powerPages.websiteId should fail before deployment starts.'

Set-DbmHappyPathSiteContextMocks
$script:MockInvokeDataverseRequest = {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccessToken,
        [object]$Body,
        [byte[]]$BinaryBody,
        [string]$ContentType,
        [hashtable]$AdditionalHeaders,
        [switch]$ReturnRawResponse
    )

    if ($Uri -match 'mspp_websites\(') {
        throw 'Dataverse request failed: GET https://example.crm.dynamics.com/api/data/v9.2/mspp_websites(11111111-1111-1111-1111-111111111111) 404 Not Found'
    }

    throw "Unexpected Dataverse request URI in test double: $Uri"
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'does not resolve to a live mspp_website' `
    -Message 'Missing Power Pages website should fail with an external provisioning prerequisite message.'

Set-DbmHappyPathSiteContextMocks
$script:MockInvokeDataverseRequest = {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccessToken,
        [object]$Body,
        [byte[]]$BinaryBody,
        [string]$ContentType,
        [hashtable]$AdditionalHeaders,
        [switch]$ReturnRawResponse
    )

    switch -Regex ($Uri) {
        'mspp_websites\(' {
            return [pscustomobject]@{
                mspp_websiteid = '11111111-1111-1111-1111-111111111111'
                mspp_name = 'Other Portal'
                mspp_primarydomainname = 'dbm-dev.powerappsportals.com'
                _mspp_defaultlanguage_value = '22222222-2222-2222-2222-222222222222'
            }
        }
        'mspp_websitelanguages\(' {
            return [pscustomobject]@{
                mspp_websitelanguageid = '22222222-2222-2222-2222-222222222222'
                mspp_name = 'English'
                mspp_displayname = 'English'
                mspp_languagecode = 'en-US'
                mspp_lcid = 1033
            }
        }
        default {
            throw "Unexpected Dataverse request URI in test double: $Uri"
        }
    }
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'does not match website' `
    -Message 'Mismatched powerPages.websiteName should fail before any apply.'

Set-DbmHappyPathSiteContextMocks
$script:MockInvokeDataverseRequest = {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccessToken,
        [object]$Body,
        [byte[]]$BinaryBody,
        [string]$ContentType,
        [hashtable]$AdditionalHeaders,
        [switch]$ReturnRawResponse
    )

    switch -Regex ($Uri) {
        'mspp_websites\(' {
            return [pscustomobject]@{
                mspp_websiteid = '11111111-1111-1111-1111-111111111111'
                mspp_name = 'DBM Dev Portal'
                mspp_primarydomainname = ''
                _mspp_defaultlanguage_value = '22222222-2222-2222-2222-222222222222'
            }
        }
        'mspp_websitelanguages\(' {
            return [pscustomobject]@{
                mspp_websitelanguageid = '22222222-2222-2222-2222-222222222222'
                mspp_name = 'English'
                mspp_displayname = 'English'
                mspp_languagecode = 'en-US'
                mspp_lcid = 1033
            }
        }
        default {
            throw "Unexpected Dataverse request URI in test double: $Uri"
        }
    }
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'missing mspp_primarydomainname' `
    -Message 'Missing website primary domain should fail before any apply.'

Set-DbmHappyPathSiteContextMocks
$script:MockGetSingleRecord = {
    param(
        [string]$DataverseUrl,
        [string]$AccessToken,
        [string]$EntitySetName,
        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [string]$Description,
        [switch]$AllowMissing
    )

    if ($EntitySetName -eq 'powerpagesites') {
        return $null
    }

    throw "Unexpected single-record entity set in test double: $EntitySetName"
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'missing the corresponding powerpagesite row' `
    -Message 'Missing powerpagesite row should fail with an external provisioning prerequisite message.'

Set-DbmHappyPathSiteContextMocks
$script:MockInvokeDataverseQuery = {
    param(
        [string]$DataverseUrl,
        [string]$AccessToken,
        [string]$EntitySetName,
        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [int]$Top
    )

    switch ($EntitySetName) {
        'mspp_publishingstates' { return @() }
        'powerpagesitelanguages' {
            return @(
                [pscustomobject]@{
                    powerpagesitelanguageid = '55555555-5555-5555-5555-555555555555'
                    name = 'English'
                    displayname = 'English'
                    languagecode = 'en-US'
                    lcid = 1033
                    _powerpagesiteid_value = '44444444-4444-4444-4444-444444444444'
                }
            )
        }
        default {
            throw "Unexpected Dataverse query entity set in test double: $EntitySetName"
        }
    }
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'does not have any publishing states' `
    -Message 'Missing publishing states should fail before any apply.'

Set-DbmHappyPathSiteContextMocks
$script:MockInvokeDataverseRequest = {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccessToken,
        [object]$Body,
        [byte[]]$BinaryBody,
        [string]$ContentType,
        [hashtable]$AdditionalHeaders,
        [switch]$ReturnRawResponse
    )

    switch -Regex ($Uri) {
        'mspp_websites\(' {
            return [pscustomobject]@{
                mspp_websiteid = '11111111-1111-1111-1111-111111111111'
                mspp_name = 'DBM Dev Portal'
                mspp_primarydomainname = 'dbm-dev.powerappsportals.com'
                _mspp_defaultlanguage_value = ''
            }
        }
        'mspp_websitelanguages\(' {
            return [pscustomobject]@{
                mspp_websitelanguageid = '22222222-2222-2222-2222-222222222222'
                mspp_name = 'English'
                mspp_displayname = 'English'
                mspp_languagecode = 'en-US'
                mspp_lcid = 1033
            }
        }
        default {
            throw "Unexpected Dataverse request URI in test double: $Uri"
        }
    }
}
Assert-DbmThrowsLike `
    -Action { Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token' | Out-Null } `
    -Pattern 'missing mspp_defaultlanguage' `
    -Message 'Missing website default language should fail before any apply.'

Set-DbmHappyPathSiteContextMocks
$resolvedSiteContext = Resolve-DbmPowerPagesSiteContext -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev -AccessToken 'test-token'
Assert-DbmCondition -Condition ($resolvedSiteContext.WebsiteId -eq '11111111-1111-1111-1111-111111111111') -Message 'Resolved site context did not preserve the configured website id.'
Assert-DbmCondition -Condition ([string]$resolvedSiteContext.SiteOrigin -eq 'https://dbm-dev.powerappsportals.com') -Message 'Resolved site context did not derive the expected site origin.'

Write-Host 'R3 portal runtime automation validation passed.'
