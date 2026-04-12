[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$ManifestPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'eng\security\npm-audit-exceptions.json'),
    [string]$OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\security\npm-audit')
)

$ErrorActionPreference = 'Stop'

$nodeProjects = @(
    'dbm-app',
    'dbm-script-lib',
    'dbm-js-vm',
    'dbm-web-resources'
)

function Assert-ManifestValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($null -eq $Value) {
        throw "npm audit exception manifest value is missing: $Label"
    }

    if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
        throw "npm audit exception manifest value is missing: $Label"
    }
}

function Convert-ToDateOnly {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    try {
        return [datetime]::ParseExact($Value, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
    }
    catch {
        throw "npm audit exception manifest contains an invalid date for '$Label': '$Value'. Expected format yyyy-MM-dd."
    }
}

function Resolve-HighSeverityAdvisories {
    param(
        [string]$PackageName,

        [object]$Vulnerabilities,

        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[string]]$Visited
    )

    if ($Visited.Contains($PackageName)) {
        return @()
    }

    $Visited.Add($PackageName) | Out-Null
    $vulnerabilityProperty = $Vulnerabilities.PSObject.Properties[$PackageName]
    if (-not $vulnerabilityProperty) {
        return @()
    }

    $resolvedAdvisories = @()
    foreach ($viaEntry in $vulnerabilityProperty.Value.via) {
        if ($viaEntry -is [string]) {
            $resolvedAdvisories += Resolve-HighSeverityAdvisories -PackageName $viaEntry -Vulnerabilities $Vulnerabilities -Visited $Visited
            continue
        }

        if ($viaEntry.severity -notin @('high', 'critical')) {
            continue
        }

        $resolvedAdvisories += [pscustomobject]@{
            advisory = ($viaEntry.url -replace '^https://github.com/advisories/', '')
            severity = [string]$viaEntry.severity
            title = [string]$viaEntry.title
            url = [string]$viaEntry.url
        }
    }

    return $resolvedAdvisories | Sort-Object advisory -Unique
}

if (-not (Test-Path $ManifestPath)) {
    throw "npm audit exception manifest is missing: $ManifestPath"
}

if (Test-Path $OutputRoot) {
    Remove-Item -Path $OutputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$manifest = Get-Content -Path $ManifestPath -Raw | ConvertFrom-Json
$manifestExceptions = @($manifest.exceptions)
if ($manifestExceptions.Count -eq 0) {
    throw "npm audit exception manifest does not contain any exception entries: $ManifestPath"
}

$today = (Get-Date).Date
$validatedExceptions = @()
$expiredExceptions = @()

foreach ($entry in $manifestExceptions) {
    Assert-ManifestValue -Value $entry.scope -Label 'scope'
    Assert-ManifestValue -Value $entry.advisory -Label "advisory for scope '$($entry.scope)'"
    Assert-ManifestValue -Value $entry.packages -Label "packages for advisory '$($entry.advisory)'"
    Assert-ManifestValue -Value $entry.rationale -Label "rationale for advisory '$($entry.advisory)'"
    Assert-ManifestValue -Value $entry.ownerRole -Label "ownerRole for advisory '$($entry.advisory)'"
    Assert-ManifestValue -Value $entry.openedDate -Label "openedDate for advisory '$($entry.advisory)'"
    Assert-ManifestValue -Value $entry.hardExpiry -Label "hardExpiry for advisory '$($entry.advisory)'"

    $openedDate = Convert-ToDateOnly -Value ([string]$entry.openedDate) -Label "openedDate for advisory '$($entry.advisory)'"
    $hardExpiry = Convert-ToDateOnly -Value ([string]$entry.hardExpiry) -Label "hardExpiry for advisory '$($entry.advisory)'"

    $validatedEntry = [pscustomobject]@{
        scope = [string]$entry.scope
        advisory = [string]$entry.advisory
        packages = @($entry.packages)
        rationale = [string]$entry.rationale
        ownerRole = [string]$entry.ownerRole
        openedDate = $openedDate.ToString('yyyy-MM-dd')
        hardExpiry = $hardExpiry.ToString('yyyy-MM-dd')
    }

    $validatedExceptions += $validatedEntry

    if ($hardExpiry.Date -lt $today) {
        $expiredExceptions += [pscustomobject]@{
            scope = $validatedEntry.scope
            advisory = $validatedEntry.advisory
            hardExpiry = $validatedEntry.hardExpiry
        }
    }
}

$validatedManifest = [ordered]@{
    schemaVersion = if ($manifest.schemaVersion) { [string]$manifest.schemaVersion } else { '1.0' }
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    exceptions = $validatedExceptions
}

$validatedManifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $OutputRoot 'active-exceptions.json') -Encoding UTF8

$projectSummaries = @()
$blockedFindings = @()
$allowedFindings = @()

