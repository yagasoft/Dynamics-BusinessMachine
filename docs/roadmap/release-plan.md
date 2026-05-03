# DBM release plan

This document defines the active DBM release ladder after the process-first product reset.

## Planning frame

- Integration baseline: `main`.
- Delivery model: short-lived feature branches, release branches when needed, and TDD evidence for every implementation slice.
- Permanent environments: `Dev`, `UAT`, and `Prod`.
- Official docs: tracked in `docs/`.
- Local planning and execution notes: `_codex/dbm-revival/`.
- Current implementation status: current implementation is prototype/reference material, not a shipped product baseline.
- Product reset authority: [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md).
- Collaborative authoring authority: [ADR-0017](../adr/0017-collaborative-authoring-and-code-apps-designer.md).

## Release ladder

| Release | Name | Goal |
| --- | --- | --- |
| `R0` | Engineering foundation and governance | Keep the repo, delivery rules, branch policy, documentation discipline, and verification harness strong enough to support the reset. |
| `R1` | Process/stage designer and actual form render | Define process portfolios, nested parent/child process hierarchies, stage-owned child process links, and actual model-driven form rendering for business users. |
| `R2` | DBMScript and action foundation | Rebuild the JavaScript-first action and DBMScript foundation that later stages, templates, buttons, notifications, and backend execution will use. |
| `R3` | Back-office runtime | Execute processes inside Dataverse and model-driven forms, including transitions, statuses, process instances, form behaviour, and action triggers. |
| `R4` | Back-office operations | Add routing, tasks, notifications, SLA/KPI, validations, history, jobs, custom messages, and operator/support surfaces. |
| `R5` | Portal runtime and return path | Add actual portal rendering and runtime continuity once back-office execution is stable. |
| `R6` | Reuse, templates, artefacts, and documents | Add process templates, sub-process reuse, table row templates, cloning, generated artefacts, service definitions, string generation, and document management. |
| `R7` | Platform tooling and ALM | Add DBM Manager, source sync, XrmToolBox playground, DBM Solution packaging, post-deploy scripts, versioning, DBM Tree, enhanced jobs, auto-integration, and on-premise automation. |
| `R8` | Enterprise maturity | Add simulation, replay/debugging, explainability, governance, drift control, observability, policy packs, and portfolio-scale optimisation. |
| `R9` | AI-assisted platform | Add AI only after the basic product is stable, reviewable, testable, and useful without AI. |

## Cross-release rules

- The old `R1` through `R3.1` work is prototype/reference evidence. It can be mined for code, tests, concepts, and lessons, but it no longer defines the active product release ladder.
- The designer remains the primary product surface.
- Every release must leave a demonstrable, testable product increment.
- AI is out of scope until `R9`.
- Actual portal runtime is out of scope until `R5`; `R1` defines only the portal projection contract.
- DBM owns the rendered process experience. Native Dataverse BPF may be generated later as an optional downstream integration, never as the source of truth.
- Dataverse-normalised authoring rows are the collaborative authoring source for editable process artefacts; process JSON is a compiled published/export/import/runtime snapshot.
- Designer-session presence is separate from edit authority: active designer sessions show who has a process or component open, while `dbm_editlock` remains the edit lease.
- Long non-mergeable edits must not wait until save to discover conflicts. Editable surfaces acquire granular edit leases before meaningful edits begin and autosave into private Dataverse-backed drafts.
- Optimistic concurrency and ETags are mandatory final consistency guards, not the primary long-edit UX.
- Whole-process locks are reserved for publish, destructive structural edits, root process changes, migrations, and bulk reorder.
- Power Apps Code Apps are the preferred R2+ rich designer host only after the R2 proof slice confirms Dataverse access, embedding/navigation, CSP/admin requirements, solution ALM, environment support, and source-sync limits.
- The rendered form process surface remains PCF/model-driven unless a later concrete blocker proves Code Apps is better for that business-user form surface.
- No secrets in Git.
- No release bypasses `Dev` and `UAT`.
- TDD applies to implementation slices. After a successful verified TDD round, the task branch lifecycle follows the workspace policy for merge, push, branch purge, worktree removal, and stale metadata prune.

