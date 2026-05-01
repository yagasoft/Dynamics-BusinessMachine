# Release 3: Back-office runtime

## Goal

Execute designed processes inside Dataverse and model-driven forms after the R1 designer/rendering and R2 action foundation are stable.

## Feature set and deliverables

- Process instance creation and persistence.
- Row, user, role, and owner scoped execution.
- Main process and sub-process runtime state.
- Stage entry/exit condition evaluation.
- Branching, convergence, and previous-stage transition support.
- Action trigger execution for stage and form events.
- Form behaviour orchestration on model-driven forms.
- Internal status and portal-status projection fields.
- Runtime diagnostics for why a transition or action did or did not run.

## Stages

### R3.1 Process instance foundation

Output:
- persisted process instance and context model

Must include:
- `ys_processinstance` binding strategy
- row-scoped and user-scoped sessions
- role/owner scoped instance strategy
- process switching context
- record-level and user-level switching rules

### R3.2 Transition runtime

Output:
- back-office stage progression in model-driven forms

Must include:
- entry conditions
- exit conditions
- branch selection
- previous-stage transitions
- action-trigger coordination
- transition diagnostics

### R3.3 Form behaviour runtime

Output:
- DBM-managed form behaviour based on the current process/stage state

Must include:
- show/hide controls
- lock/unlock controls
- requirement changes
- stage-specific form behaviour
- reusable XRM helper based on the prototype/EAGiL idea

### R3.4 Runtime hardening

Output:
- release-quality model-driven process runtime

Must include:
- model-driven runtime tests
- plugin/server runtime tests
- deterministic transition scenarios
- performance baseline for process load and save
- failure and recovery diagnostics

## Exit criteria

- A business user can progress through a process on model-driven forms.
- DBM persists process instance state and projected status.
- Stage transitions and actions run in the correct back-office contexts.
- Portal runtime is still deferred to `R5`.
