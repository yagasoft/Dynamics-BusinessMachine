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
- set required pull-request check to `validate`
- keep `security` and `package-dataverse` as protected-branch push or release-line gates rather than PR gates
- disable merge-commit and rebase-merge on the repository
- leave squash merge enabled

## Pull request and review policy

Every PR into a protected branch must include:

- clear scope and risk statement
- validation evidence
- TDD evidence for every behaviour change
- documentation impact statement
- ADR impact statement
- rollout impact statement

Review minimums:

- 1 approving review
- code-owner review when protected paths change
- resolved review conversations
- successful required checks on the current HEAD commit

Architecture or delivery changes are not complete until the relevant tracked docs in `docs/` are updated in the same PR.

## TDD evidence policy

Completed-roadmap revamp work must use TDD as the default implementation model. The accepted scope is the current completed baseline through `R3.1`; it must not pull in future `R3.2` or later roadmap capabilities.

Every behaviour change must provide:

- failing-test evidence captured before the implementation change
- green verification after the smallest implementation change that satisfies the test
- a trace to the completed roadmap capability being protected or improved
- a scope statement confirming that future roadmap items were not introduced

Completed-roadmap closeout now requires direct deterministic automated coverage for every completed capability row through `R3.1`. Live Dataverse, UAT promotion, hosted designer, and browser-session proof may still be retained as supplemental live proof, but it does not count as the primary TDD surface for a completed behaviour.

Documentation-only changes may use an executable documentation check, such as `eng/scripts/Test-Docs.ps1`, as the failing test. Refactors are treated as behaviour-risking work unless the PR explains why no executable test can observe the change.

The completed-roadmap trace source is [Completed Roadmap TDD Matrix](../roadmap/completed-roadmap-tdd-matrix.md).

### Sequential completed-roadmap validation

Completed-roadmap closeout evidence should prefer the local sequential wrapper `eng/scripts/Test-CompletedRoadmapValidation.ps1` when a change touches the matrix, proof ledger, package wrappers, or completed-roadmap validation rules. The wrapper runs the docs, matrix, readiness, package, and Node build gates in a fixed order so package installs and Windows file locks do not overlap inside one worktree.

The wrapper is local evidence for AI closeout and reviewer reproduction. It is not a replacement for the protected-branch `validate` workflow, and it must not be wired into normal CI as a duplicate gate.

The wrapper must write a completed-roadmap validation manifest under the ignored `artifacts/` evidence tree when it runs full validation. The same wrapper must enforce a clean-worktree guard by comparing tracked content diffs and untracked non-ignored files before and after validation, so generated package or build drift cannot be hidden in closeout.

If an emergency admin action or direct push creates a branch-protection bypass, the closeout evidence must say so explicitly, identify the bypassed review or workflow path, and record the sequential local validation that was used to compensate. When the completed-roadmap wrapper is used, that evidence must include the completed-roadmap validation manifest path. The bypass does not change the normal PR-only rule for protected branches.

### CI parity and closeout attestation

Completed-roadmap validation must keep local sequential gates and the protected-branch `validate` workflow aligned. The local wrapper may include evidence capture and readiness checks that are local-only, but every deterministic gate used as completed-roadmap coverage must also be present in `.github/workflows/validate.yml`.

When a successful verified TDD round is completed on an AI-created branch or worktree, closeout evidence must include a closeout attestation section in the completed-roadmap validation manifest or an equivalent attached manifest. The attestation must record the task branch, source commit, target branch, gate list, final verification status, pushed target branch, and lifecycle cleanup actions.

After green verification, the default closeout action is automatic merge, push, branch purge, worktree removal, and stale metadata prune. This automatic lifecycle applies only to the current AI-created task branch or worktree, and only when scope checks, unrelated-change checks, and merge checks are clean.

