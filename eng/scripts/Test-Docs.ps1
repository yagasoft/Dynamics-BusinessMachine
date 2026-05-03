[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$requiredDocs = @(
    'docs\README.md',
    'docs\adr\0008-canonical-contract-authority-and-format.md',
    'docs\releases\release-governance.md',
    'docs\adr\0005-versioning-and-release-branch-policy.md',
    'docs\adr\0006-dataverse-alm-source-and-packaging-model.md',
    'docs\adr\0007-github-oidc-key-vault-and-federated-delivery.md',
    'docs\adr\0010-dataverse-metadata-synthesis-and-layered-generated-solution-strategy.md',
    'docs\adr\0012-generic-existing-form-authoring-required-for-r2-closeout.md',
    'docs\adr\0015-dataverse-first-roadmap-and-azure-deferral.md',
    'docs\adr\0016-product-roadmap-reset-process-first.md',
    'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md',
    'docs\architecture\canonical-model-runtime-contract-v1.md',
    'docs\architecture\examples\approval-request-v1.model.json',
    'docs\architecture\examples\generic-existing-form-v1.model.json',
    'docs\runbooks\dev-deployment-runbook.md',
    'docs\runbooks\uat-promotion-runbook.md',
    'docs\runbooks\prod-promotion-runbook.md',
    'docs\runbooks\secret-rotation-and-identity-recovery.md',
    'docs\runbooks\local-bootstrap-and-build.md',
    'docs\runbooks\designer-hosted-validation.md',
    'docs\runbooks\r2-generic-existing-form-dev-proof.md',
    'docs\runbooks\live-connected-e2e.md',
    'docs\runbooks\codex-dataverse-metadata-synthesis-skill-handoff.md',
    'docs\roadmap\completed-roadmap-tdd-matrix.md'
)

$missing = foreach ($relativePath in $requiredDocs) {
    $fullPath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        $relativePath
    }
}

if ($missing) {
    throw "Missing required documentation files: $($missing -join ', ')"
}

$requiredScripts = @(
    'eng\scripts\CompletedRoadmapMatrix.Common.ps1',
    'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1',
    'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1',
    'eng\scripts\Test-CompletedRoadmapValidation.ps1',
    'eng\scripts\Test-DbmLiveE2EDeterministic.ps1',
    'eng\scripts\Test-DbmReleasePromotionContract.ps1',
    'eng\scripts\Test-DbmProcessExperience.ps1',
    'eng\scripts\Test-DbmProcessExperienceVisual.ps1',
    'eng\scripts\Test-DbmPortalRuntime.ps1',
    'eng\scripts\Test-DbmPluginRuntime.ps1',
    'eng\scripts\Test-R3PortalRuntimeAutomation.ps1',
    'eng\scripts\Test-DbmDesignerShell.ps1',
    'eng\scripts\Test-RoadmapReset.ps1',
    'eng\scripts\Write-CompletedRoadmapCloseoutAttestation.ps1'
)

$missingScripts = foreach ($relativePath in $requiredScripts) {
    $fullPath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        $relativePath
    }
}

if ($missingScripts) {
    throw "Missing required validation scripts: $($missingScripts -join ', ')"
}

