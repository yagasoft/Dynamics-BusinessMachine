[CmdletBinding()]
param(
    [string]$RepoRoot,

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment = 'Dev',

    [ValidateSet('full', 'promotion')]
    [string]$CaseSet,

    [string[]]$CaseIds,

    [string]$EvidenceRoot,

    [switch]$ValidateOnly,
    [switch]$SessionHealthOnly,
    [switch]$CleanupOrphansOnly,
    [switch]$PreserveOnFailure,
    [switch]$InteractiveLogin,
    [switch]$AllowStaleLockRecovery
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot 'artifacts\live-e2e'
}

. (Join-Path $PSScriptRoot 'DbmLiveE2ESession.Common.ps1')

function Get-DbmRequiredConfigValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($null -eq $Value) {
        throw "Missing required live E2E configuration value: $Label"
    }

    if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required live E2E configuration value: $Label"
    }

    return $Value
}

function Get-DbmLiveConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT', 'Prod')]
        [string]$TargetEnvironment
    )

    $configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json

    Get-DbmRequiredConfigValue -Value $config.modelDrivenAppUrl -Label "$TargetEnvironment.modelDrivenAppUrl" | Out-Null
    Get-DbmRequiredConfigValue -Value $config.liveE2E -Label "$TargetEnvironment.liveE2E" | Out-Null
    Get-DbmRequiredConfigValue -Value $config.liveE2E.lock.webResourceName -Label "$TargetEnvironment.liveE2E.lock.webResourceName" | Out-Null
    Get-DbmRequiredConfigValue -Value $config.liveE2E.cleanup.namePrefix -Label "$TargetEnvironment.liveE2E.cleanup.namePrefix" | Out-Null
    Get-DbmRequiredConfigValue -Value $config.liveE2E.caseSets.full -Label "$TargetEnvironment.liveE2E.caseSets.full" | Out-Null
    Get-DbmRequiredConfigValue -Value $config.liveE2E.caseSets.promotion -Label "$TargetEnvironment.liveE2E.caseSets.promotion" | Out-Null
    Assert-DbmPersistedSessionConfig -Config $config -TargetEnvironment $TargetEnvironment

    return [pscustomobject]@{
        Path = $configPath
        Value = $config
    }
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
        throw 'Azure CLI must be available to run connected live E2E tests.'
    }

    $resource = $DataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'. Run 'az login' first or use the GitHub OIDC workflow path."
    }

    return $token.Trim()
}

