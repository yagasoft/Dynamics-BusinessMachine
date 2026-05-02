# Architecture example models

The active `R1.2` contract proof is the generic process fixture matrix under `dbm-contract/fixtures/valid/generic-process-matrix/`.

The matrix proves that `DbmModelV1` accepts user-defined process types, actor roles, stage kinds, work kinds, statuses, outcomes, sub-processes, visibility rules, whole-stage spans, fractional spans, and portal projection contracts without making a single domain example authoritative.

- `linear-service-fulfilment.model.json`: simple portal-to-back-office-to-portal flow.
- `employee-onboarding.model.json`: parallel HR, IT, and facilities sub-processes spanning one main timeline.
- `case-investigation.model.json`: back-office-only process with internal visibility and branching.
- `document-lifecycle.model.json`: draft, check, revise, publish, and previous-stage/rework hooks.
- `field-inspection.model.json`: scheduling, visit, evidence capture, closure, fractional spans, and portal-safe projection.

`approval-request-v1.model.json is historical/prototype reference`. Keep it only for old closeout evidence and migration comparison. It is no longer the active roadmap authority or the active contract proof.

`generic-existing-form-v1.model.json` is also prototype/reference material from the earlier existing-form line of work. Future implementation slices should use the generic matrix or a new slice-specific fixture instead of treating that file as the product shape.
