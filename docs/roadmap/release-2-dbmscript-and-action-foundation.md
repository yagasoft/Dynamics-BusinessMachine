# Release 2: DBMScript and action foundation

## Goal

Make DBMScript and action authoring feature-complete enough to become the later runtime substrate, starting with JavaScript first.

This release also establishes the collaborative authoring foundation for R2+ so editable units live as Dataverse-normalised authoring rows with private drafts, granular edit leases, rowversion/ETag expectations, and compiled snapshot boundaries.

## Feature set and deliverables

- JavaScript first DBMScript/action authoring.
- Dataverse-normalised authoring rows for process, stage, child process link, DBMScript, DBM Object, action, notification template, routing policy, SLA policy, validation rule, and stage-local config.
- Private Dataverse-backed drafts created when editing starts, with autosave so user work is not lost after failed publish, expired locks, browser close, or ETag conflict.
- Granular edit leases acquired before meaningful non-mergeable edits begin, either explicitly through Acquire lock or automatically on first edit.
- Active designer sessions for process-level and component-level authoring awareness, stored separately from edit locks.
- Optimistic concurrency/ETags as final consistency guards, not the primary long-edit conflict UX.
- Process JSON remains a compiled published/export/import/runtime snapshot, not the collaborative authoring row.
- DBMScript language/runtime contract for code-first and template-mode authoring.
- DBM Object as a first-class companion to DBMScript for maps, scoped composition, generated objects, and ordered object processing.
- Action definitions that can attach to process, sub-process, stage, form, field, and button triggers.
- Trigger model for on-entry, on-exit, column value change, backend/server change, and dynamically generated buttons.
- Table row templates as the foundation for notifications, routing updates, cloning, and later generated rows.
- WYSIWYG notification template authoring backed by table row templates and send actions.
- Code editor foundation using the prototype CodeMirror work as reference.
- Rich text editor foundation using the prototype CKEditor work as reference.
- Query editor foundation for FetchXML and embedded query snippets.
- Dependency loading, output handling, trace/log support, version history, and test case support.
- Safe execution planning for browser, model-driven, plugin/server, and Dataverse/Jint execution contexts.
- Power Apps Code Apps proof slice for the rich React designer host, while keeping the rendered form process surface PCF/model-driven by default.

## Stages

### R2.1 DBMScript contract and storage

Output:
- collaborative authoring primitives plus DBMScript language/runtime contract and vNext model for scripts, DBM Object records, actions, dependencies, outputs, status, and versioning

Must include:
- authoring unit IDs for process, stage, child process link, DBMScript, DBM Object, action, notification template, routing policy, SLA policy, validation rule, and stage-local config
- draft/published lifecycle across lockable authoring units
- private Dataverse-backed drafts with owner, base published version, base rowversion/ETag, autosave payload, validation state, and recoverability state
- lockable unit metadata and `dbm_editlock` public contract with target type/id, owner, owner display, expiry, heartbeat timestamp, reason, status, acquired source, and force-release audit fields
- `dbm_designersession` public contract with one active session per open designer tab or host instance, process id, owner, owner display, current component target type/id, opened timestamp, heartbeat timestamp, expiry, status, and host/source
- process-level and component-level active designer sessions shown in the editor, including same-user sessions that are not aggregated by user
- acquire, renew heartbeat, release, force-release, stale-lock cleanup, autosave draft, publish draft, reject-save, and reject-publish API/plugin contracts
- optimistic concurrency/ETags as final consistency guards
- compiled snapshot boundary where Process JSON remains a compiled published/export/import/runtime snapshot and excludes draft/lock metadata
- script identity and description
- DBM Object identity, scope, scratchpad, ordered script components, and duplicate-property behaviour
- draft/published/editing lifecycle
- version history and restore-to-draft behaviour
- JavaScript authoring mode
- compressed script storage with web-resource fallback for large payloads
- dependency declarations
- solution-aware metadata

### R2.2 Power Apps Code Apps designer host proof

Output:
- evidence-backed host decision for the rich React DBM designer

