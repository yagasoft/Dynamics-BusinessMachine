# ADR-0012: Generic Existing-Form Authoring Required For R2 Closeout

- Status: Accepted
- Date: 2026-04-14
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

`R2.1` through `R2.4` establish the long-term designer shell, DBM-owned graph contract, shared process renderer, supported model-driven host, preferred overlay bridge, synthesis emission, and release hardening.

Those slices are necessary but not sufficient to close `R2`.

If `R2` closed only on the approval/request reference scenario, DBM would still carry a major product risk:

- the platform might still be shaped around one reference solution rather than a genuinely generic existing-form authoring path
- cross-entity handoff and custom existing-form binding could become much harder to generalize later
- `R3` portal work would start before the model-driven foundation is proven on a non-reference process

## Decision

- Add `R2.5` as the final `R2` close-out slice before `R3`.
- Do not treat `R2` as complete until DBM proves a non-reference custom process on existing Dataverse forms in `Dev`.
- Generalize `DbmProcessV1.scenarioType` from an approval/request-only literal to a descriptive classification string.
- Add canonical `subjectHandoff` semantics for cross-entity stage and step transitions.
- Treat cross-entity handoff strategy selection as mandatory authoring data, not an implicit runtime heuristic.
- Make blank-starter existing-form authoring first-class in the hosted designer, including live Dataverse metadata import and stage form binding.
- Keep the existing-form ownership boundary intact. `R2.5` proves generic authoring on existing forms; it does not reopen full generated main-form ownership.
- Require a tracked non-reference fixture model plus a `Dev` proof runbook and smoke path as release evidence.

## Consequences

- `R2` close-out evidence must no longer depend only on the approval/request reference sample.
- The hosted designer and Dataverse synthesis path must support arbitrary existing Dataverse forms and explicit cross-entity handoffs within the canonical model boundary.
- `R3` remains blocked until `R2.5` is complete, because portal/runtime work should build on a generic model-driven authoring and hosting foundation rather than a special-case sample.
- The approval/request sample remains valuable as a reference solution, but not as the sole proof of platform generality.

## Alternatives considered

- Close `R2` after `R2.4` and defer generic existing-form authoring proof to `R3`
  - rejected because it would push core genericity risk into the portal release
- Treat the approval/request sample as sufficient evidence of genericity
  - rejected because it would not prove custom existing-form binding, explicit cross-entity handoff authoring, or non-reference runtime progression
- Reopen `R2` into full generated main-form ownership
  - rejected because the existing-form boundary remains intentional and valuable

## Related docs

- [Release Plan](../roadmap/release-plan.md)
- [Release 2: Designer And Process Experience Platform](../roadmap/release-2-designer-and-process-experience-platform.md)
- [R2 Generic Existing-Form Dev Proof](../runbooks/r2-generic-existing-form-dev-proof.md)
- [Designer Hosted Validation](../runbooks/designer-hosted-validation.md)
- [ADR-0011: Post-R1 Roadmap Reset And Designer/Process Experience Platform](0011-post-r1-roadmap-reset-and-designer-process-experience-platform.md)
