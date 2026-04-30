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
    'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1',
    'eng\scripts\Test-DbmProcessExperience.ps1',
    'eng\scripts\Test-DbmPortalRuntime.ps1',
    'eng\scripts\Test-DbmDesignerShell.ps1'
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
        Path = 'docs\releases\release-governance.md'
        Pattern = 'TDD evidence policy'
        Description = 'Release governance must define the TDD evidence policy.'
    },
    @{
        Path = '.github\PULL_REQUEST_TEMPLATE.md'
        Pattern = 'Failing-test evidence'
        Description = 'Pull request template must ask for failing-test evidence.'
    },
    @{
        Path = 'docs\roadmap\completed-roadmap-tdd-matrix.md'
        Pattern = 'R3.1 local SPA runtime proof and external entry'
        Description = 'Completed roadmap TDD matrix must trace R3.1 at the capability level.'
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

Write-Host 'Documentation checks passed.'
