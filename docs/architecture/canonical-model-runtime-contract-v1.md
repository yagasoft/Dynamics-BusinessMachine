# Canonical model and runtime contract v1

This document records the reset target for the DBM canonical model after [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md).

## Status

- Status: Reset architecture target
- First product release: `R1`
- Current executable status: prototype/reference implementation exists, but the active contract must be rebuilt through TDD

## Purpose

DBM needs one portable contract that can describe a complete business cycle from portal to back office and back to portal again.

The model must support:

- one visible main process
- any number of sub-processes
- stages with whole-stage, multi-stage, and fractional spans against the main-process timeline
- stage feature hooks
- actual rendered form projection for business users
- portal projection contract for portal users
- later DBMScript/action execution
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
- global actors, statuses, portal statuses, variables, and shared rule references where useful
- portfolio-level validation rules

Each process owns:

- stable ID and display name
- process role: `main` or `sub-process`
- stages
- visibility rules if it is a sub-process
- rendered order below the main process

## Stage contract

Each stage owns:

- stable ID and display name
- scope: portal, back office, or shared
- `stageSpan`
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

`stageSpan` is first-class. It must support:

- start and end at full main stages
- start and end inside a main stage by fractional position
- spans across several main stages
- validation that a sub-process stage resolves to a visible position on the main-process timeline

## Rendered form contract

The rendered form is the final business-user process presentation, not the designer.

R1 must support:

- main process always visible
- sub-processes below the main process
- conditional sub-process visibility
- collapsed main-process slim bar
- arrows for previous-stage transitions where relevant
- business-user-safe labels and statuses

## Portal projection contract

Portal projection is contract-only in `R1`.

It must define:

- which main-process status is visible to the portal user
- which sub-processes are visible to the portal user
- how internal statuses map to portal statuses
- how hidden internal stages stay hidden
- which future portal actions can be exposed safely

Actual portal rendering and runtime belong to `R5`.

## DBMScript/action implications

R1 defines hooks only. R2 owns executable action details.

The contract must leave stable references for:

- on-entry actions
- on-exit actions
- column value change actions
- backend/server change actions
- dynamic button actions
- template-backed notification send actions

## Runtime implications

R3 owns the first back-office runtime implementation.

The contract must allow:

- process instance creation
- row, user, role, and owner scope
- stage transition persistence
- form behaviour runtime
- internal status and portal status persistence
- action trigger execution

## Non-authoritative sidecars

Designer workspace state, graph layout, viewport, collapsed node state, and renderer-specific state must remain sidecars. They must not become the authoritative business process definition.