Durable closeout evidence must be written before removing the AI-created task worktree. Use `eng/scripts/Write-CompletedRoadmapCloseoutAttestation.ps1` to copy the passed validation manifest into the stable ignored evidence root and record the final target commit, branch-protection bypass status, and cleanup action statuses. Evidence created only inside the task worktree is not sufficient if that worktree will be removed.

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
  - the only required PR workflow for protected-branch pull requests
  - repo hygiene
  - docs validation
  - tracked environment-baseline validation
  - Node asset builds
  - DBM Dataverse synthesis validation
  - legacy .NET restore and build
  - DBM plugin runtime tests
  - core and generated Dataverse source staging smoke tests
  - Azure delivery-contract validation
- `security`
  - does not run on feature-branch pushes or protected-branch PRs
  - runs on protected-branch pushes plus scheduled or manual invocations
  - secret scanning
  - npm dependency audit
  - repo-tracked temporary npm audit exceptions with expiry-aware enforcement
  - CodeQL for C# and JS/TS on `release/*` and `hotfix/*` pushes, plus scheduled or manual runs
- `package-dataverse`
  - does not run on feature-branch pushes or protected-branch PRs
  - runs on protected-branch pushes and reusable or manual packaging flows
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
  - successful `security.yml` gate required for the exact commit before `UAT` or `Prod` deployment starts
  - tracked environment-baseline validation
  - post-deploy smoke evidence
- `deploy-azure`
  - manual or reusable, environment-gated Azure contract validation and deployment
  - successful `security.yml` gate required for the exact commit before `UAT` or `Prod` deployment starts
  - tracked environment-baseline validation and evidence

Protected-branch PR check:

- `validate`

Protected-branch push and release-line gates:

- `validate`
- `security`
- `package-dataverse`

## Local Dev rapid deploy

Repo-tracked local inner-loop command:

- `eng/scripts/Invoke-DevRapidDeploy.ps1`

Tracked component registry:

- `eng/dev-rapid-deploy.components.json`

Rules:

- local rapid deploy is allowed only for `Dev`
- it packages and imports the current working tree into `Dev` for fast validation
- it may build only the affected local component set before packaging, using the tracked component registry
- it must still use the tracked Dataverse staging and import scripts
- it is not valid release evidence
- it must not be used for `UAT` or `Prod`
- once a fix is kept, it must still move through the normal PR, `package-dataverse`, and `release-candidate` flow
- if the working tree contains unrelated deployable changes, the rapid path must stop rather than silently excluding them

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
- shared Azure tenant ID
- Azure resource group
- Azure Key Vault

Alignment rules:

- each GitHub Environment must match the corresponding file under `azure/config/`
- `DBM_SOLUTION_NAME` must match the core solution name in `eng/version.json`
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

ADR-0015 updates the near-term direction: Dataverse-owned operational configuration and secret posture is the preferred product baseline where feasible. Azure Key Vault, GitHub OIDC, and Azure deployment workflow references in this document remain valid historical or deferred delivery context, but they are no longer the default product/runtime direction for new roadmap work.

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

Near-term secret and operational configuration posture:

- Dataverse-owned operational configuration and secret posture where feasible
- no secrets in Git
- external secret stores only where deployment automation or approved non-Dataverse components require them

Deferred or historical vault model:

- `yagasoft-dbm-dev-kv`
- `yagasoft-dbm-uat-kv`
- `yagasoft-dbm-prod-kv`

Stable secret names across vaults:

- `nuget-api-key`
- `app-signing-key`
- `applicationinsights-connection-string`
- `powerplatform-admin-client-secret`
- `powerpages-client-secret`
- `servicebus-connection-string`

GitHub Actions bootstrap secret:

- `APP_SIGNING_KEY_B64`

Ownership rules:

- platform owner provisions any required Dataverse-owned configuration and approved external secret stores
- workflows read deployment secrets only after GitHub Environment approval gates are satisfied
- component owners may not invent new secret names without a docs update and ADR update

## Dataverse packaging and promotion policy

Formal Dataverse delivery does not use `dvdt.linker.xml` as the release mechanism. It remains a local-only recovery or experimentation aid.