## Key model and interface reset

The new product model is a process portfolio rather than a single-process-only contract.

Minimum reset concepts:

- `mainProcessId`: identifies the root process that anchors the full business cycle and is always visible on the rendered form.
- `processes[]`: contains the root process and reusable child process definitions.
- `processTypeId`: a user-defined process type identifier, not a built-in domain enum.
- `actorCategory` and `roleKey`: broad actor category plus user-defined role key for the process.
- `stageCategory` and `stageKindId`: broad stage category plus user-defined stage kind.
- `workCategory` and `workKindId`: broad task or step category plus user-defined work kind.
- `subProcessVisibility`: defines when a child process appears for the rendered form or portal projection, such as status, owner, role, or audience conditions.
- `childProcessRefs[]`: defines stage-owned child process links, including the target process definition, activation rule, and whether the parent stage waits for child completion.
- Authoring unit IDs: stable identities for process, stage, child process link, DBMScript, DBM Object, action, notification template, routing policy, SLA policy, validation rule, and stage-local configuration.
- Private drafts: Dataverse-backed autosave rows created when editing starts, tied to the target authoring unit, owner, base published version, and base rowversion/ETag.
- Designer sessions: Dataverse-backed presence leases created per open designer tab or host instance, tied to the process, current component target, owner, heartbeat, expiry, and host/source.
- Edit locks: Dataverse-native leases for non-mergeable authoring units, including target type/id, owner, expiry, heartbeat, reason, status, and admin force-release audit.
- Published snapshots: compiled definitions that resolve published rows and exclude draft/lock metadata.
- Stage feature hooks: entry/exit conditions, branching, previous-stage transitions, notifications, routing, SLA/KPI, tasks, validations, actions, status, and portal status.
- Notifications: modelled as table row templates plus send actions, not as a separate hard-coded notification subsystem.
- DBMScript/action vNext: JavaScript first, with DBMScript language/runtime contract, DBM Object composition, browser/model-driven/server execution planning, TypeScript, richer transpilation, and richer editor modes deferred until the JS foundation is proven.
- Runtime vNext: process sessions, child process instance spawning, parent-stage locking, child completion, process instance per row/user/role/owner where configured, record-level and user-level switching, manual show Next transitions, automatic transition, parallel branches, condition timing, and XRM/form-context helpers are explicit roadmap concepts.

## Release summaries

### Release 0

`R0` keeps the engineering foundation alive. It covers branch policy, docs, delivery, verification, release governance, environment rules, and secret posture. Existing `R0` material remains useful.

Details: [release-0-engineering-foundation.md](release-0-engineering-foundation.md)

### Release 1

`R1` starts the product again around process and stage design. It proves the root process, nested child process definitions, stage-owned child process links, conditional visibility, collapsed main-process display, generic user-defined process vocabulary, and an actual model-driven rendered form experience.

Details: [release-1-process-stage-designer-and-form-render.md](release-1-process-stage-designer-and-form-render.md)

### Release 2

`R2` rebuilds the action foundation around DBMScript, DBM Object, and JavaScript-first execution. It also establishes collaborative authoring primitives: authoring unit IDs, private drafts, granular edit leases, designer-session presence, rowversion/ETag expectations, lockable metadata, and compiled snapshot boundaries. It makes action definitions, trigger hooks, table row templates, WYSIWYG notification templates, query/rich editor hooks, dependency loading, output handling, version history, test case support, and safe execution planning ready for later runtime work.

Details: [release-2-dbmscript-and-action-foundation.md](release-2-dbmscript-and-action-foundation.md)

### Release 3

`R3` turns the designed process into a back-office runtime in Dataverse/model-driven forms. It owns process sessions, scoped process instances, child process spawning, parent-stage locking, child completion, process switching, transition evaluation, status persistence, form behaviour, action triggers, and scoped execution. Runtime reads published snapshots/definitions only; drafts, locks, and autosave rows are never executable runtime inputs.

