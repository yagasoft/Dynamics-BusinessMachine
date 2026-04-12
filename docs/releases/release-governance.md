# Release Governance

This document is the source of truth for DBM release movement, branch protection expectations, versioning, CI/CD gates, and environment promotion rules for Release 0.2 through Release 0.4.

## Source-control operating model

- `main`
  - protected integration branch
  - every planned release branch is cut from green `main`
- `feature/*`, `fix/*`, `docs/*`, `chore/*`, `codex/*`
  - short-lived implementation branches
  - branch from `main`
  - merge back through PR only
- `release/<semver>`
  - stabilization branch for one formal release line, for example `release/0.2.0`
  - cut only from green `main`
  - accepts only release-scoped fixes, documentation, and deployment-readiness work
- `hotfix/<semver>-<slug>`
  - urgent fix branch cut only from the latest production tag
  - must merge back to `main` and to any still-open `release/*` branch that still needs the fix

## Protected-branch policy

The following branches are protected in GitHub:

- `main`
- `release/*`
- `hotfix/*`

Protection expectations:

- direct pushes blocked except emergency admin action
- force pushes blocked
- branch deletion blocked
- pull request required before merge
- required checks must be green and current
- stale review dismissal enabled
- conversation resolution required
- CODEOWNERS review required for `docs/**`, `.github/**`, `power-platform/**`, `azure/**`, and `eng/**`
- squash merge is the only allowed merge strategy for protected branches
- merge commits and rebase merges are disabled for protected branches

Repo-tracked controls for this policy:

