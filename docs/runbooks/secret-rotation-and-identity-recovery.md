# Secret Rotation And Identity Recovery

## Purpose

Provide the approved process for rotating DBM delivery secrets, recovering broken environment identities, and keeping GitHub Actions federation healthy without introducing secrets into Git.

## Scope

- GitHub Environments `Dev`, `UAT`, and `Prod`
- Azure Key Vault secrets
- Azure OIDC identities
- Dataverse application users

## Tracked baseline

Non-secret target metadata is tracked in:

- [`../../azure/config/dev.json`](../../azure/config/dev.json)
- [`../../azure/config/uat.json`](../../azure/config/uat.json)
- [`../../azure/config/prod.json`](../../azure/config/prod.json)

`DBM_SOLUTION_NAME` remains aligned to `eng/version.json`.

## Stable secret inventory

Each environment vault keeps the same secret names:

- `nuget-api-key`
- `app-signing-key`
- `applicationinsights-connection-string`
- `powerpages-client-secret`
- `servicebus-connection-string`

Vault names:

- `yagasoft-dbm-dev-kv`
- `yagasoft-dbm-uat-kv`
- `yagasoft-dbm-prod-kv`

`app-signing-key` stores the base64-encoded contents of the approved DBM strong-name `.snk` file used for release packaging.

## Ownership model

- platform owner:
  - creates and rotates secrets
  - maintains the approved shared Entra delivery app registration and its DBM-specific GitHub federated credentials
  - adds only the DBM-specific RBAC entries required for delivery
- component owners:
  - consume approved secret names only
  - request docs and ADR updates before introducing new secret categories

## Rotation process

1. Choose the target environment.
2. Confirm the tracked baseline file for that environment is still correct.
3. Confirm current GitHub Environment variables still point to the correct vault and identity.
4. Create the new secret version in the matching Key Vault.
5. Validate the consuming system outside production first when practical.
6. Run the relevant deployment workflow against `Dev` or the lowest safe environment.
7. If validation is successful, repeat the rotation for the next environment.
8. Retire the old secret version according to the platform retention policy.

## Identity recovery process

If a delivery workflow loses access:

1. Confirm the GitHub Environment variables are correct.
2. Confirm the tracked baseline file for the target environment is correct.
3. Confirm the approved shared Entra delivery app still exists.
4. Confirm the GitHub federated credential still targets:
   - the correct repository
   - the correct GitHub Environment subject
   - the correct audience for Azure OIDC
5. Confirm the identity still has the required DBM-specific Azure RBAC on the target resource group and matching Key Vault.
6. Confirm the identity still exists as a Dataverse application user in the target environment.
7. Re-run `deploy-dataverse` or `deploy-azure` against `Dev` to validate recovery before higher environments.

## Recovery checkpoints

- Azure login succeeds with OIDC
- PAC auth succeeds with `--githubFederated`
- Key Vault secrets are readable after environment approval
- Dataverse deployment can read the target environment and complete smoke validation

## Prohibited actions

- do not paste rotated secrets into GitHub repository secrets
- do not rename stable secret identifiers without docs and ADR updates
- do not remove or narrow unrelated permissions on the shared delivery identity from DBM work
- do not create repository-wide GitHub subjects that bypass the approved `Dev`, `UAT`, and `Prod` environment boundaries
