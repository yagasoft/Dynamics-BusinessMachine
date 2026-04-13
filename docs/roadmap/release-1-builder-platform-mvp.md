# Release 1: Builder Platform MVP

## Goal

Give architects and developers a real designer-first platform that can define and run one approval/request process through a DBM-owned model-driven experience, a shared runtime, supported Dataverse form behavior, and portal-compatible state projection.

## Feature set and deliverables

- canonical DBM process model v1
- stage + step + form-state semantics
- reusable condition component
- designer core extracted from host-specific UI
- advanced model-driven designer host
- existing Dataverse forms plus supported JS behavior
- XrmToolBox designer host
- first real DBM-owned model-driven process runtime
- backend execution engine v1
- one approval/request reference solution
- Azure support services only where they clearly add value

## Stages

### R1.1 Canonical model and runtime contract

Output:
- approved v1 platform specification that both hosts and runtimes implement
- docs-first contract baseline tracked in [Canonical Model And Runtime Contract v1](../architecture/canonical-model-runtime-contract-v1.md)
- authority and future executable format locked in [ADR-0008: Canonical Contract Authority And Format](../adr/0008-canonical-contract-authority-and-format.md)
- DBM-owned process UI, portal projection, and generated Dataverse authoring locked in [ADR-0009](../adr/0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)

Must define:
- process model
- form model
- metadata model
- rule and condition model
- execution contract across model-driven runtime, Dataverse, portal projection, and Azure
- packaging contract for deployment

### R1.2.1 Process semantics and contract alignment

Output:
- executable contract aligned to the approved process architecture

Must include:
- stage + step + form-state model
- portal-visible versus internal state projection semantics
- reusable condition component for branching, visibility, ownership, and runtime guards
- alignment of TypeScript types, JSON Schema, fixtures, and reference example with the approved contract

### R1.2.2 Advanced designer UX foundation

Output:
- designer UX baseline aligned to the richer process model

Must include:
- advanced process authoring UX for stages, steps, branching, and form states
- explicit framework and library decision gate for the long-term designer UX
- preservation of a host-agnostic designer core boundary

### R1.2.3a Dataverse synthesis foundation

Output:
- first script-driven synthesis path from the canonical model into Dataverse business metadata

Must include:
- generated or updated Dataverse tables, columns, and relationships
- direct `Dev` metadata apply and readback for authoring proof
- tracked emitted source for `DynamicsBusinessMachineGeneratedMetadata`
- drift detection between emitted artifacts and live Dataverse
- packaged import order that preserves `DynamicsBusinessMachine` as the core solution and layers generated metadata after it

### R1.2.3b Existing forms and behavior synthesis

Output:
- existing Dataverse forms bound to DBM-managed supported JS behavior through the synthesis layer

Must include:
- canonical forms mapped to existing Dataverse forms through provider bindings
- DBM-managed JS behavior for tabs, sections, and fields on those existing forms
- readback and diff support for the DBM-managed form fragments and behavior web resources
- packaged import of the patched form artifacts and behavior web resources through the layered generated-metadata solution

Deferred to post-R1:
- generated model-driven main forms from the canonical model
- generated quick-view forms for related bindings
- designer-driven table and column authoring
- full-form XML ownership by DBM
- whole-form drift enforcement against live Dataverse

### R1.2.4 Host adapters and portability completion

Output:
- one model edited consistently from both model-driven and XrmToolBox hosts

Must include:
- model-driven host completion
- XrmToolBox host completion
- shared validation, serialization, and synthesis planning behavior

### R1.3 Execution engine and model-driven runtime

Output:
- testable end-to-end flow inside Dataverse with the first DBM-owned process runtime

Must include:
- shared runtime contract implementation
- backend execution engine v1
- efficient condition evaluation
- top-of-form model-driven process experience
- approval/request scenario execution path

### R1.4 Reference solution and release hardening

Output:
- builder-facing MVP release installable in `Dev` and promotable to `UAT`

Must include:
- packaged approval/request reference solution
- CI/CD promotion path
- performance baselines
- release documentation

## Exit criteria

- one approval/request flow can be fully authored in the designer
- the same model can be edited from both supported hosts
- existing Dataverse forms for the scenario can be bound to DBM-managed behavior and the scenario can run through the backend runtime and render through the DBM-owned model-driven process experience
- columns remain solution-owned and do not require designer-driven authoring in this release
- portal-visible state projection is defined in the model even though the live portal runtime lands in `R2`
- the release is deployable through the formal pipeline
