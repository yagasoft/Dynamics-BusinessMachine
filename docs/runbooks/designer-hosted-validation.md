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

- the left rail shows `DBM Packages`
- the left rail exposes `New Package`, `Refresh`, validation, live preview, and the Dataverse metadata browser when hosted in model-driven
- `New Package` opens a starter gallery with:
  - `Blank Existing-Form Starter`
  - `Approval / Request Reference`
- the main workspace is graph-first rather than tree-first
- the selected package opens as a stage-first graph with floating palette, inline editing cards, and diagnostics behind a secondary drawer
- the validation panel blocks save only for error-level issues
- the hosted designer can import Dataverse table, form, field, relationship, tab, section, and control metadata through the in-app metadata browser
- stage form binding and cross-entity handoff configuration are reachable from the normal authoring surface without raw JSON editing

## Manual validation checklist

1. Open `DBM App` from the hosted URL or from the sitemap.
2. Confirm the model browser renders without host-context or blank-page failures.
3. Click `New Package`.
4. Validate both starter paths:
   - open `Approval / Request Reference` and confirm the graph-first workspace loads
   - open `Blank Existing-Form Starter`
5. In the blank starter path, choose:
   - package id and display name
   - one Dataverse primary table
   - one Dataverse main form
   - starter actor and status defaults
6. Confirm the blank starter creates a saveable package without raw JSON editing.
7. Use the Dataverse metadata browser to inspect at least one table and main form.
8. Import one additional Dataverse main form and confirm the metadata browser surfaces:
   - fields
   - relationships
   - tabs, sections, and controls
9. Edit at least one of each from the normal UI:
   - stage form binding
   - portal visibility
   - transition handoff strategy when a stage changes to a different primary entity
10. Confirm the validation panel updates while editing and blocks invalid cross-entity transitions until a handoff is declared.
11. Save once to persist the package under `ys_/dbm/data/models/`.
12. Refresh the package list or reopen the same package.
13. Confirm the saved changes are still present and the graph workspace rehydrates correctly.

## Usage notes

- Hosted Dataverse use is the recommended interactive path right now.
- Plain localhost remains useful for `dbm-app` build and host smoke tests, but not as the primary interactive usage path until local MSAL auth is intentionally finished.
- Save persists to Dataverse web resources when the designer is hosted in Dataverse.
- To synthesize the same hosted package through local scripts, first export it:

```powershell
.\eng\scripts\Export-DbmHostedPackage.ps1 -TargetEnvironment Dev -PackageName <package-name>
```

- Save falls back to IndexedDB only when the app is not running under host context.
- A passing hosted designer validation does not mean `R1.2.3a` metadata synthesis has already been applied. Full post-deployment smoke still expects both `DynamicsBusinessMachine` and `DynamicsBusinessMachineGeneratedMetadata` to be present.
