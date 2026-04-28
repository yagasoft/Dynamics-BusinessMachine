# R3 Local SPA Runtime Dev Proof

This runbook is the operator path for `R3.1 Local SPA runtime proof and external entry`. It proves that a repo-owned local SPA can create and submit an approval request through the canonical Dataverse runtime contract while preserving the shared external-safe process experience from `R2`.

## Scope

- canonical branch strategy for `R3.1`
- local SPA external-entry proof in `Dev`
- local Node proxy with Azure CLI Dataverse access
- Dataverse-authoritative create and submit progression
- shared process-experience shell and same-session continuity
- external-safe status projection without internal-stage leakage

Out of scope:

- Power Pages, IIS, or any hosted front-door technology
- authenticated external-user ownership
- cross-device recovery
- queueing, escalation, SLA, and timeline features
- UAT or Prod-ready external runtime hosting
- browser-held Dataverse tokens

## Branch strategy

- Canonical continuation branch: `codex/r3-1-portal-runtime-and-external-entry`
- Base branch for the slice: `main`
- Do not resume related `R3.1` work on:
  - `codex/r2.4-live-connected-e2e`
  - `codex/r2.4-live-e2e-persisted-session`
- Do not reopen `R2` semantics while validating this slice.

## Target artifacts and packages

- `dbm-contract`
  - host-neutral `DbmPortalRuntimeBootstrapV1`
  - schema and valid fixture coverage
- `dbm-process-experience`
  - `external-runtime` mode
  - external-shell actions around the existing shared snapshot builder
- `dbm-portal-runtime`
  - standalone SPA shell with `/approval-request` and `/approval-request/status`
  - local Node host for static SPA serving plus `/api/runtime/*`
  - same-session continuity
  - browser client that talks only to the local host API
- `dbm-dataverse-synthesis`
  - synthetic portal runtime fields on the process-owner table
  - portal runtime plan and bootstrap generation for the local proof host
- `DbmSolution/Plugins`
  - `DbmRequestPortalRuntime`
  - upgraded legacy package references
- `eng/scripts/Sync-DbmPortalRuntimePluginSteps.ps1`
  - Dev plugin-step registration drift sync
- `eng/scripts/Test-R3PortalRuntimeLocalSmoke.ps1`
  - local browser and optional model-driven acceptance smoke
- `eng/scripts/Invoke-R3PortalRuntimeLocalProof.ps1`
  - one-command Dev local-proof wrapper with evidence output

## Interface and config surface

`DbmPortalRuntimeBootstrapV1` now carries:

- package and process identity
- `identityMode = generic-profile`
- configured `genericProfileKey`
- `routes.entryPath`
- `routes.statusPath`
- request entity logical name and entity set name
- start form id
- entry fields for the start slice
- portal command field logical name
- runtime state field logical names
- default start stage, step, form state, internal status, and portal status ids
- allowed external actions

Dataverse runtime additions on the request owner record:

- `dbm_portalcommand`
- `dbm_portalprofilekey`

Local proof host API surface:

- `POST /api/runtime/drafts`
- `GET /api/runtime/requests/:id`
- `POST /api/runtime/requests/:id/submit`
- `GET /api/runtime/health`

Local proof host defaults:

- bind `127.0.0.1`
- port `4173`
- entry URL `http://127.0.0.1:4173/approval-request`
- status URL `http://127.0.0.1:4173/approval-request/status`

Plugin contract for `R3.1`:

- create request with business fields only
- plugin initializes draft runtime state and stamps generic profile key
- submit by patching `dbm_portalcommand = submit`
- plugin validates required start-form data, advances to hidden internal screening, projects `Under Review`, and clears the command

## Local build and validation

Run the local package and test path before touching `Dev`:

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

Run the local automation validation:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Test-R3PortalRuntimeAutomation.ps1
```

## Dev proof path

Prerequisites:

- Azure CLI is installed and authenticated to the target tenant
- `azure/config/dev.json` contains a valid `dataverseUrl`
- the approved DBM strong-name key is available:
  - pass `-AssemblyKeyFile <official.snk>` to the wrapper, or
  - set `DBM_ASSEMBLY_KEY_FILE` to the official `.snk` path
- a persisted model-driven live E2E session is optional for the final model-driven check:
  - `.\eng\scripts\Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment Dev`
- no Power Pages site configuration is required

Run the full local proof wrapper:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1 -TargetEnvironment Dev -AssemblyKeyFile <official.snk>
```

The wrapper performs the canonical sequence:

1. package build, validate, and test for `dbm-contract`, `dbm-process-experience`, `dbm-portal-runtime`, and `dbm-dataverse-synthesis`
2. plugin restore and build
3. Dataverse packaging and deployment
   The local proof wrapper forces same-version imports in `Dev` so iterative `R3.1` solution changes are reapplied even when the tracked solution version has not been incremented yet.
   The deployment path also retries transient Dataverse customization-lock failures when an import, publish, or remediation delete is briefly blocked by another Dataverse customization operation.
   In `Dev`, the wrapper also allows the existing deployment remediation path to replace a stale plugin assembly registration when Dataverse still holds an older `Yagasoft.Dbm.Plugins` identity.
4. plugin-step sync through `Sync-DbmPortalRuntimePluginSteps.ps1`
5. local proof host start on `http://127.0.0.1:4173`
6. local browser and optional model-driven smoke through `Test-R3PortalRuntimeLocalSmoke.ps1`

Evidence is written under:

- `artifacts/r3-portal-runtime-local-proof/<timestamp>/`

## Dev proof steps

1. Open `http://127.0.0.1:4173/approval-request`.
2. Complete the request fields and create a draft.
3. Confirm the request record was created with:
   - draft stage and step ids
   - draft internal and portal status
   - generic profile key stamped by the plugin
4. Submit the request from the local SPA shell.
5. Confirm Dataverse advances the request to the hidden internal screening stage.
6. Confirm the external shell shows `Under Review` and does not reveal:
   - `Internal Screening`
   - internal-only step names
   - internal-only actions
7. Refresh or reopen `http://127.0.0.1:4173/approval-request/status` in the same browser session and confirm the shell resumes from stored request context.
8. If a persisted model-driven session is available, open the same request in the model-driven host and confirm the shared process experience remains coherent.

## Acceptance before R3.2

`R3.1` is complete enough to begin `R3.2` only when all of the following are true:

- the canonical continuation branch remains `codex/r3-1-portal-runtime-and-external-entry`
- the local SPA proof posture and Dataverse authority boundary are documented in ADR and runbook form
- local contract, renderer, synthesis, and portal runtime tests pass
- the touched legacy plugin project builds on the upgraded package set
- the one-command local proof wrapper completes with evidence
- the `Dev` proof shows draft create, local submit, canonical Dataverse advance, and external-safe `Under Review`
- the external shell never exposes hidden internal screening details
- the model-driven host still renders the same request coherently after local-SPA initiation when the persisted session is available

## Notes

- `R3.1` intentionally stays on a `Dev` proof posture.
- Treat the generic profile ownership assumption as a temporary proof constraint, not pilot-ready production design.
- The local proof keeps Dataverse authority in the backend plugin and the local Node proxy; the browser never receives a Dataverse access token.
