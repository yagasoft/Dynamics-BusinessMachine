# ADR-0006: Dataverse ALM Source And Packaging Model

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The recovered PoC uses `dvdt.linker.xml` and local tooling to push web resources into Dataverse. That path is useful for emergency recovery and exploration, but it is not a formal CI/CD mechanism. Release 0.3 needs a tracked, repeatable packaging model that can build the current product surface from Git and produce immutable Dataverse promotion artifacts.

## Decision

- `dvdt.linker.xml` remains local-only and is no longer the release mechanism.
- The tracked Dataverse baseline is stored under `power-platform/solutions/DynamicsBusinessMachine/baseline/`.
- Generated business metadata is emitted into a separate layered solution, `DynamicsBusinessMachineGeneratedMetadata`, rather than being hand-authored directly into the recovered core baseline.
- Built web resources and plugin assemblies are mapped into the solution package using `power-platform/manifests/webresources.yml`.
- Packaging assembles a temporary solution source tree from:
  - tracked baseline metadata
  - built JS and TypeScript outputs
  - tracked legacy static assets
  - the built plugin assembly
- Release `R1.2.3` adds a synthesis-driven generated-metadata source tree from the canonical DBM model.
- `pac solution pack` produces both unmanaged and managed ZIP artifacts.
- `pac solution create-settings` produces the deployment settings template.
- Release-candidate packaging runs solution check before formal promotion.
- `Dev` may use direct Dataverse metadata apply for authoring proof, but formal package promotion still imports the layered solution set.
- `Dev` receives unmanaged imports only. `UAT` and `Prod` receive managed imports only.

## Consequences

- Dataverse ALM becomes reproducible from Git and CI.
- The current shipped PoC solution metadata remains preserved instead of being re-created from guesswork.
- Business metadata generation can evolve independently of the recovered PoC baseline while still remaining pipeline-driven.
- Local ad hoc uploads remain possible for recovery, but they are explicitly outside the formal release path.

## Alternatives considered

- Keep `dvdt.linker.xml` as the formal delivery mechanism
  - rejected because it depends on machine-local tooling and does not produce immutable release artifacts
- Wait for a future full `.cdsproj` or PAC-first source conversion before formalizing packaging
  - rejected because Release 0 needs a deployable baseline now, not after a second migration

## Related docs

- [ADR-0010: Dataverse Metadata Synthesis And Layered Generated Solution Strategy](0010-dataverse-metadata-synthesis-and-layered-generated-solution-strategy.md)
- [Current-State Baseline](../architecture/current-state-baseline.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release Governance](../releases/release-governance.md)
- [Power Platform README](../../power-platform/README.md)
