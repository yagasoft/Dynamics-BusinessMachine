# UAT Promotion Runbook

## Purpose

Promote an approved DBM release candidate into `UAT` using managed Dataverse artifacts and environment-gated approval.

## Preconditions

- the candidate has already succeeded in `Dev`
- the source ref is `release/*`, `hotfix/*`, or a tag `v*`
- the UAT reviewer is available
- a pre-promotion Dataverse backup or restore point has been captured
- GitHub Environment `UAT` exists with the required variables and reviewer gate
- the tracked environment baseline in [`../../azure/config/uat.json`](../../azure/config/uat.json) is current
- the `UAT` delivery identity can read the referenced Key Vault
- the `UAT` delivery identity exists as a Dataverse application user

## Required GitHub Environment variables

GitHub Environment variables must match [`../../azure/config/uat.json`](../../azure/config/uat.json), and `DBM_SOLUTION_NAME` must match `eng/version.json`.

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
3. Capture the UAT backup reference and record it in the release notes or promotion record.
4. Run `.github/workflows/deploy-dataverse.yml` with:
   - `artifact_version` set to the approved candidate version
   - `target_environment` set to `UAT`
5. Approve the GitHub Environment gate.
6. If deployable Azure assets exist, run `.github/workflows/deploy-azure.yml` for `UAT`.
7. Record workflow IDs, timestamps, and smoke-test evidence.

## R0 close-out rehearsal

When `UAT` is being used as formal R0 close-out evidence:

1. Complete the normal managed promotion and smoke tests.
2. Execute the Dataverse restore using the captured pre-promotion backup or restore point.
3. Record the restore reference, timestamps, and post-restore validation evidence.
4. Re-run `.github/workflows/deploy-dataverse.yml` with the same immutable candidate artifact.
5. Record the re-promotion workflow reference so `UAT` ends the exercise on the intended candidate baseline.

## Expected technical behavior

- the managed solution package is imported
- `--publish-changes` and `--skip-lower-version` are always used
- `--stage-and-upgrade` is used only when the solution already exists in `UAT`
- optional runtime secrets are read from `yagasoft-dbm-uat-kv` only after the environment gate is approved

## Smoke tests

- UAT deployment completed successfully
- `environment-baseline.json` confirms workflow variables matched the tracked baseline
- the solution online version matches or exceeds the expected candidate version
- `smoke-test-results.json` shows automated solution and version checks passed
- `smoke-test-summary.md` is retained with any manual follow-up notes
- no blocking import warnings remain unresolved
- representative designer flow works
- representative runtime flow works
- any required Azure contract validation passed
- when used for R0 close-out, the rollback rehearsal and re-promotion both completed successfully

## Failure handling

- stop the promotion chain immediately
- prefer a corrective forward fix if the issue is small and time-bounded
- if UAT cannot remain on the promoted candidate, use the pre-promotion restore point and record the rollback evidence

## Evidence to retain

- backup or restore-point reference
- Dataverse deployment evidence artifact
- `environment-baseline.json`
- `smoke-test-results.json`
- `smoke-test-summary.md`
- Azure deployment evidence if applicable
- rollback rehearsal record and restore reference
- re-promotion workflow reference
- UAT smoke-test results
- release decision for promotion to `Prod` or for corrective action
