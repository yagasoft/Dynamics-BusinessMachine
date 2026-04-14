# Release 3: Pilot-Ready End-To-End Platform (`v1.0.0`)

## Goal

Turn the `R2` designer and process-experience foundation into a pilot-ready platform where a real approval/request process uses the shared DBM process experience, starts in Power Pages, runs through Dataverse and Azure where needed, returns to the front door, and is supportable in `UAT` and `Prod`.

## Feature set and deliverables

- Power Pages runtime built on the `R1` portal projection contract and the shared process-experience system delivered in `R2`
- work-management core with inboxes, queues, reassignment, delegation, escalation, and SLA timers
- timeline and audit trail as first-class runtime output
- support and administration surfaces
- runtime observability baseline
- Azure orchestration and integration services
- end-to-end state return to the portal
- browser- or Azure-hosted administration surfaces where needed for pilot operation
- observability, supportability, rollback, and pilot runbooks

## Stages

### R3.1 Portal runtime and external entry

Output:
- real portal entry and coherent process experience for the approval/request scenario

Must define and implement:
- Power Pages authentication and identity assumptions
- context handoff into the DBM runtime
- process initiation contract
- use of the shared process-experience renderer and the portal-visible status projection defined in `R1`
- coherent portal-facing status and stage communication without leaking hidden internal steps

### R3.2 Azure orchestration and service plane

Output:
- stable Azure-backed execution layer that complements Dataverse without duplicating it

Must include:
- inboxes and queues where operationally useful
- reassignment and delegation paths
- escalation and SLA timers
- background work strategy
- orchestration strategy
- telemetry and service APIs where Azure adds clear value

### R3.3 End-to-end lifecycle completion

Output:
- one coherent, pilot-ready reference solution with first-class operational diagnostics

Must connect:
- Power Pages runtime
- model-driven DBM process runtime
- Dataverse backend execution
- Azure orchestration and supporting services
- state return to the portal

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

- the reference approval/request solution works end-to-end from portal to completion and back
- portal-facing status remains coherent with the internal process model without exposing hidden internal stages or steps
- work management, audit, and support diagnostics are usable by real operators
- the solution is supportable in `UAT` and `Prod`
- rollback, diagnostics, and operational documentation are ready for pilot use
