[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string[]]$EnvironmentName = @('Dev', 'UAT', 'Prod'),

    [string]$DataverseUrl = $env:DATAVERSE_URL,
    [string]$DataverseEnvironmentId = $env:DATAVERSE_ENVIRONMENT_ID,
    [string]$AzureClientId = $env:AZURE_CLIENT_ID,
    [string]$AzureTenantId = $env:AZURE_TENANT_ID,
    [string]$AzureKeyVaultName = $env:AZURE_KEYVAULT_NAME,
    [string]$AzureResourceGroup = $env:AZURE_RESOURCE_GROUP,
    [string]$DbmSolutionName = $env:DBM_SOLUTION_NAME,

    [switch]$RequireEnvironmentVariables,
    [switch]$AsJson,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Normalize-DbmText {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value.Trim()
}

function Normalize-DbmLowerText {
    param(
        [string]$Value
    )

    $normalized = Normalize-DbmText -Value $Value
    if ($null -eq $normalized) {
        return $null
    }

    return $normalized.ToLowerInvariant()
}

function Normalize-DbmUrl {
    param(
        [string]$Value
    )

    $normalized = Normalize-DbmText -Value $Value
    if ($null -eq $normalized) {
        return $null
    }

    return $normalized.TrimEnd('/')
}

function Assert-RequiredValue {
    param(
        [string]$Value,
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Required environment baseline value is missing: $Label"
    }
}

function Assert-PositiveIntegerValue {
    param(
        [object]$Value,
        [string]$Label
    )

    if ($null -eq $Value) {
        throw "Required environment baseline value is missing: $Label"
    }

    $parsed = 0
    if (-not [int]::TryParse([string]$Value, [ref]$parsed) -or $parsed -le 0) {
        throw "Required environment baseline value must be a positive integer: $Label"
    }
}

function Assert-ArrayValue {
    param(
        [object]$Value,
        [string]$Label
    )

    if ($null -eq $Value) {
        throw "Required environment baseline array is missing: $Label"
    }

    if (-not ($Value -is [System.Collections.IEnumerable])) {
        throw "Required environment baseline value must be an array: $Label"
    }
}

function Assert-Match {
    param(
        [string]$Expected,
        [string]$Actual,
        [string]$Label,
        [scriptblock]$Normalizer
    )

    $expectedValue = & $Normalizer $Expected
    $actualValue = & $Normalizer $Actual

    if ($expectedValue -ne $actualValue) {
        throw "$Label does not match the tracked baseline. Expected '$Expected' but found '$Actual'."
    }
}