- `.github/CODEOWNERS`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/validate.yml`
- `.github/workflows/security.yml`
- `.github/workflows/package-dataverse.yml`

GitHub admin follow-up required outside Git:

- apply branch protection rules for `main`, `release/*`, and `hotfix/*`
- set required checks to `validate`, `security`, and `package-dataverse`
- disable merge-commit and rebase-merge on the repository
- leave squash merge enabled

## Pull request and review policy

Every PR into a protected branch must include:

- clear scope and risk statement
- validation evidence
- documentation impact statement
- ADR impact statement
- rollout impact statement

Review minimums:

- 1 approving review
- code-owner review when protected paths change
- resolved review conversations
- successful required checks on the current HEAD commit

Architecture or delivery changes are not complete until the relevant tracked docs in `docs/` are updated in the same PR.

## Versioning policy

Formal release numbering resets from legacy PoC numbering to SemVer starting with `v0.2.0`.

Canonical identifiers:

- Git tag or release name
  - `vMAJOR.MINOR.PATCH`
  - `vMAJOR.MINOR.PATCH-rc.N` for pre-release candidates
- release branch
  - `release/MAJOR.MINOR.PATCH`
- Dataverse solution version
  - `MAJOR.MINOR.PATCH.BUILD`
- .NET assembly and file version
  - `MAJOR.MINOR.PATCH.BUILD`
- .NET informational version
  - `MAJOR.MINOR.PATCH[-suffix]+<commit-sha>`

Single manual version source:

- `eng/version.json`

Rules:

- edit `eng/version.json` only when intentionally changing the release line or build counter
- legacy tag `v0.1.1.1-alpha` remains historical PoC evidence only
- npm package versions are internal and non-canonical
- all stamped artifacts must derive from `eng/version.json`

## Workflow set

Required repository workflows:

- `validate`
  - repo hygiene
  - docs validation
  - tracked environment-baseline validation
  - Node asset builds
  - legacy .NET restore and build
  - Dataverse source staging smoke test
  - Azure delivery-contract validation
- `security`
  - dependency review on PRs
  - secret scanning
  - npm dependency audit
  - repo-tracked temporary npm audit exceptions with expiry-aware enforcement
  - CodeQL for C# and JS/TS
- `package-dataverse`
  - build release inputs
  - package unmanaged and managed Dataverse solution artifacts
  - generate deployment settings template
  - authenticated solution check when invoked from the release-candidate lane
- `release-candidate`
  - version resolution
  - authenticated Dataverse packaging
  - Azure contract validation
  - immutable release-candidate bundle with checksums and evidence
- `deploy-dataverse`
  - manual, environment-gated Dataverse promotion from immutable artifacts
  - tracked environment-baseline validation
  - post-deploy smoke evidence
- `deploy-azure`
  - manual or reusable, environment-gated Azure contract validation and deployment
  - tracked environment-baseline validation and evidence

Required checks on `main` and `release/*`:

- `validate`
- `security`
- `package-dataverse`

## GitHub Environments

Formal delivery uses three GitHub Environments:

- `Dev`
  - deployment refs allowed: `main`, `release/*`, `hotfix/*`
  - no reviewer gate
- `UAT`
  - deployment refs allowed: `release/*`, `hotfix/*`, tags `v*`
  - 1 required reviewer
- `Prod`
  - deployment refs allowed: tags `v*`, `hotfix/*`
  - 1 required reviewer
  - short wait timer before job start

Environment variables that must be created in each GitHub Environment:

- `DATAVERSE_URL`
- `DATAVERSE_ENVIRONMENT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_KEYVAULT_NAME`
- `AZURE_RESOURCE_GROUP`
- `DBM_SOLUTION_NAME`

Tracked non-secret environment baseline:

- `azure/config/dev.json`
- `azure/config/uat.json`
- `azure/config/prod.json`

These files are the repo-tracked source of truth for target metadata:

- Dataverse URL
- Dataverse environment ID
- shared Azure client ID
- Azure resource group
- Azure Key Vault

Alignment rules:

- each GitHub Environment must match the corresponding file under `azure/config/`
- `DBM_SOLUTION_NAME` must match `eng/version.json`
- the repo-tracked script `eng/scripts/Test-EnvironmentBaseline.ps1` enforces this in validation and deployment workflows

Environment branch restrictions must be enforced both in GitHub Environment settings and by the repo-tracked script `eng/scripts/Test-DeploymentRefPolicy.ps1`.

## Temporary npm audit exceptions

Release-blocking npm audit findings may be waived only through the tracked manifest:

- `eng/security/npm-audit-exceptions.json`

Rules:

- exceptions are allowed only for explicitly approved R0 close-out findings
- every exception entry must include:
  - scope
  - advisory
  - package set
  - rationale
  - owner role
  - opened date
  - hard expiry
- `eng/scripts/Invoke-NpmAudit.ps1` fails when:
  - a high or critical npm finding is not matched by an active exception entry
  - an exception entry has expired
  - a new project, package, or advisory appears outside the tracked manifest
- the current R0 close-out exception scope is limited to `dbm-app` Angular and PrimeNG advisories and expires on `2026-05-31`

## Identity and secret model

Authentication rules:

- Azure authentication uses GitHub OIDC through `azure/login@v2`
- Dataverse authentication uses Power Platform CLI GitHub federation
  - `pac auth create --githubFederated --applicationId ... --tenant ... --environment ...`
- no Azure client secrets or Dataverse client secrets are stored in GitHub

Identity ownership model:

- DBM currently reuses one approved shared Entra app registration across `Dev`, `UAT`, and `Prod`
- DBM may add only the GitHub federated credentials and Azure RBAC entries required for DBM delivery
- DBM must not remove, narrow, or otherwise modify unrelated permissions already assigned to the shared identity for other applications
- the shared identity must have:
  - Azure RBAC on the DBM target resource groups and DBM Key Vaults
  - a Dataverse application user in each target Dataverse environment
  - GitHub federated credentials scoped to this repository and the approved GitHub Environment subjects

Secret source of truth:

- Azure Key Vault only

Vault model:

- `yagasoft-dbm-dev-kv`
- `yagasoft-dbm-uat-kv`
- `yagasoft-dbm-prod-kv`

Stable secret names across vaults:

- `nuget-api-key`
- `app-signing-key`
- `applicationinsights-connection-string`
- `powerpages-client-secret`
- `servicebus-connection-string`

GitHub Actions bootstrap secret:

- `APP_SIGNING_KEY_B64`

Ownership rules:

- platform owner provisions vaults, rotation policies, and federated identities
- workflows read secrets only after GitHub Environment approval gates are satisfied
- component owners may not invent new secret names without a docs update and ADR update

## Dataverse packaging and promotion policy

Formal Dataverse delivery does not use `dvdt.linker.xml` as the release mechanism. It remains a local-only recovery or experimentation aid.

Tracked source of truth:

- `power-platform/solutions/DynamicsBusinessMachine/baseline/`
- `power-platform/manifests/webresources.yml`

Packaging rules:

- build outputs from `dbm-app`, `dbm-script-lib`, `dbm-js-vm`, and `dbm-web-resources` are assembled into a temporary solution source tree
- the baseline solution metadata is version-stamped during packaging
- plugin assembly metadata is refreshed from the built assembly before packaging
- the release-candidate packaging lane prefers `app-signing-key` from Azure Key Vault and may fall back to GitHub Actions secret `APP_SIGNING_KEY_B64` during bootstrap or recovery
- the release-candidate packaging lane enables legacy packaging and promotes the signed merged plugin assembly onto `DbmSolution/Plugins/bin/Release/Yagasoft.Dbm.Plugins.dll`
- `pac solution pack` produces unmanaged and managed ZIP artifacts
- `pac solution create-settings` generates the deployment settings template
- solution check is required in the release-candidate lane before a formal candidate is promoted

Promotion rules:

- `Dev` imports unmanaged only
- `UAT` imports managed only
- `Prod` imports managed only
- all imports must use `--publish-changes`
- all imports must use `--skip-lower-version`
- managed promotions use `--stage-and-upgrade` only when the target already has the solution installed
- a one-time solution delete and retry is allowed only for `Dev` or `UAT` when import fails specifically because the target still carries the pre-R0 plugin assembly strong-name identity
- that destructive replace path must never be used for `Prod`
- `UAT` may use the destructive replace path only after a pre-promotion backup or restore point has been captured
- manual upload through Dataverse UI is recovery-only and is not valid release evidence

Rollback rules:

- lower-version managed re-import is not the primary rollback path
- before every UAT or Prod promotion, capture a restorable Dataverse backup or equivalent platform restore point
- the preferred rollback path is:
  - forward-fix hotfix with a higher version when practical
  - environment restore to the pre-promotion backup when a forward fix is not acceptable inside the release window

## Azure packaging and promotion policy

Tracked Azure delivery contract:

- `azure/infra/`
  - Bicep templates
- `azure/apps/`
  - deployable Azure workloads
- `azure/config/`
  - tracked non-secret environment baseline

Rules:

- Azure deployment uses GitHub OIDC only
- `azure/config/*.json` is the tracked environment baseline and not a raw ARM parameter file
- until deployable Azure workloads exist, the Azure workflow validates the contract and passes as an intentional no-op
- once deployable workloads exist, Azure promotion must use environment-gated workflows and the matching environment config under `azure/config/`

## Release evidence

Every formal release candidate or production promotion must keep:

- release notes or change summary
- artifact version and commit SHA
- workflow run IDs
- checksums for the immutable release-candidate bundle
- build and scan results
- raw npm audit JSON when the security workflow runs
- npm audit summary with exception-aware classification
- active npm audit exception manifest snapshot when exceptions are in effect
- Dataverse solution-check output
- deployment evidence and timestamps
- `environment-baseline.json` from validation or deployment workflows
- `smoke-test-results.json` and `smoke-test-summary.md` for Dataverse promotions
- `deployment-remediation.json` when deployment uses or attempts a non-standard remediation path
- Azure deployment summary evidence when Azure workflow runs
- smoke-test results
- rollback reference and backup reference
- rollback rehearsal and re-promotion references when UAT is used for R0 close-out proof
- known issues or deferred risks

## Minimum quality gates

The release train does not move forward unless the following are true:

- clean-checkout CI builds the current JS and .NET assets on hosted runners
- protected branches cannot merge without review and required checks
- version stamping is consistent across tags, Dataverse packages, and .NET metadata
- Dataverse packaging generates both managed and unmanaged artifacts plus deployment settings
- Dataverse deployment uses GitHub federation and does not depend on a stored Dataverse client secret
- Azure deployment uses OIDC and validates successfully even when there are no deployable Azure workloads yet
- secret scanning, dependency review, npm audit, and CodeQL are release-blocking, with npm exceptions allowed only through the tracked expiry-aware manifest
- release evidence is attached to the release-candidate or promotion run
