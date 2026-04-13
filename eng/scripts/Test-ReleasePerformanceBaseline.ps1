[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment = 'Dev',

    [string]$DataverseUrl,

    [string]$OutputRoot,

    [string]$AssemblyKeyFile,

    [switch]$SkipDeployment
)

$ErrorActionPreference = 'Stop'

$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($DataverseUrl)) {
    $environmentConfigPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    if (-not (Test-Path $environmentConfigPath)) {
        throw "Environment config is missing: $environmentConfigPath"
    }

    $environmentConfig = Get-Content -Path $environmentConfigPath -Raw | ConvertFrom-Json
    $DataverseUrl = [string]$environmentConfig.dataverseUrl
}

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
    $OutputRoot = Join-Path $RepoRoot ("artifacts\performance\r1\{0}\{1}" -f $version.solutionVersion, $timestamp)
}

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$logsRoot = Join-Path $OutputRoot 'logs'
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null

$gitBranch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to resolve the current Git branch for the release performance baseline.'
}

$gitCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to resolve the current Git commit for the release performance baseline.'
}

$originalAssemblyKeyFile = $env:DBM_ASSEMBLY_KEY_FILE
if (-not [string]::IsNullOrWhiteSpace($AssemblyKeyFile)) {
    $env:DBM_ASSEMBLY_KEY_FILE = $AssemblyKeyFile
}

$report = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    release = [ordered]@{
        line = 'R1'
        version = [string]$version.solutionVersion
        semVer = [string]$version.semVer
        branch = $gitBranch
        commitSha = $gitCommit
    }
    environment = [ordered]@{
        name = $TargetEnvironment
        dataverseUrl = $DataverseUrl
    }
    baseline = [ordered]@{
        name = 'r1-release-performance'
        kind = 'wall-clock'
        sampleCount = 1
    }
    status = 'pass'
    totalElapsedMs = 0
    operations = @()
    notes = @(
        'R1 baseline measures the release-shaped engineering path rather than load or concurrency behavior.',
        'Portal runtime, AI assistance, and rapid-deploy inner-loop timings are intentionally excluded from this release baseline.'
    )
}

function Invoke-BaselineOperation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Category,

        [Parameter(Mandatory = $true)]
        [string]$CommandText,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,

        [string[]]$Evidence = @()
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 'pass'
    $errorMessage = $null

    try {
        & $Action
    }
    catch {
        $status = 'fail'
        $errorMessage = $_.Exception.Message
        throw
    }
    finally {
        $stopwatch.Stop()
        $report.operations += [ordered]@{
            name = $Name
            category = $Category
            status = $status
            elapsedMs = [int][Math]::Round($stopwatch.Elapsed.TotalMilliseconds, 0)
            command = $CommandText
            evidence = @($Evidence | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            error = $errorMessage
        }
    }
}

$overallStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    Invoke-BaselineOperation `
        -Name 'repo-validation' `
        -Category 'repo' `
        -CommandText 'Test-RepoHygiene.ps1; Test-Docs.ps1; Test-EnvironmentBaseline.ps1' `
        -Evidence @(
            'artifacts/security/npm-audit/summary.md',
            'azure/config/dev.json',
            'azure/config/uat.json',
            'azure/config/prod.json'
        ) `
        -Action {
            & (Join-Path $PSScriptRoot 'Test-RepoHygiene.ps1') -RepoRoot $RepoRoot
            & (Join-Path $PSScriptRoot 'Test-Docs.ps1') -RepoRoot $RepoRoot
            & (Join-Path $PSScriptRoot 'Test-EnvironmentBaseline.ps1') -RepoRoot $RepoRoot
        }

    Invoke-BaselineOperation `
        -Name 'build-and-synthesis' `
        -Category 'build' `
        -CommandText 'Invoke-NodeBuild.ps1; Test-DbmDataverseSynthesis.ps1; Invoke-DataverseSynthesis.ps1 -Mode Plan; Invoke-DataverseSynthesis.ps1 -Mode EmitSource' `
        -Evidence @(
            'artifacts/validate/dbm-dataverse-synthesis/plan.json',
            'artifacts/validate/dbm-dataverse-synthesis/generated-source'
        ) `
        -Action {
            & (Join-Path $PSScriptRoot 'Invoke-NodeBuild.ps1') `
                -RepoRoot $RepoRoot `
                -Projects @('dbm-contract', 'dbm-designer-core', 'dbm-dataverse-synthesis', 'dbm-app')
            & (Join-Path $PSScriptRoot 'Test-DbmDataverseSynthesis.ps1') -RepoRoot $RepoRoot
        }

    Invoke-BaselineOperation `
        -Name 'package-dataverse' `
        -Category 'package' `
        -CommandText 'Invoke-DataversePackaging.ps1 -PackageSet Full -RunSolutionCheck:$false' `
        -Evidence @(
            'artifacts/dataverse/package-manifest.json'
        ) `
        -Action {
            & (Join-Path $PSScriptRoot 'Invoke-DataversePackaging.ps1') `
                -RepoRoot $RepoRoot `
                -OutputRoot (Join-Path $RepoRoot 'artifacts\dataverse') `
                -PackageSet Full `
                -RunSolutionCheck:$false
        }

    if (-not $SkipDeployment) {
        Invoke-BaselineOperation `
            -Name 'deploy-dataverse-dev' `
            -Category 'deploy' `
            -CommandText "Invoke-DataverseDeployment.ps1 -TargetEnvironment $TargetEnvironment -AllowSameVersionImport" `
            -Evidence @(
                'artifacts/dataverse/deployment-evidence/deployment-summary.json'
            ) `
            -Action {
                & (Join-Path $PSScriptRoot 'Invoke-DataverseDeployment.ps1') `
                    -TargetEnvironment $TargetEnvironment `
                    -PackageRoot (Join-Path $RepoRoot 'artifacts\dataverse') `
                    -DataverseUrl $DataverseUrl `
                    -AllowSameVersionImport
            }

        Invoke-BaselineOperation `
            -Name 'smoke-validation' `
            -Category 'smoke' `
            -CommandText "Test-DataverseSmoke.ps1 -TargetEnvironment $TargetEnvironment" `
            -Evidence @(
                'artifacts/deployment-evidence/smoke-test-summary.md',
                'artifacts/deployment-evidence/generated-metadata/drift-report.json'
            ) `
            -Action {
                & (Join-Path $PSScriptRoot 'Test-DataverseSmoke.ps1') `
                    -TargetEnvironment $TargetEnvironment `
                    -DataverseUrl $DataverseUrl
            }
    }
}
catch {
    $report.status = 'fail'
    $report.notes += "Baseline execution stopped after a failure: $($_.Exception.Message)"
}
finally {
    $overallStopwatch.Stop()
    $report.totalElapsedMs = [int][Math]::Round($overallStopwatch.Elapsed.TotalMilliseconds, 0)

    $jsonPath = Join-Path $OutputRoot 'performance-baseline.json'
    $markdownPath = Join-Path $OutputRoot 'performance-baseline.md'

    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath -Encoding UTF8

    $markdown = @(
        '# R1 Performance Baseline',
        '',
        "Generated: $($report.generatedUtc)",
        ('Release: `R1` / `{0}` (`{1}` @ `{2}`)' -f $report.release.version, $report.release.branch, $report.release.commitSha.Substring(0, 12)),
        ('Environment: `{0}` / `{1}`' -f $report.environment.name, $report.environment.dataverseUrl),
        ('Status: `{0}`' -f $report.status),
        "Total elapsed: $([Math]::Round(($report.totalElapsedMs / 1000), 2)) seconds",
        '',
        '| Operation | Category | Status | Elapsed (s) | Evidence |',
        '| --- | --- | --- | ---: | --- |'
    )

    foreach ($operation in $report.operations) {
        $evidenceText = if ($operation.evidence.Count -gt 0) {
            ($operation.evidence -join '<br>')
        }
        else {
            '-'
        }

        $markdown += "| $($operation.name) | $($operation.category) | $($operation.status) | $([Math]::Round(($operation.elapsedMs / 1000), 2)) | $evidenceText |"
    }

    if ($report.notes.Count -gt 0) {
        $markdown += ''
        $markdown += '## Notes'
        foreach ($note in $report.notes) {
            $markdown += "- $note"
        }
    }

    Set-Content -Path $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    if (-not [string]::IsNullOrWhiteSpace($AssemblyKeyFile)) {
        $env:DBM_ASSEMBLY_KEY_FILE = $originalAssemblyKeyFile
    }
}

if ($report.status -ne 'pass') {
    throw "R1 release performance baseline failed. See '$(Join-Path $OutputRoot 'performance-baseline.md')'."
}

Write-Host "Performance baseline JSON: $(Join-Path $OutputRoot 'performance-baseline.json')"
Write-Host "Performance baseline Markdown: $(Join-Path $OutputRoot 'performance-baseline.md')"