$contentChecks = @(
    @{
        Path = 'AGENTS.md'
        Pattern = 'TDD branch lifecycle policy'
        Description = 'AGENTS.md must define the TDD branch lifecycle policy.'
    },
    @{
        Path = 'AGENTS.md'
        Pattern = 'automatic merge, push, branch purge, worktree removal, and stale metadata prune'
        Description = 'AGENTS.md must require automatic successful-TDD branch lifecycle cleanup.'
    },
    @{
        Path = 'AGENTS.md'
        Pattern = 'durable closeout evidence'
        Description = 'AGENTS.md must require durable closeout evidence before AI worktree cleanup.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'TDD evidence policy'
        Description = 'Release governance must define the TDD evidence policy.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'CI parity and closeout attestation'
        Description = 'Release governance must define completed-roadmap CI parity and closeout attestation expectations.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'durable closeout evidence'
        Description = 'Release governance must define durable closeout evidence expectations.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'automatic merge, push, branch purge, worktree removal, and stale metadata prune'
        Description = 'Release governance must require automatic successful-TDD branch lifecycle cleanup.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'Sequential completed-roadmap validation'
        Description = 'Release governance must define sequential completed-roadmap validation evidence.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'branch-protection bypass'
        Description = 'Release governance must define branch-protection bypass evidence expectations.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'completed-roadmap validation manifest'
        Description = 'Release governance must require completed-roadmap validation manifest evidence.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'clean-worktree guard'
        Description = 'Release governance must define the completed-roadmap clean-worktree guard.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'direct deterministic automated coverage'
        Description = 'Release governance must require direct deterministic automated completed-roadmap coverage.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'supplemental live proof'
        Description = 'Release governance must define live proof as supplemental evidence only.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'Dataverse-owned operational configuration and secret posture'
        Description = 'Release governance must define Dataverse-owned operational configuration and secret posture.'
    },
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = '| `R1` | Process/stage designer and actual form render |'
        Description = 'Release plan must restart product delivery at the new process/stage R1.'
    },
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = '| `R9` | AI-assisted platform |'
        Description = 'Release plan must defer AI to R9.'
    },
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = 'current implementation is prototype/reference material'
        Description = 'Release plan must classify the current implementation as prototype/reference material.'
    },
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = 'ADR-0016'
        Description = 'Release plan must reference ADR-0016 for the process-first reset.'
    },
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = 'ADR-0017'
        Description = 'Release plan must reference ADR-0017 for collaborative authoring.'
    },
    @{
        Path = 'docs\adr\README.md'
        Pattern = '0017-collaborative-authoring-and-code-apps-designer.md'
        Description = 'ADR index must reference ADR-0017.'
    },
    @{
        Path = 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md'
        Pattern = 'Dataverse-normalised authoring rows'
        Description = 'ADR-0017 must record Dataverse-normalised authoring rows.'
    },
    @{
        Path = 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md'
        Pattern = 'dbm_designersession'
        Description = 'ADR-0017 must record designer-session presence.'
    },
    @{
        Path = 'docs\architecture\canonical-model-runtime-contract-v1.md'
        Pattern = 'Presence sessions never grant or deny edits'
        Description = 'Canonical model contract must keep designer sessions separate from edit authority.'
    },
    @{
        Path = 'docs\roadmap\release-3-back-office-runtime.md'
        Pattern = 'Back-office runtime'
        Description = 'Release 3 plan must define the back-office runtime release.'
    },
    @{
        Path = 'docs\roadmap\release-5-portal-runtime-and-return-path.md'
        Pattern = 'Portal runtime and return path'
        Description = 'Release 5 plan must define the portal runtime and return path release.'
    },
    @{
        Path = 'docs\roadmap\capability-map.md'
        Pattern = '`R1` process/stage designer and actual form render'
        Description = 'Capability map must show the new R1 process/stage release.'
    },
    @{
        Path = 'docs\roadmap\capability-map.md'
        Pattern = '`R9` AI-assisted platform'
        Description = 'Capability map must defer AI to R9.'
    },
    @{
        Path = 'docs\adr\README.md'
        Pattern = '0015-dataverse-first-roadmap-and-azure-deferral.md'
        Description = 'ADR index must reference ADR-0015.'
    },
    @{
        Path = 'docs\architecture\product-principles.md'
        Pattern = 'Dataverse is the near-term default for runtime authority, operational configuration, and platform-owned secrets.'
        Description = 'Product principles must record the Dataverse-first operational default.'
    },
    @{
        Path = 'docs\architecture\target-platform-architecture.md'
        Pattern = 'process portfolio'
        Description = 'Target architecture must define the process portfolio boundary.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'Failing-test evidence'
        Description = 'Pull request template must ask for failing-test evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'Sequential completed-roadmap validation'
        Description = 'Pull request template must ask for sequential completed-roadmap validation evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'CI parity and closeout attestation'
        Description = 'Pull request template must ask for CI parity and closeout attestation evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'durable closeout evidence'
        Description = 'Pull request template must ask for durable closeout evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'automatic merge, push, branch purge, worktree removal, and stale metadata prune'
        Description = 'Pull request template must ask for automatic successful-TDD branch lifecycle cleanup evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'Protected-branch bypass'
        Description = 'Pull request template must ask for protected-branch bypass evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'completed-roadmap validation manifest'
        Description = 'Pull request template must ask for completed-roadmap validation manifest evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'clean-worktree guard'
        Description = 'Pull request template must ask for completed-roadmap clean-worktree guard evidence.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'direct deterministic automated gate'
        Description = 'Pull request template must ask for the deterministic completed-roadmap gate.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'supplemental live proof'
        Description = 'Pull request template must classify live proof as supplemental evidence only.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'R3.1 local SPA runtime proof and external entry'
        Description = 'Completed roadmap TDD matrix must trace R3.1 at the capability level.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Supplemental live proof ledger'
        Description = 'Completed roadmap TDD matrix must include a supplemental live proof ledger.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-CompletedRoadmapEnvironmentProofReadiness.ps1'
        Description = 'Completed roadmap TDD matrix must reference the environment proof readiness check.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-DbmProcessExperienceVisual.ps1'
        Description = 'Completed roadmap TDD matrix must reference the deterministic process-experience visual proof wrapper.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-DbmLiveE2EDeterministic.ps1'
        Description = 'Completed roadmap TDD matrix must reference the deterministic live-E2E proof wrapper.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-DbmReleasePromotionContract.ps1'
        Description = 'Completed roadmap TDD matrix must reference the release promotion contract wrapper.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-R3PortalRuntimeAutomation.ps1'
        Description = 'Completed roadmap TDD matrix must reference the R3 proof automation contract check.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Parallel package validation from one worktree'
        Description = 'Completed roadmap TDD matrix must record the round-4 parallel package validation warning.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Test-CompletedRoadmapValidation.ps1'
        Description = 'Completed roadmap TDD matrix must reference the sequential completed-roadmap validation wrapper.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'completed-roadmap-validation-manifest.json'
        Description = 'Completed roadmap TDD matrix must reference the validation evidence manifest.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'CI parity and closeout attestation'
        Description = 'Completed roadmap TDD matrix must record CI parity and closeout attestation governance.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'durable closeout evidence'
        Description = 'Completed roadmap TDD matrix must record durable closeout evidence governance.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'Validation-generated content drift'
        Description = 'Completed roadmap TDD matrix must record validation-generated content drift governance.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmPluginRuntime.ps1'
        Description = 'Validate workflow must run the DBM plugin runtime tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-CompletedRoadmapTddMatrix.ps1'
        Description = 'Validate workflow must run the completed-roadmap TDD matrix checks.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmProcessExperience.ps1'
        Description = 'Validate workflow must run process-experience package tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmPortalRuntime.ps1'
        Description = 'Validate workflow must run portal-runtime package tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmDesignerShell.ps1'
        Description = 'Validate workflow must run designer-shell package tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmLiveE2EDeterministic.ps1'
        Description = 'Validate workflow must run deterministic live-E2E tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmReleasePromotionContract.ps1'
        Description = 'Validate workflow must run release promotion contract tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-DbmProcessExperienceVisual.ps1'
        Description = 'Validate workflow must run deterministic process-experience visual tests.'
    },
    @{
        Path = '.github\workflows\validate.yml'
        Pattern = 'Test-R3PortalRuntimeAutomation.ps1'
        Description = 'Validate workflow must run R3 portal runtime automation contract tests.'
    }
)

