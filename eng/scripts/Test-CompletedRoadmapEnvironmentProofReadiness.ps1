[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'

function Get-MarkdownTableRows {
    param(
        [string[]]$Lines,
        [string]$Heading,
        [int]$ExpectedCellCount
    )

    $rows = @()
    $inSection = $false
    $foundHeading = $false

    foreach ($line in $Lines) {
        if ($line -eq $Heading) {
            $inSection = $true
            $foundHeading = $true
            continue
        }

        if ($inSection -and $line -like '## *') {
            break
        }

        if (-not $inSection -or -not $line.TrimStart().StartsWith('|')) {
            continue
        }

        $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        if ($cells.Count -ne $ExpectedCellCount) {
            throw "$Heading contains a table row with $($cells.Count) cells; expected $ExpectedCellCount cells: $line"
        }

        if ($cells[0] -eq 'Capability' -or $cells[0] -match '^-+$') {
            continue
        }

        $rows += ,$cells
    }

    if (-not $foundHeading) {
        throw "Completed roadmap TDD matrix is missing required section: $Heading"
    }

    return $rows
}

function Get-EnvironmentProofAssetReferences {
    param([string]$RepoRoot)

    $matrixPath = Join-Path $RepoRoot 'docs\roadmap\completed-roadmap-tdd-matrix.md'
    if (-not (Test-Path $matrixPath)) {
        throw "Completed roadmap TDD matrix is missing: $matrixPath"
    }

    $lines = (Get-Content -Path $matrixPath -Raw) -split "`r?`n"
    $proofReferences = [System.Collections.Generic.List[string]]::new()
    $proofReferences.Add('docs\roadmap\completed-roadmap-tdd-matrix.md')

    $ledgerRows = Get-MarkdownTableRows -Lines $lines -Heading '## Environment-bound proof ledger' -ExpectedCellCount 7
    foreach ($row in $ledgerRows) {
        $commandOrRunbook = [string]$row[2]
        $references = @([regex]::Matches($commandOrRunbook, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value })
        foreach ($reference in $references) {
            if ($reference -notmatch '\.(ps1|md|json|yml|yaml|ts|tsx)$') {
                continue
            }

            $proofReferences.Add(($reference -replace '/', '\'))
        }
    }

    if ($proofReferences -contains 'eng\scripts\Test-DbmProcessExperienceVisual.ps1') {
        $proofReferences.Add('dbm-process-experience\package.json')
    }

    if (
        $proofReferences -contains 'docs\runbooks\live-connected-e2e.md' -or
        $proofReferences -contains 'eng\scripts\Test-R3PortalRuntimeLocalSmoke.ps1' -or
        $proofReferences -contains 'eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1'
    ) {
        $proofReferences.Add('dbm-live-e2e\package.json')
    }

    return @($proofReferences | Select-Object -Unique)
}

$proofAssets = @(Get-EnvironmentProofAssetReferences -RepoRoot $RepoRoot)

$missingRepoAssets = foreach ($relativePath in $proofAssets) {
    $fullPath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        $relativePath
    }
}

if ($missingRepoAssets) {
    throw "Missing repo-owned environment proof assets: $($missingRepoAssets -join ', ')"
}

$readinessWarnings = @()

function Add-ReadinessWarning {
    param([string]$Message)

    $script:readinessWarnings += $Message
}

function Test-CommandAvailable {
    param(
        [string]$Name,
        [string]$Purpose
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Add-ReadinessWarning "$Name is not available on PATH; needed for $Purpose."
    }
}

Test-CommandAvailable -Name 'pwsh' -Purpose 'PowerShell proof wrappers and GitHub Actions parity'
Test-CommandAvailable -Name 'npm' -Purpose 'Node package build, test, and local proof commands'
Test-CommandAvailable -Name 'npx' -Purpose 'Playwright browser installation and package-local CLIs'
Test-CommandAvailable -Name 'az' -Purpose 'Azure token acquisition for live portal runtime proof'
Test-CommandAvailable -Name 'pac' -Purpose 'Dataverse solution deployment and smoke proof commands'

$processExperiencePlaywrightCli = Join-Path $RepoRoot 'dbm-process-experience\node_modules\@playwright\test\cli.js'
if (-not (Test-Path $processExperiencePlaywrightCli)) {
    Add-ReadinessWarning 'dbm-process-experience Playwright CLI is not installed; run eng/scripts/Test-DbmProcessExperienceVisual.ps1 to install package dependencies.'
}

$liveE2EPlaywrightCli = Join-Path $RepoRoot 'dbm-live-e2e\node_modules\@playwright\test\cli.js'
if (-not (Test-Path $liveE2EPlaywrightCli)) {
    Add-ReadinessWarning 'dbm-live-e2e Playwright CLI is not installed; run npm ci in dbm-live-e2e before live E2E or local smoke proof.'
}

if ($env:LOCALAPPDATA) {
    $playwrightBrowserRoot = Join-Path $env:LOCALAPPDATA 'ms-playwright'
    if (-not (Test-Path $playwrightBrowserRoot)) {
        Add-ReadinessWarning "Playwright browser cache is missing at $playwrightBrowserRoot; use -InstallBrowsers on the visual wrapper or the local smoke setup path before browser proof."
    }
}
else {
    Add-ReadinessWarning 'LOCALAPPDATA is not set, so the Playwright browser cache location cannot be checked.'
}

if ($readinessWarnings.Count -gt 0) {
    foreach ($warning in $readinessWarnings) {
        Write-Warning $warning
    }

    if ($Strict) {
        throw "Environment proof readiness warnings were found in strict mode: $($readinessWarnings -join ' ')"
    }
}

Write-Host "Completed-roadmap environment proof readiness check completed with $($readinessWarnings.Count) warning(s)."
