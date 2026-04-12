# DBM Documentation

This `docs/` tree is the tracked source of truth for the revived Dynamics Business Machine (DBM) product by Ahmed Elsawalhy and Yagasoft.

Use this area for durable product documentation:

- architecture baselines and target design
- ADRs for locked technical and delivery decisions
- roadmap and release planning
- release governance and release notes
- operational runbooks

Do not use this area for temporary execution notes, scratch work, or private planning drafts. Those stay in the local-only `_codex/dbm-revival/` workspace.

## Structure

- `architecture/`
  - product principles, current-state baseline, and target-platform architecture
- `adr/`
  - architecture decision records
- `roadmap/`
  - high-level release ladder and per-release stage plans
- `releases/`
  - release governance, quality gates, and release-note template
- `runbooks/`
  - deployment, rollback, bootstrap, and identity runbooks

## Reading order

1. [Architecture Principles](architecture/product-principles.md)
2. [Current-State Baseline](architecture/current-state-baseline.md)
3. [Target Platform Architecture](architecture/target-platform-architecture.md)
4. [ADR Index](adr/README.md)
5. [Release Plan](roadmap/release-plan.md)
6. [Release Governance](releases/release-governance.md)
7. [Runbook Index](runbooks/README.md)

## Working rules

- If a decision is still being explored, keep it out of `docs/` until we intentionally promote it.
- If a decision is locked, capture it in an ADR and update the relevant architecture or roadmap doc.
- If a release or stage changes, update `roadmap/` and then align release governance or runbooks as needed.
- If a process becomes operationally necessary, document it in `runbooks/` before we rely on it.
