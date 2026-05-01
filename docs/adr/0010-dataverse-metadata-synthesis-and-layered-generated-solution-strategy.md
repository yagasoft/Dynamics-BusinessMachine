# ADR-0010: Dataverse Metadata Synthesis And Layered Generated Solution Strategy

- Status: Accepted
- Date: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

Release `R1.2.3` needs DBM to move beyond a web-resource-only packaging baseline and start generating Dataverse business metadata from the canonical DBM model. The platform now needs one consistent strategy that supports:

- fast authoring proof in `Dev`
- durable tracked artifacts for CI/CD and promotion
- generated tables, columns, relationships, and later existing-form behavior bindings
- drift/readback validation between live Dataverse metadata and tracked emitted artifacts

DBM already has a formal PAC-based delivery spine for the current core solution, but that spine is still centered on the recovered PoC package under `power-platform/solutions/DynamicsBusinessMachine/baseline/`.

## Decision

- The canonical DBM model remains the product source of truth for Dataverse metadata authoring.
- DBM introduces a dedicated synthesis layer, implemented in `dbm-dataverse-synthesis/`, that maps the canonical model into:
  - direct Dataverse metadata operations for `Dev`
  - tracked generated solution source
  - readback and drift reports
- The generated Dataverse metadata is emitted into a separate layered solution named `DynamicsBusinessMachineGeneratedMetadata`.
- Import order is fixed:
  1. `DynamicsBusinessMachine`
  2. `DynamicsBusinessMachineGeneratedMetadata`
- `Dev` may use direct metadata apply and readback as an authoring proof path through `Invoke-DataverseSynthesis.ps1`.
- `UAT` and `Prod` remain packaged-import-only environments. Direct Dataverse metadata mutation is not a release mechanism there.
- `R1.2.3a` is script-driven. The designer owns the canonical model and synthesis-planning boundary, but it does not yet own an in-host "apply to Dev" UX.
- `R1.2.3b` resets the form strategy to existing Dataverse forms plus supported JS behavior. The synthesis layer maps canonical forms to existing Dataverse forms, patches only DBM-managed fragments, and emits the behavior web resources required to drive tabs, sections, and field behavior. Generated main forms, generated quick-view forms, and designer-driven table or column authoring are deferred to post-R1.

## Consequences

- DBM gains a durable way to generate business metadata without making raw Dataverse XML the primary design surface.
- The current core solution baseline can remain stable while generated business metadata matures in a separate layer.
- `Dev` can prove generated metadata quickly through direct apply and readback, while higher environments remain governed by immutable packaged artifacts.
- Smoke and promotion validation can now check both:
  - layered solution presence
  - generated metadata drift against the canonical model
  - DBM-managed fragments on existing Dataverse forms

## Alternatives considered

- Write metadata only through direct Dataverse APIs in every environment
  - rejected because it weakens promotion governance and loses durable release artifacts
- Hand-author solution XML as the primary DBM source
  - rejected because XML is an emitted artifact family, not the product authoring surface
- Merge generated metadata directly into the current `DynamicsBusinessMachine` baseline
  - rejected because it couples the recovered PoC solution metadata to a still-maturing generated authoring path

## Related docs

- [ADR-0006: Dataverse ALM Source And Packaging Model](0006-dataverse-alm-source-and-packaging-model.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release 1: Process/stage designer and actual form render](../roadmap/release-1-process-stage-designer-and-form-render.md)
- [Power Platform README](../../power-platform/README.md)