$forbiddenContentChecks = @(
    @{
        Path = 'docs\roadmap\release-plan.md'
        Pattern = 'traverse Dataverse and Azure'
        Description = 'Release 3 acceptance must not require traversing Azure.'
    },
    @{
        Path = 'docs\releases\release-governance.md'
        Pattern = 'Azure Key Vault only'
        Description = 'Release governance must not state that Azure Key Vault is the only secret source of truth.'
    },
    @{
        Path = 'docs\architecture\product-principles.md'
        Pattern = 'Azure is used from the start where it adds clear value.'
        Description = 'Product principles must not keep Azure as an early default.'
    }
)

$contentFailures = foreach ($check in $contentChecks) {
    $fullPath = Join-Path $RepoRoot $check.Path
    $content = [System.IO.File]::ReadAllText($fullPath)
    if ($content -notmatch [regex]::Escape($check.Pattern)) {
        $check.Description
    }
}

if ($contentFailures) {
    throw "Documentation content checks failed: $($contentFailures -join ' ')"
}

$forbiddenContentFailures = foreach ($check in $forbiddenContentChecks) {
    $fullPath = Join-Path $RepoRoot $check.Path
    $content = [System.IO.File]::ReadAllText($fullPath)
    if ($content -match [regex]::Escape($check.Pattern)) {
        $check.Description
    }
}

if ($forbiddenContentFailures) {
    throw "Forbidden documentation content checks failed: $($forbiddenContentFailures -join ' ')"
}

$validateWorkflowPath = Join-Path $RepoRoot '.github\workflows\validate.yml'
$validateWorkflowContent = [System.IO.File]::ReadAllText($validateWorkflowPath)
$environmentBoundWorkflowScripts = @(
    'Test-CompletedRoadmapEnvironmentProofReadiness.ps1',
    'Test-CompletedRoadmapValidation.ps1'
)

$environmentBoundWorkflowFailures = foreach ($scriptName in $environmentBoundWorkflowScripts) {
    if ($validateWorkflowContent -match [regex]::Escape($scriptName)) {
        "Validate workflow must not run optional environment-bound proof command $scriptName."
    }
}

if ($environmentBoundWorkflowFailures) {
    throw "Environment-bound workflow checks failed: $($environmentBoundWorkflowFailures -join ' ')"
}

& (Join-Path $RepoRoot 'eng\scripts\Test-RoadmapReset.ps1') -RepoRoot $RepoRoot

Write-Host 'Documentation checks passed.'
