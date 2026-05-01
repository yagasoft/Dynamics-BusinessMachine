[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$ListOnly,
    [switch]$IncludeVisual,
    [string]$EvidenceRoot,
    [string]$TargetBranch = 'main'
)

$ErrorActionPreference = 'Stop'

$resolvedRepoRoot = (Resolve-Path $RepoRoot).Path

function New-CompletedRoadmapGate {
    param(
        [string]$Name,
        [string]$Script,
        [string]$Description,
        [string[]]$Arguments = @()
    )

    [pscustomobject]@{
        Name = $Name
        Script = $Script
        Description = $Description
        Arguments = @($Arguments)
    }
}

function Get-UtcTimestamp {
    return (Get-Date).ToUniversalTime().ToString('o')
}

function Invoke-RepoGit {
    param([string[]]$Arguments)

    Push-Location $resolvedRepoRoot
    try {
        return @(& git @Arguments | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    finally {
        Pop-Location
    }
}

function Get-TrackedContentDiff {
    Push-Location $resolvedRepoRoot
    try {
        return @(git diff --name-only | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    finally {
        Pop-Location
    }
}

function Get-UntrackedNonIgnoredFiles {
    Push-Location $resolvedRepoRoot
    try {
        return @(git ls-files --others --exclude-standard | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    finally {
        Pop-Location
    }
}

function Get-WorktreeStatus {
    Push-Location $resolvedRepoRoot
    try {
        return @(git status --porcelain=v1 --untracked-files=all | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    finally {
        Pop-Location
    }
}

function Get-NewGitItems {
    param(
        [string[]]$Before,
        [string[]]$After
    )

    return @($After | Where-Object { $_ -notin $Before })
}

function Get-GitStatusPath {
    param([string]$StatusLine)

    if ($StatusLine.Length -lt 4) {
        return $null
    }

    $path = $StatusLine.Substring(3)
    if ($path.StartsWith('"') -and $path.EndsWith('"')) {
        $path = $path.Trim('"')
    }

    return $path
}

function Restore-StatusOnlyGeneratedChanges {
    param([string[]]$StatusLines)

    $restored = [System.Collections.Generic.List[string]]::new()

    foreach ($statusLine in $StatusLines) {
        $path = Get-GitStatusPath -StatusLine $statusLine
        if ([string]::IsNullOrWhiteSpace($path)) {
            continue
        }

        Push-Location $resolvedRepoRoot
        try {
            git restore --worktree -- $path
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to restore status-only generated validation churn: $path"
            }
        }
        finally {
            Pop-Location
        }

        $restored.Add($statusLine)
    }

    return @($restored)
}

function Write-CompletedRoadmapValidationManifest {
    param(
        [System.Collections.IDictionary]$Manifest,
        [string]$ManifestPath
    )

    $Manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $ManifestPath -Encoding UTF8
}

$gates = [System.Collections.Generic.List[object]]::new()
$gates.Add((New-CompletedRoadmapGate -Name 'Docs' -Script 'eng\scripts\Test-Docs.ps1' -Description 'required documentation and CI evidence checks'))
$gates.Add((New-CompletedRoadmapGate -Name 'Completed-roadmap matrix' -Script 'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1' -Description 'capability routing, proof ledger, and warning governance'))
$gates.Add((New-CompletedRoadmapGate -Name 'Environment proof readiness' -Script 'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1' -Description 'repo-owned proof assets and local readiness warnings'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM contract' -Script 'eng\scripts\Test-DbmContract.ps1' -Description 'contract build, tests, and fixture validation'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM live-E2E deterministic' -Script 'eng\scripts\Test-DbmLiveE2EDeterministic.ps1' -Description 'offline fake Dataverse live-E2E runner and portal smoke contract tests'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM release promotion contract' -Script 'eng\scripts\Test-DbmReleasePromotionContract.ps1' -Description 'Dataverse and Azure promotion workflow, backup, and evidence contract tests'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM process experience' -Script 'eng\scripts\Test-DbmProcessExperience.ps1' -Description 'shared process renderer package test and build'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM process experience visual' -Script 'eng\scripts\Test-DbmProcessExperienceVisual.ps1' -Description 'deterministic process renderer visual snapshot proof' -Arguments @('-InstallBrowsers')))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM portal runtime' -Script 'eng\scripts\Test-DbmPortalRuntime.ps1' -Description 'local SPA runtime package test and build'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM plugin runtime' -Script 'eng\scripts\Test-DbmPluginRuntime.ps1' -Description 'legacy Dataverse plugin runtime unit tests'))
$gates.Add((New-CompletedRoadmapGate -Name 'R3 portal runtime automation' -Script 'eng\scripts\Test-R3PortalRuntimeAutomation.ps1' -Description 'local proof orchestration, evidence manifest, and cleanup contract tests'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM designer shell' -Script 'eng\scripts\Test-DbmDesignerShell.ps1' -Description 'designer shell package test and build'))
$gates.Add((New-CompletedRoadmapGate -Name 'Node build' -Script 'eng\scripts\Invoke-NodeBuild.ps1' -Description 'full Node asset build path'))

if ($ListOnly) {
    Write-Output 'Completed-roadmap validation gates run sequentially in this order:'
    for ($index = 0; $index -lt $gates.Count; $index++) {
        $gate = $gates[$index]
        Write-Output ("{0}. {1} - {2} ({3})" -f ($index + 1), $gate.Name, $gate.Script, $gate.Description)
    }

    return
}

if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceRoot = Join-Path $resolvedRepoRoot "artifacts\validate\completed-roadmap-validation\$timestamp"
}
elseif (-not [System.IO.Path]::IsPathRooted($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $resolvedRepoRoot $EvidenceRoot
}

$resolvedEvidenceRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($EvidenceRoot)
New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null
$manifestPath = Join-Path $resolvedEvidenceRoot 'completed-roadmap-validation-manifest.json'

$preTrackedDiff = @(Get-TrackedContentDiff)
$preUntrackedFiles = @(Get-UntrackedNonIgnoredFiles)
$preWorktreeStatus = @(Get-WorktreeStatus)
$currentBranch = (Invoke-RepoGit -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1)
$currentCommit = (Invoke-RepoGit -Arguments @('rev-parse', 'HEAD') | Select-Object -First 1)
$gateList = @(
    $gates | ForEach-Object {
        [ordered]@{
            name = $_.Name
            script = $_.Script
            arguments = @($_.Arguments)
        }
    }
)
$cleanupActions = @(
    'confirm-intended-scope',
    'confirm-no-unrelated-user-changes',
    'commit-completed-work',
    'switch-to-target-branch',
    'merge-task-branch',
    'push-target-branch',
    'delete-local-task-branch',
    'delete-remote-task-branch-if-pushed',
    'remove-bound-worktree',
    'prune-stale-worktree-metadata'
) | ForEach-Object {
    [ordered]@{
        action = $_
        status = 'required-after-successful-verification'
    }
}

$gateResults = @(
    $gates | ForEach-Object {
        [ordered]@{
            name = $_.Name
            script = $_.Script
            description = $_.Description
            status = 'pending'
            startedAtUtc = $null
            endedAtUtc = $null
            error = $null
        }
    }
)

$manifest = [ordered]@{
    schemaVersion = 'completed-roadmap-validation.v1'
    status = 'running'
    startedAtUtc = Get-UtcTimestamp
    endedAtUtc = $null
    repoRoot = $resolvedRepoRoot
    branch = $currentBranch
    commit = $currentCommit
    includeVisual = $true
    evidenceRoot = $resolvedEvidenceRoot
    preRun = [ordered]@{
        trackedDiff = @($preTrackedDiff)
        untrackedNonIgnoredFiles = @($preUntrackedFiles)
        status = @($preWorktreeStatus)
    }
    postRun = $null
    generatedChanges = $null
    gates = $gateResults
    closeoutAttestation = [ordered]@{
        schemaVersion = 'completed-roadmap-closeout-attestation.v1'
        taskBranch = $currentBranch
        taskCommit = $currentCommit
        targetBranch = $TargetBranch
        gateList = $gateList
        verificationStatus = 'running'
        pushedTargetBranch = 'pending-post-verification'
        cleanupActions = @($cleanupActions)
    }
    error = $null
}

Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath

$statusOnlyNormalised = @()

try {
    for ($index = 0; $index -lt $gates.Count; $index++) {
        $gate = $gates[$index]
        $gateResult = $gateResults[$index]
        $scriptPath = Join-Path $resolvedRepoRoot $gate.Script
        if (-not (Test-Path $scriptPath)) {
            throw "Completed-roadmap validation gate script is missing: $($gate.Script)"
        }

        $gateResult.status = 'running'
        $gateResult.startedAtUtc = Get-UtcTimestamp
        Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath

        Write-Host ("[{0}/{1}] {2}: {3}" -f ($index + 1), $gates.Count, $gate.Name, $gate.Description)
        $gateParameters = @{
            RepoRoot = $resolvedRepoRoot
        }

        foreach ($argument in @($gate.Arguments)) {
            if ($argument -match '^-([A-Za-z][A-Za-z0-9]*)$') {
                $gateParameters[$Matches[1]] = $true
                continue
            }

            throw "Completed-roadmap validation gate '$($gate.Script)' has unsupported wrapper argument '$argument'."
        }

        & $scriptPath @gateParameters

        if (-not $?) {
            throw "Completed-roadmap validation gate failed: $($gate.Script)"
        }

        $gateResult.status = 'passed'
        $gateResult.endedAtUtc = Get-UtcTimestamp
        Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath
    }

    $postTrackedDiff = @(Get-TrackedContentDiff)
    $postUntrackedFiles = @(Get-UntrackedNonIgnoredFiles)
    $postWorktreeStatus = @(Get-WorktreeStatus)
    $newTrackedDiff = @(Get-NewGitItems -Before $preTrackedDiff -After $postTrackedDiff)
    $newUntrackedFiles = @(Get-NewGitItems -Before $preUntrackedFiles -After $postUntrackedFiles)
    $newWorktreeStatus = @(Get-NewGitItems -Before $preWorktreeStatus -After $postWorktreeStatus)

    if ($newWorktreeStatus.Count -gt 0 -and $newTrackedDiff.Count -eq 0 -and $newUntrackedFiles.Count -eq 0) {
        $statusOnlyNormalised = @(Restore-StatusOnlyGeneratedChanges -StatusLines $newWorktreeStatus)
        $postTrackedDiff = @(Get-TrackedContentDiff)
        $postUntrackedFiles = @(Get-UntrackedNonIgnoredFiles)
        $postWorktreeStatus = @(Get-WorktreeStatus)
        $newTrackedDiff = @(Get-NewGitItems -Before $preTrackedDiff -After $postTrackedDiff)
        $newUntrackedFiles = @(Get-NewGitItems -Before $preUntrackedFiles -After $postUntrackedFiles)
        $newWorktreeStatus = @(Get-NewGitItems -Before $preWorktreeStatus -After $postWorktreeStatus)
    }

    $manifest.postRun = [ordered]@{
        trackedDiff = @($postTrackedDiff)
        untrackedNonIgnoredFiles = @($postUntrackedFiles)
        status = @($postWorktreeStatus)
    }
    $manifest.generatedChanges = [ordered]@{
        trackedDiff = @($newTrackedDiff)
        untrackedNonIgnoredFiles = @($newUntrackedFiles)
        status = @($newWorktreeStatus)
        statusOnlyNormalised = @($statusOnlyNormalised)
    }

    if ($newTrackedDiff.Count -gt 0 -or $newUntrackedFiles.Count -gt 0 -or $newWorktreeStatus.Count -gt 0) {
        $manifest.status = 'failed'
        $manifest.endedAtUtc = Get-UtcTimestamp
        $manifest.error = 'Completed-roadmap validation clean-worktree guard detected generated content drift.'
        Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath

        $driftSummary = @()
        if ($newTrackedDiff.Count -gt 0) {
            $driftSummary += "new tracked content diffs: $($newTrackedDiff -join ', ')"
        }

        if ($newUntrackedFiles.Count -gt 0) {
            $driftSummary += "new untracked non-ignored files: $($newUntrackedFiles -join ', ')"
        }

        if ($newWorktreeStatus.Count -gt 0) {
            $driftSummary += "new status entries: $($newWorktreeStatus -join ', ')"
        }

        throw "Completed-roadmap validation clean-worktree guard failed; $($driftSummary -join '; '). Evidence manifest: $manifestPath"
    }

    $manifest.status = 'passed'
    $manifest.closeoutAttestation.verificationStatus = 'passed'
    $manifest.endedAtUtc = Get-UtcTimestamp
    Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath
}
catch {
    $manifest.status = 'failed'
    $manifest.closeoutAttestation.verificationStatus = 'failed'
    $manifest.endedAtUtc = Get-UtcTimestamp
    $manifest.error = $_.Exception.Message

    if ($null -eq $manifest.postRun) {
        $postTrackedDiff = @(Get-TrackedContentDiff)
        $postUntrackedFiles = @(Get-UntrackedNonIgnoredFiles)
        $postWorktreeStatus = @(Get-WorktreeStatus)
        $manifest.postRun = [ordered]@{
            trackedDiff = @($postTrackedDiff)
            untrackedNonIgnoredFiles = @($postUntrackedFiles)
            status = @($postWorktreeStatus)
        }
        $manifest.generatedChanges = [ordered]@{
            trackedDiff = @(Get-NewGitItems -Before $preTrackedDiff -After $postTrackedDiff)
            untrackedNonIgnoredFiles = @(Get-NewGitItems -Before $preUntrackedFiles -After $postUntrackedFiles)
            status = @(Get-NewGitItems -Before $preWorktreeStatus -After $postWorktreeStatus)
            statusOnlyNormalised = @($statusOnlyNormalised)
        }
    }

    Write-CompletedRoadmapValidationManifest -Manifest $manifest -ManifestPath $manifestPath
    throw
}

Write-Host "Completed-roadmap validation passed. Evidence manifest: $manifestPath"
