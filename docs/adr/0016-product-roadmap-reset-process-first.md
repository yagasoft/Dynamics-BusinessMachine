# ADR-0016: Product roadmap reset and process-first plan

- Status: Accepted
- Date: 2026-05-01
- Decision owners: Ahmed Elsawalhy, Yagasoft
- Supersedes: active-roadmap authority in ADR-0011 and ADR-0015, while preserving their historical evidence value

## Context

DBM needs to return to the original product vision before moving further: a designer that lets a user define a complete business cycle from portal to back office and back to portal again.

The existing implementation contains useful work, including the designer core, graph/workspace contracts, process renderer, Dataverse synthesis, JavaScript VM, CKEditor/CodeMirror editors, and Jint evaluator. However, the product has not been released, no customer work is built on it, and the current implementation does not yet represent the desired DBM product shape.

The old `R1` through `R3.1` roadmap therefore cannot remain the active release ladder. It is now prototype/reference material.

## Decision

- Reset the product roadmap to a new product R1.
- Keep `R0` as the engineering foundation and governance baseline.
- Treat the current implementation and old closeout evidence as prototype/reference evidence, not a shipped product baseline.
- Use a process-first reset as the organising roadmap strategy.
- Make the new `R1` about process/stage designer capability and actual model-driven form rendering.
- Make the new `R2` about JavaScript-first DBMScript and action foundation.
- Make the new `R3` about back-office runtime before portal runtime.
- Defer actual portal runtime and return path to `R5`.
- Defer AI until `R9`, after the basic product is stable and useful without AI.

## Locked product terms

- `form` or `rendered form`: the final rendering of the process or sub-process for the business user, not the designer.
- `user`: the designing or customising user.
- `business user`: the actual user of the rendered form.
- `portal user`: the external portal user.

## Locked model direction

The product model becomes a process portfolio:

- `mainProcessId` identifies the root process.
- `processes[]` contains the root process and reusable child process definitions.
- The root process is always visible on the rendered form and portal projection.
- Child processes render under the parent stage that owns them.
- `subProcessVisibility` controls whether a child process is visible for a given audience and condition.
- `childProcessRefs[]` is first-class and declares stage-owned child process links, including whether the parent stage waits for child completion.
- Runtime spawning, parent locking, child completion, return-state handling, and process-instance persistence belong to `R3`.
- Stage feature hooks include entry/exit conditions, branching, notifications, routing, SLA/KPI, tasks, validations, actions, status, and portal status.
- Notifications are table row templates plus send actions, not a hard-coded notification subsystem.
- DBMScript/action vNext is JavaScript first.

## Consequences

- The release plan, capability map, target architecture, product principles, current-state baseline, and README roadmap references must be rewritten around the new `R1` to `R9` ladder.
- Old release files are retained as superseded historical pointers only.
- Existing tests and docs that protect completed prototype work may remain, but their wording must not imply that old releases are the active product plan.
- Future implementation slices must start from the new roadmap and use TDD.
- After a successful verified TDD round, the branch lifecycle follows the DBM policy for automatic merge, push, branch purge, worktree removal, and stale metadata prune unless a policy blocker applies.

## Related docs

- [Release Plan](../roadmap/release-plan.md)
- [Capability Map](../roadmap/capability-map.md)
- [Product Principles](../architecture/product-principles.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Current-State Baseline](../architecture/current-state-baseline.md)
