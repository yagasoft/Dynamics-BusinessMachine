# ADR-0011: Post-R1 Roadmap Reset And Designer/Process Experience Platform

- Status: Accepted
- Date: 2026-04-14
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

`R1` shipped successfully on the `0.3.0` line with:

- canonical DBM process semantics
- a host-agnostic `dbm-designer-core`
- an Angular-based `dbm-app` shell
- existing-form Dataverse synthesis plus DBM-managed supported JS behavior
- a DBM-owned model-driven runtime rendered today through supported form JS and top-of-form notifications

That shipped boundary is historically correct and must not be rewritten.

However, the biggest post-`R1` product gaps are now clear:

- the current designer host is still a bridge-quality authoring shell
- the current process runtime is still a bridge-quality process presentation rather than a true DBM-owned process component

Those gaps need their own release before the portal/pilot-ready release continues.

## Decision

- Insert a new `R2` between shipped `R1` and the former portal/pilot-ready release.
- Keep `R1` historically unchanged as the completed builder-platform MVP baseline.
- Re-slot the later releases as follows:
  - old `R2` becomes new `R3`
  - old `R3` becomes new `R4`
  - old `R4` becomes new `R5`
- New `R2` is the designer and process-experience productization release.
- `v1.0.0` remains attached to the pilot-ready end-to-end platform and therefore moves with old `R2` to new `R3`.

## Locked product and architecture decisions

- Replace the current Angular-based `dbm-app` direction with a long-term React + TypeScript designer shell.
- Keep `dbm-designer-core` as the durable host-agnostic editing seam.
- Treat the current Angular shell as a temporary bridge rather than the future product foundation.
- Keep model-driven and XrmToolBox as thin host adapters that both load the same browser bundle.
- Add `DbmDesignerWorkspaceV1` as a non-authoritative sidecar for graph layout, viewport, preview, and other UI-only authoring state.
- Add `DbmDesignerGraphDocumentV1` as the DBM-owned derived graph/interchange contract consumed by designer libraries.
- Add `DbmProcessExperienceSnapshotV1` as the shared derived UI contract consumed by all process renderers.
- Keep `DbmModelV1` authoritative and do not repurpose it to carry authoring-layout state or renderer-owned state.
- Do not let any chosen designer-library graph document become authoritative or required for save/load.
- Build one shared DBM-owned process-experience renderer that serves model-driven and future portal surfaces without forking the business-process visualization logic.
- Keep forms mapping-first in `R2`; do not reopen `R1` into full generated main-form ownership.
- Ship a supported model-driven baseline using a generated DBM Process host section at the top of the first business tab.
- Allow a preferred unsupported above-tabs overlay bridge when needed to satisfy the required UX, but keep it renderer-only and fully fallback-safe.
- Keep native Dataverse BPF as optional downstream inspiration or integration only, never as the source of truth or runtime boundary.

## Consequences

- The roadmap, capability map, release mapping, and post-`R1` references must all move to the new five-release ladder.
- `R2` becomes the release that productizes the designer and process experience before the live portal runtime lands.
- `R3` inherits the old portal/pilot-ready scope and explicitly depends on the shared renderer and snapshot contract introduced in `R2`.
- Live end-to-end operational hardening stays with the pilot-ready release, not with the new `R2`.
- AI work moves to `R4`, after the richer designer and process-experience surfaces exist.
- Enterprise simulation, governance, reuse, and optimization move to `R5`.

## Alternatives considered

- Continue directly from `R1` into the former portal/pilot-ready `R2`
  - rejected because it would harden bridge-quality designer and process-runtime seams before the product surfaces are ready
- Treat the current Angular shell as the permanent designer foundation
  - rejected because framework inertia is less important than authoring quality, supportability, and long-term maintainability
- Delay the process-experience redesign until the portal release
  - rejected because model-driven and portal continuity both depend on the same renderer and UX contract

## Related docs

- [Product Principles](../architecture/product-principles.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Canonical Model And Runtime Contract v1](../architecture/canonical-model-runtime-contract-v1.md)
- [Release Plan](../roadmap/release-plan.md)
- [Release 2: Designer And Process Experience Platform](../roadmap/release-2-designer-and-process-experience-platform.md)
- [ADR-0002: Designer-First And Portable Host Strategy](0002-designer-first-and-host-strategy.md)
- [ADR-0003: Shared Runtime Contract And Mandatory Model-Driven Runtime](0003-runtime-and-pcf-strategy.md)
- [ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts](0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
