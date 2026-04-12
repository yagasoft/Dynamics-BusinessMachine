# ADR-0005: Versioning And Release-Branch Policy

- Status: Accepted
- Date: 2026-04-12
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

The revived repo inherited a legacy PoC numbering history, multiple branch conventions, and no single release-number source. Release 0.2 needs one branch policy and one versioning policy that drive Git tags, Dataverse solution versions, and .NET assembly metadata without engineers making local interpretation calls.

## Decision

- `main` remains the protected integration branch.
- Day-to-day implementation uses short-lived `feature/*`, `fix/*`, `docs/*`, `chore/*`, and `codex/*` branches from `main`.
- `release/<semver>` branches are cut only from green `main`.
- `hotfix/<semver>-<slug>` branches are cut only from the latest production tag and must merge back to `main` and any open `release/*` branch that still needs the fix.
- Formal release numbering resets to SemVer beginning with `v0.2.0`.
- `eng/version.json` is the only manually edited version source.
- Dataverse solution version, .NET assembly version, file version, and informational version are stamped from `eng/version.json` during build and packaging.
- npm package versions are not the canonical release number.

## Consequences

- Every durable artifact has a predictable version mapping.
- Release branch creation and hotfix creation are constrained enough to support safe promotion and rollback.
- Legacy PoC versions remain historical evidence only and do not define the revived product line.

## Alternatives considered

- Continue the historical `0.1.1.1-alpha` style numbering
  - rejected because it is PoC-specific and does not fit a clean SemVer release train
- Allow each project to own its own visible version
  - rejected because DBM is shipped as one coordinated Dataverse and Azure product surface

## Related docs

- [Release Governance](../releases/release-governance.md)
- [Release 0 Engineering Foundation](../roadmap/release-0-engineering-foundation.md)
