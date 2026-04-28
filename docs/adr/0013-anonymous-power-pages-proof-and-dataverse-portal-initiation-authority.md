# ADR-0013: Anonymous Power Pages Proof And Dataverse Portal Initiation Authority

- Status: Superseded
- Date: 2026-04-15
- Decision owners: Ahmed Elsawalhy, Yagasoft
- Superseded by: [ADR-0014](0014-local-spa-proof-and-dataverse-runtime-authority.md)

## Supersession note

This ADR is retained for history only. The Power Pages proof direction was abandoned before it became the durable `R3.1` front-door strategy, and `R3.1` now uses a repo-owned local SPA proof with a local Node proxy and Dataverse-authoritative runtime progression instead.

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
- The repo establishes a tracked portal delivery seam through `power-platform/solutions/DynamicsBusinessMachinePortalRuntime`, a generated `portal-runtime-context.js` asset sourced from the generated metadata plan, and Dev automation scripts that apply portal assets and plugin-step registrations through the Dataverse Web API.
- The repo does not provision Power Pages websites for `R3.1`; site creation remains an external prerequisite, and deployment only proceeds after `azure/config/dev.json` points to a real pre-provisioned site name/id pair.

## Consequences

- External entry can be proven live in `Dev` without widening the release slice into durable external identity, portal hardening, or Azure orchestration.
- Anonymous status readback is explicit and visible in config through `devAnonymousReadbackEnabled`; it is not an implicit behavior.
- The request record stays the source of truth for:
  - runtime stage and step
  - internal and portal status
  - generic profile key ownership assumption
- Portal-visible status stays coherent with the model-driven host because both hosts read the same canonical Dataverse-backed runtime contract.
- `Dev` deployment is now automation-first through `.\eng\scripts\Invoke-R3PortalRuntimeDevDeploy.ps1`, but it still depends on a pre-provisioned Power Pages website and a persisted model-driven session for the final smoke path.
- Arbitrary placeholder Power Pages values are intentionally rejected so operators cannot accidentally apply portal assets against a nonexistent or mismatched site.

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
