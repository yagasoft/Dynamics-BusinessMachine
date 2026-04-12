[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,

    [Parameter(Mandatory = $true)]
    [string]$DataverseUrl,

    [string]$SolutionName = 'DynamicsBusinessMachine',
    [string]$PluginAssemblyName = 'Yagasoft.Dbm.Plugins',
    [string]$ExpectedSolutionVersion,
    [string]$EvidenceRoot = (Join-Path $PackageRoot 'deployment-evidence'),
    [switch]$AllowSolutionReplaceOnPluginIdentityChange
)

$pacPath = $null

if (-not [string]::IsNullOrWhiteSpace($env:POWERPLATFORMTOOLS_PACPATH) -and (Test-Path $env:POWERPLATFORMTOOLS_PACPATH)) {
    $pacPath = (Resolve-Path $env:POWERPLATFORMTOOLS_PACPATH).Path
}
else {
    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if ($pac) {
        $pacPath = $pac.Source
    }
}

if (-not $pacPath) {
    throw 'pac must be available on PATH or via POWERPLATFORMTOOLS_PACPATH to deploy Dataverse solution artifacts.'
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

function Convert-ToVersionOrNull {
    param(
        [string]$Value
    )

    try {
        return [version]$Value
    } catch {
        return $null
    }
}

function Get-DbmImportFailureMessage {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )

    $message = $ErrorRecord.Exception.Message

    if ($ErrorRecord.ScriptStackTrace) {
        return "$message`n$($ErrorRecord.ScriptStackTrace)"
    }

    return $message
}

function Invoke-DbmPacCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PacPath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $PacPath @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    foreach ($line in @($output)) {
        $line | Out-Host
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output)
        OutputText = (@($output) | Out-String).Trim()
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
        throw 'Azure CLI must be available to query Dataverse Web API during deployment remediation.'
    }

    $resource = $DataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource' from Azure CLI."
    }

    return $token.Trim()
}

function Invoke-DbmDataverseRequest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'DELETE')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $headers = @{
        Authorization  = "Bearer $AccessToken"
        Accept         = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    }

    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

function Get-DbmPluginAssemblyRegistrations {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$PluginAssemblyName,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $escapedPluginAssemblyName = $PluginAssemblyName.Replace("'", "''")
    $filter = [System.Uri]::EscapeDataString("name eq '$escapedPluginAssemblyName'")
    $uri = "$(Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl)/pluginassemblies?`$select=pluginassemblyid,name,version,culture,publickeytoken&`$filter=$filter"
    $response = Invoke-DbmDataverseRequest -Method GET -Uri $uri -AccessToken $AccessToken

    return @($response.value)
}

function ConvertTo-DbmPluginAssemblyEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$PluginAssemblies
    )

    return @(
        $PluginAssemblies | ForEach-Object {
            [ordered]@{
                pluginassemblyid = Get-DbmPropertyValue -InputObject $_ -Names @('pluginassemblyid')
                name = Get-DbmPropertyValue -InputObject $_ -Names @('name')
                version = Get-DbmPropertyValue -InputObject $_ -Names @('version')
                culture = Get-DbmPropertyValue -InputObject $_ -Names @('culture')
                publickeytoken = Get-DbmPropertyValue -InputObject $_ -Names @('publickeytoken')
            }
        }
    )
}

