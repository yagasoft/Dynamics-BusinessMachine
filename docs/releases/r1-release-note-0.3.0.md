# R1 Release Note: 0.3.0

## Release

- Version: `0.3.0`
- Release name: `R1 Builder Platform MVP`
- Date: `2026-04-13`
- Status: accepted

## Summary

Release `0.3.0` completes `R1` for DBM. It delivers a designer-first approval/request builder MVP with a canonical process model, Dataverse synthesis foundation, portable hosts, existing Dataverse forms plus DBM-managed supported JS behavior, and the first DBM-owned model-driven runtime.

## Scope

- canonical DBM model and aligned executable contract
- portable designer foundation across model-driven and XrmToolBox hosts
- Dataverse schema synthesis for tables, columns, relationships, readback, and drift
- existing Dataverse forms patched with DBM-managed supported behavior
- Dataverse-backed model-driven runtime v1 for one approval/request scenario
- packaged reference solution and UAT promotion proof

## Included changes

- aligned the executable contract to stage + step + form-state semantics
- completed the host-agnostic designer core and host adapters
- delivered the layered `DynamicsBusinessMachineGeneratedMetadata` solution
- proved direct `Dev` synthesis apply plus packaged promotion flow
- completed the existing-form reset for `R1` instead of generating new Dataverse forms
- added runtime state persistence, transition evaluation, and review-record creation for the approval/request scenario
- hardened the signed core packaging path around the new official plugin identity
- added timed release-baseline evidence for the full Dev release path

## Deployment notes

- environment path:
  - packaged import to `Dev` and managed promotion to `UAT`
- required prerequisites:
  - approved strong-name key available through `DBM_ASSEMBLY_KEY_FILE`, Azure Key Vault, or the GitHub fallback secret
  - working PAC auth profiles or GitHub federated auth for the target environment
- known manual steps:
  - Azure Key Vault seeding for the new `app-signing-key` still needs to be completed from an authorized session

## Validation evidence

- closeout:
  - [R1 Close-Out: 0.3.0](r1-close-out-0.3.0.md)
- Dev baseline:
  - `artifacts/releases/r1/0.3.0.0/dev-performance/performance-baseline.md`
- UAT promotion:
  - `artifacts/releases/r1/0.3.0.0/uat-deployment/deployment-summary.json`
  - `artifacts/releases/r1/0.3.0.0/uat-smoke/smoke-test-summary.md`

## Rollback reference

- runbook:
  - [rollback-runbook.md](../runbooks/rollback-runbook.md)
- rollback trigger points:
  - failed managed import in `UAT`
  - blocking post-deploy smoke failure
  - unexpected generated-metadata drift after promotion

## Known issues and risks

- Azure Key Vault seeding for the new official signing key is not complete yet.
- npm audit exception scope and Angular/CommonJS warnings remain a tracked hardening item for the next release.
- generated main forms, quick-view forms, and designer-driven schema authoring remain intentionally deferred beyond `R1`.

## Credits

Ahmed Elsawalhy / Yagasoft