Tracked source of truth:

- `power-platform/solutions/DynamicsBusinessMachine/baseline/`
- `power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/template/`
- `power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/source/`
- `power-platform/manifests/webresources.yml`

Packaging rules:

- build outputs from `dbm-app`, `dbm-script-lib`, `dbm-js-vm`, and `dbm-web-resources` are assembled into a temporary solution source tree
- the baseline solution metadata is version-stamped during packaging
- plugin assembly metadata is refreshed from the built assembly before packaging
- generated business metadata is emitted from the canonical DBM model into `DynamicsBusinessMachineGeneratedMetadata`
- the release-candidate packaging lane currently reads `app-signing-key` from Azure Key Vault and may fall back to GitHub Actions secret `APP_SIGNING_KEY_B64` during bootstrap or recovery; ADR-0015 makes this a transitional delivery path until a Dataverse-owned secret/configuration implementation replaces it where feasible
- the release-candidate packaging lane enables legacy packaging and promotes the signed merged plugin assembly onto `DbmSolution/Plugins/bin/Release/Yagasoft.Dbm.Plugins.dll`
- `pac solution pack` produces unmanaged and managed ZIP artifacts for both the core and generated-metadata solutions
- `pac solution create-settings` generates solution-specific deployment settings templates
- solution check is required in the release-candidate lane before a formal candidate is promoted

Promotion rules:

- `Dev` may use direct Dataverse metadata apply only as an authoring proof path through the tracked synthesis scripts
- formal `Dev` promotions import unmanaged packages only
- `UAT` imports managed packages only
- `Prod` imports managed packages only
- all package-driven promotions import `DynamicsBusinessMachine` first and `DynamicsBusinessMachineGeneratedMetadata` second
- formal `UAT` and `Prod` promotions must have a pre-promotion Dataverse backup or restore point recorded before import starts
- the preferred automation path for that backup record is `eng/scripts/Invoke-DataverseBackup.ps1`
- all imports must use `--publish-changes`
- all imports must use `--skip-lower-version`
- managed promotions use `--stage-and-upgrade` only when the target already has the solution installed
- a one-time solution delete and retry is allowed only for `Dev` or `UAT` when import fails specifically because the target still carries the pre-R0 plugin assembly strong-name identity
- that destructive replace path must never be used for `Prod`
- `UAT` may use the destructive replace path only after a pre-promotion backup or restore point has been captured
- manual upload through Dataverse UI is recovery-only and is not valid release evidence
- local Dev rapid deploy is allowed only through `eng/scripts/Invoke-DevRapidDeploy.ps1` and is not valid release evidence

Rollback rules:

- lower-version managed re-import is not the primary rollback path
- before every UAT or Prod promotion, capture a restorable Dataverse backup or equivalent platform restore point
- the preferred operator automation path for that record is `eng/scripts/Invoke-DataverseBackup.ps1`
- the preferred rollback path is:
  - forward-fix hotfix with a higher version when practical
  - environment restore to the pre-promotion backup when a forward fix is not acceptable inside the release window

## Deferred Azure packaging and promotion policy

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
- once deployable workloads exist under an accepted Dataverse-first exception, Azure promotion must use environment-gated workflows and the matching environment config under `azure/config/`

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
- `backup-reference.json` and `backup-summary.md` when `eng/scripts/Invoke-DataverseBackup.ps1` is used for the promotion record
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
- Dataverse packaging and deployment handle the ordered core-plus-generated solution set
- Dataverse deployment uses GitHub federation and does not depend on a stored Dataverse client secret
- Azure deployment uses OIDC and validates successfully even when there are no deployable Azure workloads yet
- secret scanning, dependency review, npm audit, and CodeQL are release-blocking, with npm exceptions allowed only through the tracked expiry-aware manifest
- CodeQL is intentionally moved off the day-to-day Dev PR path and must be green on the release or hotfix commit before `UAT` or `Prod` deployment
- release evidence is attached to the release-candidate or promotion run
