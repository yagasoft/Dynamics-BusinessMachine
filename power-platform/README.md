# Power Platform Delivery Baseline

This directory is the tracked source of truth for DBM Dataverse delivery assets.

## Structure

- `manifests/`
  - build-time component manifests used to assemble solution source from repo outputs
- `solutions/DynamicsBusinessMachine/baseline/`
  - tracked solution metadata anchored to the reviewed `0.1.1.1` PoC package
- `assets/legacy/`
  - durable legacy assets that are still required for packaging but are not yet regenerated from source

## Rules

- Do not commit secrets, auth profiles, or environment-specific settings here.
- Treat `baseline/` as authoritative metadata until a later release intentionally restructures the solution.
- Package artifacts are generated under `artifacts/` and never committed.
