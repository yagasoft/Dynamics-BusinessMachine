# R2.1 contract proof implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the R2.1 DBMScript contract and collaborative authoring foundation proof without implementing later R2.x or R3+ runtime behaviour.

**Architecture:** Add explicit authoring contracts beside the existing process portfolio model: Dataverse-normalised authoring rows, private drafts, published versions, edit locks, designer sessions, DBMScript/DBM Object/action records, operation contract metadata, and a compiled process snapshot boundary. Extend Dataverse synthesis planning to include public authoring table and operation metadata only; no live Dataverse enforcement or runtime execution belongs in this slice.

**Tech Stack:** TypeScript contracts in `dbm-contract`, generated JSON Schema through `typescript-json-schema`, Node test runner, AJV validation, and TypeScript synthesis planning in `dbm-dataverse-synthesis`.

---

## Task 1: Contract RED tests

**Files:**
- Modify: `dbm-contract/test/contract-fixtures.test.cjs`

- [ ] **Step 1: Run baseline contract validation**

Run: `.\eng\scripts\Test-DbmContract.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'`

Expected: PASS before R2.1 tests are added.

- [ ] **Step 2: Add failing R2.1 tests**

Append tests that compile `dbm-authoring-contract-v1.schema.json` and `dbm-compiled-process-snapshot-v1.schema.json`, then assert valid R2.1 fixtures and reject authoring metadata leakage from compiled process snapshots. The test names must be:

```javascript
test('R2.1 authoring contract validates lockable units, drafts, sessions, and operations', () => {});
test('R2.1 edit locks are authority and designer sessions are awareness only', () => {});
test('R2.1 compiled process snapshot validates published references and rejects authoring leakage', () => {});
```

Assertions must cover all R2.1 lockable unit types, duplicate same-user designer sessions, active DBMScript lock denial for another user, unlocked stage edit access despite presence sessions, compiled snapshot published references, and rejection of `drafts`, `editLocks`, `designerSessions`, or `autosaveState` on compiled snapshots.

- [ ] **Step 3: Run RED**

Run: `Push-Location dbm-contract; npm test -- test/contract-fixtures.test.cjs; Pop-Location`

Expected: FAIL because the new schemas, fixtures, and `resolveAuthoringEditAuthorityV1` do not exist.

## Task 2: Contract implementation

**Files:**
- Modify: `dbm-contract/src/index.ts`
- Modify: `dbm-contract/scripts/generate-schema.cjs`
- Modify: `dbm-contract/scripts/validate-contracts.cjs`
- Create: `dbm-contract/fixtures/valid/r2-1-authoring-contract-v1.json`
- Create: `dbm-contract/fixtures/valid/r2-1-compiled-process-snapshot-v1.json`
- Create: `dbm-contract/fixtures/invalid/r2-1-compiled-snapshot-authoring-leakage-v1.json`

- [ ] **Step 1: Add public R2.1 contract types**

Add schema versions, authoring unit unions, lifecycle/status unions, owner/target interfaces, draft/version/lock/session interfaces, DBMScript/DBM Object/action interfaces, operation contract interfaces, `DbmAuthoringContractV1`, and `DbmCompiledProcessSnapshotV1`.

- [ ] **Step 2: Add edit-authority helper**

Implement `resolveAuthoringEditAuthorityV1(contract, request)` so only active, unexpired edit locks can deny editing. Designer sessions must be returned as awareness context and must never deny edits by themselves.

- [ ] **Step 3: Generate schemas**

Add generation targets for `DbmAuthoringContractV1` and `DbmCompiledProcessSnapshotV1`.

- [ ] **Step 4: Add fixtures**

The valid authoring fixture must include all R2.1 unit types, two sessions for the same owner, one other-user session, one active DBMScript lock, one private draft, one published version, one DBMScript record, one DBM Object record, one action record, all operation names, and the compiled snapshot exclusion list.

The valid compiled snapshot fixture must contain published references only. The invalid fixture must add authoring-only fields that schema validation rejects.

- [ ] **Step 5: Extend validation script**

Compile and validate both new schemas in `validate-contracts.cjs`, including expected rejection for the leakage fixture.

- [ ] **Step 6: Run GREEN**

Run: `.\eng\scripts\Test-DbmContract.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'`

Expected: PASS.

- [ ] **Step 7: Commit**

Run: `git add dbm-contract docs/superpowers/plans/2026-05-03-r2-1-contract-proof.md && git commit -m "feat: add r2.1 authoring contract proof"`

## Task 3: Dataverse synthesis RED tests

