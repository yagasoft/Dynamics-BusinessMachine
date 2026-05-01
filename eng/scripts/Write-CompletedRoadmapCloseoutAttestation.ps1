[CmdletBinding()]
param(
    [string]$ValidationManifestPath,
    [string]$ExistingAttestationPath,
    [string]$TargetRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$EvidenceRoot,
    [string]$TaskWorktreePath,
    [string]$TargetBranch,
    [string]$PushedTargetCommit,
    [ValidateSet('not-observed', 'none', 'direct-push-bypass-reported', 'emergency-admin-bypass-reported')]
    [string]$BranchProtectionBypassStatus,
    [ValidateSet('pending', 'completed', 'not-applicable', 'blocked')]
    [string]$LocalBranchDeletionStatus = 'pending',
    [ValidateSet('pending', 'completed', 'not-applicable', 'blocked')]
    [string]$RemoteBranchDeletionStatus = 'pending',
    [ValidateSet('pending', 'completed', 'not-applicable', 'blocked')]
    [string]$WorktreeRemovalStatus = 'pending',
    [ValidateSet('pending', 'completed', 'not-applicable', 'blocked')]
    [string]$WorktreePruneStatus = 'pending'
)

$ErrorActionPreference = 'Stop'

function Get-UtcTimestamp {
    return (Get-Date).ToUniversalTime().ToString('o')
}

function Resolve-OutputPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    }

    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $TargetRepoRoot $Path))
}

