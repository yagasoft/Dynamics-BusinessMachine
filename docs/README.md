# DBM documentation

This `docs/` tree is the tracked source of truth for the reset Dynamics Business Machine (DBM) product by Ahmed Elsawalhy and Yagasoft.

Use this area for durable product documentation:

- architecture baselines and target design
- ADRs for locked technical and delivery decisions
- roadmap and release planning
- release governance and release notes
- operational runbooks

Do not use this area for temporary execution notes, scratch work, or private planning drafts. Those stay in the local-only `_codex/dbm-revival/` workspace.

## Structure

- `architecture/`
  - product principles, current-state baseline, target-platform architecture, and canonical contract direction
- `adr/`
  - architecture decision records
- `roadmap/`
  - active release ladder, capability map, and per-release stage plans
- `releases/`
  - release governance, release notes, and historical close-out records
- `runbooks/`
  - deployment, rollback, bootstrap, and identity runbooks

## Reading order

1. [Product principles](architecture/product-principles.md)
2. [Current-state baseline](architecture/current-state-baseline.md)
3. [Target platform architecture](architecture/target-platform-architecture.md)
4. [Canonical model and runtime contract v1](architecture/canonical-model-runtime-contract-v1.md)
5. [ADR index](adr/README.md)
6. [Product roadmap reset ADR](adr/0016-product-roadmap-reset-process-first.md)
7. [Release plan](roadmap/release-plan.md)
8. [Capability map](roadmap/capability-map.md)
9. [Roadmap progress tracker](roadmap/progress-tracker.md)
10. [Release 1 process/stage designer and actual form render](roadmap/release-1-process-stage-designer-and-form-render.md)
11. [Release 2 DBMScript and action foundation](roadmap/release-2-dbmscript-and-action-foundation.md)
12. [Release governance](releases/release-governance.md)
13. [Runbook index](runbooks/README.md)

## Working rules

- If a decision is still being explored, keep it out of `docs/` until it is intentionally promoted.
- If a decision is locked, capture it in an ADR and update the relevant architecture or roadmap doc.
- If a release or stage changes, update `roadmap/` and then align release governance or runbooks as needed.
- If a process becomes operationally necessary, document it in `runbooks/` before relying on it.
