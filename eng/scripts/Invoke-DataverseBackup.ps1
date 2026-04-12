[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$ArtifactVersion,

    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$EvidenceRoot,
    [string]$SecretName = 'powerplatform-admin-client-secret',
    [int]$DiscoveryTimeoutMinutes = 15,
    [int]$PollIntervalSeconds = 20
)

$ErrorActionPreference = 'Stop'

function Get-DbmRequiredConfigValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $property = $Config.PSObject.Properties[$PropertyName]
    if (-not $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        throw "Tracked environment baseline value '$Label' is missing."
    }

    return [string]$property.Value
}

function Get-DbmPropertyValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$InputObject,

        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $property = $InputObject.PSObject.Properties[$name]
        if ($property) {
            return [string]$property.Value
        }
    }

    return $null
}

function Resolve-DbmEnvironmentConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT', 'Prod')]
        [string]$TargetEnvironment
    )

    $configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    if (-not (Test-Path $configPath)) {
        throw "Tracked environment baseline file is missing: $configPath"
    }

    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    $declaredEnvironment = Get-DbmRequiredConfigValue -Config $config -PropertyName 'environment' -Label "$TargetEnvironment.environment"
    if ($declaredEnvironment -ne $TargetEnvironment) {
        throw "Tracked environment baseline file '$configPath' declares environment '$declaredEnvironment' instead of '$TargetEnvironment'."
    }

    return [pscustomobject]@{
        ConfigPath = $configPath
        Environment = $declaredEnvironment
        DataverseUrl = Get-DbmRequiredConfigValue -Config $config -PropertyName 'dataverseUrl' -Label "$TargetEnvironment.dataverseUrl"
        DataverseEnvironmentId = Get-DbmRequiredConfigValue -Config $config -PropertyName 'dataverseEnvironmentId' -Label "$TargetEnvironment.dataverseEnvironmentId"
        AzureClientId = Get-DbmRequiredConfigValue -Config $config -PropertyName 'azureClientId' -Label "$TargetEnvironment.azureClientId"
        AzureTenantId = Get-DbmRequiredConfigValue -Config $config -PropertyName 'azureTenantId' -Label "$TargetEnvironment.azureTenantId"
        KeyVaultName = Get-DbmRequiredConfigValue -Config $config -PropertyName 'keyVaultName' -Label "$TargetEnvironment.keyVaultName"
    }
}

function Resolve-DbmAzureCliPath {
    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available on PATH to fetch the Dataverse backup secret from Key Vault.'
    }

    return $az.Source
}

function Get-DbmKeyVaultSecretValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AzPath,

        [Parameter(Mandatory = $true)]
        [string]$KeyVaultName,

        [Parameter(Mandatory = $true)]
        [string]$SecretName
    )

    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
    try {
        $value = & $AzPath keyvault secret show --vault-name $KeyVaultName --name $SecretName --query value -o tsv 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }

    $outputText = (@($value) | Out-String).Trim()
    if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($outputText)) {
        throw "Failed to read Key Vault secret '$SecretName' from '$KeyVaultName'. Confirm Azure CLI is signed in and the current identity can read that secret."
    }

    return $outputText
}

function Connect-DbmPowerAppsAdmin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TenantId,

        [Parameter(Mandatory = $true)]
        [string]$ApplicationId,

        [Parameter(Mandatory = $true)]
        [string]$ClientSecret
    )

    Import-Module Microsoft.PowerApps.Administration.PowerShell -ErrorAction Stop
    Add-PowerAppsAccount -Endpoint 'prod' -TenantID $TenantId -ApplicationId $ApplicationId -ClientSecret $ClientSecret | Out-Null
}

function New-DbmBackupLabel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$ArtifactVersion
    )

    $environmentSegment = $TargetEnvironment.ToLowerInvariant()
    $versionSegment = ($ArtifactVersion -replace '[^0-9A-Za-z]+', '-').Trim('-')
    $runSegment = if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_RUN_ID)) {
        "run$($env:GITHUB_RUN_ID)"
    }
    else {
        "utc$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
    }

    $label = "dbm-$environmentSegment-$versionSegment-$runSegment"
    if ($label.Length -gt 80) {
        return $label.Substring(0, 80).TrimEnd('-')
    }

    return $label
}

$environmentConfig = Resolve-DbmEnvironmentConfig -RepoRoot $RepoRoot -TargetEnvironment $TargetEnvironment
$azPath = Resolve-DbmAzureCliPath

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot ("artifacts\backup-evidence\{0}-{1}" -f $TargetEnvironment.ToLowerInvariant(), $timestamp)
}

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

