# ADR-0007: GitHub OIDC, Key Vault, And Federated Delivery

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

DBM must deliver Dataverse and Azure assets through GitHub Actions without secrets in Git, without long-lived cloud credentials in the repository, and without each component inventing its own secret or environment rules. The earlier CI/CD ADR set the direction, but Release 0.3 needs the exact delivery identity model.

## Decision

- GitHub Actions is the delivery platform for formal build, packaging, and promotion workflows.
- Azure authentication uses GitHub OIDC with `azure/login@v2`.
- Dataverse authentication uses Power Platform CLI GitHub federation with `pac auth create --githubFederated`.
- GitHub Environments `Dev`, `UAT`, and `Prod` are the deployment boundary and hold non-secret environment metadata.
- Azure Key Vault is the only secret source for runtime deployment material.
- DBM reuses one approved shared Entra app registration for delivery and binds it to GitHub through one federated credential per GitHub Environment subject.
- DBM may add only the GitHub subjects and Azure RBAC entries it requires for DBM delivery; unrelated permissions on the shared principal are outside DBM scope and must not be removed or narrowed by DBM work.
- Secret names are stable across vaults and do not include the environment name.
- Workflow jobs may read environment-specific secrets only after the GitHub Environment gate for that target has been satisfied.

## Consequences

- DBM avoids stored cloud client secrets in GitHub.
- Delivery access can still be reviewed at the environment boundary because each GitHub Environment has its own subject and approval rules.
- DBM-specific Azure access is additive and is granted only on DBM resource groups and DBM Key Vaults.
- The shared principal may retain unrelated access for other applications; DBM governance must not modify or remove those unrelated permissions.
- Environment variables, Key Vault inventory, and federated credentials must be provisioned before deployment workflows can succeed.

## Alternatives considered

- Store deployment secrets in repository secrets
  - rejected because it weakens separation between environments and increases rotation risk
- Use one environment-scoped delivery identity per environment
  - rejected for Release 0.3 because an approved existing delivery app already exists and can safely be constrained through per-environment GitHub subjects plus DBM-only RBAC
- Use one shared delivery identity with unrestricted repository-wide GitHub subjects
  - rejected because it weakens environment approval boundaries and makes access review less precise
- Replace the shared delivery identity with a DBM-only identity immediately
  - deferred because the existing shared delivery app is already approved and in use, and DBM may only add the minimum extra grants it requires in this release
- Continue with manual local PAC auth for promotions
  - rejected because it is not auditable or repeatable enough for the revived product

## Related docs

- [ADR-0004: Secrets, Environments, And CI/CD Governance](0004-secrets-environments-and-ci-cd.md)
- [Release Governance](../releases/release-governance.md)
- [Secret Rotation And Identity Recovery Runbook](../runbooks/secret-rotation-and-identity-recovery.md)
