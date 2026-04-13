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

`DBM_SOLUTION_NAME` remains aligned to the core solution name in `eng/version.json`.

## Stable secret inventory

Each environment vault keeps the same secret names:

- `nuget-api-key`
- `app-signing-key`
- `applicationinsights-connection-string`
- `powerpages-client-secret`
- `servicebus-connection-string`

GitHub Actions bootstrap secret:

- `APP_SIGNING_KEY_B64`

Vault names:

- `yagasoft-dbm-dev-kv`
- `yagasoft-dbm-uat-kv`
- `yagasoft-dbm-prod-kv`

`app-signing-key` stores the base64-encoded contents of the approved DBM strong-name `.snk` file used for release packaging.

`APP_SIGNING_KEY_B64` is a GitHub Actions secret containing the same base64-encoded `.snk` payload. It exists only as a bootstrap or recovery fallback when the matching Key Vault secret has not yet been seeded or temporarily cannot be read.

If the previous approved signing key has been lost and plugin identity must be reset, generate one new replacement key outside Git with:

```powershell
.\eng\scripts\New-DbmAssemblySigningKey.ps1
```

Treat that generated `.snk` as the new official DBM signing key immediately, seed the same base64 payload into each environment's `app-signing-key`, update `APP_SIGNING_KEY_B64`, and capture the new public key token from the signed plugin build as deployment evidence.

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
5. If Key Vault seeding is temporarily blocked, set GitHub Actions secret `APP_SIGNING_KEY_B64` to the same payload as a documented fallback and remove the fallback once Key Vault is seeded.
6. Rebuild the signed plugin assembly and capture the resulting public key token as evidence when the rotated secret is the app signing key.
7. Validate the consuming system outside production first when practical.
8. Run the relevant deployment workflow against `Dev` or the lowest safe environment.
9. If validation is successful, repeat the rotation for the next environment.
10. Retire the old secret version according to the platform retention policy.

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

- do not paste rotated secrets into ad hoc or unstable GitHub repository secrets; only the stable fallback secret `APP_SIGNING_KEY_B64` is allowed for DBM recovery
- do not rename stable secret identifiers without docs and ADR updates
- do not remove or narrow unrelated permissions on the shared delivery identity from DBM work
- do not create repository-wide GitHub subjects that bypass the approved `Dev`, `UAT`, and `Prod` environment boundaries