function Get-DbmRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $resolvedBasePath = (Resolve-Path $BasePath).Path.TrimEnd('\')
    $resolvedTargetPath = (Resolve-Path $TargetPath).Path

    if ($resolvedTargetPath.StartsWith($resolvedBasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $resolvedTargetPath.Substring($resolvedBasePath.Length).TrimStart('\')
    }

    return $resolvedTargetPath
}

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$selectedEnvironments = @($EnvironmentName)
$results = @()

foreach ($name in $selectedEnvironments) {
    $configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $name.ToLowerInvariant())
    if (-not (Test-Path $configPath)) {
        throw "Environment baseline file is missing: $configPath"
    }

    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json

    $requiredConfigValues = [ordered]@{
        environment = [string]$config.environment
        deploymentMode = [string]$config.deploymentMode
        dataverseUrl = [string]$config.dataverseUrl
        dataverseEnvironmentId = [string]$config.dataverseEnvironmentId
        modelDrivenAppUrl = [string]$config.modelDrivenAppUrl
        azureClientId = [string]$config.azureClientId
        azureTenantId = [string]$config.azureTenantId
        resourceGroup = [string]$config.resourceGroup
        keyVaultName = [string]$config.keyVaultName
    }

    foreach ($item in $requiredConfigValues.GetEnumerator()) {
        Assert-RequiredValue -Value $item.Value -Label "$name.$($item.Key)"
    }

    if ($config.environment -ne $name) {
        throw "Environment baseline file '$configPath' declares environment '$($config.environment)' instead of '$name'."
    }

    if ($null -eq $config.liveE2E) {
        throw "Environment baseline file '$configPath' is missing the liveE2E configuration block."
    }

    Assert-ArrayValue -Value $config.liveE2E.enabledModes -Label "$name.liveE2E.enabledModes"
    Assert-RequiredValue -Value ([string]$config.liveE2E.lock.webResourceName) -Label "$name.liveE2E.lock.webResourceName"
    Assert-PositiveIntegerValue -Value $config.liveE2E.lock.staleAfterMinutes -Label "$name.liveE2E.lock.staleAfterMinutes"
    Assert-RequiredValue -Value ([string]$config.liveE2E.cleanup.namePrefix) -Label "$name.liveE2E.cleanup.namePrefix"
    Assert-PositiveIntegerValue -Value $config.liveE2E.cleanup.orphanAgeHours -Label "$name.liveE2E.cleanup.orphanAgeHours"

    if ($null -eq $config.liveE2E.authentication) {
        throw "Environment baseline file '$configPath' is missing liveE2E.authentication."
    }

    Assert-RequiredValue -Value ([string]$config.liveE2E.authentication.mode) -Label "$name.liveE2E.authentication.mode"
    Assert-RequiredValue -Value ([string]$config.liveE2E.authentication.sessionScope) -Label "$name.liveE2E.authentication.sessionScope"
    Assert-RequiredValue -Value ([string]$config.liveE2E.authentication.identityModel) -Label "$name.liveE2E.authentication.identityModel"
    Assert-RequiredValue -Value ([string]$config.liveE2E.authentication.sessionUserDisplayName) -Label "$name.liveE2E.authentication.sessionUserDisplayName"

    foreach ($caseSetName in @('full', 'promotion')) {
        $caseSetProperty = $config.liveE2E.caseSets.PSObject.Properties[$caseSetName]
        if ($null -eq $caseSetProperty) {
            throw "Environment baseline file '$configPath' is missing live E2E case set '$caseSetName'."
        }

        $caseSet = @($caseSetProperty.Value)
        if ($caseSet.Count -eq 0) {
            throw "Environment baseline file '$configPath' is missing live E2E case set '$caseSetName'."
        }
    }

    if ($null -eq $config.liveE2E.entities) {
        throw "Environment baseline file '$configPath' is missing live E2E entities."
    }

    foreach ($entityProperty in $config.liveE2E.entities.PSObject.Properties) {
        Assert-RequiredValue -Value ([string]$entityProperty.Value.logicalName) -Label "$name.liveE2E.entities.$($entityProperty.Name).logicalName"
        Assert-RequiredValue -Value ([string]$entityProperty.Value.entitySetName) -Label "$name.liveE2E.entities.$($entityProperty.Name).entitySetName"
        Assert-RequiredValue -Value ([string]$entityProperty.Value.primaryIdField) -Label "$name.liveE2E.entities.$($entityProperty.Name).primaryIdField"
        Assert-RequiredValue -Value ([string]$entityProperty.Value.primaryNameField) -Label "$name.liveE2E.entities.$($entityProperty.Name).primaryNameField"

        $stateFieldsProperty = $entityProperty.Value.PSObject.Properties['stateFields']
        if ($null -ne $stateFieldsProperty -and $null -ne $stateFieldsProperty.Value) {
            foreach ($stateFieldName in @('stageIdField', 'stepIdField', 'internalStatusField', 'portalStatusField')) {
                Assert-RequiredValue -Value ([string]$stateFieldsProperty.Value.$stateFieldName) -Label "$name.liveE2E.entities.$($entityProperty.Name).stateFields.$stateFieldName"
            }
        }
    }

    $result = [ordered]@{
        environment = $name
        configPath = Get-DbmRelativePath -BasePath $RepoRoot -TargetPath $configPath
        deploymentMode = [string]$config.deploymentMode
        dataverseUrl = [string]$config.dataverseUrl
        dataverseEnvironmentId = [string]$config.dataverseEnvironmentId
        modelDrivenAppUrl = [string]$config.modelDrivenAppUrl
        azureClientId = [string]$config.azureClientId
        azureTenantId = [string]$config.azureTenantId
        azureResourceGroup = [string]$config.resourceGroup
        azureKeyVaultName = [string]$config.keyVaultName
        liveE2ELockWebResourceName = [string]$config.liveE2E.lock.webResourceName
        liveE2EAuthenticationMode = [string]$config.liveE2E.authentication.mode
        liveE2EIdentityModel = [string]$config.liveE2E.authentication.identityModel
        dbmSolutionName = [string]$version.solutionName
        dbmGeneratedMetadataSolutionName = [string]$version.solutionNames.generatedMetadata
    }

    if ($selectedEnvironments.Count -eq 1) {
        if ($RequireEnvironmentVariables) {
            $requiredEnvironmentValues = [ordered]@{
                DATAVERSE_URL = $DataverseUrl
                DATAVERSE_ENVIRONMENT_ID = $DataverseEnvironmentId
                AZURE_CLIENT_ID = $AzureClientId
                AZURE_TENANT_ID = $AzureTenantId
                AZURE_KEYVAULT_NAME = $AzureKeyVaultName
                AZURE_RESOURCE_GROUP = $AzureResourceGroup
                DBM_SOLUTION_NAME = $DbmSolutionName
            }

            foreach ($item in $requiredEnvironmentValues.GetEnumerator()) {
                Assert-RequiredValue -Value $item.Value -Label $item.Key
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($DataverseUrl)) {
            Assert-Match -Expected $config.dataverseUrl -Actual $DataverseUrl -Label 'DATAVERSE_URL' -Normalizer ${function:Normalize-DbmUrl}
        }

        if (-not [string]::IsNullOrWhiteSpace($DataverseEnvironmentId)) {
            Assert-Match -Expected $config.dataverseEnvironmentId -Actual $DataverseEnvironmentId -Label 'DATAVERSE_ENVIRONMENT_ID' -Normalizer ${function:Normalize-DbmLowerText}
        }

        if (-not [string]::IsNullOrWhiteSpace($AzureClientId)) {
            Assert-Match -Expected $config.azureClientId -Actual $AzureClientId -Label 'AZURE_CLIENT_ID' -Normalizer ${function:Normalize-DbmLowerText}
        }

        if (-not [string]::IsNullOrWhiteSpace($AzureTenantId)) {
            Assert-Match -Expected $config.azureTenantId -Actual $AzureTenantId -Label 'AZURE_TENANT_ID' -Normalizer ${function:Normalize-DbmLowerText}
        }

        if (-not [string]::IsNullOrWhiteSpace($AzureKeyVaultName)) {
            Assert-Match -Expected $config.keyVaultName -Actual $AzureKeyVaultName -Label 'AZURE_KEYVAULT_NAME' -Normalizer ${function:Normalize-DbmLowerText}
        }

        if (-not [string]::IsNullOrWhiteSpace($AzureResourceGroup)) {
            Assert-Match -Expected $config.resourceGroup -Actual $AzureResourceGroup -Label 'AZURE_RESOURCE_GROUP' -Normalizer ${function:Normalize-DbmLowerText}
        }

        if (-not [string]::IsNullOrWhiteSpace($DbmSolutionName)) {
            Assert-Match -Expected $version.solutionName -Actual $DbmSolutionName -Label 'DBM_SOLUTION_NAME' -Normalizer ${function:Normalize-DbmLowerText}
        }
    }

    Write-Host "Validated tracked environment baseline for '$name'."
    $results += [pscustomobject]$result
}

$duplicateUrls = $results | Group-Object dataverseUrl | Where-Object { $_.Count -gt 1 }
if ($duplicateUrls) {
    $values = $duplicateUrls | ForEach-Object { $_.Name }
    throw "Tracked environment baseline contains duplicate Dataverse URLs: $($values -join ', ')"
}

$duplicateEnvironmentIds = $results | Group-Object dataverseEnvironmentId | Where-Object { $_.Count -gt 1 }
if ($duplicateEnvironmentIds) {
    $values = $duplicateEnvironmentIds | ForEach-Object { $_.Name }
    throw "Tracked environment baseline contains duplicate Dataverse environment IDs: $($values -join ', ')"
}

$payload = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    solutionName = [string]$version.solutionName
    solutionNames = [ordered]@{
        core = [string]$version.solutionNames.core
        generatedMetadata = [string]$version.solutionNames.generatedMetadata
    }
    environments = $results
}

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputDirectory = Split-Path -Path $OutputPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $payload | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8
    Write-Host "Environment baseline evidence: $OutputPath"
}

if ($AsJson) {
    $payload | ConvertTo-Json -Depth 6
    return
}

$results | ForEach-Object {
    "environment=$($_.environment)"
    "configPath=$($_.configPath)"
    "dataverseUrl=$($_.dataverseUrl)"
    "dataverseEnvironmentId=$($_.dataverseEnvironmentId)"
    "modelDrivenAppUrl=$($_.modelDrivenAppUrl)"
    "azureClientId=$($_.azureClientId)"
    "azureTenantId=$($_.azureTenantId)"
    "azureResourceGroup=$($_.azureResourceGroup)"
    "azureKeyVaultName=$($_.azureKeyVaultName)"
    "liveE2ELockWebResourceName=$($_.liveE2ELockWebResourceName)"
    "liveE2EAuthenticationMode=$($_.liveE2EAuthenticationMode)"
    "liveE2EIdentityModel=$($_.liveE2EIdentityModel)"
    "dbmSolutionName=$($_.dbmSolutionName)"
    "dbmGeneratedMetadataSolutionName=$($_.dbmGeneratedMetadataSolutionName)"
}
