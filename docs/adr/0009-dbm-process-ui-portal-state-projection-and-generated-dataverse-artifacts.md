# ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts

- Status: Accepted
- Date: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The revived DBM direction needs a business process that stays coherent from portal to backend to portal. The existing roadmap and contract baseline were still framed around a simpler stage-only process and a model-driven-first runtime without explicit portal state projection, step-level semantics, or generated Dataverse authoring as a first-class product boundary.

The product now needs to lock:

- DBM-owned process UI instead of native Dataverse business process flow as the product boundary
- portal-visible versus internal process state
- stage + step + form-state semantics
- supported Dataverse synthesis boundaries, including schema artifacts and DBM-managed behavior on existing forms
- top-of-form model-driven process placement as the target experience

## Decision

- DBM owns the business-process experience. Native Dataverse business process flow is not the source of truth.
- Portal-visible state is a projection of canonical DBM process state, not a separate process model.
- Internal stages and steps may be hidden from portal users.
- The canonical process model expands from stage-only flow into stage + step + form-state semantics.
- Forms are model-driven forms, not custom form components.
- Same-table variants should reuse the underlying model-driven form and apply generated stateful behavior rather than creating unnecessary full duplicate forms.
- The synthesis layer owns supported Dataverse schema artifacts in `Dev` and patches DBM-managed fragments onto existing Dataverse forms.
- Tracked release artifacts remain the release source of truth even when the designer engine can apply changes directly in `Dev`.
- Initial Dataverse synthesis scope is:
  - tables, columns, and relationships
  - model-driven form patching for DBM-managed libraries, handlers, and behavior assets
- Grids and richer native Dataverse components remain planned but are deferred from the first proof scope.
- The preferred model-driven process experience is rendered at the top of the form, above tabs.
- If no supported platform placement can satisfy the required early proof, a simplified unsupported placement method may be used temporarily with explicit documentation and later replacement.

## Consequences

- `R1.2.1` must align the executable canonical contract, schema, fixtures, and example model to the expanded process semantics.
- `R1.2.3a` must own generated Dataverse tables, columns, relationships, and synthesis layering.
- `R1.2.3b` must own binding canonical forms to existing Dataverse forms and attaching DBM-managed supported JS behavior.
- `R1.3` must deliver the first DBM-owned model-driven runtime experience rather than delegating the business-process experience to native BPF.
- `R2` delivers the live Power Pages runtime on top of the portal projection semantics defined in `R1`.

## Alternatives considered

- Keep native Dataverse business process flow as the source of truth
  - rejected because it would constrain process semantics, visibility control, and portal continuity to the limits of the native platform feature
- Treat portal status as a separate process definition
  - rejected because it would create duplicate logic and drift risk
- Keep all Dataverse schema and behavior hand-authored outside DBM synthesis
  - rejected because it would weaken the designer-first product boundary and make the model incomplete

## Related docs

- [Product Principles](../architecture/product-principles.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Canonical Model And Runtime Contract v1](../architecture/canonical-model-runtime-contract-v1.md)
- [Release Plan](../roadmap/release-plan.md)
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
- [Release 2: Pilot-Ready End-To-End Platform](../roadmap/release-2-pilot-ready-v1.md)