**Files:**
- Modify: `dbm-dataverse-synthesis/test/dataverse-synthesis.test.ts`

- [ ] **Step 1: Add failing synthesis tests**

Add tests asserting `planDataverseSynthesis(...)` exposes `authoringTables` for `dbm_authoringunit`, `dbm_authoringdraft`, `dbm_publishedversion`, `dbm_editlock`, and `dbm_designersession`, with required target, owner, version, rowversion/ETag, heartbeat/expiry, session, and audit columns.

Add tests asserting `authoringOperations` includes `acquire-lock`, `renew-lock`, `release-lock`, `force-release-lock`, `cleanup-stale-locks`, `autosave-draft`, `publish-draft`, `reject-save`, and `reject-publish`.

- [ ] **Step 2: Run RED**

Run: `Push-Location dbm-dataverse-synthesis; npm test -- test/dataverse-synthesis.test.ts; Pop-Location`

Expected: FAIL because `authoringTables` and `authoringOperations` do not exist.

## Task 4: Dataverse synthesis implementation

**Files:**
- Modify: `dbm-dataverse-synthesis/src/types.ts`
- Modify: `dbm-dataverse-synthesis/src/plan.ts`
- Modify: `dbm-dataverse-synthesis/src/index.ts`

- [ ] **Step 1: Add plan interfaces**

Add `DataverseAuthoringColumnPlan`, `DataverseAuthoringTablePlan`, and `DataverseAuthoringOperationPlan`. Add `authoringTables`, `authoringOperations`, `summary.authoringTables`, and `summary.authoringOperations` to `DataverseSynthesisPlan`.

- [ ] **Step 2: Add fixed R2.1 builders**

Implement fixed metadata-only builders for the five public authoring tables and nine operation contracts. Do not emit live Dataverse Custom API files, plugins, or runtime execution behaviour.

- [ ] **Step 3: Export types**

Export the new synthesis plan types from `dbm-dataverse-synthesis/src/index.ts`.

- [ ] **Step 4: Run GREEN**

Run: `.\eng\scripts\Test-DbmDataverseSynthesis.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add dbm-dataverse-synthesis && git commit -m "feat: plan r2.1 authoring dataverse contracts"`

## Task 5: Roadmap/docs alignment

**Files:**
- Modify: `docs/roadmap/progress-tracker.md`
- Modify: `eng/scripts/Test-RoadmapReset.ps1`
- Modify: `eng/scripts/Test-Docs.ps1` only if a new required doc file must be protected.

- [ ] **Step 1: Add failing roadmap assertion**

Update `Test-RoadmapReset.ps1` so it requires the tracker to say `R2.1 implementation proof has started` and `contract/schema/fixture and synthesis-plan proof`.

- [ ] **Step 2: Run RED**

Run: `.\eng\scripts\Test-RoadmapReset.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'`

Expected: FAIL while the tracker still says implementation proof has not started.

- [ ] **Step 3: Update tracker**

Update `docs/roadmap/progress-tracker.md` to say R2.1 implementation proof has started through contract/schema/fixture and synthesis-plan proof, while later R2.x/R3+ implementation has not started.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
.\eng\scripts\Test-RoadmapReset.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
.\eng\scripts\Test-Docs.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add docs/roadmap/progress-tracker.md eng/scripts/Test-RoadmapReset.ps1 eng/scripts/Test-Docs.ps1 && git commit -m "docs: mark r2.1 contract proof started"`

## Task 6: Final verification and lifecycle

**Files:**
- All changed files

- [ ] **Step 1: Run full verification**

Run:

```powershell
.\eng\scripts\Test-DbmContract.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
.\eng\scripts\Test-DbmDataverseSynthesis.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
.\eng\scripts\Test-RoadmapReset.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
.\eng\scripts\Test-Docs.ps1 -RepoRoot 'C:\Users\Ahmed Elsawalhy\.config\superpowers\worktrees\Dynamics-BusinessMachine\r2-1-contract-proof'
git diff --check
```

Expected: all commands PASS. Existing npm deprecation warnings may appear from current dependencies, but no new warnings should be introduced by this work.

- [ ] **Step 2: Inspect scope**

Run:

```powershell
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: changes are limited to R2.1 contract proof, synthesis plan support, roadmap validation, and this implementation plan.

- [ ] **Step 3: Merge and clean up**

If verification passes and scope is clean, follow `AGENTS.md`: merge to `main`, push, delete the branch, remove the worktree, prune metadata, and leave durable closeout evidence outside the removed worktree if worktree cleanup is performed.
