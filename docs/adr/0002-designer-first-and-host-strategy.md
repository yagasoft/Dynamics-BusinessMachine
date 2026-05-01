# ADR-0002: Designer-First And Portable Host Strategy

- Status: Accepted
- Date: 2026-04-12
- Updated: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

DBM is intended to be a designer-led platform, not a collection of disconnected scripts and configuration surfaces. The designer must also remain portable so the product is not trapped inside a single shell. The desired product quality is an elegant, sophisticated designer experience, which means host framework choice must stay subordinate to supportability and UX quality.

## Decision

- DBM follows a designer-first product strategy.
- The designer core must be host-agnostic.
- The first host to prove the product remains the model-driven experience.
- XrmToolBox remains the first portable host delivered in `R1`, but it no longer blocks the first model-driven proof.
- Future browser- or Azure-hosted management surfaces are explicitly supported by the architecture.
- The host shell is replaceable. The canonical model and designer core are the enduring seams.
- UI framework choice is subordinate to keeping a supported, reputable, high-quality designer experience.

## Consequences

- Shared model, validation, synthesis, and serialization logic become mandatory.
- Host-specific UI concerns must stay behind adapters.
- The product avoids locking value into Dataverse-only hosting assumptions or into one front-end framework choice.

## Alternatives considered

- Build the model-driven experience only and defer portability indefinitely
  - rejected because it would harden the wrong architectural boundaries
- Build an external host first
  - rejected because the first proof scenario is centered on model-driven delivery
- Treat the current Angular shell as a permanent architectural decision
  - rejected because it would put framework inertia ahead of product quality and portability

## Related docs

- [Product Principles](../architecture/product-principles.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release 1: Process/stage designer and actual form render](../roadmap/release-1-process-stage-designer-and-form-render.md)
- [ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts](0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
