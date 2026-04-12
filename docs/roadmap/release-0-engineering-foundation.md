# Release 0: Engineering Foundation And Product Baseline

## Goal

Make the repo, environments, documentation, security posture, and delivery system production-grade enough that every later feature release can be built without avoidable debt.

## Feature set and deliverables

- tracked docs baseline in `docs/`
- release governance and acceptance criteria
- branching and semantic versioning model
- CI/CD for code, Dataverse, docs, and Azure
- secret management and environment promotion
- current PoC recovery and deploy validation

## Stages

### R0.1 Product governance and tracked docs

Output:
- approved `docs/` baseline for architecture, ADRs, roadmap, releases, and runbooks

Must define:
- product principles
- current-state baseline
- target-platform architecture
- ADR conventions and initial accepted ADRs
- release ladder and stage outputs
- release-note and runbook templates

### R0.2 Repo and branching foundation

Output:
- release-ready source-control operating model

Implementation baseline:
- [Release Governance](../releases/release-governance.md)
- [ADR-0005: Versioning And Release-Branch Policy](../adr/0005-versioning-and-release-branch-policy.md)

Must define:
- `main` as the integration branch
- short-lived feature branch model
- release branch model
- hotfix flow
- PR review policy
- semantic versioning rules
- branch protection expectations

### R0.3 Delivery and secret-management foundation

Output:
- green baseline pipeline able to build and promote artifacts without secrets in Git

Implementation baseline:
- `.github/workflows/validate.yml`
- `.github/workflows/security.yml`
- `.github/workflows/package-dataverse.yml`
- `.github/workflows/release-candidate.yml`
- `.github/workflows/deploy-dataverse.yml`
- `.github/workflows/deploy-azure.yml`
- `eng/security/npm-audit-exceptions.json`
- [ADR-0006: Dataverse ALM Source And Packaging Model](../adr/0006-dataverse-alm-source-and-packaging-model.md)
- [ADR-0007: GitHub OIDC, Key Vault, And Federated Delivery](../adr/0007-github-oidc-key-vault-and-federated-delivery.md)
- [Runbook Index](../runbooks/README.md)

Must include:
- GitHub Actions for .NET, TypeScript, docs, Dataverse packaging, and Azure deployment
- GitHub Environments for `Dev`, `UAT`, and `Prod`
- Azure Key Vault integration
- secret scanning and dependency scanning
- a tracked, time-boxed exception path for explicitly approved npm audit findings

### R0.4 Environment and recovery baseline

Output:
- repeatable deployment path with smoke tests and rollback proof

Implementation baseline:
- `azure/config/dev.json`
- `azure/config/uat.json`
- `azure/config/prod.json`
- `eng/scripts/Test-EnvironmentBaseline.ps1`
- `eng/scripts/Test-DataverseSmoke.ps1`
- `.github/workflows/deploy-dataverse.yml`
- `.github/workflows/deploy-azure.yml`
- [Dev Deployment Runbook](../runbooks/dev-deployment-runbook.md)
- [UAT Promotion Runbook](../runbooks/uat-promotion-runbook.md)
- [Prod Promotion Runbook](../runbooks/prod-promotion-runbook.md)
- [Rollback Runbook](../runbooks/rollback-runbook.md)

Must include:
- target environment baseline for `Dev`, `UAT`, and `Prod`
- connected Dataverse and Azure deployment targets
- promotion validation
- rollback rehearsal
- rollback re-promotion evidence
- current PoC redeployed as known baseline

## Exit criteria

- the tracked documentation set is approved as the source of truth
- the branch and version model is documented and usable
- baseline CI/CD can build the current solution and docs
- release-blocking security checks are green, with any temporary npm audit waiver tracked and unexpired
- secrets are externalized
- the current PoC is recoverable and promotable through formal environments
- UAT rollback rehearsal and re-promotion evidence have been retained for R0 close-out
