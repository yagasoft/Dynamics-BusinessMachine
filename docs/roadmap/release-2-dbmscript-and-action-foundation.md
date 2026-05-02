# Release 2: DBMScript and action foundation

## Goal

Make DBMScript and action authoring feature-complete enough to become the later runtime substrate, starting with JavaScript first.

## Feature set and deliverables

- JavaScript first DBMScript/action authoring.
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

## Stages

### R2.1 DBMScript contract and storage

Output:
- DBMScript language/runtime contract and vNext model for scripts, DBM Object records, actions, dependencies, outputs, status, and versioning

Must include:
- script identity and description
- DBM Object identity, scope, scratchpad, ordered script components, and duplicate-property behaviour
- draft/published/editing lifecycle
- version history and restore-to-draft behaviour
- JavaScript authoring mode
- compressed script storage with web-resource fallback for large payloads
- dependency declarations
- solution-aware metadata

### R2.2 JavaScript VM and built-in library

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

### R2.3 Actions and triggers

Output:
- action definitions can be attached to stage and form events without executing full process transitions yet

Must include:
- on-entry trigger
- on-exit trigger
- column value change trigger for frontend/form and backend/server contexts
- dynamic button trigger
- trigger test harness
- explicit unsupported-trigger diagnostics

### R2.4 Templates and notifications

Output:
- table row template system and WYSIWYG notification template path

Must include:
- template editor with code and rich text modes
- query editor for FetchXML snippets
- expression references
- related-row template links
- notification as table row template plus send action
- no hard-coded notification-only subsystem

### R2.5 DBM Object processing

Output:
- DBM Object authoring and processing model that can compose scripts into generated maps and artefact inputs

Must include:
- DBM Object table/storage contract aligned with DBMScript lifecycle
- ordered script processing with shared in-memory state
- named scope grouping
- parent `$target` propagation and override rules
- quick-create DBMScript path from DBM Object authoring
- object-level test case support

### R2.6 R2 hardening

Output:
- action foundation ready for the back-office runtime in `R3`

Must include:
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
- Runtime execution is planned and testable, but full back-office process execution remains in `R3`.
