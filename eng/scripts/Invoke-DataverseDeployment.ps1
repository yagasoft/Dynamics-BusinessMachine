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
    [string]$EvidenceRoot = (Join-Path $PackageRoot 'deployment-evidence')
)

$pac = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pac) {
    throw 'pac must be available on PATH to deploy Dataverse solution artifacts.'
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

$packageType = if ($TargetEnvironment -eq 'Dev') { 'unmanaged' } else { 'managed' }
$package = Get-ChildItem -Path $PackageRoot -Filter "*-$packageType.zip" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $package) {
    throw "No $packageType Dataverse solution package was found under '$PackageRoot'."
}

$settingsFile = Join-Path $PackageRoot 'SampleDeploymentSettings.json'
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

$beforeListPath = Join-Path $EvidenceRoot 'solution-list-before.json'
$beforeSolutionsRaw = & $pac.Source solution list --environment $DataverseUrl --json
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution list failed before import.'
}

Set-Content -Path $beforeListPath -Value $beforeSolutionsRaw -Encoding UTF8
$beforeSolutions = $beforeSolutionsRaw | ConvertFrom-Json
$existingSolution = $beforeSolutions | Where-Object {
    $uniqueName = Get-DbmPropertyValue -InputObject $_ -Names @('UniqueName', 'uniquename', 'SolutionUniqueName', 'solutionuniquename')
    $uniqueName -eq $SolutionName
} | Select-Object -First 1

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

& $pac.Source @importArguments
if ($LASTEXITCODE -ne 0) {
    throw "pac solution import failed for '$($package.FullName)'."
}

& $pac.Source --log-to-console solution publish --environment $DataverseUrl
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution publish failed after import.'
}

$afterListPath = Join-Path $EvidenceRoot 'solution-list-after.json'
$afterSolutionsRaw = & $pac.Source solution list --environment $DataverseUrl --json
if ($LASTEXITCODE -ne 0) {
    throw 'pac solution list failed after import.'
}

Set-Content -Path $afterListPath -Value $afterSolutionsRaw -Encoding UTF8
$onlineVersionRaw = & $pac.Source solution online-version --solution-name $SolutionName --environment $DataverseUrl
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
