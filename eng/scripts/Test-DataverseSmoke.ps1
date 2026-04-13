[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$DataverseUrl,

    [string]$SolutionName,
    [string]$GeneratedMetadataSolutionName,
    [string]$ExpectedSolutionVersion,
    [string]$ModelPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'docs\architecture\examples\approval-request-v1.model.json'),
    [switch]$SkipGeneratedMetadataValidation,
    [string]$EvidenceRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\deployment-evidence')
)

$ErrorActionPreference = 'Stop'

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($SolutionName)) {
    $SolutionName = [string]$version.solutionNames.core
}
if ([string]::IsNullOrWhiteSpace($GeneratedMetadataSolutionName)) {
    $GeneratedMetadataSolutionName = [string]$version.solutionNames.generatedMetadata
}

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
    }
    catch {
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
$solutionChecks = @(
    [pscustomobject]@{
        solutionName = $SolutionName
        label = 'core'
    },
    [pscustomobject]@{
        solutionName = $GeneratedMetadataSolutionName
        label = 'generated-metadata'
    }
)

$actualVersions = [ordered]@{}
$automatedChecks = @()

foreach ($solutionCheck in $solutionChecks) {
    $solution = $solutions | Where-Object {
        $uniqueName = Get-DbmPropertyValue -InputObject $_ -Names @('UniqueName', 'uniquename', 'SolutionUniqueName', 'solutionuniquename')
        $uniqueName -eq $solutionCheck.solutionName
    } | Select-Object -First 1

    if (-not $solution) {
        throw "Dataverse smoke validation could not find solution '$($solutionCheck.solutionName)' in '$DataverseUrl'."
    }

    $onlineVersion = Get-DbmSolutionVersionFromList -Solutions $solutions -SolutionName $solutionCheck.solutionName
    if ([string]::IsNullOrWhiteSpace($onlineVersion)) {
        $onlineVersionRaw = & $pacPath solution online-version --solution-name $solutionCheck.solutionName --environment $DataverseUrl
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to resolve online version for '$($solutionCheck.solutionName)' from the solution list, and pac solution online-version also failed."
        }

        $onlineVersion = ($onlineVersionRaw | Select-Object -Last 1).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($onlineVersion)) {
        throw "Dataverse smoke validation returned an empty online version for '$($solutionCheck.solutionName)'."
    }

    $actualVersions[$solutionCheck.solutionName] = $onlineVersion
    Set-Content -Path (Join-Path $EvidenceRoot ("online-version.{0}.txt" -f $solutionCheck.label)) -Value $onlineVersion -Encoding UTF8

    $automatedChecks += [ordered]@{
        name = "$($solutionCheck.label)-solution-exists"
        passed = $true
        details = "Found solution '$($solutionCheck.solutionName)' in '$TargetEnvironment'."
    }

    if (-not [string]::IsNullOrWhiteSpace($ExpectedSolutionVersion)) {
        $expectedVersion = Convert-ToVersionOrNull -Value $ExpectedSolutionVersion
        $actualVersion = Convert-ToVersionOrNull -Value $onlineVersion

        if ($expectedVersion -and $actualVersion -and $actualVersion -lt $expectedVersion) {
            throw "Dataverse smoke validation found solution version '$actualVersion' for '$($solutionCheck.solutionName)', which is lower than expected '$expectedVersion'."
        }

        $automatedChecks += [ordered]@{
            name = "$($solutionCheck.label)-online-version-at-or-above-expected"
            passed = $true
            details = "Online version '$onlineVersion' for '$($solutionCheck.solutionName)' meets or exceeds expected '$ExpectedSolutionVersion'."
        }
    }
}

