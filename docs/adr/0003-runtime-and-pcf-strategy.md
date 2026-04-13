# ADR-0003: Shared Runtime Contract And Mandatory Model-Driven Runtime

- Status: Accepted
- Date: 2026-04-12
- Updated: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The current PoC shows a resource-centric editor and form integration pattern, but the future product requires a true DBM-owned process runtime on model-driven forms and consistent execution contracts across model-driven UI, portal projection, Dataverse, and Azure.

## Decision

- DBM will define one shared runtime contract across model-driven runtime, Dataverse, portal projection, and Azure-backed execution.
- Release 1 must ship a real DBM-owned runtime on model-driven forms.
- Release 1 must not rely on a temporary web-resource fallback for the in-form process experience.
- PCF remains the preferred supported implementation path for the model-driven runtime where it can satisfy the product requirement, but PCF is not the business-process definition itself.
- Portal-visible state projection belongs in the shared runtime contract, even though the live Power Pages runtime is delivered in `R2`.
- The first production-worthy runtime proof is a real approval/request scenario.

## Consequences

- The canonical model must be rich enough to feed model-driven runtime, Dataverse execution, and portal projection from the same source of truth.
- Runtime parity becomes an explicit engineering concern from Release 1 onward.
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
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
- [ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts](0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