foreach ($project in $nodeProjects) {
    $projectPath = Join-Path $RepoRoot $project
    Push-Location $projectPath
    try {
        $rawAudit = npm audit --omit=dev --audit-level=high --json 2>$null | Out-String
        $auditExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ([string]::IsNullOrWhiteSpace($rawAudit)) {
        throw "npm audit did not return JSON output for $projectPath"
    }

    $rawAuditPath = Join-Path $OutputRoot "$project-raw.json"
    Set-Content -Path $rawAuditPath -Value $rawAudit -Encoding UTF8

    $report = $rawAudit | ConvertFrom-Json
    $projectAllowedFindings = @()
    $projectBlockedFindings = @()
    $vulnerabilityProperties = @($report.vulnerabilities.PSObject.Properties)

    foreach ($vulnerabilityProperty in $vulnerabilityProperties) {
        $packageName = $vulnerabilityProperty.Name
        $packageVulnerability = $vulnerabilityProperty.Value

        if ([string]$packageVulnerability.severity -notin @('high', 'critical')) {
            continue
        }

        $resolvedAdvisories = @(
            Resolve-HighSeverityAdvisories -PackageName $packageName -Vulnerabilities $report.vulnerabilities -Visited ([System.Collections.Generic.HashSet[string]]::new())
        )

        if ($resolvedAdvisories.Count -eq 0) {
            $projectBlockedFindings += [pscustomobject]@{
                project = $project
                package = $packageName
                advisory = $null
                severity = [string]$packageVulnerability.severity
                reason = 'No high-severity advisory could be resolved for this npm audit finding.'
            }
            continue
        }

        foreach ($resolvedAdvisory in $resolvedAdvisories) {
            $matchingExceptions = @(
                $validatedExceptions | Where-Object {
                    $_.scope -eq $project -and
                    $_.advisory -eq $resolvedAdvisory.advisory -and
                    ($_.packages -contains $packageName)
                }
            )

            if ($matchingExceptions.Count -eq 0) {
                $projectBlockedFindings += [pscustomobject]@{
                    project = $project
                    package = $packageName
                    advisory = $resolvedAdvisory.advisory
                    severity = $resolvedAdvisory.severity
                    reason = 'No matching tracked npm audit exception exists for this project/package/advisory combination.'
                }
                continue
            }

            $activeExceptions = @(
                $matchingExceptions | Where-Object {
                    (Convert-ToDateOnly -Value $_.hardExpiry -Label "hardExpiry for advisory '$($_.advisory)'").Date -ge $today
                }
            )

            if ($activeExceptions.Count -eq 0) {
                $projectBlockedFindings += [pscustomobject]@{
                    project = $project
                    package = $packageName
                    advisory = $resolvedAdvisory.advisory
                    severity = $resolvedAdvisory.severity
                    reason = 'The tracked npm audit exception for this finding has expired.'
                }
                continue
            }

            $activeException = $activeExceptions | Select-Object -First 1
            $projectAllowedFindings += [pscustomobject]@{
                project = $project
                package = $packageName
                advisory = $resolvedAdvisory.advisory
                severity = $resolvedAdvisory.severity
                hardExpiry = $activeException.hardExpiry
                ownerRole = $activeException.ownerRole
            }
        }
    }

    $projectSummaries += [pscustomobject]@{
        project = $project
        auditExitCode = $auditExitCode
        reportedHighOrCriticalPackages = @(
            $vulnerabilityProperties | Where-Object { [string]$_.Value.severity -in @('high', 'critical') } | Select-Object -ExpandProperty Name
        )
        allowedFindings = $projectAllowedFindings
        blockedFindings = $projectBlockedFindings
    }

    $allowedFindings += $projectAllowedFindings
    $blockedFindings += $projectBlockedFindings
}

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    manifestPath = $ManifestPath
    totals = [ordered]@{
        allowedFindings = @($allowedFindings).Count
        blockedFindings = @($blockedFindings).Count
        expiredExceptions = @($expiredExceptions).Count
    }
    expiredExceptions = $expiredExceptions
    projects = $projectSummaries
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $OutputRoot 'summary.json') -Encoding UTF8

$summaryLines = @(
    '# npm Audit Summary',
    '',
    "- Generated UTC: $($summary.generatedUtc)",
    "- Allowed findings by active exception: $($summary.totals.allowedFindings)",
    "- Blocking findings: $($summary.totals.blockedFindings)",
    "- Expired exception entries: $($summary.totals.expiredExceptions)",
    ''
)

foreach ($projectSummary in $projectSummaries) {
    $summaryLines += "## $($projectSummary.project)"
    $summaryLines += ''

    if (@($projectSummary.allowedFindings).Count -gt 0) {
        $summaryLines += 'Allowed findings:'
        foreach ($finding in $projectSummary.allowedFindings) {
            $summaryLines += "- $($finding.package) / $($finding.advisory) (expires $($finding.hardExpiry))"
        }
        $summaryLines += ''
    }

    if (@($projectSummary.blockedFindings).Count -gt 0) {
        $summaryLines += 'Blocking findings:'
        foreach ($finding in $projectSummary.blockedFindings) {
            if ([string]::IsNullOrWhiteSpace($finding.advisory)) {
                $summaryLines += "- $($finding.package): $($finding.reason)"
                continue
            }

            $summaryLines += "- $($finding.package) / $($finding.advisory): $($finding.reason)"
        }
        $summaryLines += ''
    }

    if (@($projectSummary.allowedFindings).Count -eq 0 -and @($projectSummary.blockedFindings).Count -eq 0) {
        $summaryLines += 'No high or critical npm audit findings were reported.'
        $summaryLines += ''
    }
}

if (@($expiredExceptions).Count -gt 0) {
    $summaryLines += '## Expired exception entries'
    $summaryLines += ''
    foreach ($entry in $expiredExceptions) {
        $summaryLines += "- $($entry.scope) / $($entry.advisory) expired on $($entry.hardExpiry)"
    }
    $summaryLines += ''
}

$summaryLines | Set-Content -Path (Join-Path $OutputRoot 'summary.md') -Encoding UTF8

Write-Host "npm audit evidence root: $OutputRoot"
Write-Host "Allowed findings by active exception: $($summary.totals.allowedFindings)"
Write-Host "Blocking findings: $($summary.totals.blockedFindings)"
Write-Host "Expired exception entries: $($summary.totals.expiredExceptions)"

if (@($blockedFindings).Count -gt 0 -or @($expiredExceptions).Count -gt 0) {
    throw "npm audit found blocking issues. Review the evidence under '$OutputRoot'."
}
