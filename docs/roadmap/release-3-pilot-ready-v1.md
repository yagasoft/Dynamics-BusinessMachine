# Release 3: Pilot-Ready End-To-End Platform (`v1.0.0`)

## Goal

Turn the `R2` designer and process-experience foundation into a pilot-ready Dataverse-first platform where a real approval/request process uses the shared DBM process experience, starts in a DBM-owned external runtime, runs through Dataverse, returns to the front door, and is supportable in `UAT` and `Prod` without requiring Azure runtime services.

## Feature set and deliverables

- DBM-owned external runtime built on the `R1` portal projection contract and the shared process-experience system delivered in `R2`, beginning with a local SPA proof in `R3.1`
- Dataverse-owned work-management core with inboxes, queues, reassignment, delegation, escalation, and SLA timers
- timeline and audit trail as first-class runtime output
- support and administration surfaces
- runtime observability baseline
- Dataverse-owned operational configuration and service-plane behaviour where feasible
- end-to-end state return to the external front door
- browser- or model-driven administration surfaces where needed for pilot operation
- observability, supportability, rollback, and pilot runbooks

## Stages

### R3.1 Local SPA runtime proof and external entry

Output:
- real external entry and coherent process experience for the approval/request scenario, proven through a local SPA against live Dev Dataverse

Must define and implement:
- local proof identity assumptions
- local Node proxy handoff into the DBM runtime
- process initiation contract
- use of the shared process-experience renderer and the external-visible status projection defined in `R1`
- coherent external-facing status and stage communication without leaking hidden internal steps

### R3.2 Dataverse work management and service plane

Output:
- stable Dataverse-owned execution and operational layer that complements the existing runtime without duplicating it

Must include:
- Dataverse-backed inboxes and queues where operationally useful
- reassignment and delegation paths
- escalation and SLA timers
- Dataverse-first background work strategy
- Dataverse-owned orchestration strategy
- operational configuration and telemetry where Dataverse or Power Platform surfaces can reasonably own them

### R3.3 End-to-end lifecycle completion

Output:
- one coherent, pilot-ready reference solution with first-class operational diagnostics

Must connect:
- DBM-owned external runtime
- model-driven DBM process runtime
- Dataverse backend execution
- Dataverse-owned work management and supporting services
- state return to the external front door

Must include:
- process timeline and audit trail
- support and administration surfaces
- runtime observability baseline
- lifecycle completion across portal, backend, and return path

### R3.4 Pilot readiness and operational hardening

Output:
- `v1.0.0`, a pilot-ready end-to-end platform

Must include:
- `UAT` promotion and evidence
- rollback rehearsal
- support diagnostics
- performance validation
- release notes and pilot runbooks
- live end-to-end operational hardening, including the salvaged browser harness, persisted-session posture, environment locks, and promotion-gate wiring

## Exit criteria

- the reference approval/request solution works end-to-end from external entry to completion and back without requiring Azure runtime services
- external-facing status remains coherent with the internal process model without exposing hidden internal stages or steps
- work management, audit, and support diagnostics are usable by real operators
- the solution is supportable in `UAT` and `Prod`
- rollback, diagnostics, and operational documentation are ready for pilot use
