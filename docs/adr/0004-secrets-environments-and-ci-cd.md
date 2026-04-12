# ADR-0004: Secrets, Environments, And CI/CD Governance

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

DBM spans code, Dataverse solutions, and Azure assets. The revival needs a secure and repeatable promotion model that keeps secrets out of source control and makes release movement auditable.

## Decision

- Secrets must never be committed to Git.
- GitHub Environments are the deployment boundary for `Dev`, `UAT`, and `Prod`.
- Azure Key Vault is the secret source for environment-specific deployment material.
- GitHub Actions is the primary CI/CD platform for code, Dataverse artifacts, docs, Azure artifacts, and promotion workflows.
- No production promotion is valid unless it has moved through `Dev` and `UAT` with release evidence and rollback readiness.

## Consequences

- Pipeline work is part of Release 0, not cleanup work for later.
- Environment configuration must be explicit and documented.
- Ad hoc local deployment becomes a recovery or experimentation tool, not the formal release mechanism.

## Alternatives considered

- Keep secrets in repo config for convenience
  - rejected for obvious security and operational reasons
- Delay CI/CD until after the builder platform exists
  - rejected because it would create avoidable delivery debt

## Related docs

- [Product Principles](../architecture/product-principles.md)
- [Release Governance](../releases/release-governance.md)
- [Deployment Promotion Runbook Template](../runbooks/deployment-promotion-runbook-template.md)
