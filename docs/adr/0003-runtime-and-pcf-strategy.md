# ADR-0003: Shared Runtime Contract And Mandatory Model-Driven Runtime

- Status: Accepted
- Date: 2026-04-12
- Updated: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The current PoC shows a resource-centric editor and form integration pattern, but the future product requires a true DBM-owned process runtime on model-driven forms and consistent execution contracts across model-driven UI, portal projection, external runtime, Dataverse, and Azure.

Reset note: [ADR-0016](0016-product-roadmap-reset-process-first.md) keeps the DBM-owned process experience principle, but re-plans delivery. The new `R1` proves actual model-driven form rendering, while back-office runtime execution starts in the new `R3`.

## Decision

- DBM will define one shared runtime contract across model-driven runtime, Dataverse, portal projection, and Azure-backed execution.
- The reset roadmap must ship actual model-driven form rendering in `R1` and DBM-owned back-office runtime execution in `R3`.
- The product must not rely on a temporary web-resource fallback as the long-term in-form process experience.
- PCF remains the preferred supported implementation path for the model-driven runtime where it can satisfy the product requirement, but PCF is not the business-process definition itself.
- Portal-visible state projection belongs in the shared runtime contract, with actual portal runtime now planned for `R5` under ADR-0016.
- The first production-worthy runtime proof is a real approval/request scenario.

## Consequences

- The canonical model must be rich enough to feed model-driven runtime, Dataverse execution, and portal projection from the same source of truth.
- Runtime parity becomes an explicit engineering concern once runtime execution starts in the reset roadmap.
- Existing PoC form integration patterns may be reused selectively, but they cannot define the long-term runtime architecture.
- Native Dataverse business process flow remains optional integration only and cannot become the runtime boundary.

## Alternatives considered

- Continue using only embedded web-resource form experiences
  - rejected because it preserves a PoC limitation as a product boundary
- Build separate runtime contracts per host
  - rejected because it breaks portability and increases long-term maintenance cost
- Treat native Dataverse business process flow as the runtime definition
  - rejected because it cannot express the full DBM process semantics, visibility rules, and portal projection requirements

## Related docs

- [Current-State Baseline](../architecture/current-state-baseline.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release 1: Process/stage designer and actual form render](../roadmap/release-1-process-stage-designer-and-form-render.md)
- [Release 3: Back-office runtime](../roadmap/release-3-back-office-runtime.md)
- [ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts](0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
