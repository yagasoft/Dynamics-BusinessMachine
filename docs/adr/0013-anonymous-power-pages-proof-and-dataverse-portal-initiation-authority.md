# ADR-0013: Anonymous Power Pages Proof And Dataverse Portal Initiation Authority

- Status: Accepted
- Date: 2026-04-15
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

`R3.1` is the first live external-entry slice after the canonical `R2` merge. It must build on the shipped shared process-experience renderer, portal projection semantics, and generated Dataverse runtime fields without reopening `R2`.

The slice is intentionally narrow:

- one approval/request proof path
- `Dev` only
- Power Pages external entry and runtime shell
- authoritative create and submit progression in Dataverse
- portal-visible status that never leaks internal-only stage or step detail

Two earlier exploratory branches, `codex/r2.4-live-connected-e2e` and `codex/r2.4-live-e2e-persisted-session`, were not part of the canonical `R2` merge and are therefore not inherited assumptions for this slice.

## Decision

- The canonical continuation branch for this slice is `codex/r3-1-portal-runtime-and-external-entry`, created from `main`.
- `R3.1` uses an explicit proof-only anonymous identity posture in Power Pages with a configured generic profile key.
- Power Pages uses supported Dataverse table CRUD only. It does not call a Dataverse Custom API for this slice.
- The portal client creates request rows with business fields only and submits by writing `dbm_portalcommand = submit`.
- Dataverse plugin logic is the authoritative create/submit decision point:
  - on create, initialize draft runtime state and stamp the generic profile key
  - on submit, validate the start-form requirements, advance to the hidden internal screening stage, project `under-review`, and clear the command field
- The shared `dbm-process-experience` renderer remains the only source of portal projection behavior. The portal shell may add entry/runtime chrome, but it must not invent hidden-stage or status semantics locally.
- The `R3.1` start-form experience is driven by bootstrap entry-field configuration derived from the start-stage form states, so the portal runtime captures the same request business fields the Dataverse runtime expects before draft creation.
- The repo establishes a tracked portal delivery seam through `power-platform/solutions/DynamicsBusinessMachinePortalRuntime` plus `.\eng\scripts\Export-PortalRuntimePackage.ps1`, rather than pretending that a full Power Pages packaging/import automation pipeline already exists.

## Consequences

- External entry can be proven live in `Dev` without widening the release slice into durable external identity, portal hardening, or Azure orchestration.
- Anonymous status readback is explicit and visible in config through `devAnonymousReadbackEnabled`; it is not an implicit behavior.
- The request record stays the source of truth for:
  - runtime stage and step
  - internal and portal status
  - generic profile key ownership assumption
- Portal-visible status stays coherent with the model-driven host because both hosts read the same canonical Dataverse-backed runtime contract.
- Operators must still perform manual portal asset import/configuration and manual plugin step registration in `Dev`, because those parts are not yet represented as a fully automated repo-managed deployment flow.

## Alternatives considered

- Put initiation authority in the Power Pages client
  - rejected because it would duplicate runtime semantics and weaken the canonical Dataverse authority boundary
- Introduce a Dataverse Custom API in `R3.1`
  - rejected because the first slice should stay on the supported Power Pages CRUD path and avoid broadening the delivery surface
- Require authenticated external users in `R3.1`
  - rejected because it would delay the proof slice and mix portal identity hardening into the first runtime seam
- Reopen `R2` semantics while adding live portal runtime
  - rejected because `R3.1` must build on the merged `R2` platform, not renegotiate it

## Related docs

- [Release Plan](../roadmap/release-plan.md)
- [Release 3 Pilot Ready v1](../roadmap/release-3-pilot-ready-v1.md)
- [R2 Process Experience Hosting](../runbooks/r2-process-experience-hosting.md)
- [R3 Portal Runtime Dev Proof](../runbooks/r3-portal-runtime-dev-proof.md)