Details: [release-3-back-office-runtime.md](release-3-back-office-runtime.md)

### Release 4

`R4` adds operational depth for back-office users and support teams: routing, tasks, notifications, SLA/KPI, validations, history, jobs, custom messages, and support views. Routing policies, SLA policies, notification templates, validation rules, and operational configs are first-class Dataverse authoring rows with their own lock/draft/version lifecycle.

Details: [release-4-back-office-operations.md](release-4-back-office-operations.md)

### Release 5

`R5` adds actual portal rendering and the portal return path after the back-office runtime is reliable. It covers portal user initiation, portal-visible projection, hidden internal stage handling, status return, and portal-safe actions.

Details: [release-5-portal-runtime-and-return-path.md](release-5-portal-runtime-and-return-path.md)

### Release 6

`R6` expands reuse and generated business artefacts: templates, base flows, sub-process reuse, table row templates, cloning, transforms, generated artefacts, service definitions, auto-numbering, and document management.

Details: [release-6-reuse-templates-artefacts-and-documents.md](release-6-reuse-templates-artefacts-and-documents.md)

### Release 7

`R7` adds platform tooling and ALM depth: DBM Manager, source sync, XrmToolBox script playground, DBM Solution packaging, solution-aware versioning, DBM Tree, enhanced jobs, auto-integration discovery, and on-premise automation where still relevant. Source sync exports/imports compiled published snapshots and may also handle source-normalised artefacts with conflict reporting.

Details: [release-7-platform-tooling-and-alm.md](release-7-platform-tooling-and-alm.md)

### Release 8

`R8` deepens DBM into an enterprise-grade platform through simulation, replay, explainability, governance, drift control, observability, policy packs, and portfolio-scale optimisation.

Details: [release-8-enterprise-maturity.md](release-8-enterprise-maturity.md)

### Release 9

`R9` adds AI-assisted authoring and analysis after the core product works well without AI.

Details: [release-9-ai-assisted-platform.md](release-9-ai-assisted-platform.md)

## Release-specific acceptance scenarios

- `R0`: repo governance, docs, branch policy, delivery posture, and verification remain enforceable.
- `R1`: a user can define a process portfolio with a visible root process, nested child process definitions, stage-owned child process links, collapsed main-process display, and actual model-driven form rendering. Portal behaviour is defined only as a projection contract.
- `R2`: a user can define JavaScript-first DBMScript actions, trigger hooks, templates, dependencies, and outputs that can be tested without relying on the later runtime; non-mergeable editor work uses granular locks, private drafts, autosave, visible designer sessions, and final ETag consistency checks.
- `R3`: a business user can move through a back-office process on model-driven forms, with process state, stage transitions, statuses, form behaviour, and action triggers persisted by DBM from published snapshots/definitions only.
- `R4`: operators can route work, manage tasks, use notifications, track SLA/KPI behaviour, inspect history, and support running instances; operational policies and templates are first-class authoring rows with granular locks.
- `R5`: a portal user can start or continue the portal leg, see a portal-safe process projection, and receive the correct return-path status without internal leakage.
- `R6`: reusable templates, artefacts, generated rows/documents, cloning, and numbering can be used from the designer without one-off bespoke implementation.
- `R7`: platform assets can be managed, synced, packaged, versioned, deployed, and post-processed through DBM tooling, with conflict reporting for source-normalised imports.
- `R8`: enterprise users can simulate, replay, explain, govern, monitor, and optimise process portfolios.
- `R9`: AI can generate or suggest DBM artefacts with traceability, human review, and no unreviewed production mutation.

## Current assumptions

- `main` remains the integration branch.
- `R0` remains a useful foundation, but product delivery restarts at new `R1`.
- The current designer core, graph/workspace contracts, process renderer, Dataverse synthesis, JS VM, CKEditor/CodeMirror editors, and Jint evaluator are reusable reference candidates.
- Existing release closeout documents remain historical evidence only.
- British spelling is used in new roadmap material.
