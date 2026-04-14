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
    'docs\runbooks\codex-dataverse-metadata-synthesis-skill-handoff.md'
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

Write-Host 'Documentation checks passed.'
