[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'CompletedRoadmapMatrix.Common.ps1')

$matrixPath = Join-Path $RepoRoot 'docs\roadmap\completed-roadmap-tdd-matrix.md'
if (-not (Test-Path $matrixPath)) {
    throw "Completed roadmap TDD matrix is missing: $matrixPath"
}

$matrixRows = @(Get-CompletedRoadmapMatrixRows -RepoRoot $RepoRoot)

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
        Where-Object { [string]$_.VerificationSurface -notmatch '^Automated:\s+\S' } |
        ForEach-Object { $_.Capability }
)

if ($classificationFailures.Count -gt 0) {
    throw "Completed roadmap TDD matrix rows must use direct deterministic Automated verification surfaces only: $($classificationFailures -join ', ')"
}

$nonDeterministicPrimaryRows = @(
    $matrixRows |
        Where-Object { [string]$_.VerificationSurface -match '(Environment-bound|Manual):' } |
        ForEach-Object { $_.Capability }
)

if ($nonDeterministicPrimaryRows.Count -gt 0) {
    throw "Completed roadmap rows must not rely on Environment-bound or Manual proof as primary TDD coverage: $($nonDeterministicPrimaryRows -join ', ')"
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

$ledgerRows = @(Get-CompletedRoadmapProofLedgerRows -RepoRoot $RepoRoot)

if ($ledgerRows.Count -eq 0) {
    throw 'Supplemental live proof ledger does not contain any proof rows.'
}

$unknownLedgerCapabilities = @(
    $ledgerRows |
        Where-Object { $_.Capability -notin $actualCapabilities } |
        ForEach-Object { $_.Capability }
)

if ($unknownLedgerCapabilities.Count -gt 0) {
    throw "Supplemental live proof ledger contains unknown capability routes: $($unknownLedgerCapabilities -join ', ')"
}

$ledgerConsistencyFailures = foreach ($row in $ledgerRows) {
    $matrixRow = @($matrixRows | Where-Object { $_.Capability -eq $row.Capability })[0]

    if ($row.FutureBoundary -ne $matrixRow.FutureBoundary) {
        "$($row.Capability) ledger future boundary '$($row.FutureBoundary)' does not match matrix boundary '$($matrixRow.FutureBoundary)'"
    }
}

if ($ledgerConsistencyFailures) {
    throw "Supplemental live proof ledger must stay consistent with matrix rows: $($ledgerConsistencyFailures -join '; ')"
}

$emptyLedgerFailures = foreach ($row in $ledgerRows) {
    foreach ($propertyName in @('Capability', 'ProofType', 'CommandOrRunbook', 'Prerequisites', 'EvidenceOutput', 'WhyNotCi', 'FutureBoundary')) {
        if ([string]::IsNullOrWhiteSpace([string]$row.$propertyName)) {
            "$($row.Capability) has an empty $propertyName ledger cell"
        }
    }
}

if ($emptyLedgerFailures) {
    throw "Supplemental live proof ledger has empty required cells: $($emptyLedgerFailures -join '; ')"
}

$invalidProofTypes = @(
    $ledgerRows |
        Where-Object { $_.ProofType -notin @('Supplemental live') } |
        ForEach-Object { "$($_.Capability) uses proof type '$($_.ProofType)'" }
)

if ($invalidProofTypes.Count -gt 0) {
    throw "Supplemental live proof ledger proof type must be Supplemental live: $($invalidProofTypes -join '; ')"
}

$missingProofReferences = foreach ($row in $ledgerRows) {
    $references = @([regex]::Matches([string]$row.CommandOrRunbook, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value })
    foreach ($reference in $references) {
        if ($reference -notmatch '\.(ps1|md|json|yml|yaml|ts|tsx)$') {
            continue
        }

        $relativeReference = $reference -replace '/', '\'
        $fullReference = Join-Path $RepoRoot $relativeReference
        if (-not (Test-Path $fullReference)) {
            "$($row.Capability) references missing proof asset '$reference'"
        }
    }
}

if ($missingProofReferences) {
    throw "Supplemental live proof ledger references missing proof assets: $($missingProofReferences -join '; ')"
}

$issueRows = @(Get-CompletedRoadmapIssueRows -RepoRoot $RepoRoot)

if ($issueRows.Count -eq 0) {
    throw 'Retrofit issue log does not contain any issue rows.'
}

$issueRouteFailures = foreach ($row in $issueRows) {
    $routes = @(
        ([string]$row.CapabilityRoute -replace '<br\s*/?>', ';') -split ';' |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($routes.Count -eq 0) {
        "$($row.ExposedBy) has no completed capability route"
        continue
    }

    foreach ($route in $routes) {
        if ($route -notin $actualCapabilities) {
            "$($row.ExposedBy) references unknown capability route '$route'"
        }
    }
}

if ($issueRouteFailures) {
    throw "Retrofit issue log routes must match completed matrix capability rows: $($issueRouteFailures -join '; ')"
}

$parallelPackageIssueRows = @($issueRows | Where-Object { $_.ExposedBy -eq 'Parallel package validation from one worktree' })
if ($parallelPackageIssueRows.Count -ne 1) {
    throw 'Retrofit issue log must contain exactly one round-4 parallel package validation issue row.'
}

$parallelPackageRoutes = @(
    ([string]$parallelPackageIssueRows[0].CapabilityRoute -replace '<br\s*/?>', ';') -split ';' |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

$requiredParallelPackageRoutes = @(
    '`R1.1` canonical model and runtime contract',
    '`R2.3` shared process experience and model-driven host strategy',
    '`R3.1` proof automation'
)

$missingParallelPackageRoutes = @(
    $requiredParallelPackageRoutes |
        Where-Object { $_ -notin $parallelPackageRoutes }
)

if ($missingParallelPackageRoutes.Count -gt 0) {
    throw "Round-4 parallel package validation issue must route to exact completed capabilities: $($missingParallelPackageRoutes -join ', ')"
}

$warningRows = @(Get-CompletedRoadmapWarningRows -RepoRoot $RepoRoot)

if ($warningRows.Count -eq 0) {
    throw 'Verification warning ledger does not contain any warning rows.'
}

$warningLedgerFailures = foreach ($row in $warningRows) {
    foreach ($propertyName in @('WarningSource', 'Classification', 'Warning', 'ExpectedHandling', 'FutureBoundary')) {
        if ([string]::IsNullOrWhiteSpace([string]$row.$propertyName)) {
            "$($row.WarningSource) has an empty $propertyName warning ledger cell"
        }
    }

    if ($row.Classification -notin @('Non-blocking', 'Environment-bound', 'Actionable')) {
        "$($row.WarningSource) uses unsupported warning classification '$($row.Classification)'"
    }
}

if ($warningLedgerFailures) {
    throw "Verification warning ledger entries must be classified and complete: $($warningLedgerFailures -join '; ')"
}

$parallelPackageWarningRows = @($warningRows | Where-Object { $_.WarningSource -eq 'Parallel package validation from one worktree' })
if ($parallelPackageWarningRows.Count -ne 1) {
    throw 'Verification warning ledger must contain exactly one round-4 parallel package validation warning row.'
}

if ($parallelPackageWarningRows[0].Classification -ne 'Actionable') {
    throw 'Round-4 parallel package validation warning must be classified as Actionable.'
}

if ($parallelPackageWarningRows[0].ExpectedHandling -notmatch 'Test-CompletedRoadmapValidation\.ps1') {
    throw 'Round-4 parallel package validation warning must point to the sequential completed-roadmap validation wrapper.'
}

$generatedDriftWarningRows = @($warningRows | Where-Object { $_.WarningSource -eq 'Validation-generated content drift' })
if ($generatedDriftWarningRows.Count -ne 1) {
    throw 'Verification warning ledger must contain exactly one validation-generated content drift warning row.'
}

if ($generatedDriftWarningRows[0].Classification -ne 'Actionable') {
    throw 'Validation-generated content drift warning must be classified as Actionable.'
}

if ($generatedDriftWarningRows[0].ExpectedHandling -notmatch 'completed-roadmap-validation-manifest\.json') {
    throw 'Validation-generated content drift warning must point to the completed-roadmap validation manifest.'
}

$validationWrapperPath = Join-Path $RepoRoot 'eng\scripts\Test-CompletedRoadmapValidation.ps1'
if (-not (Test-Path $validationWrapperPath)) {
    throw "Completed-roadmap sequential validation wrapper is missing: $validationWrapperPath"
}

$validationWrapper = Get-Content -Path $validationWrapperPath -Raw
$validationWrapperRequirements = @(
    @{
        Pattern = '\[string\]\$EvidenceRoot'
        Description = 'accept an -EvidenceRoot parameter'
    },
    @{
        Pattern = 'completed-roadmap-validation-manifest\.json'
        Description = 'write a completed-roadmap validation manifest'
    },
    @{
        Pattern = 'ConvertTo-Json'
        Description = 'serialise the completed-roadmap validation manifest as JSON'
    },
    @{
        Pattern = 'git\s+diff\s+--name-only'
        Description = 'capture tracked content diffs before and after validation'
    },
    @{
        Pattern = 'git\s+ls-files\s+--others\s+--exclude-standard'
        Description = 'capture untracked non-ignored files before and after validation'
    },
    @{
        Pattern = 'git\s+status\s+--porcelain'
        Description = 'capture status-level content drift before and after validation'
    },
    @{
        Pattern = 'statusOnlyNormalised'
        Description = 'record status-only validation churn normalised by the clean-worktree guard'
    },
    @{
        Pattern = 'git\s+restore\s+--worktree'
        Description = 'normalise status-only generated validation churn without committing it'
    },
    @{
        Pattern = 'clean-worktree guard'
        Description = 'fail clearly when validation generates content drift'
    },
    @{
        Pattern = 'closeoutAttestation'
        Description = 'write a closeout attestation manifest section'
    },
    @{
        Pattern = 'targetBranch'
        Description = 'record the intended stable target branch'
    },
    @{
        Pattern = 'pushedTargetBranch'
        Description = 'record target branch push status for TDD closeout'
    },
    @{
        Pattern = 'cleanupActions'
        Description = 'record required TDD branch lifecycle cleanup actions'
    }
)

$validationWrapperFailures = foreach ($requirement in $validationWrapperRequirements) {
    if ($validationWrapper -notmatch $requirement.Pattern) {
        "Completed-roadmap validation wrapper must $($requirement.Description)."
    }
}

if ($validationWrapperFailures) {
    throw "Completed-roadmap validation wrapper contract checks failed: $($validationWrapperFailures -join ' ')"
}

$listOnlyEvidenceRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dbm-completed-roadmap-listonly-{0}" -f ([System.Guid]::NewGuid().ToString('N')))
$listOnlyOutput = @(& $validationWrapperPath -RepoRoot $RepoRoot -ListOnly -EvidenceRoot $listOnlyEvidenceRoot 2>&1 | ForEach-Object { [string]$_ })

if (Test-Path $listOnlyEvidenceRoot) {
    throw "Completed-roadmap validation -ListOnly must not create evidence output: $listOnlyEvidenceRoot"
}

$expectedListOnlyGateScripts = @(
    'eng\scripts\Test-Docs.ps1',
    'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1',
    'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1',
    'eng\scripts\Test-DbmContract.ps1',
    'eng\scripts\Test-DbmLiveE2EDeterministic.ps1',
    'eng\scripts\Test-DbmReleasePromotionContract.ps1',
    'eng\scripts\Test-DbmProcessExperience.ps1',
    'eng\scripts\Test-DbmProcessExperienceVisual.ps1',
    'eng\scripts\Test-DbmPortalRuntime.ps1',
    'eng\scripts\Test-DbmPluginRuntime.ps1',
    'eng\scripts\Test-R3PortalRuntimeAutomation.ps1',
    'eng\scripts\Test-DbmDesignerShell.ps1',
    'eng\scripts\Invoke-NodeBuild.ps1'
)

$listOnlyText = $listOnlyOutput -join "`n"
$missingListOnlyGates = @(
    $expectedListOnlyGateScripts |
        Where-Object { $listOnlyText -notmatch [regex]::Escape($_) }
)

if ($missingListOnlyGates.Count -gt 0) {
    throw "Completed-roadmap validation -ListOnly output is missing expected sequential gates: $($missingListOnlyGates -join ', ')"
}

if ($listOnlyText -match 'completed-roadmap-validation-manifest\.json') {
    throw 'Completed-roadmap validation -ListOnly output must not claim a completed-roadmap validation manifest was written.'
}

$readinessScriptPath = Join-Path $RepoRoot 'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1'
if (-not (Test-Path $readinessScriptPath)) {
    throw "Completed-roadmap environment proof readiness script is missing: $readinessScriptPath"
}

$readinessScript = Get-Content -Path $readinessScriptPath -Raw
if ($readinessScript -match '(?m)^\$repoOwnedProofAssets\s*=\s*@\(') {
    throw 'Completed-roadmap environment proof readiness must derive repo-owned proof assets from the proof ledger instead of maintaining $repoOwnedProofAssets.'
}

$commonParserPath = Join-Path $RepoRoot 'eng\scripts\CompletedRoadmapMatrix.Common.ps1'
if (-not (Test-Path $commonParserPath)) {
    throw "Completed roadmap matrix common parser is missing: $commonParserPath"
}

$commonParser = Get-Content -Path $commonParserPath -Raw
foreach ($requiredFunction in @('Get-CompletedRoadmapMarkdownTableRows', 'Get-EnvironmentProofAssetReferences', 'Get-CompletedRoadmapValidationGateScripts', 'Get-ValidateWorkflowGateScripts', 'Test-CompletedRoadmapCiParity')) {
    if ($commonParser -notmatch "function\s+$([regex]::Escape($requiredFunction))\b") {
        throw "Completed roadmap matrix common parser must define $requiredFunction."
    }
}

Test-CompletedRoadmapCiParity -RepoRoot $RepoRoot

$closeoutWriterPath = Join-Path $RepoRoot 'eng\scripts\Write-CompletedRoadmapCloseoutAttestation.ps1'
if (-not (Test-Path $closeoutWriterPath)) {
    throw "Completed-roadmap durable closeout attestation writer is missing: $closeoutWriterPath"
}

function New-TestValidationManifest {
    param(
        [string]$Path,
        [string]$Status = 'passed',
        [switch]$OmitGateList
    )

    $closeoutAttestation = [ordered]@{
        schemaVersion = 'completed-roadmap-closeout-attestation.v1'
        taskBranch = 'codex/test-closeout'
        taskCommit = '1111111111111111111111111111111111111111'
        targetBranch = 'main'
        verificationStatus = $Status
        pushedTargetBranch = 'pending-post-verification'
        cleanupActions = @(
            [ordered]@{
                action = 'delete-local-task-branch'
                status = 'required-after-successful-verification'
            }
        )
    }

    if (-not $OmitGateList) {
        $closeoutAttestation.gateList = @(
            [ordered]@{
                name = 'Docs'
                script = 'eng\scripts\Test-Docs.ps1'
                arguments = @()
            }
        )
    }

    $manifest = [ordered]@{
        schemaVersion = 'completed-roadmap-validation.v1'
        status = $Status
        branch = 'codex/test-closeout'
        commit = '1111111111111111111111111111111111111111'
        closeoutAttestation = $closeoutAttestation
        gates = @(
            [ordered]@{
                name = 'Docs'
                script = 'eng\scripts\Test-Docs.ps1'
                status = 'passed'
            }
        )
    }

    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $Path -Encoding UTF8
}

function Invoke-ExpectCloseoutWriterFailure {
    param(
        [scriptblock]$ScriptBlock,
        [string]$Description
    )

    try {
        & $ScriptBlock
    }
    catch {
        return
    }

    throw "Completed-roadmap durable closeout attestation writer must fail for $Description."
}

$closeoutWriterTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dbm-closeout-writer-{0}" -f ([System.Guid]::NewGuid().ToString('N')))
New-Item -ItemType Directory -Path $closeoutWriterTestRoot -Force | Out-Null
try {
    $taskWorktreeRoot = Join-Path $closeoutWriterTestRoot 'task-worktree'
    $stableEvidenceRoot = Join-Path $closeoutWriterTestRoot 'stable-evidence'
    New-Item -ItemType Directory -Path $taskWorktreeRoot -Force | Out-Null

    $passedManifestPath = Join-Path $taskWorktreeRoot 'completed-roadmap-validation-manifest.json'
    New-TestValidationManifest -Path $passedManifestPath

    $attestationPath = & $closeoutWriterPath `
        -ValidationManifestPath $passedManifestPath `
        -TargetRepoRoot $RepoRoot `
        -EvidenceRoot $stableEvidenceRoot `
        -TaskWorktreePath $taskWorktreeRoot `
        -TargetBranch 'main' `
        -PushedTargetCommit '2222222222222222222222222222222222222222' `
        -BranchProtectionBypassStatus 'direct-push-bypass-reported' `
        -LocalBranchDeletionStatus 'completed' `
        -RemoteBranchDeletionStatus 'not-applicable' `
        -WorktreeRemovalStatus 'pending' `
        -WorktreePruneStatus 'pending' |
        Select-Object -Last 1

    if (-not (Test-Path $attestationPath)) {
        throw "Completed-roadmap durable closeout attestation writer did not create attestation output: $attestationPath"
    }

    $attestation = Get-Content -Path $attestationPath -Raw | ConvertFrom-Json
    if ($attestation.schemaVersion -ne 'completed-roadmap-closeout-attestation-durable.v1') {
        throw "Completed-roadmap durable closeout attestation has unexpected schema version '$($attestation.schemaVersion)'."
    }

    if ($attestation.validationManifest.sha256 -notmatch '^[A-Fa-f0-9]{64}$') {
        throw 'Completed-roadmap durable closeout attestation must record the copied validation manifest SHA-256 hash.'
    }

    if (-not (Test-Path $attestation.validationManifest.copyPath)) {
        throw 'Completed-roadmap durable closeout attestation must copy the source validation manifest into durable evidence.'
    }

    if ($attestation.validation.status -ne 'passed' -or $attestation.validation.gateList.Count -lt 1) {
        throw 'Completed-roadmap durable closeout attestation must preserve passed verification status and gate list.'
    }

    if ($attestation.target.branchProtectionBypassStatus -ne 'direct-push-bypass-reported') {
        throw 'Completed-roadmap durable closeout attestation must record direct-push branch protection bypass status.'
    }

    $updatedAttestationPath = & $closeoutWriterPath `
        -ExistingAttestationPath $attestationPath `
        -PushedTargetCommit '3333333333333333333333333333333333333333' `
        -LocalBranchDeletionStatus 'completed' `
        -RemoteBranchDeletionStatus 'not-applicable' `
        -WorktreeRemovalStatus 'completed' `
        -WorktreePruneStatus 'completed' |
        Select-Object -Last 1

    $updatedAttestation = Get-Content -Path $updatedAttestationPath -Raw | ConvertFrom-Json
    $worktreeRemovalAction = @($updatedAttestation.cleanupActions | Where-Object { $_.action -eq 'remove-bound-worktree' })[0]
    if ($worktreeRemovalAction.status -ne 'completed') {
        throw 'Completed-roadmap durable closeout attestation update mode must record final worktree removal status.'
    }

    $failedManifestPath = Join-Path $closeoutWriterTestRoot 'failed-validation-manifest.json'
    New-TestValidationManifest -Path $failedManifestPath -Status 'failed'
    Invoke-ExpectCloseoutWriterFailure -Description 'failed validation manifests' -ScriptBlock {
        & $closeoutWriterPath -ValidationManifestPath $failedManifestPath -TargetRepoRoot $RepoRoot -EvidenceRoot (Join-Path $closeoutWriterTestRoot 'failed-evidence')
    }

    $missingGateManifestPath = Join-Path $closeoutWriterTestRoot 'missing-gate-validation-manifest.json'
    New-TestValidationManifest -Path $missingGateManifestPath -OmitGateList
    Invoke-ExpectCloseoutWriterFailure -Description 'missing gate lists' -ScriptBlock {
        & $closeoutWriterPath -ValidationManifestPath $missingGateManifestPath -TargetRepoRoot $RepoRoot -EvidenceRoot (Join-Path $closeoutWriterTestRoot 'missing-gate-evidence')
    }

    Invoke-ExpectCloseoutWriterFailure -Description 'unknown cleanup statuses' -ScriptBlock {
        & $closeoutWriterPath -ValidationManifestPath $passedManifestPath -TargetRepoRoot $RepoRoot -EvidenceRoot (Join-Path $closeoutWriterTestRoot 'unknown-status-evidence') -LocalBranchDeletionStatus 'unknown'
    }

    Invoke-ExpectCloseoutWriterFailure -Description 'evidence roots inside the task worktree' -ScriptBlock {
        & $closeoutWriterPath -ValidationManifestPath $passedManifestPath -TargetRepoRoot $RepoRoot -EvidenceRoot (Join-Path $taskWorktreeRoot 'artifacts\validate\completed-roadmap-closeout') -TaskWorktreePath $taskWorktreeRoot
    }
}
finally {
    if (Test-Path $closeoutWriterTestRoot) {
        Remove-Item -LiteralPath $closeoutWriterTestRoot -Recurse -Force
    }
}

$sharedParserConsumers = @(
    'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1',
    'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1'
)

$sharedParserFailures = foreach ($relativeScript in $sharedParserConsumers) {
    $scriptPath = Join-Path $RepoRoot $relativeScript
    $scriptContent = Get-Content -Path $scriptPath -Raw

    if ($scriptContent -notmatch 'CompletedRoadmapMatrix\.Common\.ps1') {
        "$relativeScript must dot-source CompletedRoadmapMatrix.Common.ps1"
    }

    if ($scriptContent -match 'function\s+Get-MarkdownTableRows\b') {
        "$relativeScript must not carry a local Get-MarkdownTableRows parser"
    }

    if ($relativeScript -ne 'eng\scripts\CompletedRoadmapMatrix.Common.ps1' -and $scriptContent -match 'function\s+Get-EnvironmentProofAssetReferences\b') {
        "$relativeScript must use the shared Get-EnvironmentProofAssetReferences helper"
    }
}

if ($sharedParserFailures) {
    throw "Completed-roadmap validators must share matrix parsing: $($sharedParserFailures -join '; ')"
}

Write-Host 'Completed roadmap TDD matrix checks passed.'
