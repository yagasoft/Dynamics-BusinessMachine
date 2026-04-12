[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$DataverseUrl,

    [string]$SolutionName = 'DynamicsBusinessMachine',
    [string]$ExpectedSolutionVersion,
    [string]$EvidenceRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\deployment-evidence')
)

$ErrorActionPreference = 'Stop'

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
    throw 'pac must be available on PATH or via POWERPLATFORMTOOLS_PACPATH to run Dataverse smoke validation.'
}

$pacProfileSelection = & (Join-Path $PSScriptRoot 'Use-DbmPacProfile.ps1') -TargetEnvironment $TargetEnvironment -DataverseUrl $DataverseUrl
$selectedPacProfileName = if ($pacProfileSelection -and $pacProfileSelection.profileName) { [string]$pacProfileSelection.profileName } else { $null }

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

function Get-DbmSolutionVersionFromList {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Solutions,

        [Parameter(Mandatory = $true)]
        [string]$SolutionName
    )

    $solution = $Solutions | Where-Object {
        $uniqueName = Get-DbmPropertyValue -InputObject $_ -Names @('UniqueName', 'uniquename', 'SolutionUniqueName', 'solutionuniquename')
        $uniqueName -eq $SolutionName
    } | Select-Object -First 1

    if (-not $solution) {
        return $null
    }

    return Get-DbmPropertyValue -InputObject $solution -Names @('Version', 'version', 'SolutionVersion', 'solutionversion', 'VersionNumber', 'versionnumber')
}

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
if (-not [string]::IsNullOrWhiteSpace($selectedPacProfileName)) {
    Set-Content -Path (Join-Path $EvidenceRoot 'pac-profile.txt') -Value $selectedPacProfileName -Encoding UTF8
}

$solutionsRaw = & $pacPath solution list --environment $DataverseUrl --json
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution list failed during Dataverse smoke validation.'
}

$solutions = $solutionsRaw | ConvertFrom-Json
$solution = $solutions | Where-Object {
    $uniqueName = Get-DbmPropertyValue -InputObject $_ -Names @('UniqueName', 'uniquename', 'SolutionUniqueName', 'solutionuniquename')
    $uniqueName -eq $SolutionName
} | Select-Object -First 1

if (-not $solution) {
    throw "Dataverse smoke validation could not find solution '$SolutionName' in '$DataverseUrl'."
}

$onlineVersion = Get-DbmSolutionVersionFromList -Solutions $solutions -SolutionName $SolutionName
if ([string]::IsNullOrWhiteSpace($onlineVersion)) {
    $onlineVersionRaw = & $pacPath solution online-version --solution-name $SolutionName --environment $DataverseUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve online version for '$SolutionName' from the solution list, and pac solution online-version also failed."
    }

    $onlineVersion = ($onlineVersionRaw | Select-Object -Last 1).Trim()
}
if ([string]::IsNullOrWhiteSpace($onlineVersion)) {
    throw "Dataverse smoke validation returned an empty online version for '$SolutionName'."
}

Set-Content -Path (Join-Path $EvidenceRoot 'online-version.txt') -Value $onlineVersion -Encoding UTF8

$automatedChecks = @(
    [ordered]@{
        name = 'solution-exists'
        passed = $true
        details = "Found solution '$SolutionName' in '$TargetEnvironment'."
    }
)

if (-not [string]::IsNullOrWhiteSpace($ExpectedSolutionVersion)) {
    $expectedVersion = Convert-ToVersionOrNull -Value $ExpectedSolutionVersion
    $actualVersion = Convert-ToVersionOrNull -Value $onlineVersion

    if ($expectedVersion -and $actualVersion -and $actualVersion -lt $expectedVersion) {
        throw "Dataverse smoke validation found solution version '$actualVersion', which is lower than expected '$expectedVersion'."
    }

    $automatedChecks += [ordered]@{
        name = 'online-version-at-or-above-expected'
        passed = $true
        details = "Online version '$onlineVersion' meets or exceeds expected '$ExpectedSolutionVersion'."
    }
}

$manualChecks = @(
    'Review the deployment workflow logs for import warnings or component issues.',
    'Verify the designer entry flow loads successfully in the target environment.',
    'Verify one representative DBM runtime action loads successfully in the target environment.'
)

$result = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    environment = $TargetEnvironment
    dataverseUrl = $DataverseUrl
    solutionName = $SolutionName
    expectedSolutionVersion = $ExpectedSolutionVersion
    actualSolutionVersion = $onlineVersion
    status = 'pass'
    automatedChecks = $automatedChecks
    manualChecksRequired = $manualChecks
}

$resultsPath = Join-Path $EvidenceRoot 'smoke-test-results.json'
$summaryPath = Join-Path $EvidenceRoot 'smoke-test-summary.md'

$result | ConvertTo-Json -Depth 6 | Set-Content -Path $resultsPath -Encoding UTF8

$summaryLines = @(
    "# Dataverse Smoke Test Summary",
    '',
    "- Environment: $TargetEnvironment",
    "- Dataverse URL: $DataverseUrl",
    "- Solution: $SolutionName",
    "- Actual online version: $onlineVersion"
)

if (-not [string]::IsNullOrWhiteSpace($ExpectedSolutionVersion)) {
    $summaryLines += "- Expected minimum version: $ExpectedSolutionVersion"
}

$summaryLines += ''
$summaryLines += '## Automated checks'

foreach ($check in $automatedChecks) {
    $summaryLines += "- PASS: $($check.details)"
}

$summaryLines += ''
$summaryLines += '## Manual follow-up'

foreach ($check in $manualChecks) {
    $summaryLines += "- $check"
}

$summaryLines | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Dataverse smoke evidence: $resultsPath"
Write-Host "Dataverse smoke summary: $summaryPath"
Write-Host "Online version: $onlineVersion"