function Remove-DbmPluginAssemblyRegistrations {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [object[]]$PluginAssemblies,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $baseUrl = Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl
    $removed = New-Object System.Collections.Generic.List[object]
    $failures = New-Object System.Collections.Generic.List[object]

    foreach ($pluginAssembly in $PluginAssemblies) {
        $pluginAssemblyId = Get-DbmPropertyValue -InputObject $pluginAssembly -Names @('pluginassemblyid')
        $pluginAssemblyName = Get-DbmPropertyValue -InputObject $pluginAssembly -Names @('name')
        $pluginAssemblyVersion = Get-DbmPropertyValue -InputObject $pluginAssembly -Names @('version')
        $pluginAssemblyToken = Get-DbmPropertyValue -InputObject $pluginAssembly -Names @('publickeytoken')

        if ([string]::IsNullOrWhiteSpace($pluginAssemblyId)) {
            $failures.Add([ordered]@{
                name = $pluginAssemblyName
                version = $pluginAssemblyVersion
                publickeytoken = $pluginAssemblyToken
                error = 'Missing pluginassemblyid.'
            }) | Out-Null
            continue
        }

        $normalizedPluginAssemblyId = ([guid]$pluginAssemblyId).Guid
        $deleteUri = "$baseUrl/pluginassemblies($normalizedPluginAssemblyId)"

        try {
            Invoke-DbmDataverseRequest -Method DELETE -Uri $deleteUri -AccessToken $AccessToken | Out-Null
            Write-Warning "Deleted stale plugin assembly registration '$pluginAssemblyName' version '$pluginAssemblyVersion' token '$pluginAssemblyToken'."
            $removed.Add([ordered]@{
                pluginassemblyid = $normalizedPluginAssemblyId
                name = $pluginAssemblyName
                version = $pluginAssemblyVersion
                publickeytoken = $pluginAssemblyToken
            }) | Out-Null
        }
        catch {
            $failures.Add([ordered]@{
                pluginassemblyid = $normalizedPluginAssemblyId
                name = $pluginAssemblyName
                version = $pluginAssemblyVersion
                publickeytoken = $pluginAssemblyToken
                error = $_.Exception.Message
            }) | Out-Null
        }
    }

    return [pscustomobject]@{
        Removed = @($removed)
        Failures = @($failures)
    }
}

$packageType = if ($TargetEnvironment -eq 'Dev') { 'unmanaged' } else { 'managed' }
$package = Get-ChildItem -Path $PackageRoot -Filter "*-$packageType.zip" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $package) {
    throw "No $packageType Dataverse solution package was found under '$PackageRoot'."
}

$settingsFile = Join-Path $PackageRoot 'SampleDeploymentSettings.json'
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$remediationEvidencePath = Join-Path $EvidenceRoot 'deployment-remediation.json'
$pluginAssembliesBeforeCleanupPath = Join-Path $EvidenceRoot 'plugin-assemblies-before-cleanup.json'
$pluginAssembliesAfterCleanupPath = Join-Path $EvidenceRoot 'plugin-assemblies-after-cleanup.json'

$beforeListPath = Join-Path $EvidenceRoot 'solution-list-before.json'
$beforeSolutionsRaw = & $pacPath solution list --environment $DataverseUrl --json
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution list failed before import.'
}

Set-Content -Path $beforeListPath -Value $beforeSolutionsRaw -Encoding UTF8
$beforeSolutions = $beforeSolutionsRaw | ConvertFrom-Json
$existingSolution = $beforeSolutions | Where-Object {
    $uniqueName = Get-DbmPropertyValue -InputObject $_ -Names @('UniqueName', 'uniquename', 'SolutionUniqueName', 'solutionuniquename')
    $uniqueName -eq $SolutionName
} | Select-Object -First 1
$existingSolutionVersion = if ($existingSolution) {
    Get-DbmPropertyValue -InputObject $existingSolution -Names @('Version', 'version', 'SolutionVersion', 'solutionversion', 'VersionNumber', 'versionnumber')
}
else {
    $null
}

$importArguments = @(
    '--log-to-console',
    'solution',
    'import',
    '--path', $package.FullName,
    '--environment', $DataverseUrl,
    '--publish-changes',
    '--skip-lower-version',
    '--max-async-wait-time', '60'
)

if (Test-Path $settingsFile) {
    $importArguments += @('--settings-file', $settingsFile)
}

if ($TargetEnvironment -ne 'Dev' -and $existingSolution) {
    $importArguments += '--stage-and-upgrade'
}

