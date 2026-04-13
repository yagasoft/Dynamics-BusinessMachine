# Designer Hosted Validation

## Purpose

Provide one repeatable way to resolve, open, and manually validate the current DBM designer in a live Dataverse environment before moving on to generated metadata apply or promotion work.

This runbook is the current truth for the hosted designer flow on `Dev`. It complements automated build and component smoke checks, but it does not replace them.

## Recommended environment

- use `Dev` for normal hosted designer validation
- use `UAT` only when the designer must be checked as part of promotion validation
- do not use `Prod` for exploratory designer validation

## Resolve the hosted designer

The tracked navigation target is:

- Area: `Dynamics Business Machine`
- Group: `Apps`
- Subarea: `DBM App`
- Web resource: `ys_/dbm/apps/editor/index.html`

To resolve the current live app id and direct designer URL from Dataverse:

```powershell
.\eng\scripts\Get-DbmDesignerHost.ps1 -TargetEnvironment Dev
```

To open it directly:

```powershell
.\eng\scripts\Get-DbmDesignerHost.ps1 -TargetEnvironment Dev -Open
```

To validate the hosted prerequisites and capture evidence:

```powershell
.\eng\scripts\Test-DbmDesignerHost.ps1 -TargetEnvironment Dev
```

That validation writes:

- `artifacts/designer-validation/dev/designer-host-results.json`
- `artifacts/designer-validation/dev/designer-host-summary.md`

## Expected current designer flow

When the hosted designer opens successfully:

- the left pane shows `DBM Models`
- the left toolbar shows `New Model`, `Refresh`, and `Delete`
- the right pane shows the selected model details
- the top toolbar shows `Save Model` plus context-sensitive `Add ...`, `Move Up`, `Move Down`, and `Remove`
- the validation panel blocks save only for error-level issues
- the tree and inspector expose canonical contract nodes such as package, process, statuses, stages, steps, forms, form states, metadata, rules, runtime, and artifacts

## Manual validation checklist

1. Open `DBM App` from the hosted URL or from the sitemap.
2. Confirm the model browser renders without host-context or blank-page failures.
3. Click `New Model`.
4. Set a resource suffix and display label.
5. Save once to create the model under `ys_/dbm/data/models/`.
6. Edit at least one of each:
   - stage
   - step
   - form state
   - metadata field
7. Confirm the validation panel updates while editing.
8. Save again and confirm the model returns to `Saved state`.
9. Refresh the model list or reopen the same model.
10. Confirm the saved changes are still present.

## Usage notes

- Hosted Dataverse use is the recommended interactive path right now.
- Plain localhost remains useful for `dbm-app` build and host smoke tests, but not as the primary interactive usage path until local MSAL auth is intentionally finished.
- Save persists to Dataverse web resources when the designer is hosted in Dataverse.
- Save falls back to IndexedDB only when the app is not running under host context.
- A passing hosted designer validation does not mean `R1.2.3a` metadata synthesis has already been applied. Full post-deployment smoke still expects both `DynamicsBusinessMachine` and `DynamicsBusinessMachineGeneratedMetadata` to be present.
