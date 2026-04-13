# Dynamics Business Machine Codex Directives

These instructions are durable workspace rules for Codex and similar AI helpers working in this repository.

## Package upgrade policy

- If a change touches a legacy package-managed project, upgrade that project's packages to the latest available versions as part of the same change.
- Do whatever migration work is necessary so the touched legacy project works correctly on the upgraded versions.
- New package-managed projects must start on the latest available package versions.
- After a new package-managed project is established, do not upgrade it again without explicit user confirmation.

## Branch and commit policy

- Each meaningful bulk of change must be done on its own feature branch.
- A feature branch must not span more than one release slice such as `Rx.x`.
- Do not commit directly on `main`.
- Commit as often as meaningful while keeping each commit coherent.

