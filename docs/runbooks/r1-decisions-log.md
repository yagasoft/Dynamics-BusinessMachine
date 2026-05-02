# R1 Decisions Log

Historical/prototype reference: this runbook records the old `R1` prototype/reference line. It is not active roadmap authority after [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md); use [the current release plan](../roadmap/release-plan.md) for the process-first `R1` to `R9` roadmap.

This document collects the major product and implementation decisions made during R1 so they can be reviewed together at the end of the release.

## Current Direction

- `R1.2.3a` proved the Dataverse metadata synthesis path in `Dev` for tables, columns, relationships, readback, drift, and layered solution packaging.
- The plugin identity was reset to a new official signing key, and the packaged core solution path was hardened around explicit signing input.
- `R1.2.3b` was reset away from generated Dataverse forms and toward existing Dataverse forms plus supported JS behavior.

## Decisions Made

### Dataverse synthesis scope

- Keep `DynamicsBusinessMachineGeneratedMetadata` as the layered generated-metadata solution.
- Keep direct `Dev` metadata apply and readback for synthesis proof.
- Keep `UAT` and `Prod` packaged-import-only.
- Keep generated metadata and tracked solution source as the durable release path.

### Form strategy

- Map canonical forms to existing Dataverse forms instead of generating new main forms in this release.
- Attach DBM-managed supported JS behavior to those existing forms for tabs, sections, and fields.
- Treat form XML as a patched artifact family, not as a full DBM-authored design surface.
- Keep baseline Dataverse forms solution-defined and let DBM own only the managed fragments it patches onto them.
- Defer generated main forms, generated quick-view forms, designer-driven table and column authoring, full-form XML ownership, and whole-form drift enforcement to post-R1.
- Simplify the R1 `assigned-approver` example field to a string-backed Dataverse field instead of a live lookup so the working product stays concrete without taking on premature lookup-composition complexity.

### Metadata authoring boundaries

- Keep tables, columns, and relationships in the synthesis foundation.
- Keep columns solution-owned instead of designer-authored for this release.
- Keep the canonical model authoritative for behavior planning and form bindings.

### Runtime posture

- Treat `R1.3` as a Dataverse-backed, model-driven runtime v1 rather than a larger server-first orchestration layer.
- Persist the authoritative DBM process state on the request record through the synthetic Dataverse runtime fields introduced by the synthesis layer.
- Render the in-form DBM process experience through supported form JS, top-of-form notifications, and form-state-driven control behavior on existing Dataverse forms.
- Use generated runtime-behavior tests plus deployed `Dev` and `UAT` smoke validation as the formal R1 runtime proof boundary.
- Defer broader browser automation and richer runtime hosting concerns until after the MVP is stable.

### Host portability

- Complete `R1.2.4` by reusing the same browser editor bundle across hosts instead of building a second bespoke XrmToolBox UI.
- Treat the XrmToolBox plugin as a thin WebView2 shell with a Dataverse-backed model-document bridge.
- Keep host-specific logic limited to document CRUD and minimal environment shims; keep validation, serialization, and editor behavior shared in the browser bundle.

### Operational notes

- The new official signing key is the authoritative packaging identity.
- Azure Key Vault seeding for the new signing key remains an external operational follow-up.
- The repo docs should continue to describe the current working-product direction rather than the earlier generated-form spike.

## Review Checklist For End Of R1

- Confirm the roadmap matches the existing-form plus supported-JS reset.
- Confirm the ADR describes the same post-R1 deferrals.
- Confirm no doc still promises generated Dataverse forms or designer-driven column authoring as part of R1.
- Confirm the decisions log remains the single place to review the release-shaping calls made on the user's behalf.

## R1 Closeout

- Release line: `0.3.0`
- Validated environments:
  - `Dev` through the timed release baseline in `artifacts/releases/r1/0.3.0.0/dev-performance/performance-baseline.md`
  - `UAT` through `artifacts/releases/r1/0.3.0.0/uat-deployment/deployment-summary.json` and `artifacts/releases/r1/0.3.0.0/uat-smoke/smoke-test-summary.md`
- Formal release record:
  - [R1 Close-Out: 0.3.0](../releases/r1-close-out-0.3.0.md)
- Formal release note:
  - [R1 Release Note: 0.3.0](../releases/r1-release-note-0.3.0.md)

Deferred beyond `R1`:

- generated model-driven main forms from the canonical model
- generated quick-view forms for related bindings
- designer-driven table and column authoring
- full-form XML ownership by DBM
- whole-form drift enforcement against live Dataverse
- editable multi-table composition on model-driven forms
- live external runtime and full portal loop in the then-planned `R2`, now `R3` after the post-`R1` roadmap reset; the first accepted `R3.1` proof path is the local SPA direction recorded in ADR-0014
- AI-assisted authoring and optimization in the then-planned `R3`, now `R4`