$remediation = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    solutionName = $SolutionName
    pluginAssemblyName = $PluginAssemblyName
    packagePath = $package.FullName
    existingSolutionVersion = $existingSolutionVersion
    allowSolutionReplaceOnPluginIdentityChange = [bool]$AllowSolutionReplaceOnPluginIdentityChange
    usedSolutionReplaceOnPluginIdentityChange = $false
    reason = $null
    initialImportFailure = $null
}

try {
    $importResult = Invoke-DbmPacCommand -PacPath $pacPath -Arguments $importArguments
    if ($importResult.ExitCode -ne 0) {
        $message = if ([string]::IsNullOrWhiteSpace($importResult.OutputText)) {
            "pac solution import failed for '$($package.FullName)'."
        }
        else {
            $importResult.OutputText
        }

        throw $message
    }
}
catch {
    $failureMessage = Get-DbmImportFailureMessage -ErrorRecord $_
    $remediation.initialImportFailure = $failureMessage

    $isPluginIdentityChange = $failureMessage -like '*Plugin Assembly fully qualified name has changed*'
    $canReplaceSolution = $AllowSolutionReplaceOnPluginIdentityChange -and $TargetEnvironment -ne 'Prod'

    if (-not ($isPluginIdentityChange -and $canReplaceSolution)) {
        $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
        throw
    }

    Write-Warning "Detected plugin assembly identity drift for '$SolutionName' in '$TargetEnvironment'. Cleaning stale registrations and retrying import."
    $remediation.usedSolutionReplaceOnPluginIdentityChange = $true
    $remediation.reason = 'plugin-assembly-identity-change'
    $remediation.solutionFoundBeforeCleanup = [bool]$existingSolution

    if ($existingSolution) {
        $remediation.deleteAttemptedUtc = (Get-Date).ToUniversalTime().ToString('o')

        & $pacPath --log-to-console solution delete --environment $DataverseUrl --solution-name $SolutionName
        if ($LASTEXITCODE -ne 0) {
            $remediation.deleteSucceeded = $false
            $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
            throw "pac solution delete failed while remediating plugin assembly identity drift for '$SolutionName'."
        }

        $remediation.deleteSucceeded = $true
    }
    else {
        Write-Warning "Solution '$SolutionName' is already absent in '$TargetEnvironment'. Skipping solution delete and cleaning stale plugin assembly registrations directly."
        $remediation.deleteSkippedBecauseSolutionMissing = $true
    }

    $remediation.retryAttemptedUtc = (Get-Date).ToUniversalTime().ToString('o')

    $dataverseAccessToken = Get-DbmDataverseAccessToken -DataverseUrl $DataverseUrl
    $pluginAssembliesBeforeCleanup = Get-DbmPluginAssemblyRegistrations -DataverseUrl $DataverseUrl -PluginAssemblyName $PluginAssemblyName -AccessToken $dataverseAccessToken
    $pluginAssemblyEvidenceBeforeCleanup = ConvertTo-DbmPluginAssemblyEvidence -PluginAssemblies $pluginAssembliesBeforeCleanup
    $pluginAssemblyEvidenceBeforeCleanup | ConvertTo-Json -Depth 6 | Set-Content -Path $pluginAssembliesBeforeCleanupPath -Encoding UTF8
    $remediation.pluginAssembliesBeforeCleanup = $pluginAssemblyEvidenceBeforeCleanup

    if ($pluginAssembliesBeforeCleanup.Count -gt 0) {
        Write-Warning "Found $($pluginAssembliesBeforeCleanup.Count) stale plugin assembly registration(s) for '$PluginAssemblyName' after deleting '$SolutionName'. Removing them before retry."
        $remediation.pluginAssemblyCleanupAttemptedUtc = (Get-Date).ToUniversalTime().ToString('o')

        $pluginAssemblyCleanupResult = Remove-DbmPluginAssemblyRegistrations -DataverseUrl $DataverseUrl -PluginAssemblies $pluginAssembliesBeforeCleanup -AccessToken $dataverseAccessToken
        $remediation.pluginAssembliesRemoved = @($pluginAssemblyCleanupResult.Removed)
        $remediation.pluginAssemblyCleanupFailures = @($pluginAssemblyCleanupResult.Failures)

        if ($pluginAssemblyCleanupResult.Failures.Count -gt 0) {
            $remediation.pluginAssemblyCleanupSucceeded = $false
            $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
            throw "Failed to remove one or more stale plugin assembly registrations for '$PluginAssemblyName'."
        }
    }
    else {
        $remediation.pluginAssembliesRemoved = @()
        $remediation.pluginAssemblyCleanupFailures = @()
        $remediation.pluginAssemblyCleanupSucceeded = $true
    }

    $pluginAssembliesAfterCleanup = Get-DbmPluginAssemblyRegistrations -DataverseUrl $DataverseUrl -PluginAssemblyName $PluginAssemblyName -AccessToken $dataverseAccessToken
    $pluginAssemblyEvidenceAfterCleanup = ConvertTo-DbmPluginAssemblyEvidence -PluginAssemblies $pluginAssembliesAfterCleanup
    $pluginAssemblyEvidenceAfterCleanup | ConvertTo-Json -Depth 6 | Set-Content -Path $pluginAssembliesAfterCleanupPath -Encoding UTF8
    $remediation.pluginAssembliesAfterCleanup = $pluginAssemblyEvidenceAfterCleanup

    if ($pluginAssembliesAfterCleanup.Count -gt 0) {
        $remediation.pluginAssemblyCleanupSucceeded = $false
        $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
        throw "Stale plugin assembly registrations remain for '$PluginAssemblyName' after cleanup."
    }

    $remediation.pluginAssemblyCleanupSucceeded = $true

    $retryImportArguments = @($importArguments | Where-Object { $_ -ne '--stage-and-upgrade' })
    $retryImportResult = Invoke-DbmPacCommand -PacPath $pacPath -Arguments $retryImportArguments
    if ($retryImportResult.ExitCode -ne 0) {
        $remediation.retrySucceeded = $false
        if (-not [string]::IsNullOrWhiteSpace($retryImportResult.OutputText)) {
            $remediation.retryImportFailure = $retryImportResult.OutputText
        }
        $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
        throw "pac solution import retry failed for '$($package.FullName)' after deleting '$SolutionName'."
    }

    $remediation.retrySucceeded = $true
    $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
}

