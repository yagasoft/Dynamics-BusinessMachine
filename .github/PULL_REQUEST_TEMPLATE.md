## Scope

- What does this change do?
- Which release/stage or roadmap item does it affect?

## Risk

- What could break?
- What is the rollback or mitigation path?

## Validation

- Failing-test evidence:
  - What test or executable check failed before the implementation?
  - What failure message proved the intended missing or broken behaviour?
- What did you run locally or in CI?
- What evidence should reviewers look for?
- Which completed-roadmap matrix row does this protect or improve?
- Does the change avoid future roadmap scope?
- Sequential completed-roadmap validation:
  - If this touches completed-roadmap validation, did you run `eng/scripts/Test-CompletedRoadmapValidation.ps1` or explain why a narrower gate was enough?
  - If the full wrapper was run, what is the completed-roadmap validation manifest path?
  - Did the clean-worktree guard finish without new tracked diffs or untracked non-ignored files?
- Protected-branch bypass:
  - Was any direct push, emergency admin action, or branch-protection bypass used?
  - If yes, what review, workflow, sequential local validation, and completed-roadmap validation manifest evidence covers that bypass?

## Docs Impact

- Which tracked docs changed?
- If none, why are docs not affected?

## ADR Impact

- Does this change align with an existing ADR?
- If it changes a durable decision, which ADR was added or updated?

## Rollout Impact

- Which environments are affected?
- Are GitHub Environment, Key Vault, or deployment follow-ups required?
