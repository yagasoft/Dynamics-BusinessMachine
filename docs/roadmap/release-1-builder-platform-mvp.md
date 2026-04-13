# Release 1: Builder Platform MVP

## Goal

Give architects and developers a real designer-first platform that can define and run one approval/request process through a model-driven experience, a portable XrmToolBox designer host, a shared runtime, and a real PCF form runtime.

## Feature set and deliverables

- canonical DBM process model v1
- designer core extracted from host-specific UI
- model-driven designer host
- XrmToolBox designer host
- first real PCF process runtime on forms
- backend execution engine v1
- one approval/request reference solution
- Azure support services only where they clearly add value

## Stages

### R1.1 Canonical model and runtime contract

Output:
- approved v1 platform specification that both hosts and runtimes implement
- docs-first contract baseline tracked in [Canonical Model And Runtime Contract v1](../architecture/canonical-model-runtime-contract-v1.md)
- authority and future executable format locked in [ADR-0008: Canonical Contract Authority And Format](../adr/0008-canonical-contract-authority-and-format.md)
- future executable authority will be TypeScript source plus JSON Schema validation

Must define:
- process model
- form model
- metadata model
- rule model
- execution contract across PCF, Dataverse, and Azure
- packaging contract for deployment

### R1.2 Designer core and host adapters

Output:
- one model edited consistently from both model-driven and XrmToolBox hosts

Must include:
- host-agnostic designer core
- model-driven host shell
- XrmToolBox host shell
- shared validation and serialization behavior

### R1.3 Execution engine and PCF runtime

Output:
- testable end-to-end flow inside Dataverse

Must include:
- shared runtime contract implementation
- backend execution engine v1
- real PCF-based in-form runtime
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
- the flow runs through the backend runtime and renders on forms through PCF
- the release is deployable through the formal pipeline