& $pacPath --log-to-console solution publish --environment $DataverseUrl
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution publish failed after import.'
}

$afterListPath = Join-Path $EvidenceRoot 'solution-list-after.json'
$afterSolutionsRaw = & $pacPath solution list --environment $DataverseUrl --json
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution list failed after import.'
}

Set-Content -Path $afterListPath -Value $afterSolutionsRaw -Encoding UTF8
$onlineVersionRaw = & $pacPath solution online-version --solution-name $SolutionName --environment $DataverseUrl
if ($LASTEXITCODE -ne 0) {
    throw "pac solution online-version failed for '$SolutionName'."
}

$onlineVersion = ($onlineVersionRaw | Select-Object -Last 1).Trim()
Set-Content -Path (Join-Path $EvidenceRoot 'online-version.txt') -Value $onlineVersion -Encoding UTF8

if (-not [string]::IsNullOrWhiteSpace($ExpectedSolutionVersion)) {
    $expectedVersion = Convert-ToVersionOrNull -Value $ExpectedSolutionVersion
    $currentVersion = Convert-ToVersionOrNull -Value $onlineVersion

    if ($expectedVersion -and $currentVersion -and $currentVersion -lt $expectedVersion) {
        throw "Deployed solution version '$currentVersion' is lower than expected '$expectedVersion'."
    }
}

Write-Host "Package: $($package.FullName)"
Write-Host "Environment: $TargetEnvironment"
Write-Host "Online version: $onlineVersion"
