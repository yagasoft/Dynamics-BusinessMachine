# Rollback Runbook

## Purpose

Define the approved rollback paths for DBM when a Dataverse or Azure promotion causes regression, corruption, or unacceptable operational risk.

## Key policy

- lower-version managed Dataverse re-import is not the default rollback path
- every UAT and Prod promotion must have a pre-promotion backup or restore point
- the first rollback decision is whether to forward-fix or restore
- R0 close-out requires one planned rollback rehearsal in `UAT`, followed by re-promotion to the approved candidate baseline

## Rollback triggers

- critical smoke-test failure after promotion
- import corruption or missing solution components
- production regression with unacceptable business impact
- security or configuration failure requiring immediate reversal

## Decision tree

1. Stop additional promotions and dependent deployments.
2. Assess whether a forward hotfix can be prepared and validated inside the acceptable outage or degradation window.
3. If a forward hotfix is practical:
   - cut `hotfix/<semver>-<slug>` from the latest production tag
   - increment the build or release version
   - run the normal release-candidate and promotion chain
4. If a forward hotfix is not practical:
   - restore the target Dataverse environment from the pre-promotion backup
   - restore matching Azure state if Azure assets were changed

## Dataverse rollback steps

1. Identify the failed promotion run and target environment.
2. Locate the recorded backup or restore-point reference.
3. Confirm rollback authority.
4. Pause any other deployments into the target environment.
5. Execute the Dataverse restore using the platform-approved restore mechanism.
6. Re-run minimal smoke tests after restore.
7. Record the restored solution version and restore completion time.
8. If this rollback was a planned R0 close-out rehearsal, re-run the original UAT promotion from the same immutable candidate artifact.

## Azure rollback steps

1. Identify whether Azure infra or app assets changed in the failed release.
2. If the Azure change is isolated and safe to repair, prefer a forward hotfix.
3. If Azure state must be reversed, restore or redeploy the previously approved configuration for that environment.
4. Re-run validation on the restored Azure surface.

## Validation after rollback

- target environment is reachable
- expected DBM version is restored or a corrective hotfix is deployed
- critical user flow works
- monitoring shows stable recovery
- incident or release record has been updated
- planned R0 close-out rehearsals end with the environment re-promoted to the intended candidate version

## Evidence to retain

- failed release reference
- rollback decision owner
- backup or restore-point reference
- `environment-baseline.json` from the failed promotion when available
- `smoke-test-results.json` and `smoke-test-summary.md` from the failed promotion when available
- restore job or workflow reference
- re-promotion workflow reference when the rollback was a planned rehearsal
- validation and smoke-test evidence
