[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'

$repoOwnedProofAssets = @(
    'docs\roadmap\completed-roadmap-tdd-matrix.md',
    'docs\runbooks\designer-hosted-validation.md',
    'docs\runbooks\live-connected-e2e.md',
    'docs\runbooks\uat-promotion-runbook.md',
    'docs\runbooks\r2-generic-existing-form-dev-proof.md',
    'eng\scripts\Test-DataverseSmoke.ps1',
    'eng\scripts\Test-DbmProcessExperienceVisual.ps1',
    'eng\scripts\Test-R3PortalRuntimeLocalSmoke.ps1',
    'eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1',
    'dbm-process-experience\package.json',
    'dbm-live-e2e\package.json'
)

$missingRepoAssets = foreach ($relativePath in $repoOwnedProofAssets) {
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
