# Release 1: Process/stage designer and actual form render

## Goal

Build the first usable process-first DBM product slice: a user can model a complete business cycle as a process portfolio, then see that process rendered on an actual model-driven form for a business user.

Portal is contract-only in R1. Actual portal runtime and portal rendering land in `R5`.

## Feature set and deliverables

- Process portfolio model with one `mainProcessId` and `processes[]`.
- Main process backbone that is always visible on the rendered form.
- Stacked sub-processes shown below the main process.
- `stageSpan` support for stages that fit inside one main stage, span several main stages, or use a fractional main-stage span.
- Conditional sub-process visibility for form and portal projection rules.
- Main-process collapse option for a slim rendered bar.
- Stage hook model for entry/exit conditions, branching, notifications, routing, SLA/KPI, tasks, validations, actions, status, and portal status.
- Designer authoring for processes, sub-processes, stages, spans, and visibility.
- Actual model-driven form render for the business user.
- Portal projection contract only, including visible/hidden stage rules and portal status fields.

## Stages

### R1.1 Process portfolio contract

Output:
- executable contract and docs for process portfolios, main process identity, sub-processes, stage spans, and stage feature hooks

Must include:
- `mainProcessId`
- `processes[]`
- `subProcessVisibility`
- `stageSpan`
- whole-stage and fractional span anchors
- stage scope for portal, back office, or shared usage
- portal projection contract without actual portal rendering

### R1.2 Designer authoring foundation

Output:
- designer support for main process and sub-process lane authoring

Must include:
- add/edit/reorder processes and sub-processes
- add/edit/reorder stages
- visual span editing against the main-process timeline
- conditional visibility editing
- stage feature hook placeholders for later releases
- validation for invalid spans, missing main process, and ambiguous stage anchors

### R1.3 Rendered form experience

Output:
- actual model-driven form render of the process portfolio

Must include:
- main process always visible
- sub-process lanes below the main process
- conditional sub-process display
- collapsed main-process slim bar
- visible previous-stage branch arrows
- business-user-safe labels and status display
- no portal runtime dependency

### R1.4 R1 hardening

Output:
- release-quality R1 docs, tests, examples, and acceptance evidence

Must include:
- process portfolio fixtures
- renderer tests for main/sub-process display
- fractional span tests
- form-render smoke proof
- portal projection contract tests
- migration notes from prototype/reference assets

## Exit criteria

- A user can define a process portfolio with one main process and multiple sub-processes.
- Sub-process stages can align to any number of main-process stages, including fractional main-stage spans.
- A business user can see the process on an actual model-driven form.
- Portal-visible state is defined as a contract only.
- No action execution, back-office transition runtime, or portal runtime is required to close R1.
