# ADR-0014: Local SPA Proof And Dataverse Runtime Authority

- Status: Superseded by ADR-0016
- Date: 2026-04-15
- Decision owners: Ahmed Elsawalhy, Yagasoft
- Supersedes: [ADR-0013](0013-anonymous-power-pages-proof-and-dataverse-portal-initiation-authority.md)

## Context

Historical note: this ADR described the old `R3.1` local SPA proof. It is superseded as active roadmap authority by [ADR-0016](0016-product-roadmap-reset-process-first.md), while the local SPA proof remains useful prototype/reference evidence.

`R3.1` was the first live external-entry slice after the canonical `R2` merge in the old roadmap. It had to build on the shipped shared process-experience renderer, portal projection semantics, and generated Dataverse runtime fields without reopening `R2`.

The original Power Pages proof direction was abandoned after repeated deployment-host instability and tooling overhead that did not add value to the first slice. `R3.1` still needs to prove:

- one approval/request proof path
- `Dev` only
- real external entry and same-session continuity
- authoritative create and submit progression in Dataverse
- external-visible status that never leaks internal-only stage or step detail

Two earlier exploratory branches, `codex/r2.4-live-connected-e2e` and `codex/r2.4-live-e2e-persisted-session`, were not part of the canonical `R2` merge and are therefore not inherited assumptions for this slice.

## Decision

- The canonical continuation branch for this slice remains `codex/r3-1-portal-runtime-and-external-entry`, created from `main`.
- `R3.1` uses a repo-owned local SPA proof hosted by a local Node process on the developer machine.
- The local proof host serves the SPA and exposes the only browser-facing API surface:
  - `POST /api/runtime/drafts`
  - `GET /api/runtime/requests/:id`
  - `POST /api/runtime/requests/:id/submit`
  - `GET /api/runtime/health`
- The local proof host acquires Dataverse access tokens through Azure CLI. The browser never receives a Dataverse access token.
- `R3.1` uses a proof-only generic-profile identity posture with a configured `genericProfileKey`.
- The browser client creates request rows with business fields only and submits by calling the local host, which writes `dbm_portalcommand = submit`.
- Dataverse plugin logic remains the authoritative create and submit decision point:
  - on create, initialize draft runtime state and stamp the generic profile key
  - on submit, validate the start-form requirements, advance to the hidden internal screening stage, project `under-review`, and clear the command field
- The shared `dbm-process-experience` renderer remains the only source of external projection behavior. The local SPA may add entry/runtime chrome, but it must not invent hidden-stage or status semantics locally.
- The `R3.1` start-form experience is driven by bootstrap entry-field configuration derived from the start-stage form states, so the local SPA captures the same request business fields the Dataverse runtime expects before draft creation.
- The repo does not provision or configure Power Pages for `R3.1`. Power Pages is fully removed from the implementation and deployment path for this slice.

## Consequences

- External entry can be proven live in `Dev` without widening the release slice into hosted front-door infrastructure, durable external identity, or browser token flows.
- The request record stays the source of truth for:
  - runtime stage and step
  - internal and external-visible status
  - generic profile key ownership assumption
- External-visible status stays coherent with the model-driven host because both hosts read the same canonical Dataverse-backed runtime contract.
- `Dev` validation is now automation-first through `.\eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1`.
- `R3.1` no longer depends on Power Pages site provisioning, Power Pages deployment seams, or Dataverse website metadata.

## Alternatives considered

- Keep the Power Pages proof path and add more deployment hardening
  - rejected because the hosting and deployment surface was too brittle for the value it added in the first slice
- Put initiation authority in the local SPA client
  - rejected because it would duplicate runtime semantics and weaken the canonical Dataverse authority boundary
- Introduce a Dataverse Custom API in `R3.1`
  - rejected because the first slice should stay on the simplest supported create-and-submit path and avoid broadening the backend delivery surface
- Require authenticated external users in `R3.1`
  - rejected because it would delay the proof slice and mix identity hardening into the first runtime seam
- Reopen `R2` semantics while adding live external runtime
  - rejected because `R3.1` must build on the merged `R2` platform, not renegotiate it

## Related docs

- [Release Plan](../roadmap/release-plan.md)
- [Superseded old release 3 plan](../roadmap/release-3-pilot-ready-v1.md)
- [R2 Process Experience Hosting](../runbooks/r2-process-experience-hosting.md)
- [R3 Portal Runtime Dev Proof](../runbooks/r3-portal-runtime-dev-proof.md)