Must include:
- Power Apps Code Apps proof slice for Dataverse CRUD/service generation
- lock/draft custom API usage from the designer host
- embedding/navigation proof from model-driven context
- CSP/admin requirement documentation for iframe hosting
- solution ALM proof for the code app and generated service dependencies
- environment enablement and licence assumptions
- source-sync limitation notes, including Code Apps source integration limits
- explicit decision to keep rendered form process as PCF/model-driven unless a later concrete blocker proves Code Apps is better for that business-user surface

### R2.3 JavaScript VM and built-in library

Output:
- tested JavaScript execution surface based on the prototype VM and Jint evaluator

Must include:
- `output(...)`
- `console.log`/trace support
- context object
- entity/reference/choice/date helpers
- broker boundary for C# or external operations
- load script/resource/object functions
- transaction and bulk execution planning contracts
- browser, model-driven, plugin/server, and Dataverse/Jint execution contexts

### R2.4 Actions and triggers

Output:
- action definitions can be attached to stage and form events without executing full process transitions yet

Must include:
- action authoring rows with private draft, published version, rowversion/ETag, and lockable metadata
- editor save/publish checks for lock ownership and final rowversion/ETag match
- read-only editor state when another user holds the action lock
- on-entry trigger
- on-exit trigger
- column value change trigger for frontend/form and backend/server contexts
- dynamic button trigger
- trigger test harness
- explicit unsupported-trigger diagnostics

### R2.5 Templates and notifications

Output:
- table row template system and WYSIWYG notification template path

Must include:
- notification template authoring rows with private draft, published version, rowversion/ETag, and lockable metadata
- autosave into private drafts before publish
- editor save/publish checks for lock ownership and final rowversion/ETag match
- template editor with code and rich text modes
- query editor for FetchXML snippets
- expression references
- related-row template links
- notification as table row template plus send action
- no hard-coded notification-only subsystem

### R2.6 DBM Object processing

Output:
- DBM Object authoring and processing model that can compose scripts into generated maps and artefact inputs

Must include:
- DBM Object table/storage contract aligned with DBMScript lifecycle
- DBM Object authoring rows with private draft, published version, rowversion/ETag, and lockable metadata
- editor save/publish checks for lock ownership and final rowversion/ETag match
- ordered script processing with shared in-memory state
- named scope grouping
- parent `$target` propagation and override rules
- quick-create DBMScript path from DBM Object authoring
- object-level test case support

### R2.7 R2 hardening

Output:
- action foundation ready for the back-office runtime in `R3`

Must include:
- collaborative authoring tests for lock acquisition, lock denial, stale-lock recovery, autosave survival, admin force-release audit, and publish conflict behaviour
- designer-session tests for process-level presence, component-level focus, duplicate same-user sessions, current-tab labelling, and stale-session expiry
- compiled snapshot tests proving Process JSON contains resolved published definitions/references and excludes draft/lock metadata
- Code Apps proof evidence for Dataverse, embedding, CSP, ALM, environment, and source-sync limits
- unit tests for VM behaviour
- action contract fixtures
- editor validation
- script versioning tests
- DBM Object processing tests
- migration notes from prototype/reference script assets

## Exit criteria

- A user can define JavaScript-first DBMScript actions and templates.
- A user can define DBM Object records that compose DBMScript logic into maps and generated object inputs.
- Actions can be bound to the triggers required by later stage execution.
- Notifications are represented through table row templates and send actions.
- Editable DBMScript, DBM Object, action, template, and stage-local config surfaces acquire granular locks before meaningful edits and autosave into private drafts.
- The designer shows active designer sessions at process level and component level, repeats the same user's display name for separate sessions, and keeps those sessions separate from edit authority.
- Two users can edit different units under the same process, while two users cannot edit the same non-mergeable unit concurrently.
- A user's autosaved draft survives failed publish, expired lock, browser close, and ETag conflict.
- Stale locks can expire and be reacquired; admin force-release is audited.
- Published Process JSON snapshots contain published definitions/references and no draft or lock metadata.
- Power Apps Code Apps is either proven as the preferred rich designer host or explicitly deferred with concrete blocker evidence.
- Runtime execution is planned and testable, but full back-office process execution remains in `R3`.
