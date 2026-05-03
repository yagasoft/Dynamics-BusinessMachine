# Roadmap progress tracker

This tracker is the human-readable status view for the process-first DBM roadmap. It summarises progress only; [release-plan.md](release-plan.md) remains the release ladder source of truth and [capability-map.md](capability-map.md) remains the capability placement source of truth.

## Current snapshot

- Snapshot date: 2026-05-03.
- Baseline branch: `main`.
- Baseline commit: `76e05da docs: add designer session awareness roadmap`.
- Product baseline: `R1` is proved with the processPortfolio-native hierarchy designer and rendered model-driven form experience.
- Current active release: `R2` DBMScript and action foundation.
- Current active slice: `R2.1 DBMScript contract and collaborative authoring foundation`.
- R2 implementation status: Active planning; R2.1 implementation proof has started with contract/schema/fixture and synthesis-plan proof. Later R2.x and R3+ implementation has not started.

## Status meanings

| Status | Meaning |
| --- | --- |
| Maintained | Foundation capability exists and remains under governance; keep it green while other releases move. |
| Proved | The release has enough documented and tested proof to be treated as the current product baseline for that slice. |
| Active planning | The next release or slice is being shaped in durable docs and may carry an early slice proof; it is not a release closeout claim. |
| Planned | The release has a defined roadmap position, but no current implementation claim. |
| Historical/reference | Old roadmap or prototype work retained as evidence only; it is not the active product roadmap. |

## Release progress

| Release | Name | Status | Progress summary | Evidence |
| --- | --- | --- | --- | --- |
| `R0` | Engineering foundation and governance | Maintained | Branch, docs, release governance, and validation rules are in force. | [Release plan](release-plan.md), [Release governance](../releases/release-governance.md) |
| `R1` | Process/stage designer and actual form render | Proved | R1 proves the process portfolio hierarchy and rendered model-driven form direction. | [R1 plan](release-1-process-stage-designer-and-form-render.md), [Capability map](capability-map.md) |
| `R2` | DBMScript and action foundation | Active planning | R2 is the active roadmap focus. R2.1 implementation proof has started with contract/schema/fixture and synthesis-plan proof; later R2.x and R3+ implementation has not started. | [R2 plan](release-2-dbmscript-and-action-foundation.md), [ADR-0017](../adr/0017-collaborative-authoring-and-code-apps-designer.md) |
| `R3` | Back-office runtime | Planned | Runtime consumes published snapshots and definitions only after R2 foundations are ready. | [R3 plan](release-3-back-office-runtime.md) |
| `R4` | Back-office operations | Planned | Routing, SLA, notifications, validations, and operational configs become first-class authoring rows. | [R4 plan](release-4-back-office-operations.md) |
| `R5` | Portal runtime and return path | Planned | Actual portal runtime starts after back-office runtime is stable. | [R5 plan](release-5-portal-runtime-and-return-path.md) |
| `R6` | Reuse, templates, artefacts, and documents | Planned | Reuse and generated artefacts deepen the product after runtime basics. | [R6 plan](release-6-reuse-templates-artefacts-and-documents.md) |
| `R7` | Platform tooling and ALM | Planned | ALM/source sync exports compiled snapshots and optional source-normalised artefacts with conflict reporting. | [R7 plan](release-7-platform-tooling-and-alm.md) |
| `R8` | Enterprise maturity | Planned | Simulation, replay, governance, drift control, observability, and optimisation follow core runtime. | [R8 plan](release-8-enterprise-maturity.md) |
| `R9` | AI-assisted platform | Planned | AI starts only after the basic product is stable without AI. | [R9 plan](release-9-ai-assisted-platform.md) |

## Current active release

`R2` is the active release. The current implementation slice is `R2.1 DBMScript contract and collaborative authoring foundation`.

R2.1 expands DBMScript contract/storage into collaborative authoring primitives: authoring unit ids, private drafts, published versions, rowversion/ETag expectations, lockable unit metadata, and the compiled snapshot boundary. See the [R2 plan](release-2-dbmscript-and-action-foundation.md) and [ADR-0017](../adr/0017-collaborative-authoring-and-code-apps-designer.md).

R2.1 implementation proof has started with contract/schema/fixture and synthesis-plan proof. This does not start the later Code Apps host proof, JavaScript VM execution, trigger execution, templates/notifications, DBM Object processing execution, or R3 runtime process execution.

## Evidence links

- [Release plan](release-plan.md)
- [Capability map](capability-map.md)
- [R2 DBMScript and action foundation plan](release-2-dbmscript-and-action-foundation.md)
- [ADR-0016 product roadmap reset](../adr/0016-product-roadmap-reset-process-first.md)
- [ADR-0017 collaborative authoring and Code Apps designer](../adr/0017-collaborative-authoring-and-code-apps-designer.md)
- [Completed roadmap TDD matrix](completed-roadmap-tdd-matrix.md)

## Historical/prototype baseline

Old `R1` to `R3.1` work is `Historical/reference`. It remains useful as prototype evidence and test retrofit material, but it is not the active product roadmap after [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md).

Use [completed-roadmap-tdd-matrix.md](completed-roadmap-tdd-matrix.md) for the completed prototype/reference baseline and deterministic retrofit gates.
