# ADR-0003: Shared Runtime Contract And Mandatory PCF Form Runtime

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The current PoC shows a resource-centric editor and form integration pattern, but the future product requires a true process runtime on model-driven forms and consistent execution contracts across client, Dataverse, and Azure.

## Decision

- DBM will define one shared runtime contract across PCF, Dataverse, and Azure-backed execution.
- Release 1 must ship a real PCF-based runtime on model-driven forms.
- Release 1 must not rely on a temporary web-resource fallback for the in-form process experience.
- The first production-worthy runtime proof is a real approval/request scenario.

## Consequences

- The canonical model must be rich enough to feed multiple runtimes.
- Runtime parity becomes an explicit engineering concern from Release 1 onward.
- Existing PoC form integration patterns may be reused selectively, but they cannot define the long-term runtime architecture.

## Alternatives considered

- Continue using only embedded web-resource form experiences
  - rejected because it preserves a PoC limitation as a product boundary
- Build separate runtime contracts per host
  - rejected because it breaks portability and increases long-term maintenance cost

## Related docs

- [Current-State Baseline](../architecture/current-state-baseline.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
