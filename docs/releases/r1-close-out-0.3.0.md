# R1 Close-Out: 0.3.0

## Status

- Release line: `0.3.0`
- Close-out date: `2026-04-13`
- Validated branch: `codex/r1.3-runtime-mvp`
- Status: accepted as the completed `R1` builder-platform MVP baseline

## Summary

`R1` closed with the canonical DBM process model, aligned executable contract, portable host strategy, Dataverse synthesis foundation, existing-form behavior synthesis, and the first DBM-owned model-driven runtime for one approval/request scenario.

The shipped working-product posture for `R1` is:

- one approval/request process defined in the canonical DBM model
- Dataverse schema synthesized through the layered `DynamicsBusinessMachineGeneratedMetadata` solution
- existing Dataverse forms patched with DBM-managed supported JS behavior
- authoritative DBM runtime state persisted on the request record in Dataverse
- model-driven runtime experience rendered through supported form JS and top-of-form DBM process messaging
- the validated approval/request model editable from the model-driven host and the XrmToolBox host

## Release evidence

- Dev release-shaped baseline
  - `artifacts/releases/r1/0.3.0.0/dev-performance/performance-baseline.md`
  - `artifacts/releases/r1/0.3.0.0/dev-performance/performance-baseline.json`
- UAT promotion proof
  - `artifacts/releases/r1/0.3.0.0/uat-deployment/deployment-summary.json`
  - `artifacts/releases/r1/0.3.0.0/uat-smoke/smoke-test-summary.md`
  - `artifacts/releases/r1/0.3.0.0/uat-smoke/generated-metadata/drift-report.json`
- Aggregated release-shaping decisions
  - [R1 Decisions Log](../runbooks/r1-decisions-log.md)

## Environment proof

- `Dev`
  - timed release baseline passed for repo validation, build and synthesis, full Dataverse packaging, packaged Dev deployment, and smoke validation
  - core and generated-metadata solutions validated at `0.3.0.0`
  - generated-metadata drift validation passed
- `UAT`
  - managed import of `DynamicsBusinessMachine` succeeded at `0.3.0.0`
  - managed import of `DynamicsBusinessMachineGeneratedMetadata` succeeded at `0.3.0.0`
  - generated-metadata drift validation passed
  - hosted designer prerequisites passed in `UAT`

## R1 Outcomes By Stage

- `R1.1`
  - canonical contract authority and runtime model were locked in docs and ADRs
- `R1.2.1`
  - executable contract aligned to stage + step + form-state semantics
- `R1.2.2`
  - advanced designer foundation landed with a host-agnostic core boundary
- `R1.2.3a`
  - Dataverse synthesis foundation proved tables, columns, relationships, readback, drift, and layered solution packaging
- `R1.2.3b`
  - canonical forms were bound to existing Dataverse forms and DBM-managed supported JS behavior
- `R1.2.4`
  - model-driven and XrmToolBox hosts were aligned around the shared browser-designer bundle
- `R1.3`
  - Dataverse-backed model-driven runtime v1 landed with persisted runtime state, transition evaluation, review-record creation, and runtime-behavior proof through generated tests plus deployed smoke validation
- `R1.4`
  - packaged reference solution, UAT promotion proof, release documentation, and performance baseline evidence were completed

## Acceptance Summary

The `R1` exit criteria in [Release 1: Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md) are satisfied:

- one approval/request flow can be authored in the designer
- the same model can be edited from both supported hosts
- existing Dataverse forms can be bound to DBM-managed behavior
- the approval/request scenario runs through the DBM-owned model-driven runtime
- portal-visible state projection is defined in the canonical model
- the release is packaged, deployable, and proven in `Dev` and `UAT`

## Deferred Beyond R1

- generated model-driven main forms from the canonical model
- generated quick-view forms for related bindings
- designer-driven table and column authoring
- full-form XML ownership by DBM
- whole-form drift enforcement against live Dataverse
- editable multi-table composition on model-driven forms
- live portal runtime and end-to-end portal loop in the then-planned `R2`, now `R3` after the post-`R1` roadmap reset
- AI-assisted authoring and optimization in the then-planned `R3`, now `R4`

## Remaining Risks And Follow-Ups

- Azure Key Vault seeding for the new official `app-signing-key` remains an external operational follow-up; local packaging and the GitHub fallback secret path are already working.
- `dbm-app` still carries the tracked npm audit exception scope and Angular/CommonJS warning set documented in release governance; this remains a hardening item entering the new `R2` designer/process-experience release.
- `R1` closes on the Dataverse-backed model-driven runtime v1 boundary; broader browser-driven runtime automation can be added later without reopening the release definition.
