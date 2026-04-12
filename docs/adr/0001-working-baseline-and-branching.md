# ADR-0001: Working Baseline And Branching Model

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

DBM has multiple branches and a paused PoC history. The revival needs one clear integration baseline and a controlled branching approach that supports experimentation, testing, and low-cost rollback.

## Decision

- `main` is the integration baseline for the revival.
- `feature/script-lib/main` is reference-only and may be mined selectively for ideas.
- Day-to-day work uses short-lived feature branches from `main`.
- Release branches are used to stabilize planned release increments.
- Hotfix branches are used for urgent fixes against the appropriate release or production baseline.
- Semantic versioning is used for formal releases.

## Consequences

- The current public PoC footprint remains the authoritative engineering baseline.
- Experimental ideas can still be explored safely without destabilizing the mainline.
- Release evidence, QA, and rollback become easier to manage.

## Alternatives considered

- Continue from `feature/script-lib/main`
  - rejected because it does not represent the richer public PoC surface we are reviving
- Work directly on long-lived feature branches
  - rejected because it increases integration risk and rollback cost

## Related docs

- [Current-State Baseline](../architecture/current-state-baseline.md)
- [Release Governance](../releases/release-governance.md)
