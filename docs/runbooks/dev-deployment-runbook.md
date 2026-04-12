# Dev Deployment Runbook

## Purpose

Promote the current DBM release candidate into the `Dev` Dataverse environment for integration validation.

For local inner-loop validation without release evidence, use [dev-rapid-deploy.md](dev-rapid-deploy.md). This runbook remains the formal GitHub release-candidate path for `Dev`.

## Preconditions

- the source commit is on `main`, `release/*`, or `hotfix/*`
- `validate`, `security`, and `package-dataverse` are green for the target revision
- a `release-candidate-<semver>` artifact exists
- GitHub Environment `Dev` exists with the required variables
- the tracked environment baseline in [`../../azure/config/dev.json`](../../azure/config/dev.json) is current
- the `Dev` delivery identity can read the referenced Key Vault
- the `Dev` delivery identity exists as a Dataverse application user

## Required GitHub Environment variables

GitHub Environment variables must match [`../../azure/config/dev.json`](../../azure/config/dev.json), and `DBM_SOLUTION_NAME` must match `eng/version.json`.

- `DATAVERSE_URL`
- `DATAVERSE_ENVIRONMENT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_KEYVAULT_NAME`
- `AZURE_RESOURCE_GROUP`
- `DBM_SOLUTION_NAME`

## Inputs

- artifact version, for example `0.2.0` or `0.2.0-rc.1`
- source ref
- deployment window and owner

## Deployment steps

1. Confirm the target ref is allowed for `Dev`.
2. Confirm the required release-candidate artifact exists.
3. Run `.github/workflows/deploy-dataverse.yml` with:
   - `artifact_version` set to the target SemVer
   - `target_environment` set to `Dev`
4. If deployable Azure assets exist, run `.github/workflows/deploy-azure.yml` for `Dev`.
5. Capture workflow URLs and evidence artifacts.

## Expected technical behavior

- Dataverse auth uses `pac auth create --githubFederated`
- the `Dev` deployment imports the unmanaged package only
- import uses `--publish-changes` and `--skip-lower-version`
- deployment evidence is uploaded by the workflow

## Smoke tests

- Dataverse deployment workflow completed successfully
- `environment-baseline.json` confirms workflow variables matched the tracked baseline
- `online-version.txt` in deployment evidence matches or exceeds the expected solution version
- `smoke-test-results.json` shows automated solution and version checks passed
- `smoke-test-summary.md` is retained with any manual follow-up notes
- basic designer entry flow and one representative runtime action load successfully

## Failure handling

- stop further promotion
- if failure is isolated to `Dev`, fix on a short-lived branch and re-run the candidate flow
- if the artifact is invalid, replace it with a new release candidate rather than bypassing CI/CD

## Evidence to retain

- release-candidate artifact link
- Dataverse deployment workflow link
- `environment-baseline.json`
- `smoke-test-results.json`
- `smoke-test-summary.md`
- Azure deployment workflow link if applicable
- smoke-test notes
- issues or follow-up work opened from the promotion