$clientSecret = Get-DbmKeyVaultSecretValue -AzPath $azPath -KeyVaultName $environmentConfig.KeyVaultName -SecretName $SecretName
Connect-DbmPowerAppsAdmin -TenantId $environmentConfig.AzureTenantId -ApplicationId $environmentConfig.AzureClientId -ClientSecret $clientSecret

$backupLabel = New-DbmBackupLabel -TargetEnvironment $TargetEnvironment -ArtifactVersion $ArtifactVersion
$backupNotes = "DBM $TargetEnvironment pre-deployment backup for artifact $ArtifactVersion"
$requestedUtc = (Get-Date).ToUniversalTime().ToString('o')

$backupRequest = [pscustomobject]@{
    Label = $backupLabel
    Notes = $backupNotes
}

Write-Host "Requesting Dataverse backup '$backupLabel' for '$TargetEnvironment' using environment '$($environmentConfig.DataverseEnvironmentId)'."
Backup-PowerAppEnvironment -EnvironmentName $environmentConfig.DataverseEnvironmentId -BackupRequestDefinition $backupRequest | Out-Host

$matchedBackup = $null
$backups = @()
$deadline = (Get-Date).AddMinutes($DiscoveryTimeoutMinutes)

do {
    $backups = @(Get-PowerAppEnvironmentBackups -EnvironmentName $environmentConfig.DataverseEnvironmentId)

    $matchedBackup = $backups | Where-Object {
        $label = Get-DbmPropertyValue -InputObject $_ -Names @('displayName', 'DisplayName', 'label', 'Label', 'name', 'Name')
        $label -eq $backupLabel
    } | Select-Object -First 1

    if ($matchedBackup) {
        break
    }

    if ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $PollIntervalSeconds
    }
} while ((Get-Date) -lt $deadline)

if (-not $matchedBackup) {
    throw "Backup '$backupLabel' was requested but did not appear in the environment backup list within $DiscoveryTimeoutMinutes minute(s)."
}

$backupId = Get-DbmPropertyValue -InputObject $matchedBackup -Names @('id', 'Id', 'backupId', 'BackupId')
$backupPointDate = Get-DbmPropertyValue -InputObject $matchedBackup -Names @('createdTime', 'CreatedTime', 'backupPointDateTime', 'BackupPointDateTime')
$backupExpiry = Get-DbmPropertyValue -InputObject $matchedBackup -Names @('expirationDate', 'ExpirationDate', 'expirationDateTime', 'ExpirationDateTime')
$discoveredUtc = (Get-Date).ToUniversalTime().ToString('o')

$reference = [ordered]@{
    generatedUtc = $discoveredUtc
    requestedUtc = $requestedUtc
    targetEnvironment = $TargetEnvironment
    artifactVersion = $ArtifactVersion
    dataverseUrl = $environmentConfig.DataverseUrl
    dataverseEnvironmentId = $environmentConfig.DataverseEnvironmentId
    azureClientId = $environmentConfig.AzureClientId
    azureTenantId = $environmentConfig.AzureTenantId
    keyVaultName = $environmentConfig.KeyVaultName
    keyVaultSecretName = $SecretName
    configPath = $environmentConfig.ConfigPath
    backupLabel = $backupLabel
    backupNotes = $backupNotes
    backupId = $backupId
    backupPointDate = $backupPointDate
    backupExpiry = $backupExpiry
    gitRef = $env:GITHUB_REF
    workflowRunId = $env:GITHUB_RUN_ID
}

$referencePath = Join-Path $EvidenceRoot 'backup-reference.json'
$summaryPath = Join-Path $EvidenceRoot 'backup-summary.md'
$listPath = Join-Path $EvidenceRoot 'backup-list.json'

$reference | ConvertTo-Json -Depth 5 | Set-Content -Path $referencePath -Encoding UTF8
$backups | ConvertTo-Json -Depth 10 | Set-Content -Path $listPath -Encoding UTF8

$summaryLines = @(
    '# Dataverse Backup Summary',
    '',
    "- Environment: $TargetEnvironment",
    "- Dataverse URL: $($environmentConfig.DataverseUrl)",
    "- Dataverse environment ID: $($environmentConfig.DataverseEnvironmentId)",
    "- Artifact version: $ArtifactVersion",
    "- Backup label: $backupLabel",
    "- Backup ID: $backupId",
    "- Backup point date: $backupPointDate",
    "- Backup expiry: $backupExpiry",
    "- Key Vault: $($environmentConfig.KeyVaultName)",
    "- Secret name: $SecretName",
    "- Requested UTC: $requestedUtc",
    "- Recorded UTC: $discoveredUtc"
)

$summaryLines | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Dataverse backup evidence: $referencePath"
Write-Host "Dataverse backup summary: $summaryPath"
Write-Host "Dataverse backup label: $backupLabel"
