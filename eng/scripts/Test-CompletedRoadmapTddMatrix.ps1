[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$matrixPath = Join-Path $RepoRoot 'docs\roadmap\completed-roadmap-tdd-matrix.md'
if (-not (Test-Path $matrixPath)) {
    throw "Completed roadmap TDD matrix is missing: $matrixPath"
}

$content = Get-Content -Path $matrixPath -Raw
$lines = $content -split "`r?`n"

$matrixRows = @()
$inMatrix = $false
foreach ($line in $lines) {
    if ($line -eq '## Matrix') {
        $inMatrix = $true
        continue
    }

    if ($inMatrix -and $line -like '## *') {
        break
    }

    if (-not $inMatrix -or -not $line.TrimStart().StartsWith('|')) {
        continue
    }

    $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
    if ($cells.Count -ne 5 -or $cells[0] -eq 'Capability' -or $cells[0] -match '^-+$') {
        continue
    }

    $matrixRows += [pscustomobject]@{
        Capability = $cells[0]
        CompletedBehaviour = $cells[1]
        TddAnchor = $cells[2]
        VerificationSurface = $cells[3]
        FutureBoundary = $cells[4]
    }
}

if ($matrixRows.Count -eq 0) {
    throw 'Completed roadmap TDD matrix does not contain any capability rows.'
}

$expectedCapabilities = @(
    '`R0.1` product governance and tracked docs',
    '`R0.2` repo and branching foundation',
    '`R0.3` delivery and secret-management foundation',
    '`R0.4` environment and recovery baseline',
    '`R1.1` canonical model and runtime contract',
    '`R1.2.1` process semantics and contract alignment',
    '`R1.2.2` advanced designer UX foundation',
    '`R1.2.3a` Dataverse synthesis foundation',
    '`R1.2.3b` existing forms and behaviour synthesis',
    '`R1.2.4` host adapters and portability completion',
    '`R1.3` execution engine and model-driven runtime',
    '`R1.4` reference solution and release hardening',
    '`R2.1` long-term designer shell and workspace contract',
    '`R2.2` graph-first authoring and preview-first designer',
    '`R2.3` shared process experience and model-driven host strategy',
    '`R2.4` synthesis expansion, portal continuity fixtures, and release hardening',
    '`R2.5` generic existing-form authoring and Dev proof',
    '`R3.1` contract',
    '`R3.1` renderer',
    '`R3.1` local host',
    '`R3.1` SPA client',
    '`R3.1` synthesis',
    '`R3.1` plugin authority',
    '`R3.1` proof automation'
)

$actualCapabilities = @($matrixRows | ForEach-Object { $_.Capability })
$missingCapabilities = @($expectedCapabilities | Where-Object { $_ -notin $actualCapabilities })
$unexpectedCapabilities = @($actualCapabilities | Where-Object { $_ -notin $expectedCapabilities })

if ($missingCapabilities.Count -gt 0) {
    throw "Completed roadmap TDD matrix is missing expected capability rows: $($missingCapabilities -join ', ')"
}

if ($unexpectedCapabilities.Count -gt 0) {
    throw "Completed roadmap TDD matrix contains unexpected capability rows: $($unexpectedCapabilities -join ', ')"
}

$emptyFailures = foreach ($row in $matrixRows) {
    foreach ($propertyName in @('CompletedBehaviour', 'TddAnchor', 'VerificationSurface', 'FutureBoundary')) {
        if ([string]::IsNullOrWhiteSpace([string]$row.$propertyName)) {
            "$($row.Capability) has an empty $propertyName cell"
        }
    }
}

if ($emptyFailures) {
    throw "Completed roadmap TDD matrix has empty required cells: $($emptyFailures -join '; ')"
}

$classificationFailures = @(
    $matrixRows |
        Where-Object { [string]$_.VerificationSurface -notmatch '^(Automated|Environment-bound|Manual):\s+\S' } |
        ForEach-Object { $_.Capability }
)

if ($classificationFailures.Count -gt 0) {
    throw "Completed roadmap TDD matrix rows must classify verification surfaces as Automated, Environment-bound, or Manual: $($classificationFailures -join ', ')"
}

$futureScopePatterns = @(
    '\bqueues?\b',
    '\breassignment\b',
    '\bdelegation\b',
    '\bescalation\b',
    '\bSLA\b',
    'Azure orchestration',
    '\bservice plane\b',
    '\btimeline\b',
    '\baudit\b',
    'hosted front[- ]door',
    'durable external identity',
    '\bAI\b',
    '\bsimulation\b',
    'governance-at-scale'
)

$futureScopeFailures = foreach ($row in $matrixRows) {
    $implementedText = @(
        [string]$row.CompletedBehaviour,
        [string]$row.TddAnchor,
        [string]$row.VerificationSurface
    ) -join ' '

    foreach ($pattern in $futureScopePatterns) {
        if ($implementedText -match $pattern) {
            "$($row.Capability) includes future-scope term '$pattern' outside the boundary column"
        }
    }
}

if ($futureScopeFailures) {
    throw "Completed roadmap TDD matrix appears to include future roadmap scope as implemented coverage: $($futureScopeFailures -join '; ')"
}

Write-Host 'Completed roadmap TDD matrix checks passed.'
