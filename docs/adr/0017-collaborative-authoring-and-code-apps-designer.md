# ADR-0017: Collaborative authoring and Code Apps designer direction

- Status: Accepted
- Date: 2026-05-03
- Decision owners: Ahmed Elsawalhy, Yagasoft
- Extends: [ADR-0016](0016-product-roadmap-reset-process-first.md)

## Context

The reset roadmap now needs to support multi-user DBM authoring. A single monolithic process JSON row is not a good collaborative authoring source because long, non-mergeable edits would collide late and lose user trust. DBM still needs a portable JSON contract for publishing, export/import, runtime loading, validation, and ALM, but that JSON must be a compiled snapshot rather than the editable working row.

Current Microsoft platform guidance supports this direction:

- [Dataverse Web API conditional operations](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/perform-conditional-operations-using-web-api) provide `@odata.etag`, `If-Match`, `If-None-Match`, and optimistic concurrency support. A mismatched version returns `412 Precondition Failed`, so ETags are a good final consistency guard but not a complete authoring UX for long edits.
- [Power Apps Code Apps](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) can host React or other code-first apps in Power Platform, [connect to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse), and use managed platform governance. Code Apps still have constraints that matter to DBM, including environment enablement, Power Apps Premium licensing, [ALM/source-integration limits](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/alm), [CSP planning for iframe embedding](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/embed-iframe), and the [rule that sensitive data must live in data sources rather than hosted app code](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration).

## Decision

DBM will use Dataverse-normalised authoring rows as the collaborative authoring source for editable process artefacts. Process JSON remains a compiled published/export/import/runtime snapshot.

Authoring rows include, at minimum:

- process
- stage
- child process link
- DBMScript
- DBM Object
- action
- notification template
- routing policy
- SLA policy
- validation rule
- stage-local configuration

DBM authoring must create a private Dataverse-backed draft as soon as editing starts and autosave user work into that draft. Non-mergeable or high-risk surfaces must acquire a granular edit lease before meaningful edits begin, either explicitly through an acquire-lock command or automatically on first edit. Optimistic concurrency and ETags remain mandatory final consistency guards, but they must not be the primary conflict UX for long edits.

The lock model is Dataverse-native:

- `dbm_editlock` records target type/id, owner, owner display, expiry, heartbeat timestamp, reason, status, acquired source, and force-release audit fields.
- Custom APIs or plugins enforce acquire, renew, release, force-release, stale-lock cleanup, autosave draft, publish draft, and reject-save rules.
- Whole-process locks are reserved for publish, destructive structural edits, root process changes, migrations, and bulk reorder.
- No Azure service is introduced for lock authority.

Designer presence is also Dataverse-native, but separate from edit ownership:

- `dbm_designersession` records one active designer session per open tab or host instance, including session id, process id, owner, owner display, current component target type/id, opened timestamp, heartbeat timestamp, expiry, status, and host/source.
- The designer shows process-level active sessions and component-level current focus for stage, child process link, DBMScript, DBM Object, action, notification template, routing policy, SLA policy, validation rule, and stage-local configuration surfaces.
- Repeated display names are expected when the same user has multiple active designer sessions.
- The current user's own sessions are visible by default, with the current tab labelled distinctly.
- Designer sessions provide awareness only. They never grant or deny edits; `dbm_editlock` remains the edit-authority contract.

Power Apps Code Apps become the preferred R2+ rich designer host after a proof slice confirms Dataverse access, lock/draft API usage, embedding/navigation, CSP/admin requirements, solution ALM, environment support, and source-sync limitations. The rendered form process surface stays PCF/model-driven unless a later concrete blocker proves Code Apps is better for that business-user form surface.

## Consequences

- `R2.1` expands from DBMScript storage into collaborative authoring primitives: authoring unit IDs, draft/published versions, rowversion/ETag expectations, lockable metadata, and compiled snapshot boundaries.
- R2 editor slices must show designer-session awareness, then respect lock ownership before saving scripts, actions, templates, DBM Objects, and stage-local configs.
- R3 runtime consumes published snapshots/definitions only and never executes drafts, locks, or half-edited configs.
- R4 routing, SLA, notifications, validations, and operations become first-class authoring rows with their own lock/draft/version lifecycle.
- R7 source sync exports/imports compiled published snapshots and may also export/import source-normalised artefacts with conflict reporting.
- Existing JSON-based model contracts remain important, but they no longer imply that one JSON row is the collaborative authoring source.

## Related docs

- [Release plan](../roadmap/release-plan.md)
- [Release 2: DBMScript and action foundation](../roadmap/release-2-dbmscript-and-action-foundation.md)
- [Release 3: Back-office runtime](../roadmap/release-3-back-office-runtime.md)
- [Release 4: Back-office operations](../roadmap/release-4-back-office-operations.md)
- [Release 7: Platform tooling and ALM](../roadmap/release-7-platform-tooling-and-alm.md)
- [Target platform architecture](../architecture/target-platform-architecture.md)
- [Canonical model and runtime contract v1](../architecture/canonical-model-runtime-contract-v1.md)
