# DBM product principles

These principles are standing constraints for the process-first DBM reset.

## Engineering principles

- Proper software engineering first.
- Prefer explicit contracts, testability, observability, and controlled change.
- Use TDD for implementation slices.
- Preview before mutate.
- Reuse prototype/reference code only when it fits the current roadmap.
- Avoid technical debt by default when the direction is clear.

## Product and UX principles

- Process-first reset.
- The designer is the primary authoring surface.
- The rendered form is the business-user surface and is not the designer.
- Power Apps Code Apps are the preferred R2+ rich designer host only after a proof slice confirms DBM's governance, embedding, Dataverse, and ALM needs.
- Keep the rendered form process surface PCF/model-driven unless a later concrete blocker proves Code Apps is better for that business-user form surface.
- The product is about parent processes, child processes, and stages.
- The root process is always visible on the rendered form and portal projection.
- Child processes sit under the stage that owns them and may be conditional.
- Stage-owned child process links are first-class and can block the parent stage until child completion.
- DBM owns the rendered process experience.
- Native Dataverse BPF may be generated later only as optional downstream integration.
- Portal is contract-only in `R1`; actual portal runtime starts in `R5`.
- AI is deferred until the basic product is stable without AI.

## Security and operational principles

- Secrets never enter Git.
- Dataverse is the near-term default for runtime authority, operational configuration, and platform-owned secrets.
- Dataverse-normalised authoring rows are the source for collaborative editing; process JSON is a compiled published/export/import/runtime snapshot.
- Show designer-session presence separately from edit authority so users can see who has a process or component open without treating viewers as lock owners.
- Acquire the granular edit lease before meaningful edits begin for non-mergeable or high-risk authoring units.
- Autosave user work into private Dataverse-backed drafts so failed publish, expired locks, browser close, or ETag conflicts do not lose work.
- Use optimistic concurrency and ETags as final consistency guards, not as the primary long-edit conflict UX.
- Reserve whole-process locks for publish, destructive structural edits, root process changes, migrations, and bulk reorder.
- No release bypasses `Dev` and `UAT`.
- CI/CD is part of the product.
- Operational support is a first-class capability.
- Performance is a first-class requirement.
- Cost discipline matters, but not at the expense of required features, robustness, performance, or security.

## Delivery and collaboration principles

- Do not assume when the answer can be validated.
- State assumptions clearly.
- Document durable product knowledge in `docs/`.
- Keep temporary execution detail in `_codex/`.
- Work from `main` through short-lived branches unless the release policy says otherwise.
- After a successful verified TDD round, follow the DBM branch lifecycle policy for merge, push, branch purge, worktree removal, and stale metadata prune.

## Locked reset defaults

- `main` is the integration baseline.
- `R0` remains the engineering and governance foundation.
- Product delivery restarts at new `R1`.
- Current implementation is prototype/reference material.
- New `R1` proves process/stage designer capability and actual model-driven form render.
- New `R2` proves DBMScript and JavaScript-first actions.
- New `R3` proves back-office runtime before portal runtime.
- New `R5` proves actual portal runtime and return path.
- New `R9` is the first AI-assisted release.
