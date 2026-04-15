# R2 Generic Existing-Form Dev Proof

This runbook closes `R2` by proving DBM is not limited to the approval/request reference solution. It validates that a user can author a custom package on existing Dataverse forms, export that hosted package, synthesize it into `Dev`, and execute at least one live cross-form handoff.

## Scope

- hosted designer on `Dev`
- graph-first blank starter flow
- existing Dataverse tables and main forms only
- generated model-driven process host on selected existing forms
- single-user live proof on `Dev`

Out of scope:

- full generated main-form ownership
- live external runtime
- multi-role operational hardening
- Azure orchestration and support/admin surfaces

## Reference assets

- tracked non-reference example model:
  - [generic-existing-form-v1.model.json](../architecture/examples/generic-existing-form-v1.model.json)
- hosted designer validation:
  - [designer-hosted-validation.md](designer-hosted-validation.md)
- process-host placement and fallback rules:
  - [r2-process-experience-hosting.md](r2-process-experience-hosting.md)

## Preconditions

- `DynamicsBusinessMachine` and `DynamicsBusinessMachineGeneratedMetadata` are already deployed to `Dev`
- the hosted designer opens successfully in `Dev`
- the target Dataverse tables, main forms, and relationship metadata already exist
- you have an interactive `Dev` Dataverse sign-in that can open the target model-driven app and author records

## Hosted designer proof

1. Resolve and open the hosted designer:

```powershell
.\eng\scripts\Get-DbmDesignerHost.ps1 -TargetEnvironment Dev -Open
```

To reopen the pinned `R2.5` proof package directly in the hosted designer, use:

```text
https://ldv-rd-min.crm4.dynamics.com/main.aspx?appid=39e4cc96-59f1-ee11-904c-000d3add5311&pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&data=%7B%22packageName%22%3A%22dbm-testtableone-to-testtabletwo%22%7D
```

2. Click `New Package`.
3. Choose `Blank Existing-Form Starter`.
4. Enter:
   - package id
   - display name
   - primary Dataverse table
   - start-stage main form
   - starter actor/status labels
5. Confirm the new package opens directly into the graph-first workspace.
6. Use the Dataverse metadata browser to inspect and import a second Dataverse main form that belongs to a different primary entity.
7. Add a second stage and bind it to the imported form.
8. Edit the transition from the start stage to the second stage and set:
   - a cross-entity handoff strategy
   - the explicit relationship mapping
9. Save the package in the hosted designer.

Acceptance:

- no raw JSON editing is required
- the package saves successfully to `ys_/dbm/data/models/`
- the designer blocks invalid cross-entity transitions until a handoff is declared

## Export the hosted package

Export the same package that was saved from the hosted designer:

```powershell
.\eng\scripts\Export-DbmHostedPackage.ps1 -TargetEnvironment Dev -PackageName <package-name>
```

Expected output:

- `artifacts/designer-packages/<package-name>/<package-name>.json`
- `artifacts/designer-packages/<package-name>/<package-name>.workspace.json`
- `artifacts/designer-packages/<package-name>/export-manifest.json`

Use the exported model file as the synthesis input for the next steps.

## Rapid synthesize and validate on Dev

Apply the exported package to `Dev`:

```powershell
.\eng\scripts\Invoke-DataverseSynthesis.ps1 `
  -Mode ApplyDev `
  -TargetEnvironment Dev `
  -ModelPath .\artifacts\designer-packages\<package-name>\<package-name>.json
```

Then run the generic smoke validation against the same package:

```powershell
.\eng\scripts\Test-DataverseSmoke.ps1 `
  -TargetEnvironment Dev `
  -DataverseUrl https://<your-org>.crm?.dynamics.com `
  -ModelPath .\artifacts\designer-packages\<package-name>\<package-name>.json
```

Acceptance:

- readback finds every Dataverse-backed form declared in the package
- each selected form contains the generated DBM process-host section and control
- generated config web resources contain a `processHost` runtime block
- generated metadata drift is free of blocking errors

## Live record proof

1. Open the start-stage form in the target model-driven app.
2. Create or open a record on the process-owner entity.
3. Move the record through the first stage.
4. Trigger the cross-entity handoff.
5. Confirm DBM:
   - persists runtime state on the process-owner record
   - creates or resolves the related target record according to the chosen handoff strategy
   - opens or rehosts the generated process experience on the target form
   - shows cross-form handoff messaging in plain language
6. Complete at least one action on the target stage and confirm the process shell remains coherent.

Acceptance:

- the generated process host renders on both selected existing forms
- the same shared process renderer is used before and after the handoff
- the runtime behaves generically for the selected entities and forms, not only for the approval/request sample

## Tracked fixture proof

If you need a repo-tracked proof path before authoring a fresh hosted package, use the non-reference example:

```powershell
.\eng\scripts\Invoke-DataverseSynthesis.ps1 `
  -Mode ApplyDev `
  -TargetEnvironment Dev `
  -ModelPath .\docs\architecture\examples\generic-existing-form-v1.model.json
```

```powershell
.\eng\scripts\Test-DataverseSmoke.ps1 `
  -TargetEnvironment Dev `
  -DataverseUrl https://<your-org>.crm?.dynamics.com `
  -ModelPath .\docs\architecture\examples\generic-existing-form-v1.model.json
```

This tracked fixture is not a substitute for the hosted authoring proof, but it provides deterministic repo-based evidence that `R2` no longer depends only on the approval/request sample.
