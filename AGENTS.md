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

## Thread branch continuity policy

- For any active line of work, there must be exactly one canonical continuation branch unless the user explicitly chooses a different strategy.
- If a thread begins on a non-`main` branch, related follow-up threads for the same release slice must continue on that same branch by default.
- Do not create a new sibling branch for related work unless the user explicitly asks for it, or there is a clear integration reason and the landing branch is stated up front.
- If a thread creates a new branch and commits meaningful work there, do not resume related work on the old branch unless the new branch has first been merged or cherry-picked back, or the user explicitly chooses the old branch as canonical.
- If multiple candidate branches exist for the same line of work, stop and ask the user which branch is the canonical continuation branch before making further changes.
- When ending a thread that changed branch context, explicitly state the canonical continuation branch in the final response.

## TDD branch lifecycle policy

When a task is completed through a successful TDD cycle, treat passing verification as permission to complete the local Git workflow automatically for the AI-created task branch or worktree.

Successful verified TDD closeout requires automatic merge, push, branch purge, worktree removal, and stale metadata prune without asking again when the target branch is known and the checks below pass.

Before removing an AI-created task worktree, write durable closeout evidence outside that worktree so the validation manifest, branch lifecycle result, and cleanup record survive worktree deletion.

After tests pass:

- confirm the changed files are only within the intended task scope
- confirm there are no unrelated user changes mixed into the task branch
- commit the completed work with a clear message
- switch back to the stable base branch, usually `main` or `master`
- merge the task branch
- push the updated base branch
- delete the completed task branch locally
- delete the completed task branch remotely if it was pushed
- remove the bound worktree once it is no longer needed
- prune stale worktree metadata if required
- leave durable closeout evidence in the stable ignored evidence root

This behaviour applies only to the current task branch or worktree created for the AI's work.

Do not auto-merge or clean up if:

- tests fail
- verification was skipped
- there are unrelated user changes
- the branch contains work outside the requested scope
- merge conflicts occur
- the user explicitly says not to deploy, push, merge, or clean up
- the target branch is not clearly known

A successful TDD round means complete the branch lifecycle, not merely report readiness, unless the user gives a narrower instruction. Never overwrite, revert, reset, or delete user changes. Automatic cleanup only applies to AI-created task branches and their matching worktrees after successful verification.
