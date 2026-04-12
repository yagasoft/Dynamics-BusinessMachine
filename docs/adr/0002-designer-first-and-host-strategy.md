# ADR-0002: Designer-First And Portable Host Strategy

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

DBM is intended to be a designer-led platform, not a collection of disconnected scripts and configuration surfaces. The designer must also remain portable so the product is not trapped inside a single shell.

## Decision

- DBM follows a designer-first product strategy.
- The designer core must be host-agnostic.
- The first host to prove the product remains the model-driven experience.
- The first portable host delivered alongside the builder platform MVP is XrmToolBox.
- Future browser- or Azure-hosted management surfaces are explicitly supported by the architecture.

## Consequences

- Shared model and validation logic become mandatory.
- Host-specific UI concerns must be isolated behind adapters.
- We avoid locking product value into Dataverse-only hosting assumptions.

## Alternatives considered

- Build the model-driven experience only and defer portability indefinitely
  - rejected because it would harden the wrong architectural boundaries
- Build an external host first
  - rejected because the first proof scenario is centered on model-driven delivery

## Related docs

- [Product Principles](../architecture/product-principles.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
