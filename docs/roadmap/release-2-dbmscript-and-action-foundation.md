# Release 2: DBMScript and action foundation

## Goal

Make DBMScript and action authoring feature-complete enough to become the later runtime substrate, starting with JavaScript first.

## Feature set and deliverables

- JavaScript first DBMScript/action authoring.
- Action definitions that can attach to process, sub-process, stage, form, field, and button triggers.
- Trigger model for on-entry, on-exit, column value change, backend/server change, and dynamically generated buttons.
- Table row templates as the foundation for notifications, routing updates, cloning, and later generated rows.
- WYSIWYG notification template authoring backed by table row templates and send actions.
- Code editor foundation using the prototype CodeMirror work as reference.
- Rich text editor foundation using the prototype CKEditor work as reference.
- Dependency loading, output handling, trace/log support, and test case hooks.
- Safe execution planning for browser, model-driven, and Dataverse/Jint execution targets.

## Stages

### R2.1 DBMScript contract and storage

Output:
- DBMScript vNext model for scripts, actions, dependencies, outputs, status, and versioning

Must include:
- script identity and description
- draft/published/editing lifecycle
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
- expression references
- related-row template links
- notification as table row template plus send action
- no hard-coded notification-only subsystem

### R2.5 R2 hardening

Output:
- action foundation ready for the back-office runtime in `R3`

Must include:
- unit tests for VM behaviour
- action contract fixtures
- editor validation
- script versioning tests
- migration notes from prototype/reference script assets

## Exit criteria

- A user can define JavaScript-first DBMScript actions and templates.
- Actions can be bound to the triggers required by later stage execution.
- Notifications are represented through table row templates and send actions.
- Runtime execution is planned and testable, but full back-office process execution remains in `R3`.
