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
    Get-DbmPropertyValue -InputObject $existingSolution -Names @('Version', 'version', 'SolutionVersion', 'solutionversion')
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
    packagePath = $package.FullName
    existingSolutionVersion = $existingSolutionVersion
    allowSolutionReplaceOnPluginIdentityChange = [bool]$AllowSolutionReplaceOnPluginIdentityChange
    usedSolutionReplaceOnPluginIdentityChange = $false
    reason = $null
    initialImportFailure = $null
}

try {
    & $pacPath @importArguments
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution import failed for '$($package.FullName)'."
    }
}
catch {
    $failureMessage = Get-DbmImportFailureMessage -ErrorRecord $_
    $remediation.initialImportFailure = $failureMessage

    $isPluginIdentityChange = $failureMessage -like '*Plugin Assembly fully qualified name has changed*'
    $canReplaceSolution = $AllowSolutionReplaceOnPluginIdentityChange -and $TargetEnvironment -ne 'Prod' -and $existingSolution

    if (-not ($isPluginIdentityChange -and $canReplaceSolution)) {
        $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
        throw
    }

    Write-Warning "Detected plugin assembly identity drift for '$SolutionName' in '$TargetEnvironment'. Deleting the existing solution and retrying import."
    $remediation.usedSolutionReplaceOnPluginIdentityChange = $true
    $remediation.reason = 'plugin-assembly-identity-change'
    $remediation.deleteAttemptedUtc = (Get-Date).ToUniversalTime().ToString('o')

    & $pacPath --log-to-console solution delete --environment $DataverseUrl --solution-name $SolutionName
    if ($LASTEXITCODE -ne 0) {
        $remediation.deleteSucceeded = $false
        $remediation | ConvertTo-Json -Depth 6 | Set-Content -Path $remediationEvidencePath -Encoding UTF8
        throw "pac solution delete failed while remediating plugin assembly identity drift for '$SolutionName'."
    }

    $remediation.deleteSucceeded = $true
    $remediation.retryAttemptedUtc = (Get-Date).ToUniversalTime().ToString('o')

    $retryImportArguments = @($importArguments | Where-Object { $_ -ne '--stage-and-upgrade' })
    & $pacPath @retryImportArguments
    if ($LASTEXITCODE -ne 0) {
        $remediation.retrySucceeded = $false
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
