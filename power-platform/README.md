# Power Platform Delivery Baseline

This directory is the tracked source of truth for DBM Dataverse delivery assets.

## Structure

- `manifests/`
  - build-time component manifests used to assemble solution source from repo outputs
- `solutions/DynamicsBusinessMachine/baseline/`
  - tracked solution metadata anchored to the reviewed `0.1.1.1` PoC package
- `solutions/DynamicsBusinessMachineGeneratedMetadata/template/`
  - minimal tracked template metadata for the layered generated-metadata solution
- `solutions/DynamicsBusinessMachineGeneratedMetadata/source/`
  - generated tracked source emitted from the canonical DBM model
- `assets/legacy/`
  - durable legacy assets that are still required for packaging but are not yet regenerated from source

## Rules

- Do not commit secrets, auth profiles, or environment-specific settings here.
- Treat `DynamicsBusinessMachine/baseline/` as the authoritative core-solution baseline until a later release intentionally restructures it.
- Treat `DynamicsBusinessMachineGeneratedMetadata/source/` as generated tracked output owned by the synthesis pipeline, not hand-authored source.
- Package artifacts are generated under `artifacts/` and never committed.
