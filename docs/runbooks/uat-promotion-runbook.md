# UAT Promotion Runbook

## Purpose

Promote an approved DBM release candidate into `UAT` using managed Dataverse artifacts and environment-gated approval.

## Preconditions

- the candidate has already succeeded in `Dev`
- the source ref is `release/*`, `hotfix/*`, or a tag `v*`
- the UAT reviewer is available
- the operator can create a Dataverse backup for `UAT`, preferably through `.\eng\scripts\Invoke-DataverseBackup.ps1`
- GitHub Environment `UAT` exists with the required variables and reviewer gate
- the tracked environment baseline in [`../../azure/config/uat.json`](../../azure/config/uat.json) is current
- the `UAT` delivery identity can read the referenced Key Vault
- the `UAT` delivery identity exists as a Dataverse application user

## Required GitHub Environment variables

GitHub Environment variables must match [`../../azure/config/uat.json`](../../azure/config/uat.json), and `DBM_SOLUTION_NAME` must match the core solution name in `eng/version.json`.

- `DATAVERSE_URL`
- `DATAVERSE_ENVIRONMENT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_KEYVAULT_NAME`
- `AZURE_RESOURCE_GROUP`
- `DBM_SOLUTION_NAME`

## Deployment steps

1. Confirm the candidate release evidence bundle and smoke-test evidence from `Dev`.
2. Confirm the source ref is allowed for `UAT`.
3. Create the pre-promotion backup record, preferably with:
   - `.\eng\scripts\Invoke-DataverseBackup.ps1 -TargetEnvironment UAT -ArtifactVersion <version>`
4. Run `.github/workflows/deploy-dataverse.yml` with:
   - `artifact_version` set to the approved candidate version
   - `allow_destructive_replace` set to `true` only if the target still contains the legacy plugin assembly identity from before R0
   - `target_environment` set to `UAT`
5. Approve the GitHub Environment gate.
6. If deployable Azure assets exist, run `.github/workflows/deploy-azure.yml` for `UAT`.
7. Record workflow IDs, timestamps, backup evidence, and smoke-test evidence.

## R0 close-out rehearsal

When `UAT` is being used as formal R0 close-out evidence:

1. Complete the normal managed promotion and smoke tests.
2. Execute the Dataverse restore using the recorded `backup-reference.json` entry or the equivalent platform restore point.
3. Record the restore reference, timestamps, and post-restore validation evidence.
4. Re-run `.github/workflows/deploy-dataverse.yml` with the same immutable candidate artifact.
5. Record the re-promotion workflow reference so `UAT` ends the exercise on the intended candidate baseline.

## Expected technical behavior

- managed solution packages are imported in order:
  1. `DynamicsBusinessMachine`
  2. `DynamicsBusinessMachineGeneratedMetadata`
- the pre-promotion backup reference is retained with the promotion record
- `--publish-changes` and `--skip-lower-version` are always used
- `--stage-and-upgrade` is used only when the solution already exists in `UAT`
- when explicitly enabled, a one-time solution delete and retry may be used only to remediate legacy plugin assembly identity drift after the backup reference has been recorded
- optional runtime secrets are read from `yagasoft-dbm-uat-kv` only after the environment gate is approved

## Smoke tests

- UAT deployment completed successfully
- `environment-baseline.json` confirms workflow variables matched the tracked baseline
- `backup-reference.json` confirms the pre-deployment backup label and reference when the automation script is used
- `deployment-remediation.json` is retained when the deployment needed the one-time plugin-identity replace path
- the core and generated-metadata solution online versions match or exceed the expected candidate version
- `smoke-test-results.json` shows automated checks passed for both solutions and generated metadata drift validation
- `smoke-test-summary.md` is retained with any manual follow-up notes
- no blocking import warnings remain unresolved
- representative designer flow works
- representative runtime flow works
- any required Azure contract validation passed
- when used for R0 close-out, the rollback rehearsal and re-promotion both completed successfully

## Failure handling

- stop the promotion chain immediately
- prefer a corrective forward fix if the issue is small and time-bounded
- if UAT cannot remain on the promoted candidate, use the recorded backup reference and record the rollback evidence

## Evidence to retain

- `backup-reference.json`
- `backup-summary.md`
- Dataverse deployment evidence artifact
- `environment-baseline.json`
- `deployment-remediation.json` when the replace path is enabled
- `smoke-test-results.json`
- `smoke-test-summary.md`
- Azure deployment evidence if applicable
- rollback rehearsal record and restore reference
- re-promotion workflow reference
- UAT smoke-test results
- release decision for promotion to `Prod` or for corrective action
