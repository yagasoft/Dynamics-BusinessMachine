# Release 2: Pilot-Ready End-To-End Platform (`v1.0.0`)

## Goal

Turn the builder MVP into a pilot-ready platform where a real approval/request process starts in Power Pages, runs through Dataverse and Azure, returns to the front door, and is supportable in `UAT` and `Prod`.

## Feature set and deliverables

- Power Pages front-door integration
- Azure orchestration and integration services
- end-to-end state return to the portal
- browser- or Azure-hosted administration surfaces where needed for pilot operation
- observability, supportability, rollback, and pilot runbooks

## Stages

### R2.1 Portal contract and external entry

Output:
- portal-entry path for the approval/request scenario

Must define and implement:
- Power Pages authentication and identity assumptions
- context handoff into the DBM runtime
- process initiation contract
- state return contract

### R2.2 Azure orchestration and service plane

Output:
- stable Azure-backed execution layer that complements Dataverse without duplicating it

Must include:
- background work strategy
- orchestration strategy
- telemetry and operational service design
- performance-sensitive execution paths where Azure adds clear value

### R2.3 End-to-end lifecycle completion

Output:
- one coherent, pilot-ready reference solution

Must connect:
- Power Pages
- PCF runtime
- Dataverse backend execution
- Azure orchestration and supporting services
- state return to the portal

### R2.4 Pilot readiness and operational hardening

Output:
- `v1.0.0`, a pilot-ready end-to-end platform

Must include:
- `UAT` promotion and evidence
- rollback rehearsal
- support diagnostics
- performance validation
- release notes and pilot runbooks

## Exit criteria

- the reference approval/request solution works end-to-end from portal to completion and back
- the solution is supportable in `UAT` and `Prod`
- rollback, diagnostics, and operational documentation are ready for pilot use
