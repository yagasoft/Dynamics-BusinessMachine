# R3 Portal Runtime Dev Proof

This runbook is the operator path for `R3.1 Portal runtime and external entry`. It proves that Power Pages can create and submit an approval request through the canonical Dataverse runtime contract while preserving the shared portal-safe process experience from `R2`.

## Scope

- canonical branch strategy for `R3.1`
- Power Pages anonymous proof posture in `Dev`
- Dataverse-authoritative create and submit progression
- shared portal runtime shell and same-session continuity
- portal-safe status projection without internal-stage leakage

Out of scope:

- authenticated external-user ownership
- cross-device anonymous recovery
- queueing, escalation, SLA, and timeline features
- UAT or Prod-ready portal security posture
- a fully automated Power Pages packaging/import pipeline

## Branch strategy

- Canonical continuation branch: `codex/r3-1-portal-runtime-and-external-entry`
- Base branch for the slice: `main`
- Do not resume related `R3.1` work on:
  - `codex/r2.4-live-connected-e2e`
  - `codex/r2.4-live-e2e-persisted-session`
- Do not reopen `R2` semantics while validating this slice.

## Target artifacts and packages

- `dbm-contract`
  - `DbmPortalRuntimeBootstrapV1`
  - schema and valid fixture coverage
- `dbm-process-experience`
  - `power-pages-runtime` mode
  - portal-shell actions around the existing shared snapshot builder
- `dbm-portal-runtime`
  - Power Pages browser bundle
  - entry-field capture form
  - same-session continuity
  - CRUD-only Dataverse portal client
- `dbm-dataverse-synthesis`
  - synthetic portal runtime fields on the process-owner table
  - portal runtime plan and bootstrap generation
- `DbmSolution/Plugins`
  - `DbmRequestPortalRuntime`
  - upgraded legacy package references
- `power-platform/solutions/DynamicsBusinessMachinePortalRuntime`
  - tracked bootstrap, templates, site settings, and permission payloads
- `eng/scripts/Export-PortalRuntimePackage.ps1`
  - export seam for the portal runtime bundle and tracked portal assets

## Interface and config surface

`DbmPortalRuntimeBootstrapV1` now carries:

- package and process identity
- `identityMode = anonymous-generic-profile`
- configured `genericProfileKey`
- Power Pages entry and request-shell page ids/routes
- request entity logical name and entity set name
- start form id
- portal entry fields for the start slice
- portal command field logical name
- runtime state field logical names
- default start stage, step, form state, internal status, and portal status ids
- allowed portal actions
- `devAnonymousReadbackEnabled`

Dataverse runtime additions on the request owner record:

- `dbm_portalcommand`
- `dbm_portalprofilekey`

Plugin contract for `R3.1`:

- create request with business fields only
- plugin initializes draft runtime state and stamps generic profile key
- submit by patching `dbm_portalcommand = submit`
- plugin validates required start-form data, advances to hidden internal screening, projects `Under Review`, and clears the command

## Local build and validation

Run the local package/test path before touching `Dev`:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-contract
npm run build
npm run validate
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-process-experience
npm test
npm run build
npm run test:visual
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-portal-runtime
npm test
npm run build
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-dataverse-synthesis
npm test
npm run build
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
nuget restore .\DbmSolution\DbmSolution.sln
msbuild .\DbmSolution\Plugins\Plugins.csproj /p:Configuration=Release /p:DbmSignAssembly=false
```

Refresh the tracked generated metadata source after synthesis changes:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode EmitSource
```

Export the portal runtime package seam:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Export-PortalRuntimePackage.ps1
```

Expected portal export output:

- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/web-files/dbm/portal-runtime/portal-runtime.js`
- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/bootstrap/*.json`
- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/web-templates/*.liquid`
- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/site-settings/*.json`
- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/permissions/*.json`
- `artifacts/portal-runtime/DynamicsBusinessMachinePortalRuntime/export-manifest.json`

## Dev deployment path

1. Deploy the updated core and generated metadata Dataverse solutions into `Dev`.
2. Confirm the plugin assembly contains `Yagasoft.Dbm.Plugins.PortalRuntime.DbmRequestPortalRuntime`.
3. Register manual plugin steps in `Dev` because this repo does not yet automate step registration:
   - `Create` on `dbm_request`
     - mode: synchronous
     - stage: PreOperation
     - filtering attributes: none
   - `Update` on `dbm_request`
     - mode: synchronous
     - stage: PreOperation
     - filtering attributes: `dbm_portalcommand`
4. Export the portal runtime seam with `.\eng\scripts\Export-PortalRuntimePackage.ps1`.
5. In Power Pages `Dev`, import or update:
   - the browser bundle as `dbm/portal-runtime/portal-runtime.js`
   - the tracked web templates
   - the tracked site settings
   - the anonymous requester web role and table permission payload
   - the tracked bootstrap JSON for the approval/request entry and request-shell pages

## Dev proof steps

1. Open the Power Pages entry route anonymously.
2. Complete the request fields and create a draft.
3. Confirm the request record was created with:
   - draft stage and step ids
   - draft internal and portal status
   - generic profile key stamped by the plugin
4. Submit the request from the portal shell.
5. Confirm Dataverse advances the request to the hidden internal screening stage.
6. Confirm the portal shell shows `Under Review` and does not reveal:
   - `Internal Screening`
   - internal-only step names
   - internal-only actions
7. Refresh or reopen the request in the same browser session and confirm the portal shell resumes from stored request context.
8. Open the same request in the model-driven host and confirm the shared process experience remains coherent.

## Acceptance before R3.2

`R3.1` is complete enough to begin `R3.2` only when all of the following are true:

- the canonical continuation branch remains `codex/r3-1-portal-runtime-and-external-entry`
- the anonymous proof posture and Dataverse authority boundary are documented in ADR and runbook form
- local contract, renderer, synthesis, and portal runtime tests pass
- the touched legacy plugin project builds on the upgraded package set
- the portal runtime package export completes successfully
- the `Dev` proof shows anonymous draft create, portal submit, canonical Dataverse advance, and portal-safe `Under Review`
- the portal never exposes hidden internal screening details
- the model-driven host still renders the same request coherently after portal initiation

## Notes

- `R3.1` intentionally stays on a `Dev` proof posture.
- Treat anonymous readback and generic profile ownership as temporary proof assumptions, not pilot-ready production design.
- If future slices automate portal packaging/import or plugin step registration, supersede this runbook rather than quietly broadening it.