function Get-DbmDataverseEntityMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$LogicalName
    )

    $escapedLogicalName = $LogicalName.Replace("'", "''")
    $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)/EntityDefinitions(LogicalName='$escapedLogicalName')?`$select=LogicalName,SchemaName,EntitySetName"

    try {
        return Invoke-DbmDataverseRequest -Method GET -Uri $uri -AccessToken $AccessToken
    }
    catch {
        $details = $_.ErrorDetails.Message
        if ($details -and $details -match 'does not exist') {
            return $null
        }

        if ($_.Exception.Message -match '\(404\) Not Found') {
            return $null
        }

        throw "Failed to resolve Dataverse entity metadata for logical name '$LogicalName': $($_.Exception.Message)"
    }
}

function Assert-DbmConfiguredLiveEntitiesExist {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $issues = @()

    foreach ($entityProperty in $Config.liveE2E.entities.PSObject.Properties) {
        $entityAlias = [string]$entityProperty.Name
        $entityConfig = $entityProperty.Value
        $logicalName = [string]$entityConfig.logicalName
        if ([string]::IsNullOrWhiteSpace($logicalName)) {
            $issues += "Entity alias '$entityAlias' is missing a logicalName in the tracked live E2E config."
            continue
        }

        $metadata = Get-DbmDataverseEntityMetadata -DataverseUrl ([string]$Config.dataverseUrl) -AccessToken $AccessToken -LogicalName $logicalName
        if ($null -eq $metadata) {
            $issues += "Entity alias '$entityAlias' targets logical name '$logicalName', but that Dataverse table does not exist in '$([string]$Config.environment)'. Deploy the required table or correct azure/config/$(([string]$Config.environment).ToLowerInvariant()).json before running connected live E2E."
            continue
        }

        $expectedEntitySetName = [string]$entityConfig.entitySetName
        $actualEntitySetName = [string]$metadata.EntitySetName
        if (-not [string]::IsNullOrWhiteSpace($expectedEntitySetName) -and $expectedEntitySetName -ne $actualEntitySetName) {
            $issues += "Entity alias '$entityAlias' expects entity set '$expectedEntitySetName', but Dataverse reports '$actualEntitySetName' for logical name '$logicalName'."
        }
    }

    if ($issues.Count -gt 0) {
        throw "Connected live E2E readiness failed: $($issues -join ' ')"
    }
}

function Invoke-DbmDataverseRequest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'POST', 'DELETE')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [object]$Body
    )

    $headers = @{
        Authorization = "Bearer $AccessToken"
        Accept = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    }

    if ($Method -eq 'POST') {
        $headers['Content-Type'] = 'application/json'
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10)
    }

    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

function ConvertTo-DbmBase64Json {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value
    )

    $json = $Value | ConvertTo-Json -Depth 10 -Compress
    return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
}

function ConvertFrom-DbmBase64JsonOrNull {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    try {
        $bytes = [Convert]::FromBase64String($Value)
        $json = [Text.Encoding]::UTF8.GetString($bytes)
        return $json | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Get-DbmLiveLockRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$WebResourceName
    )

    $escapedName = $WebResourceName.Replace("'", "''")
    $filter = [System.Uri]::EscapeDataString("name eq '$escapedName'")
    $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)/webresourceset?`$select=webresourceid,name,content,modifiedon&`$filter=$filter"
    $response = Invoke-DbmDataverseRequest -Method GET -Uri $uri -AccessToken $AccessToken
    return @($response.value) | Select-Object -First 1
}

function Remove-DbmLiveLockRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$WebResourceId
    )

    $normalizedId = ([guid]$WebResourceId).Guid
    $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)/webresourceset($normalizedId)"
    Invoke-DbmDataverseRequest -Method DELETE -Uri $uri -AccessToken $AccessToken | Out-Null
}

function Acquire-DbmLiveLock {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$WebResourceName,

        [Parameter(Mandatory = $true)]
        [int]$StaleAfterMinutes,

        [Parameter(Mandatory = $true)]
        [string]$RunId,

        [switch]$AllowStaleLockRecovery
    )

    $existing = Get-DbmLiveLockRecord -DataverseUrl $DataverseUrl -AccessToken $AccessToken -WebResourceName $WebResourceName
    if ($existing) {
        $lockPayload = ConvertFrom-DbmBase64JsonOrNull -Value ([string]$existing.content)
        $acquiredUtc = if ($lockPayload.acquiredUtc) { [datetime]$lockPayload.acquiredUtc } else { [datetime]::MinValue }
        $expiresUtc = if ($lockPayload.expiresUtc) { [datetime]$lockPayload.expiresUtc } else { $acquiredUtc.AddMinutes($StaleAfterMinutes) }
        $isStale = $expiresUtc -lt (Get-Date).ToUniversalTime()

        if (-not $isStale) {
            throw "Live E2E lock '$WebResourceName' is already held for '$TargetEnvironment' by '$($lockPayload.holder)' until '$($expiresUtc.ToString('o'))'."
        }

        if (-not $AllowStaleLockRecovery) {
            throw "Live E2E lock '$WebResourceName' is stale for '$TargetEnvironment'. Re-run with -AllowStaleLockRecovery after confirming the previous run is dead."
        }

        Write-Warning "Removing stale live E2E lock '$WebResourceName' for '$TargetEnvironment'."
        Remove-DbmLiveLockRecord -DataverseUrl $DataverseUrl -AccessToken $AccessToken -WebResourceId ([string]$existing.webresourceid)
    }

    $lockPayload = [ordered]@{
        runId = $RunId
        environment = $TargetEnvironment
        holder = "$env:COMPUTERNAME::$env:USERNAME"
        acquiredUtc = (Get-Date).ToUniversalTime().ToString('o')
        expiresUtc = (Get-Date).ToUniversalTime().AddMinutes($StaleAfterMinutes).ToString('o')
    }

    $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)/webresourceset"
    Invoke-DbmDataverseRequest -Method POST -Uri $uri -AccessToken $AccessToken -Body @{
        displayname = "DBM Live E2E Lock - $TargetEnvironment"
        name = $WebResourceName
        webresourcetype = 3
        content = (ConvertTo-DbmBase64Json -Value $lockPayload)
    } | Out-Null

    $created = Get-DbmLiveLockRecord -DataverseUrl $DataverseUrl -AccessToken $AccessToken -WebResourceName $WebResourceName
    if (-not $created -or [string]::IsNullOrWhiteSpace([string]$created.webresourceid)) {
        throw "Failed to resolve the Dataverse live E2E lock record '$WebResourceName' after creation."
    }

    return [pscustomobject]@{
        webresourceid = [string]$created.webresourceid
        name = $WebResourceName
        payload = $lockPayload
    }
}

function Clear-DbmLiveE2EOrphans {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $deleted = @()
    $threshold = (Get-Date).ToUniversalTime().AddHours(-1 * [int]$Config.liveE2E.cleanup.orphanAgeHours).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $prefix = [string]$Config.liveE2E.cleanup.namePrefix

    foreach ($entityProperty in $Config.liveE2E.entities.PSObject.Properties) {
        $entity = $entityProperty.Value
        if ([string]::IsNullOrWhiteSpace([string]$entity.primaryNameField)) {
            continue
        }

        $filter = [System.Uri]::EscapeDataString("startswith($($entity.primaryNameField),'$prefix') and createdon lt $threshold")
        $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl ([string]$Config.dataverseUrl))/$($entity.entitySetName)?`$select=$($entity.primaryIdField),$($entity.primaryNameField),createdon&`$filter=$filter"
        $response = Invoke-DbmDataverseRequest -Method GET -Uri $uri -AccessToken $AccessToken

        foreach ($record in @($response.value)) {
            $recordId = [string]$record.$($entity.primaryIdField)
            if ([string]::IsNullOrWhiteSpace($recordId)) {
                continue
            }

            $normalizedId = ([guid]$recordId).Guid
            $deleteUri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl ([string]$Config.dataverseUrl))/$($entity.entitySetName)($normalizedId)"
            Invoke-DbmDataverseRequest -Method DELETE -Uri $deleteUri -AccessToken $AccessToken | Out-Null
            $deleted += [pscustomobject]@{
                entityAlias = $entityProperty.Name
                id = $normalizedId
            }
        }
    }

    return $deleted
}

function Invoke-DbmNpmCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    Push-Location $WorkingDirectory
    try {
        Write-Host "Running '$Command' in $WorkingDirectory"
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $Command"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-DbmNpmArguments {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        Write-Host "Running 'npm $($Arguments -join ' ')' in $WorkingDirectory"
        & npm @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: npm $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-DbmTsxScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        $nodePath = (Get-Command node -ErrorAction Stop).Source
        $tsxCliPath = Join-Path $WorkingDirectory 'node_modules\tsx\dist\cli.mjs'
        if (-not (Test-Path $tsxCliPath)) {
            throw "TSX CLI entrypoint is missing: $tsxCliPath. Run 'npm ci' first."
        }

        Write-Host "Running 'tsx $ScriptPath $($Arguments -join ' ')' in $WorkingDirectory"
        & $nodePath $tsxCliPath $ScriptPath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: tsx $ScriptPath $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-DbmLiveSessionRuntimeState {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$RunRoot
    )

    $sessionPaths = Get-DbmLiveSessionPaths -TargetEnvironment $TargetEnvironment
    if (-not (Test-Path $sessionPaths.ProtectedStatePath)) {
        throw "Persisted browser session for '$TargetEnvironment' is missing. Re-run 'eng/scripts/Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment $TargetEnvironment'."
    }

    $metadata = Read-DbmLiveSessionMetadata -MetadataPath $sessionPaths.MetadataPath
    if ($null -eq $metadata) {
        throw "Persisted browser session metadata for '$TargetEnvironment' is missing. Re-run 'eng/scripts/Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment $TargetEnvironment'."
    }

    $issues = @(Test-DbmLiveSessionMetadataShape -Metadata $metadata -TargetEnvironment $TargetEnvironment -ModelDrivenAppUrl ([string]$Config.modelDrivenAppUrl))
    if ($issues.Count -gt 0) {
        throw "Persisted browser session metadata for '$TargetEnvironment' is invalid: $($issues -join ' ') Re-run 'eng/scripts/Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment $TargetEnvironment'."
    }

    $sessionRoot = Join-Path $RunRoot 'session'
    New-Item -ItemType Directory -Path $sessionRoot -Force | Out-Null

    return [pscustomobject]@{
        Paths = $sessionPaths
        Metadata = $metadata
        DecryptedStatePath = Join-Path $sessionRoot 'storage-state.decrypted.json'
        RefreshedStatePath = Join-Path $sessionRoot 'storage-state.refreshed.json'
        HealthEvidencePath = Join-Path $sessionRoot 'session-health.json'
    }
}

function Update-DbmLiveSessionMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [object]$SessionState,

        [Parameter(Mandatory = $true)]
        [string]$HealthStatus,

        [switch]$MarkSuccessfulUse,
        [switch]$MarkRefresh
    )

    $metadata = [ordered]@{}
    foreach ($property in $SessionState.Metadata.PSObject.Properties) {
        $metadata[$property.Name] = $property.Value
    }

    $now = (Get-Date).ToUniversalTime().ToString('o')
    $metadata['lastHealthCheckUtc'] = $now
    $metadata['sessionHealthStatus'] = $HealthStatus

    if ($MarkSuccessfulUse) {
        $metadata['lastSuccessfulUseUtc'] = $now
    }

    if ($MarkRefresh) {
        $metadata['lastRefreshUtc'] = $now
    }

    Write-DbmLiveSessionMetadata -MetadataPath $SessionState.Paths.MetadataPath -Metadata ([pscustomobject]$metadata)
    $SessionState.Metadata = [pscustomobject]$metadata
}

function Get-DbmCaseDefinitions {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [ValidateSet('full', 'promotion')]
        [string]$CaseSet,

        [string[]]$CaseIds
    )

    $catalogRoot = Join-Path $RepoRoot 'eng\live-e2e\cases'
    $caseLookup = @{}
    foreach ($caseFile in Get-ChildItem -Path $catalogRoot -Filter *.json -File) {
        $caseDefinition = Get-Content -Path $caseFile.FullName -Raw | ConvertFrom-Json
        $caseLookup[[string]$caseDefinition.scenarioId] = $caseDefinition
    }

    $selectedCaseIds = if ($CaseIds -and $CaseIds.Count -gt 0) { $CaseIds } else { @($Config.liveE2E.caseSets.$CaseSet) }
    if ($selectedCaseIds.Count -eq 0) {
        throw "No live E2E cases were selected for case set '$CaseSet'."
    }

    $selectedCases = foreach ($scenarioId in $selectedCaseIds) {
        if (-not $caseLookup.ContainsKey($scenarioId)) {
            throw "Live E2E case set '$CaseSet' references unknown scenario '$scenarioId'."
        }

        $caseDefinition = $caseLookup[$scenarioId]
        if ($caseDefinition.runModes -notcontains $CaseSet) {
            throw "Live E2E scenario '$scenarioId' does not declare support for run mode '$CaseSet'."
        }

        $caseDefinition
    }

    return @($selectedCases)
}

if (-not $PSBoundParameters.ContainsKey('CaseSet')) {
    $CaseSet = if ($TargetEnvironment -eq 'UAT') { 'promotion' } else { 'full' }
}

$configEnvelope = Get-DbmLiveConfig -RepoRoot $RepoRoot -TargetEnvironment $TargetEnvironment
$config = $configEnvelope.Value
$selectedCases = Get-DbmCaseDefinitions -RepoRoot $RepoRoot -Config $config -CaseSet $CaseSet -CaseIds $CaseIds

if ($SessionHealthOnly -and $CleanupOrphansOnly) {
    throw 'Session health and orphan cleanup are mutually exclusive modes.'
}

if ($TargetEnvironment -eq 'Prod' -and (-not $ValidateOnly -or $SessionHealthOnly)) {
    throw 'Automated browser-driven live E2E is intentionally disabled for Prod in this slice.'
}

& (Join-Path $PSScriptRoot 'Test-EnvironmentBaseline.ps1') -RepoRoot $RepoRoot -EnvironmentName $TargetEnvironment | Out-Host

$livePackageRoot = Join-Path $RepoRoot 'dbm-live-e2e'
Invoke-DbmNpmArguments -WorkingDirectory $livePackageRoot -Arguments @('ci')
Invoke-DbmNpmArguments -WorkingDirectory $livePackageRoot -Arguments @('run', 'validate')

if ($TargetEnvironment -in @('Dev', 'UAT')) {
    Test-DbmLiveSessionProtectionRoundTrip -TargetEnvironment $TargetEnvironment
}

if ($ValidateOnly) {
    if ($TargetEnvironment -in @('Dev', 'UAT')) {
        $expectedSession = Get-DbmLiveSessionPaths -TargetEnvironment $TargetEnvironment
        Write-Host "Expected persisted session directory: $($expectedSession.Directory)"
    }

    Write-Host "Validated live E2E assets for '$TargetEnvironment' with case set '$CaseSet'."
    return
}

$runId = "{0:yyyyMMdd-HHmmss}-{1}" -f (Get-Date).ToUniversalTime(), ([guid]::NewGuid().ToString('N').Substring(0, 8))

$runRoot = Join-Path $EvidenceRoot "$($TargetEnvironment.ToLowerInvariant())\$runId"
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

$sessionState = $null
if ($TargetEnvironment -in @('Dev', 'UAT')) {
    $sessionState = Get-DbmLiveSessionRuntimeState -TargetEnvironment $TargetEnvironment -Config $config -RunRoot $runRoot
}

$pacSelection = $null
$accessToken = $null

$environmentSummary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = [string]$config.dataverseUrl
    modelDrivenAppUrl = [string]$config.modelDrivenAppUrl
    caseSet = $CaseSet
    runId = $runId
    executionMode = if ($SessionHealthOnly) { 'session-health' } elseif ($CleanupOrphansOnly) { 'cleanup-orphans' } else { 'connected-live-e2e' }
    physicalUserMode = if ($sessionState) { [string]$sessionState.Metadata.physicalUserMode } else { $null }
    sessionUserDisplayName = if ($sessionState) { [string]$sessionState.Metadata.physicalUserDisplayName } else { $null }
    sessionMetadataPath = if ($sessionState) { [string]$sessionState.Paths.MetadataPath } else { $null }
}
$environmentSummary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $runRoot 'environment.json') -Encoding UTF8

$lock = $null
$runSucceeded = $false

try {
    if ($SessionHealthOnly) {
        Unprotect-DbmLiveSessionStateFile -ProtectedPath $sessionState.Paths.ProtectedStatePath -DestinationPath $sessionState.DecryptedStatePath
        Invoke-DbmNpmArguments -WorkingDirectory $livePackageRoot -Arguments @('run', 'install:browsers')
        try {
            Invoke-DbmTsxScript -WorkingDirectory $livePackageRoot -ScriptPath 'src/session-health.ts' -Arguments @(
                '--environment', $TargetEnvironment,
                '--modelDrivenAppUrl', ([string]$config.modelDrivenAppUrl),
                '--inputPath', $sessionState.DecryptedStatePath,
                '--outputPath', $sessionState.RefreshedStatePath,
                '--evidencePath', $sessionState.HealthEvidencePath
            )
            Protect-DbmLiveSessionStateFile -SourcePath $sessionState.RefreshedStatePath -ProtectedPath $sessionState.Paths.ProtectedStatePath
            Update-DbmLiveSessionMetadata -SessionState $sessionState -HealthStatus 'healthy' -MarkSuccessfulUse -MarkRefresh
            Write-Host "Validated persisted live E2E browser session for '$TargetEnvironment'."
            return
        }
        catch {
            Update-DbmLiveSessionMetadata -SessionState $sessionState -HealthStatus 'expired'
            throw
        }
    }

    $pacSelection = & (Join-Path $PSScriptRoot 'Use-DbmPacProfile.ps1') -TargetEnvironment $TargetEnvironment -DataverseUrl ([string]$config.dataverseUrl) -InteractiveLogin:$InteractiveLogin
    $accessToken = Get-DbmDataverseAccessToken -DataverseUrl ([string]$config.dataverseUrl)
    Assert-DbmConfiguredLiveEntitiesExist -Config $config -AccessToken $accessToken

    if ($pacSelection) {
        $environmentSummary.pacMode = [string]$pacSelection.mode
        $environmentSummary.pacProfileName = [string]$pacSelection.profileName
        $environmentSummary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $runRoot 'environment.json') -Encoding UTF8
    }

    if ($CleanupOrphansOnly) {
        $lock = Acquire-DbmLiveLock -TargetEnvironment $TargetEnvironment -DataverseUrl ([string]$config.dataverseUrl) -AccessToken $accessToken -WebResourceName ([string]$config.liveE2E.lock.webResourceName) -StaleAfterMinutes ([int]$config.liveE2E.lock.staleAfterMinutes) -RunId $runId -AllowStaleLockRecovery:$AllowStaleLockRecovery
        $deleted = Clear-DbmLiveE2EOrphans -Config $config -AccessToken $accessToken
        $deleted | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runRoot 'orphan-cleanup.json') -Encoding UTF8
        Write-Host "Deleted $(@($deleted).Count) live E2E orphan record(s)."
        return
    }

    $lock = Acquire-DbmLiveLock -TargetEnvironment $TargetEnvironment -DataverseUrl ([string]$config.dataverseUrl) -AccessToken $accessToken -WebResourceName ([string]$config.liveE2E.lock.webResourceName) -StaleAfterMinutes ([int]$config.liveE2E.lock.staleAfterMinutes) -RunId $runId -AllowStaleLockRecovery:$AllowStaleLockRecovery
    $lock | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runRoot 'lock.json') -Encoding UTF8

    Invoke-DbmNpmArguments -WorkingDirectory $livePackageRoot -Arguments @('run', 'install:browsers')
    Unprotect-DbmLiveSessionStateFile -ProtectedPath $sessionState.Paths.ProtectedStatePath -DestinationPath $sessionState.DecryptedStatePath

    $runContextPath = Join-Path $runRoot 'run-context.json'
    $playwrightReportPath = Join-Path $runRoot 'playwright-results.json'
    $runContext = [ordered]@{
        environmentName = $TargetEnvironment
        caseSet = $CaseSet
        runId = $runId
        preserveOnFailure = [bool]$PreserveOnFailure
        dataverseUrl = [string]$config.dataverseUrl
        modelDrivenAppUrl = [string]$config.modelDrivenAppUrl
        evidenceRoot = $runRoot
        environmentConfig = $config
        session = [ordered]@{
            authenticationMode = 'persisted-user-session'
            sessionScope = 'environment'
            identityModel = 'single-user-simulation'
            physicalUserMode = 'single-user-simulation'
            userDisplayName = [string]$sessionState.Metadata.physicalUserDisplayName
            metadataPath = [string]$sessionState.Paths.MetadataPath
        }
        cases = $selectedCases
    }

    $runContext | ConvertTo-Json -Depth 12 | Set-Content -Path $runContextPath -Encoding UTF8

    Push-Location $livePackageRoot
    try {
        $env:DBM_LIVE_E2E_RUN_CONTEXT_PATH = $runContextPath
        $env:DBM_LIVE_E2E_ACCESS_TOKEN = $accessToken
        $env:DBM_LIVE_E2E_PLAYWRIGHT_REPORT_PATH = $playwrightReportPath
        $env:DBM_LIVE_E2E_SESSION_STATE_PATH = $sessionState.DecryptedStatePath
        $env:DBM_LIVE_E2E_SESSION_REFRESH_PATH = $sessionState.RefreshedStatePath

        & npm run test:live
        if ($LASTEXITCODE -ne 0) {
            throw "Connected live E2E failed with exit code $LASTEXITCODE."
        }

        $runSucceeded = $true
    }
    finally {
        Remove-Item Env:DBM_LIVE_E2E_RUN_CONTEXT_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:DBM_LIVE_E2E_ACCESS_TOKEN -ErrorAction SilentlyContinue
        Remove-Item Env:DBM_LIVE_E2E_PLAYWRIGHT_REPORT_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:DBM_LIVE_E2E_SESSION_STATE_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:DBM_LIVE_E2E_SESSION_REFRESH_PATH -ErrorAction SilentlyContinue
        Pop-Location
    }
}
catch {
    if ($sessionState -and $_.Exception.Message -match 'Initialize-LiveDbmE2ESession\.ps1') {
        Update-DbmLiveSessionMetadata -SessionState $sessionState -HealthStatus 'expired'
    }

    throw
}
finally {
    if ($runSucceeded -and $sessionState -and (Test-Path $sessionState.RefreshedStatePath)) {
        Protect-DbmLiveSessionStateFile -SourcePath $sessionState.RefreshedStatePath -ProtectedPath $sessionState.Paths.ProtectedStatePath
        Update-DbmLiveSessionMetadata -SessionState $sessionState -HealthStatus 'healthy' -MarkSuccessfulUse -MarkRefresh
    }

    foreach ($tempFile in @($sessionState.DecryptedStatePath, $sessionState.RefreshedStatePath)) {
        if ($tempFile -and (Test-Path $tempFile)) {
            Remove-Item -LiteralPath $tempFile -Force
        }
    }

    if ($lock -and $lock.webresourceid) {
        try {
            Remove-DbmLiveLockRecord -DataverseUrl ([string]$config.dataverseUrl) -AccessToken $accessToken -WebResourceId ([string]$lock.webresourceid)
        }
        catch {
            Write-Warning "Failed to release live E2E lock '$($lock.name)': $($_.Exception.Message)"
        }
    }
}

Write-Host "Live connected E2E evidence: $runRoot"
