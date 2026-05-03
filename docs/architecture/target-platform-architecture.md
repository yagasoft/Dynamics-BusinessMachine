# Target platform architecture

This document defines the target architecture for DBM after the process-first roadmap reset.

## Architectural intent

DBM should let a user design a complete business cycle from portal to back office and back to the portal again.

The product is centred on a process portfolio:

- one root process that drives the full lifecycle
- reusable child process definitions under any stage
- stage-owned child process links with blocked/awaiting-child semantics
- a rendered form experience for business users
- a portal-safe projection for portal users
- JavaScript-first action logic through DBMScript
- Dataverse-normalised authoring rows with private drafts and granular edit leases
- designer-session presence for who has the process or component open
- Dataverse/model-driven back-office runtime before portal runtime

## Core boundaries

### 1. Process portfolio

The process portfolio is the authoritative product model. It owns `mainProcessId`, `processes[]`, `subProcessVisibility`, `childProcessRefs[]`, stage feature hooks, status, portal status, and process-to-form rendering semantics.

### 2. Designer core

The designer core owns validation, editing behaviour, serialization, and model composition. It must stay host-agnostic and must not depend on a specific graph library save format. For R2+, the preferred host direction is Power Apps Code Apps for the rich React designer, subject to a proof slice that verifies Dataverse access, lock/draft API usage, embedding/navigation, CSP/admin requirements, solution ALM, environment support, and source-sync limits.

### 3. Collaborative authoring

Dataverse-normalised authoring rows are the collaborative authoring source for process, stage, child process link, DBMScript, DBM Object, action, notification template, routing policy, SLA policy, validation rule, and stage-local configuration. The authoring layer creates private Dataverse-backed drafts when editing starts, shows designer-session presence for process-level and component-level awareness, acquires granular edit leases before meaningful non-mergeable edits, autosaves draft work, and uses optimistic concurrency/ETags as final consistency guards.

Designer-session presence is an awareness contract, not edit authority. It records one active session per open designer tab or host instance, including repeated same-user sessions and the current component focus. Edit leases remain the only authoring gate for meaningful non-mergeable edits.

Process JSON remains a compiled published/export/import/runtime snapshot. The snapshot resolves published definitions and excludes draft and lock metadata.

### 4. Rendered form experience

The rendered form is the business-user surface. It is distinct from the designer. In `R1`, DBM must prove actual model-driven form render of the parent process context and active child process surface. The rendered form process surface remains PCF/model-driven unless a later concrete blocker proves Code Apps is better for that business-user form surface.

### 5. Portal projection

Portal projection is a view of canonical process state. `R1` defines the contract only. Actual portal rendering and runtime continuity arrive in `R5`.

### 6. DBMScript/action runtime

DBMScript is the JavaScript-first action substrate. It owns scripts, actions, templates, dependencies, output handling, trace behaviour, and execution planning across browser, model-driven, and Dataverse/Jint contexts.

### 7. Back-office runtime

The back-office runtime owns process instances, child process spawning, parent-stage locking, child completion, stage transitions, status persistence, form behaviour, owner/user/role scope, and action trigger execution in model-driven/Dataverse contexts. It consumes published snapshots and definitions only; runtime never executes drafts, edit locks, or half-edited authoring rows.

### 8. Operations layer

The operations layer owns routing, tasks, notifications, SLA/KPI, validations, history, jobs, custom messages, and support surfaces. Routing policies, SLA policies, notification templates, validation rules, and stage-local operational settings are first-class Dataverse authoring rows with their own lock/draft/version lifecycle.

### 9. Reuse and artefacts

Reusable templates, sub-processes, table row templates, artefacts, documents, cloning, service definitions, and numbering deepen the product after runtime basics are stable.

### 10. Platform tooling and ALM

DBM Manager, source sync, XrmToolBox playground, DBM Solution packaging, versioning, DBM Tree, enhanced jobs, post-deploy scripts, and automation make DBM manageable as a platform. ALM exports/imports compiled published snapshots and may also handle source-normalised artefacts with conflict reporting.

### 11. Enterprise maturity and AI

Simulation, replay, explainability, governance, drift control, observability, and optimisation arrive before AI. AI is layered on top only after DBM works well without AI.

## Target platform view

```mermaid
flowchart TB
    A["User"] --> B["Designer"]
    B --> C["Dataverse-normalised authoring rows"]
    C --> D["Private drafts, designer sessions, and edit leases"]
    C --> E["Compiled published snapshot"]
    E --> F["Rendered model-driven form"]
    E --> G["Portal projection contract"]
    E --> H["DBMScript/action definitions"]
    H --> I["Back-office runtime"]
    F --> I
    I --> J["Operations"]
    J --> K["Reuse/templates/artefacts/documents"]
    K --> L["Platform tooling and ALM"]
    L --> M["Enterprise maturity"]
    M --> N["AI assistance"]
    G --> O["Portal runtime and return path"]
    I --> O
```

## Release mapping

- `R0` keeps engineering and governance foundations.
- `R1` proves the process portfolio designer and actual model-driven rendered form.
- `R2` proves DBMScript, JavaScript-first actions, collaborative authoring primitives, designer-session awareness, and the Power Apps Code Apps designer host proof.
- `R3` proves back-office runtime from published snapshots/definitions only.
- `R4` adds operations as first-class locked/drafted authoring rows.
- `R5` adds portal runtime and return path.
- `R6` adds reuse, templates, artefacts, and documents.
- `R7` adds platform tooling, ALM, source sync, compiled published snapshots, source-normalised artefacts, and conflict reporting.
- `R8` adds enterprise maturity.
- `R9` adds AI assistance.

## Architecture constraints

- The designer remains the primary authoring surface.
- The rendered form is not the designer.
- Dataverse-normalised authoring rows are the collaborative authoring source.
- Designer-session presence shows who has a process or component open without granting edit authority.
- Process JSON is a compiled published/export/import/runtime snapshot.
- Long non-mergeable edits must acquire a granular edit lease before meaningful edits begin and autosave into a private Dataverse-backed draft.
- Optimistic concurrency and ETags are final consistency guards.
- Power Apps Code Apps is preferred for the rich designer only after the R2 proof slice passes.
- The rendered form process surface remains PCF/model-driven by default.
- The root process is always visible on rendered form and portal projection surfaces.
- Child processes render under the parent stage that owns them and can be conditional.
- Stage-owned child process links are semantic, not merely visual.
- DBMScript starts with JavaScript first.
- Actual portal runtime starts after back-office runtime.
- Current implementation is reference material unless it fits the reset architecture and passes current tests.
