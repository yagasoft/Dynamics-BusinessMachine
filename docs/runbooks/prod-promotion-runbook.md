# Prod Promotion Runbook

## Purpose

Promote a DBM release into `Prod` using a tagged formal release or an approved production hotfix path.

## Preconditions

- the candidate has already succeeded in `Dev` and `UAT`
- the source ref is a tag `v*` or a `hotfix/*` branch
- the `Prod` GitHub Environment gate, reviewer, and wait timer are configured
- the operator can create a Dataverse backup for `Prod`, preferably through `.\eng\scripts\Invoke-DataverseBackup.ps1`
- the tracked environment baseline in [`../../azure/config/prod.json`](../../azure/config/prod.json) is current
- the `Prod` delivery identity can read the referenced Key Vault
- the `Prod` delivery identity exists as a Dataverse application user
- the release notes and known-issue record are ready

## Required GitHub Environment variables

GitHub Environment variables must match [`../../azure/config/prod.json`](../../azure/config/prod.json), and `DBM_SOLUTION_NAME` must match `eng/version.json`.

- `DATAVERSE_URL`
- `DATAVERSE_ENVIRONMENT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_KEYVAULT_NAME`
- `AZURE_RESOURCE_GROUP`
- `DBM_SOLUTION_NAME`

## Deployment steps

1. Confirm the production ref and tagged version.
2. Confirm successful `Dev` and `UAT` evidence for the same candidate line or approved hotfix.
3. Create the pre-promotion backup record, preferably with:
   - `.\eng\scripts\Invoke-DataverseBackup.ps1 -TargetEnvironment Prod -ArtifactVersion <version>`
4. Run `.github/workflows/deploy-dataverse.yml` with:
   - `artifact_version` set to the approved candidate version
   - `target_environment` set to `Prod`
5. Approve the `Prod` environment gate after the wait timer expires.
6. If deployable Azure assets exist, run `.github/workflows/deploy-azure.yml` for `Prod`.
7. Execute production smoke checks and record the result.

## Expected technical behavior

- the managed solution package is imported
- the pre-promotion backup reference is retained with the promotion record
- `--publish-changes` and `--skip-lower-version` are always used
- `--stage-and-upgrade` is used when the solution already exists in `Prod`
- workflow evidence is uploaded before the release is considered complete

## Smoke tests

- deployment completed without import failure
- `environment-baseline.json` confirms workflow variables matched the tracked baseline
- production online version matches or exceeds the tagged candidate version
- `smoke-test-results.json` shows automated solution and version checks passed
- `smoke-test-summary.md` is retained with any manual follow-up notes
- designer entry flow and one critical runtime scenario work
- monitoring and logs show no immediate regression
- Azure validation or deployment completed successfully when applicable

## Failure handling

- stop all additional promotions and notify stakeholders
- decide immediately between:
  - forward hotfix with a higher version
  - environment restore to the pre-promotion backup
- do not attempt lower-version managed re-import as the default rollback path

## Evidence to retain

- tagged release reference
- `backup-reference.json`
- `backup-summary.md`
- Dataverse deployment evidence
- `environment-baseline.json`
- `smoke-test-results.json`
- `smoke-test-summary.md`
- Azure deployment evidence if applicable
- smoke-test evidence
- final release note link