$generatedMetadataArtifacts = [ordered]@{}
if (-not $SkipGeneratedMetadataValidation) {
    $generatedMetadataRoot = Join-Path $EvidenceRoot 'generated-metadata'
    New-Item -ItemType Directory -Path $generatedMetadataRoot -Force | Out-Null

    $readbackPath = Join-Path $generatedMetadataRoot 'readback-snapshot.json'
    $driftPath = Join-Path $generatedMetadataRoot 'drift-report.json'

    & (Join-Path $PSScriptRoot 'Invoke-DataverseSynthesis.ps1') `
        -RepoRoot (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path `
        -Mode Readback `
        -TargetEnvironment $TargetEnvironment `
        -DataverseUrl $DataverseUrl `
        -ModelPath $ModelPath `
        -OutputPath $readbackPath

    & (Join-Path $PSScriptRoot 'Invoke-DataverseSynthesis.ps1') `
        -RepoRoot (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path `
        -Mode Diff `
        -ModelPath $ModelPath `
        -SnapshotPath $readbackPath `
        -OutputPath $driftPath `
        -SkipBuild

    $driftReport = Get-Content -Path $driftPath -Raw | ConvertFrom-Json
    $readbackSnapshot = Get-Content -Path $readbackPath -Raw | ConvertFrom-Json
    $generatedMetadataArtifacts.readbackSnapshot = $readbackPath
    $generatedMetadataArtifacts.driftReport = $driftPath

    if ($driftReport.hasBlockingDrift) {
        throw "Generated metadata drift was detected in '$TargetEnvironment'. Review '$driftPath'."
    }

    $automatedChecks += [ordered]@{
        name = 'generated-metadata-drift-free'
        passed = $true
        details = 'Generated metadata readback matched the synthesized Dataverse plan without blocking drift.'
    }

    $expectedFormIds = @(
        '{8d65fa31-b54d-5d9b-84e0-07d87e113130}',
        '{4e37e2e6-61cb-544d-848a-9f870ec4cf4d}'
    )
    foreach ($expectedFormId in $expectedFormIds) {
        $normalizedExpectedFormId = ([string]$expectedFormId).Trim('{}').ToLowerInvariant()
        $form = $readbackSnapshot.forms | Where-Object { ([string]$_.formId).Trim('{}').ToLowerInvariant() -eq $normalizedExpectedFormId } | Select-Object -First 1
        if (-not $form) {
            throw "Generated metadata validation could not find expected form '$expectedFormId' in '$TargetEnvironment'. Review '$readbackPath'."
        }
    }

    $expectedWebResources = @(
        'ys_/dbm/forms/runtime.js',
        'ys_/dbm/forms/config/request-form.js',
        'ys_/dbm/forms/config/review-form.js'
    )
    foreach ($expectedWebResource in $expectedWebResources) {
        $webResource = $readbackSnapshot.webResources | Where-Object { [string]$_.name -eq $expectedWebResource } | Select-Object -First 1
        if (-not $webResource) {
            throw "Generated metadata validation could not find expected web resource '$expectedWebResource' in '$TargetEnvironment'. Review '$readbackPath'."
        }
    }

    $automatedChecks += [ordered]@{
        name = 'generated-metadata-forms-present'
        passed = $true
        details = 'Expected DBM-managed Dataverse forms were found in the generated metadata readback.'
    }

    $automatedChecks += [ordered]@{
        name = 'generated-metadata-behavior-assets-present'
        passed = $true
        details = 'Expected DBM form behavior web resources were found in the generated metadata readback.'
    }
}

$designerHostRoot = Join-Path $EvidenceRoot 'designer-host'
& (Join-Path $PSScriptRoot 'Test-DbmDesignerHost.ps1') `
    -RepoRoot (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path `
    -TargetEnvironment $TargetEnvironment `
    -DataverseUrl $DataverseUrl `
    -EvidenceRoot $designerHostRoot | Out-Null

$designerHostResultsPath = Join-Path $designerHostRoot 'designer-host-results.json'
$designerHostSummaryPath = Join-Path $designerHostRoot 'designer-host-summary.md'
$designerHostResults = Get-Content -Path $designerHostResultsPath -Raw | ConvertFrom-Json

$automatedChecks += [ordered]@{
    name = 'designer-host-prerequisites-valid'
    passed = $true
    details = "Designer app module and required web resources are present in '$TargetEnvironment'."
}

$manualChecks = @(
    'Review the deployment workflow logs for import warnings or component issues.',
    "Open the hosted designer using '$($designerHostResults.designerUrl)' or review '$designerHostSummaryPath', then verify the designer entry flow loads successfully in the target environment.",
    'Create one new model document, save it, refresh, and reopen it without host or validation dead ends.',
    'Verify one representative DBM runtime action loads successfully in the target environment.'
)

$result = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    environment = $TargetEnvironment
    dataverseUrl = $DataverseUrl
    solutionNames = [ordered]@{
        core = $SolutionName
        generatedMetadata = $GeneratedMetadataSolutionName
    }
    expectedSolutionVersion = $ExpectedSolutionVersion
    actualSolutionVersions = $actualVersions
    generatedMetadataValidation = if ($SkipGeneratedMetadataValidation) { 'skipped' } else { 'pass' }
    generatedMetadataArtifacts = $generatedMetadataArtifacts
    designerHostArtifacts = [ordered]@{
        result = $designerHostResultsPath
        summary = $designerHostSummaryPath
        designerUrl = [string]$designerHostResults.designerUrl
    }
    status = 'pass'
    automatedChecks = $automatedChecks
    manualChecksRequired = $manualChecks
}

$resultsPath = Join-Path $EvidenceRoot 'smoke-test-results.json'
$summaryPath = Join-Path $EvidenceRoot 'smoke-test-summary.md'

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $resultsPath -Encoding UTF8

$summaryLines = @(
    '# Dataverse Smoke Test Summary',
    '',
    "- Environment: $TargetEnvironment",
    "- Dataverse URL: $DataverseUrl",
    "- Core solution: $SolutionName",
    "- Generated metadata solution: $GeneratedMetadataSolutionName",
    "- Core online version: $($actualVersions[$SolutionName])",
    "- Generated metadata online version: $($actualVersions[$GeneratedMetadataSolutionName])"
)

if (-not [string]::IsNullOrWhiteSpace($ExpectedSolutionVersion)) {
    $summaryLines += "- Expected minimum version: $ExpectedSolutionVersion"
}

if (-not $SkipGeneratedMetadataValidation) {
    $summaryLines += "- Generated metadata drift validation: pass"
}
$summaryLines += "- Designer host validation: pass"
$summaryLines += "- Designer URL: $($designerHostResults.designerUrl)"

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
Write-Host "Core online version: $($actualVersions[$SolutionName])"
Write-Host "Generated metadata online version: $($actualVersions[$GeneratedMetadataSolutionName])"
