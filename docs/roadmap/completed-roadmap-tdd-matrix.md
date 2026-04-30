# Completed roadmap TDD matrix

This matrix traces TDD retrofit work to completed DBM capabilities only. It exists to make issues exposed by failing tests easy to route without expanding the roadmap scope.

The current completed baseline is `main` through `R3.1`. `R3.1 local SPA runtime proof and external entry` is split below into contract, renderer, local host, SPA client, synthesis, plugin authority, and proof automation so failures can be routed to the right completed seam. Future work remains out of scope here, including `R3.2` queues, reassignment, delegation, escalation, SLA timers, Azure orchestration, `R3.3` timeline and audit trail, `R3.4` pilot hardening, AI, simulation, and governance-at-scale.

## TDD routing rules

- Add or update the failing test before changing production behaviour.
- Keep each test tied to one completed capability row.
- If a failing test exposes work that belongs to a future roadmap item, record the boundary and do not implement it in the retrofit slice.
- If a completed capability has only manual or environment-bound proof today, add the narrowest executable seam that can protect the already-accepted behaviour.
- When a test exposes a product defect, keep the fix behaviour-preserving inside the completed capability unless the user explicitly opens a new roadmap slice.

## Matrix

| Capability | Completed behaviour to protect | TDD anchor | Current verification surface | Future-scope boundary |
| --- | --- | --- | --- | --- |
| `R0.1` product governance and tracked docs | Official architecture, ADR, roadmap, release, and runbook docs stay tracked and discoverable. | Documentation content checks for required docs and cross-links. | `eng/scripts/Test-Docs.ps1` | Do not add planning docs for unapproved future features. |
| `R0.2` repo and branching foundation | Work lands through scoped branches and protected branch expectations. | Repo hygiene checks and directive content checks. | `eng/scripts/Test-RepoHygiene.ps1`, `AGENTS.md`, release governance | Do not weaken protected branch or review expectations. |
| `R0.3` delivery and secret-management foundation | CI/CD, secret posture, and environment promotion remain documented and enforceable. | Secret and environment baseline checks. | `eng/scripts/Test-EnvironmentBaseline.ps1`, `eng/scripts/Invoke-NpmAudit.ps1`, release governance | Do not introduce new secret names without docs and ADR alignment. |
| `R0.4` environment and recovery baseline | Dev, UAT, Prod baseline and rollback assumptions stay explicit. | Environment config validation and rollback documentation checks. | `azure/config/*.json`, rollback runbooks, promotion runbooks | Do not treat local rapid deploy as release evidence. |
| `R1.1` canonical model and runtime contract | `DbmModelV1` and runtime contract stay the durable authority. | Schema and fixture validation, negative contract fixtures. | `dbm-contract` schema generation and validation | Do not add post-`R1` authoring scope to the canonical contract. |
| `R1.2.1` process semantics and contract alignment | Stage, step, form-state, status, and projection semantics stay aligned. | Contract and designer-core tests for semantic validation. | `dbm-designer-core/test/designer-core.test.ts` | Do not add work-management semantics from `R3.2`. |
| `R1.2.2` advanced designer UX foundation | Host-agnostic designer core operations remain stable. | Command, graph, validation, and serialization tests. | `dbm-designer-core` tests and designer shell tests | Do not make a UI library format authoritative. |
| `R1.2.3a` Dataverse synthesis foundation | Tables, columns, relationships, readback, drift, and layered packaging stay generated from the model. | Synthesis plan, emit, diff, and readback tests. | `dbm-dataverse-synthesis/test/dataverse-synthesis.test.ts` | Do not widen to full-form ownership. |
| `R1.2.3b` existing forms and behaviour synthesis | Existing Dataverse forms are patched through DBM-managed supported behaviour. | Form patch and runtime web-resource tests. | synthesis tests, generated metadata source, form runtime scripts | Do not generate full main forms in this retrofit. |
| `R1.2.4` host adapters and portability completion | Model-driven and XrmToolBox hosts share the same browser designer bundle. | Host adapter and package repository tests. | `dbm-designer-shell` tests, hosted validation runbook | Do not fork host-specific product logic. |
| `R1.3` execution engine and model-driven runtime | Dataverse-backed model-driven runtime v1 remains authoritative for approval/request progression. | Plugin/runtime unit tests and deployed smoke checks. | legacy .NET build, Dataverse smoke, live E2E cases | Do not add Azure orchestration or queue semantics. |
| `R1.4` reference solution and release hardening | Packaged reference solution, UAT promotion proof, docs, and performance baseline remain reproducible. | Packaging and release evidence checks. | release close-out docs, package workflows, performance baseline runbook | Do not bypass Dev and UAT promotion rules. |
| `R2.1` long-term designer shell and workspace contract | Workspace sidecar and graph document remain derived from canonical model semantics. | Workspace round-trip and graph identifier tests. | `dbm-designer-core` and `dbm-designer-shell` tests | Do not persist library-native graph JSON as authority. |
| `R2.2` graph-first authoring and preview-first designer | Graph authoring, validation markers, undo/redo, and preview stay product-grade around completed semantics. | Graph adapter, canvas, inspector, and command tests. | `dbm-designer-shell/src/*.test.*` | Do not add AI authoring or simulation. |
| `R2.3` shared process experience and model-driven host strategy | Shared renderer works for model-driven host and external-safe projection. | Snapshot, renderer, and visual baseline tests. | `dbm-process-experience` tests and visual snapshots | Do not add timeline/audit or support surfaces. |
| `R2.4` synthesis expansion, portal continuity fixtures, and release hardening | Process-host assets, placement patches, responsive fixtures, and release guidance stay aligned. | Synthesis and visual-regression tests. | `dbm-dataverse-synthesis`, `dbm-process-experience` visual tests | Do not deliver live external runtime in this row. |
| `R2.5` generic existing-form authoring and Dev proof | Non-reference custom existing-form packages can be authored, synthesized, deployed, and exercised in Dev. | Generic fixture, metadata browsing, handoff, and smoke tests. | `generic-existing-form-v1.model.json`, designer-core tests, R2 runbook | Do not reopen generated-form ownership. |
| `R3.1` contract | Local SPA proof uses the host-neutral portal runtime bootstrap contract. | Contract fixture and bootstrap parser tests. | `dbm-contract`, `dbm-portal-runtime/src/portal-runtime.test.tsx` | Do not add durable external identity. |
| `R3.1` renderer | External runtime projection uses the shared process-experience renderer without leaking hidden internal details. | Renderer hidden-stage and external shell tests. | `dbm-process-experience/src/processExperience.test.tsx` | Do not add timeline or support diagnostics. |
| `R3.1` local host | Local Node host owns browser-facing API and keeps Dataverse tokens server-side. | Local proof host route and proxy tests. | `dbm-portal-runtime/src/local-proof-server.test.ts` | Do not add hosted front-door infrastructure. |
| `R3.1` SPA client | SPA captures entry fields, preserves same-session status, and talks only to local host APIs. | Portal runtime client and session tests. | `dbm-portal-runtime/src/portal-runtime.test.tsx` | Do not add cross-device recovery. |
| `R3.1` synthesis | Portal runtime fields and bootstrap plan are emitted for the local proof only. | Synthesis plan and emitted source tests. | `dbm-dataverse-synthesis` tests and generated metadata source | Do not add Azure service plane assets. |
| `R3.1` plugin authority | Dataverse plugin initializes draft state, validates submit, advances to internal screening, projects `under-review`, and clears the command. | Plugin unit tests plus Dev proof smoke. | legacy .NET test project, `Test-R3PortalRuntimeLocalSmoke.ps1` | Do not move authority into the browser client. |
| `R3.1` proof automation | One-command local proof remains automation-first and Power Pages-free. | PowerShell automation content checks and smoke evidence. | `eng/scripts/Test-R3PortalRuntimeAutomation.ps1` | Do not reintroduce Power Pages deployment seams. |

## Retrofit issue log

| Exposed by | Capability route | Issue | Resolution |
| --- | --- | --- | --- |
| `dbm-contract` fixture test | `R3.1` contract | Portal runtime bootstrap fixture still used the generic `/request` and `/request/status` proof routes while the runtime and runbook had standardised on `/approval-request` and `/approval-request/status`. | Updated the valid bootstrap fixture and protected it with a package-level contract test. |
| `Invoke-NodeBuild.ps1` | `R3.1` proof automation | Local builds through the `D:\Git` junction mixed the junction path with the real `D:\Drive\Git` path, causing the portal SPA Vite build to treat `index.html` as outside the project root. | Added a shared Vite launcher that runs package tools from the real package root and kept the portal HTML input relative to that root. |
| Vite package tests from `D:\Git` | `R2.3` renderer and `R3.1` SPA client | Vitest discovered tests through the junction path but loaded transformed modules through the real path, failing with `/@fs/D:/Drive/...` module paths. | Added a shared Vitest launcher that runs with the package root resolved to the real path. |
