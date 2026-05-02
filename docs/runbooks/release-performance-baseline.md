# Release Performance Baseline

Historical/prototype reference: this runbook records the old builder-platform release baseline. It is not active roadmap authority after [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md); use [the current release plan](../roadmap/release-plan.md) for the process-first `R1` to `R9` roadmap.

## Purpose

Record a compact wall-clock baseline for the old release-shaped engineering path captured as prototype/reference evidence.

For the old `R1`, this is not a load test, concurrency test, or portal benchmark. It is a timed record of the core build, synthesis, package, deploy, and smoke path for the historical builder-platform prototype line.

## Script

Use:

```powershell
.\eng\scripts\Test-ReleasePerformanceBaseline.ps1
```

Default behavior:

- reads the current version from `eng/version.json`
- records evidence under `artifacts/performance/r1/<solution-version>/<timestamp>/`
- validates repo health and docs
- runs Node build and DBM Dataverse synthesis validation
- packages the core and generated-metadata Dataverse solutions
- deploys the packaged artifacts to `Dev`
- runs the Dataverse smoke suite after deployment

## Inputs

- `-TargetEnvironment`
  - defaults to `Dev`
- `-DataverseUrl`
  - optional override; otherwise the script reads the tracked environment config
- `-AssemblyKeyFile`
  - optional explicit strong-name key path for the packaged core solution
- `-SkipDeployment`
  - use only when you need a packaging-only baseline without the live Dataverse proof

## Outputs

The script writes:

- `performance-baseline.json`
  - machine-readable timing and status record
- `performance-baseline.md`
  - compact human-readable summary

Expected output root:

```text
artifacts/performance/r1/<solution-version>/<timestamp>/
```

## R1 Scope

Included in the `R1` baseline:

- repo validation
- DBM synthesis build and validation
- Dataverse packaging
- `Dev` deployment
- Dataverse smoke and generated-metadata drift validation

Intentionally excluded from the `R1` baseline:

- portal runtime
- AI-assisted authoring
- rapid inner-loop deploy timing
- throughput or concurrency/load testing

## Usage Notes

- Treat this baseline as release evidence, not as a local optimization benchmark.
- Run it from a clean or intentionally staged worktree so the evidence matches the candidate state.
- Keep the Dataverse URL and strong-name signing input aligned with the formal packaging path.
