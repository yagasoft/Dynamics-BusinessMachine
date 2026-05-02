# Canonical model and runtime contract v1

This document records the reset target for the DBM canonical model after [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md).

## Status

- Status: Reset architecture target
- First product release: `R1`
- Current executable status: process hierarchy contract and designer foundation are active through TDD

## Purpose

DBM needs one portable contract that can describe a complete business cycle from portal to back office and back to portal again.

The model must support:

- one visible root process
- reusable child process definitions under any stage
- nested process hierarchies where a child process can itself own deeper child processes
- parent process context while a child process is active
- blocked/awaiting-child status for parent stages
- stage feature hooks
- actual rendered form projection for business users
- portal projection contract for portal users
- later DBMScript/action execution
- later DBM Object composition
- later back-office and portal runtime state

## Canonical envelope

The reset keeps a JSON-based package envelope, but the process section becomes a process portfolio:

```json
{
  "schemaVersion": "dbm.model/v1",
  "package": {},
  "processPortfolio": {
    "mainProcessId": "main",
    "processes": []
  },
  "forms": [],
  "metadata": {},
  "rules": [],
  "runtime": {},
  "artifacts": []
}
```

## Process portfolio contract

`processPortfolio` owns:

- `mainProcessId`
- `processes[]`
- portfolio-level validation rules

Each process owns:

- stable ID and display name
- user-defined process type through `processTypeId`
- process role: `main` or `sub-process`
- display mode for the main process: `expanded` or `collapsed`
- internal status and portal status identifiers that can be projected without invoking runtime code
- actors with `actorCategory` and user-defined `roleKey`
- task and step work definitions with `workCategory` and user-defined `workKindId`
- stages
- visibility rules if it is a child process
- rendered order where a flat list is needed for previews or projections

`processPortfolio.mainProcessId` is the canonical root-process authority. `package.entryProcessId` may remain in package metadata for compatibility, but it must not override the process identified by `processPortfolio.mainProcessId`.

Child processes remain reusable definitions in `processPortfolio.processes[]`. A stage links to a child process definition rather than embedding it inline.

Sub-process visibility uses audience-specific rules:

- `form` for the rendered model-driven form projection
- `portal` for the portal projection contract

The same child process can therefore be visible in the rendered form and hidden from the portal projection, or the reverse, depending on the projection audience and rule result.

## Stage contract

Each stage owns:

- stable ID and display name
- broad stage category through `stageCategory`
- user-defined stage kind through `stageKindId`
- scope: portal, back office, or shared
- `childProcessRefs[]`
- entry conditions
- exit conditions
- branching and convergence hooks
- optional previous-stage transition hook
- notification hooks
- routing hooks
- SLA/KPI hooks
- task hooks
- validation hooks
- action hooks
- internal status
- portal status

Each child process reference stores:

- stable reference ID
- target `processId`
- display name for the authoring and rendered-form surfaces
- optional activation rule
- `blocksParent`, declaring whether the parent stage waits for the child process

R1 records blocking intent only. R3 owns runtime spawning, parent-stage locking, child completion, return-state handling, and process-instance persistence.

Executable validation must reject:

- unresolved `mainProcessId`
- duplicate or invalid main-process roles
- invalid non-main process roles
- child process links to missing process definitions
- duplicate child refs on the same stage
- circular child process references
- invalid blocking configuration

## Generic vocabulary contract

`R1.2` makes genericity executable rather than a wording change. The active `DbmModelV1` contract must not require a TypeScript enum update whenever a user invents a new business domain.

The controlled categories describe broad runtime behaviour:

- `actorCategory`: `person`, `team`, `system`, or `external`
- `stageCategory`: `start`, `work`, `decision`, `system`, `milestone`, or `end`
- `workCategory`: `data`, `work`, `decision`, `system`, or `milestone`

The user-defined identifiers describe the business meaning:

- `processTypeId`
- `roleKey`
- `stageKindId`
- `workKindId`

The active proof is the generic fixture matrix in `dbm-contract/fixtures/valid/generic-process-matrix/`. It covers linear service fulfilment, employee onboarding, case investigation, document lifecycle, and field inspection so the approval/request prototype no longer acts as the product's canonical contract proof.

## Executable contract helpers

The R1 contract package exposes only minimal executable helpers:

- `validateProcessPortfolioModelV1(model)` validates process-portfolio references that JSON Schema cannot prove, including a resolvable `mainProcessId`, child process target references, duplicate child refs, circular child references, and child-link blocking configuration.
- `createProcessPortfolioProjectionV1(model, context)` creates a contract-only projection for `form` or `portal`.

The projection helper always includes the main process from `processPortfolio.mainProcessId`. It evaluates sub-process visibility separately for the requested audience. When the main process is projected as `collapsed`, the projection must still carry business-user status and portal status identifiers.

The portal projection output is a contract shape only. It records `portalRuntimeInvoked: false` and must not depend on portal runtime, portal rendering, or external identity handling.

## Rendered form contract

The rendered form is the final business-user process presentation, not the designer.

R1 must support:

- parent process context always visible
- current parent stage visible for perspective
- active child process as the working surface under the parent stage
- blocked/awaiting-child status for blocking child process links
- conditional child process visibility
- collapsed main-process slim bar
- arrows for previous-stage transitions where relevant
- business-user-safe labels and statuses

## Portal projection contract

Portal projection is contract-only in `R1`.

It must define:

- which main-process status is visible to the portal user
- which child processes are visible to the portal user
- how internal statuses map to portal statuses
- how hidden internal stages stay hidden
- which future portal actions can be exposed safely

Actual portal rendering and runtime belong to `R5`.

## R1 exclusions

R1 does not implement:

- portal runtime or portal rendering
- DBMScript or action runtime
- back-office transition runtime
- runtime spawning, parent-stage locking, child completion, return-state handling, or process-instance persistence
- routing
- SLA/KPI execution
- task execution
- notification sending
- DBM Object
- AI behaviour

## DBMScript/action implications

R1 defines hooks only. R2 owns executable action details.

The contract must leave stable references for:

- on-entry actions
- on-exit actions
- column value change actions
- backend/server change actions
- dynamic button actions
- template-backed notification send actions
- DBMScript language/runtime contract references
- DBM Object references for maps, scoped composition, and generated object inputs
- browser, model-driven, plugin/server, and Dataverse/Jint execution contexts
- script/object version history and test case support

## Runtime implications

R3 owns the first back-office runtime implementation.

The contract must allow:

- process instance creation
- child process instance spawning from a parent stage
- parent-stage blocking while required child process instances are active
- child completion and parent-stage return-state handling
- process sessions
- row, user, role, and owner scope
- process instance per row, user, role, or owner where configured
- record-level and user-level process switching
- stage transition persistence
- show Next transition mode and automatic transition mode
- parallel branches and convergence inside a process
- expression, FetchXML, and action-backed condition references
- backend condition evaluation on load and save
- form behaviour runtime
- XRM/form-context helper binding
- internal status and portal status persistence
- action trigger execution

## Non-authoritative sidecars

Designer workspace state, graph layout, viewport, collapsed node state, and renderer-specific state must remain sidecars. They must not become the authoritative business process definition.