function Test-IsSameOrChildPath {
    param(
        [string]$ChildPath,
        [string]$ParentPath
    )

    $childFull = [System.IO.Path]::GetFullPath($ChildPath).TrimEnd('\', '/')
    $parentFull = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\', '/')

    if ($childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    return $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-RequiredGateList {
    param([object]$Manifest)

    if ($null -eq $Manifest.closeoutAttestation) {
        throw 'Validation manifest is missing closeoutAttestation.'
    }

    if ($null -eq $Manifest.closeoutAttestation.gateList) {
        throw 'Validation manifest closeoutAttestation is missing a gate list.'
    }

    $gateList = @($Manifest.closeoutAttestation.gateList | Where-Object { $null -ne $_ })
    if ($gateList.Count -eq 0) {
        throw 'Validation manifest closeoutAttestation is missing a gate list.'
    }

    return $gateList
}

function Assert-PassedValidationManifest {
    param([object]$Manifest)

    if ($Manifest.status -ne 'passed') {
        throw "Validation manifest must have status 'passed'; actual status '$($Manifest.status)'."
    }

    if ($Manifest.closeoutAttestation.verificationStatus -ne 'passed') {
        throw "Validation manifest closeoutAttestation must have verificationStatus 'passed'; actual status '$($Manifest.closeoutAttestation.verificationStatus)'."
    }

    [void](Get-RequiredGateList -Manifest $Manifest)
}

function New-CleanupActions {
    return @(
        [ordered]@{
            action = 'delete-local-task-branch'
            status = $LocalBranchDeletionStatus
        },
        [ordered]@{
            action = 'delete-remote-task-branch-if-pushed'
            status = $RemoteBranchDeletionStatus
        },
        [ordered]@{
            action = 'remove-bound-worktree'
            status = $WorktreeRemovalStatus
        },
        [ordered]@{
            action = 'prune-stale-worktree-metadata'
            status = $WorktreePruneStatus
        }
    )
}

function Set-CleanupActionStatus {
    param(
        [object]$Attestation,
        [string]$Action,
        [string]$Status
    )

    $cleanupAction = @($Attestation.cleanupActions | Where-Object { $_.action -eq $Action })[0]
    if ($null -eq $cleanupAction) {
        throw "Durable closeout attestation is missing cleanup action '$Action'."
    }

    $cleanupAction.status = $Status
}

function Write-JsonFile {
    param(
        [object]$Value,
        [string]$Path
    )

    $Value | ConvertTo-Json -Depth 12 | Set-Content -Path $Path -Encoding UTF8
}

$resolvedTargetRepoRoot = (Resolve-Path $TargetRepoRoot).Path
$TargetRepoRoot = $resolvedTargetRepoRoot

if ([string]::IsNullOrWhiteSpace($ValidationManifestPath) -eq [string]::IsNullOrWhiteSpace($ExistingAttestationPath)) {
    throw 'Specify exactly one of -ValidationManifestPath or -ExistingAttestationPath.'
}

if (-not [string]::IsNullOrWhiteSpace($ExistingAttestationPath)) {
    $resolvedExistingAttestationPath = (Resolve-Path $ExistingAttestationPath).Path
    $existingAttestation = Get-Content -Path $resolvedExistingAttestationPath -Raw | ConvertFrom-Json

    if ($existingAttestation.schemaVersion -ne 'completed-roadmap-closeout-attestation-durable.v1') {
        throw "Existing attestation has unexpected schema version '$($existingAttestation.schemaVersion)'."
    }

    if (-not [string]::IsNullOrWhiteSpace($PushedTargetCommit)) {
        $existingAttestation.target.pushedCommit = $PushedTargetCommit
        $existingAttestation.target.pushedTargetBranchStatus = 'pushed'
    }

    if (-not [string]::IsNullOrWhiteSpace($BranchProtectionBypassStatus)) {
        $existingAttestation.target.branchProtectionBypassStatus = $BranchProtectionBypassStatus
    }

    Set-CleanupActionStatus -Attestation $existingAttestation -Action 'delete-local-task-branch' -Status $LocalBranchDeletionStatus
    Set-CleanupActionStatus -Attestation $existingAttestation -Action 'delete-remote-task-branch-if-pushed' -Status $RemoteBranchDeletionStatus
    Set-CleanupActionStatus -Attestation $existingAttestation -Action 'remove-bound-worktree' -Status $WorktreeRemovalStatus
    Set-CleanupActionStatus -Attestation $existingAttestation -Action 'prune-stale-worktree-metadata' -Status $WorktreePruneStatus
    $existingAttestation.updatedAtUtc = Get-UtcTimestamp

    Write-JsonFile -Value $existingAttestation -Path $resolvedExistingAttestationPath
    Write-Output $resolvedExistingAttestationPath
    return
}

$resolvedValidationManifestPath = (Resolve-Path $ValidationManifestPath).Path
$validationManifest = Get-Content -Path $resolvedValidationManifestPath -Raw | ConvertFrom-Json
Assert-PassedValidationManifest -Manifest $validationManifest

if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceRoot = Join-Path $resolvedTargetRepoRoot "artifacts\validate\completed-roadmap-closeout\$timestamp"
}

$resolvedEvidenceRoot = Resolve-OutputPath -Path $EvidenceRoot

if (-not [string]::IsNullOrWhiteSpace($TaskWorktreePath)) {
    $resolvedTaskWorktreePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($TaskWorktreePath)
    if (Test-IsSameOrChildPath -ChildPath $resolvedEvidenceRoot -ParentPath $resolvedTaskWorktreePath) {
        throw 'Durable closeout evidence root must not be inside the AI task worktree that may be removed.'
    }
}

New-Item -ItemType Directory -Path $resolvedEvidenceRoot -Force | Out-Null

$manifestCopyPath = Join-Path $resolvedEvidenceRoot 'completed-roadmap-validation-manifest.json'
Copy-Item -LiteralPath $resolvedValidationManifestPath -Destination $manifestCopyPath -Force
$manifestHash = (Get-FileHash -LiteralPath $manifestCopyPath -Algorithm SHA256).Hash.ToLowerInvariant()
$attestationPath = Join-Path $resolvedEvidenceRoot 'completed-roadmap-closeout-attestation.json'

$sourceAttestation = $validationManifest.closeoutAttestation
$targetBranchValue = if ([string]::IsNullOrWhiteSpace($TargetBranch)) { $sourceAttestation.targetBranch } else { $TargetBranch }
$branchProtectionBypassValue = if ([string]::IsNullOrWhiteSpace($BranchProtectionBypassStatus)) { 'not-observed' } else { $BranchProtectionBypassStatus }
$pushedTargetBranchStatus = if ([string]::IsNullOrWhiteSpace($PushedTargetCommit)) { 'pending' } else { 'pushed' }

$durableAttestation = [ordered]@{
    schemaVersion = 'completed-roadmap-closeout-attestation-durable.v1'
    createdAtUtc = Get-UtcTimestamp
    updatedAtUtc = Get-UtcTimestamp
    validationManifest = [ordered]@{
        sourcePath = $resolvedValidationManifestPath
        copyPath = $manifestCopyPath
        sha256 = $manifestHash
    }
    task = [ordered]@{
        branch = $sourceAttestation.taskBranch
        commit = $sourceAttestation.taskCommit
    }
    target = [ordered]@{
        repoRoot = $resolvedTargetRepoRoot
        branch = $targetBranchValue
        pushedCommit = $PushedTargetCommit
        pushedTargetBranchStatus = $pushedTargetBranchStatus
        branchProtectionBypassStatus = $branchProtectionBypassValue
    }
    validation = [ordered]@{
        status = $sourceAttestation.verificationStatus
        gateList = @(Get-RequiredGateList -Manifest $validationManifest)
    }
    cleanupActions = @(New-CleanupActions)
}

Write-JsonFile -Value $durableAttestation -Path $attestationPath
Write-Output $attestationPath
