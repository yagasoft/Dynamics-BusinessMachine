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
- Generic user-defined vocabulary for process types, actor roles, stage kinds, work kinds, statuses, outcomes, sub-processes, and visibility rules.
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
- first implementation tests for main process visibility, conditional sub-process visibility, whole-stage spans, fractional spans, collapsed main-process rendering, and portal projection contract output

### R1.2 Generic process design contract

Output:
- active contract proof that the user can define any process shape without approval/request being the canonical product model

Must include:
- user-defined process type through `processTypeId`
- user-defined actor roles through `actorCategory` and `roleKey`
- user-defined stage kinds through `stageCategory` and `stageKindId`
- generic task/work definitions through `workCategory` and `workKindId`
- user-defined statuses, outcomes, sub-processes, and visibility rules
- no active roadmap or contract proof that treats one domain example as the default product shape
- a generic fixture matrix as the active contract proof:
  - linear service fulfilment for a simple portal-to-back-office-to-portal flow
  - employee onboarding for parallel HR, IT, and facilities sub-processes spanning a main timeline
  - case investigation for a back-office-only process with internal visibility and branching
  - document lifecycle for draft, check, revise, publish, and previous-stage/rework transition hooks
  - field inspection for scheduling, visit, evidence capture, closure, fractional spans, and portal-safe projection

### R1.3 Designer authoring foundation

Output:
- designer support for main process and sub-process lane authoring

Status:
- implemented as a `processPortfolio`-native designer foundation with `dbm-designer-core` commands and a React Flow Timeline Studio shell
- AntV X6 is not selected for this slice; it remains a possible future spike only if a concrete React Flow blocker appears

Must include:
- add/edit/reorder processes and sub-processes
- add/edit/reorder stages
- visual span editing against the main-process timeline
- conditional visibility editing
- stage feature hook placeholders for later releases
- validation for invalid spans, missing main process, duplicate main process roles, invalid process roles, and ambiguous stage anchors

Implementation boundary:
- React Flow is the canvas and interaction layer only; saved DBM packages remain canonical `processPortfolio` model/workspace JSON and must not contain React Flow graph JSON.
- Stage JavaScript editing, notification WYSIWYG, routing, SLA/KPI configuration, DBMScript execution, action execution, portal runtime, and full rendered form runtime remain placeholders or later-release work.
- Approval/request assets are historical or prototype references only, not active R1.3 contract proof.

### R1.4 Rendered form experience

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

### R1.5 R1 hardening

Output:
- release-quality R1 docs, tests, examples, and acceptance evidence

Must include:
- process portfolio fixtures
- renderer tests for main/sub-process display
- fractional span tests
- form-render smoke proof
- portal projection contract tests
- migration notes from prototype/reference assets

## First implementation tests

The first implementation tests after this roadmap refinement must prove the new `R1.1` contract before any designer or renderer code is treated as product baseline:

- main process visibility is mandatory
- conditional sub-process visibility is evaluated for rendered form and portal projection contexts
- whole-stage and fractional `stageSpan` anchors validate against the main-process timeline
- collapsed main-process rendering still preserves the business-user process status
- portal projection contract output exists without invoking actual portal runtime

## Exit criteria

- A user can define a process portfolio with one main process and multiple sub-processes.
- Sub-process stages can align to any number of main-process stages, including fractional main-stage spans.
- A business user can see the process on an actual model-driven form.
- Portal-visible state is defined as a contract only.
- No action execution, back-office transition runtime, or portal runtime is required to close R1.
