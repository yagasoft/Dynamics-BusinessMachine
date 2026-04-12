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

Must include:
- GitHub Actions for .NET, TypeScript, docs, Dataverse packaging, and Azure deployment
- GitHub Environments for `Dev`, `UAT`, and `Prod`
- Azure Key Vault integration
- secret scanning and dependency scanning

### R0.4 Environment and recovery baseline

Output:
- repeatable deployment path with smoke tests and rollback proof

Must include:
- target environment baseline for `Dev`, `UAT`, and `Prod`
- connected Dataverse and Azure deployment targets
- promotion validation
- rollback rehearsal
- current PoC redeployed as known baseline

## Exit criteria

- the tracked documentation set is approved as the source of truth
- the branch and version model is documented and usable
- baseline CI/CD can build the current solution and docs
- secrets are externalized
- the current PoC is recoverable and promotable through formal environments
