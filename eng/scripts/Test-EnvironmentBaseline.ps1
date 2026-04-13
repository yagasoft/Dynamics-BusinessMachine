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

    $result = [ordered]@{
        environment = $name
        configPath = Get-DbmRelativePath -BasePath $RepoRoot -TargetPath $configPath
        deploymentMode = [string]$config.deploymentMode
        dataverseUrl = [string]$config.dataverseUrl
        dataverseEnvironmentId = [string]$config.dataverseEnvironmentId
        azureClientId = [string]$config.azureClientId
        azureTenantId = [string]$config.azureTenantId
        azureResourceGroup = [string]$config.resourceGroup
        azureKeyVaultName = [string]$config.keyVaultName
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
    "azureClientId=$($_.azureClientId)"
    "azureTenantId=$($_.azureTenantId)"
    "azureResourceGroup=$($_.azureResourceGroup)"
    "azureKeyVaultName=$($_.azureKeyVaultName)"
    "dbmSolutionName=$($_.dbmSolutionName)"
    "dbmGeneratedMetadataSolutionName=$($_.dbmGeneratedMetadataSolutionName)"
}
