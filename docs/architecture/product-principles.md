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

## Product and UX principles

- Designer-first above all.
  - DBM should let architects and developers define the solution from within the designer with minimal dependence on scattered tools or hidden configuration.
- Build the platform for serious end-to-end business automation.
  - The target is not a script editor; it is a coherent system for defining process, forms, metadata, logic, deployment, and operational flow.
- Keep the designer portable.
  - The core designer must not be trapped inside one host shell.
- Require a real in-form runtime.
  - Release 1 must ship a real PCF-based form runtime, not a temporary web-resource fallback.

## Security and operational principles

- Secrets never enter Git.
  - Use GitHub Environments and Azure Key Vault only.
- CI/CD is part of the product, not an afterthought.
  - GitHub pipelines must cover code, Dataverse artifacts, Azure artifacts, documentation, and promotion flows.
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
- Power Pages is the first portal/front-door target.
- AI arrives after the core platform is stable enough to support it well.
- `v1.0.0` means pilot-ready end-to-end delivery, not full product maturity.
