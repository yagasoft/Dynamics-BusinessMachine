# Release 1: Process/stage designer and actual form render

## Goal

Build the first usable process-first DBM product slice: a user can model a business process hierarchy, then see the relevant parent process context and active child process rendered on an actual model-driven form for a business user.

Portal is contract-only in R1. Actual portal runtime and portal rendering land in `R5`.

Runtime spawning, parent-stage locking, child completion, return-state handling, and process-instance persistence move to `R3`.

## Feature set and deliverables

- Process portfolio model with one root `mainProcessId` and reusable process definitions in `processes[]`.
- Stage-owned child process links through `childProcessRefs[]`.
- Parent process context that stays visible when a child process is active.
- Parent stage blocked/awaiting-child display in the rendered form contract.
- Child process definitions that can themselves own stages and deeper child process links.
- Conditional child process visibility for form and portal projection rules.
- Main-process collapse option for a slim rendered bar.
- Stage hook model for entry/exit conditions, branching, notifications, routing, SLA/KPI, tasks, validations, actions, status, and portal status.
- Generic user-defined vocabulary for process types, actor roles, stage kinds, work kinds, statuses, outcomes, child processes, and visibility rules.
- Designer authoring for parent processes, child processes, stages, child-process links, visibility, and hook placeholders.
- Actual model-driven form render for the business user.
- Portal projection contract only, including visible/hidden stage rules and portal status fields.

## Stages

### R1.1 Process portfolio contract

Output:
- executable contract and docs for process portfolios, main process identity, stage-owned child process links, and stage feature hooks

Must include:
- `mainProcessId`
- `processes[]`
- `subProcessVisibility`
- `childProcessRefs[]`
- root process resolution through `processPortfolio.mainProcessId`
- validation for missing child process targets, duplicate child refs, circular process references, invalid root process, invalid process roles, and invalid blocking configuration
- stage scope for portal, back office, or shared usage
- portal projection contract without actual portal rendering
- first implementation tests for main process visibility, conditional child process visibility, nested child process definitions, collapsed main-process rendering, and portal projection contract output

### R1.2 Generic process design contract

Output:
- active contract proof that the user can define any process shape without approval/request being the canonical product model

Must include:
- user-defined process type through `processTypeId`
- user-defined actor roles through `actorCategory` and `roleKey`
- user-defined stage kinds through `stageCategory` and `stageKindId`
- generic task/work definitions through `workCategory` and `workKindId`
- user-defined statuses, outcomes, child process definitions, and visibility rules
- no active roadmap or contract proof that treats one domain example as the default product shape
- a generic fixture matrix as the active contract proof:
  - linear service fulfilment for a simple portal-to-back-office-to-portal flow
  - employee onboarding for parent, child, and grandchild process definitions
  - case investigation for a back-office-only process with internal visibility and branching
  - document lifecycle for draft, check, revise, publish, and previous-stage/rework transition hooks
  - field inspection for scheduling, visit, evidence capture, closure, and portal-safe projection

### R1.3 Designer authoring foundation

Output:
- designer support for process hierarchy authoring

Status:
- implemented as a `processPortfolio`-native designer foundation with `dbm-designer-core` commands and a React Flow Hierarchy Studio shell
- AntV X6 is not selected for this slice; it remains a possible future spike only if a concrete React Flow blocker appears

Must include:
- add/edit/reorder processes and child process definitions
- add/edit/reorder stages under any selected process
- add/edit child process links under any selected parent stage
- visual process hierarchy rendering with parent process, child process, parent stage, and child process stage labels
- blocked parent-stage indicator for blocking child process links
- conditional visibility editing
- stage feature hook placeholders for later releases
- validation for missing main process, duplicate main process roles, invalid process roles, missing child process targets, duplicate child refs, circular child references, and invalid blocking configuration

Implementation boundary:
- React Flow is the canvas and interaction layer only; saved DBM packages remain canonical `processPortfolio` model/workspace JSON and must not contain React Flow graph JSON.
- Stage JavaScript editing, notification WYSIWYG, routing, SLA/KPI configuration, DBMScript execution, action execution, portal runtime, runtime spawning, parent locking, child completion, and full rendered form runtime remain placeholders or later-release work.
- Approval/request assets are historical or prototype references only, not active R1.3 contract proof.

### R1.4 Rendered form experience

Output:
- actual model-driven form render of the process hierarchy

Must include:
- parent process context always visible
- current parent stage visible for perspective
- active child process shown as the working surface under the parent stage
- blocked/awaiting-child status on the parent stage
- conditional child process display
- collapsed main-process slim bar
- visible previous-stage branch arrows
- business-user-safe labels and status display
- no portal runtime dependency

### R1.5 R1 hardening

Output:
- release-quality R1 docs, tests, examples, and acceptance evidence

Must include:
- process portfolio fixtures
- renderer tests for parent/child process display
- nested hierarchy tests
- form-render smoke proof
- portal projection contract tests
- migration notes from prototype/reference assets

## First implementation tests

The first implementation tests after this roadmap correction must prove the active `R1.1` contract before any designer or renderer code is treated as product baseline:

- main process visibility is mandatory
- conditional child process visibility is evaluated for rendered form and portal projection contexts
- stage-owned `childProcessRefs[]` validate missing targets, duplicate refs, cycles, and blocking configuration
- nested child process definitions work across at least three levels
- collapsed main-process rendering still preserves the business-user process status
- portal projection contract output exists without invoking actual portal runtime

## Exit criteria

- A user can define a process portfolio with one root process and nested child process definitions.
- Any process stage can reference one or more child process definitions.
- A business user can see the parent process context, current parent stage, blocked/awaiting-child status, and active child process on an actual model-driven form.
- Portal-visible state is defined as a contract only.
- No action execution, back-office transition runtime, runtime spawning, parent locking, child completion, or portal runtime is required to close R1.
