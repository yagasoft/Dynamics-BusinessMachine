# DBM Product Principles

These principles are standing constraints for the revival and future evolution of DBM. They should be applied at every release, every stage, and every implementation decision.

## Engineering principles

- Proper software engineering first.
  - Favor maintainable design, explicit contracts, testability, observability, and controlled change over quick wins.
- Think like an architect when designing and like an engineer when building.
  - Architecture must be intentional; implementation must be practical, disciplined, and high quality.
- Optimize for readable, high-performance code.
  - Prefer simple, explicit, well-named code paths over cleverness.
- Avoid technical debt by default.
  - Do the right thing the first time when the cost is reasonable and the direction is clear.
- Test, validate, and verify continuously.
  - Every major stage must leave us with something valuable and testable.
- Preview before mutate.
  - Generated changes, runtime actions, and synthesis outputs should be inspectable before they become authoritative.

## Product and UX principles

- Designer-first above all.
  - DBM should let architects and developers define the solution from within the designer with minimal dependence on scattered tools or hidden configuration.
- Build the platform for serious end-to-end business automation.
  - The target is not a script editor; it is a coherent system for defining process, forms, metadata, logic, deployment, and operational flow.
- Keep one coherent process experience across every surface.
  - The business process must remain understandable from portal to backend to portal, even when some internal stages or steps are intentionally hidden from portal users.
- Own the process UI.
  - DBM owns the business-process experience and status projection. Native Dataverse business process flow can be generated later as an optional integration aid, but it is not the product boundary or source of truth.
- Keep the designer portable.
  - The core designer must not be trapped inside one host shell.
  - Persisted business-process definitions must remain DBM-owned and library-neutral so a future designer-library swap is a mapping exercise, not a product migration.
- Prefer proven libraries and frameworks over loyalty to the current stack.
  - The designer should be elegant, advanced, and sophisticated. Framework choice is secondary to supportability, product quality, and long-term maintainability.
- Make behavior explainable.
  - Architects, admins, and support staff should be able to understand why a branch, status, assignment, visibility rule, or synthesis result resolved the way it did.
- Build reusable platform assets.
  - Prefer reusable conditions, templates, policy packs, and subflows over one-off scenario logic.
- Require a real in-form runtime.
  - Release 1 must ship a real DBM-owned in-form process runtime, not a temporary web-resource fallback.

## Security and operational principles

- Secrets never enter Git.
  - Use GitHub Environments and Azure Key Vault only.
- CI/CD is part of the product, not an afterthought.
  - GitHub pipelines must cover code, Dataverse artifacts, Azure artifacts, documentation, and promotion flows.
- Operational support is a first-class capability.
  - Work management, auditability, support surfaces, and observability are part of the platform, not afterthoughts in a reference solution.
- Performance is a first-class requirement.
  - Optimize for runtime speed, responsiveness, and scale from the beginning.
- Minimize cost without compromising core quality.
  - Cost discipline matters, but not at the expense of required features, robustness, performance, or security.

## Delivery and collaboration principles

- Do not assume when the answer can be validated.
  - Research, inspect, or ask before locking a design or implementation path.
- State assumptions clearly.
  - Every important design or delivery assumption must be visible and reviewable.
- Document everything that matters.
  - Durable product knowledge belongs in `docs/`; local execution detail belongs in `_codex/`.
- Ask for direction when ambiguity becomes material.
  - Escalate early when choices carry meaningful product, operational, or architectural consequences.
- Use proper git flow.
  - Work from `main` through short-lived branches, release branches, and hotfix branches to reduce rollback cost and preserve review quality.

## Branding principles

- Use Ahmed Elsawalhy and Yagasoft branding consistently where it adds product identity.
- Avoid visual noise and over-branding.
- Keep product naming, docs, release notes, and packaged assets aligned with the same brand language.

## Locked revival defaults

The following are currently locked unless replaced by a future ADR:

- `main` is the integration baseline.
- `feature/script-lib/main` is reference-only.
- Model-driven experience comes first.
- The first proof scenario is a real approval/request flow.
- Selective reuse beats blind preservation.
- The first portable designer host is XrmToolBox.
- Azure is used from the start where it adds clear value.
- The first `R3` external/front-door proof is a DBM-owned local SPA; later hosted front-door choices remain open to later release decisions.
- The first post-`R1` release productizes the designer and DBM-owned process experience before pilot-readiness work resumes.
- Portal projection semantics are defined in Release 1 before the live external runtime proof arrives in Release 3.
- AI arrives after the core platform is stable enough to support it well.
- `v1.0.0` means pilot-ready end-to-end delivery, not full product maturity.
