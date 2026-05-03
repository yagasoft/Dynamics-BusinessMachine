# Release 3: Back-office runtime

## Goal

Execute designed processes inside Dataverse and model-driven forms after the R1 designer/rendering and R2 action foundation are stable.

R3 runtime consumes published snapshots/definitions only. It never executes drafts, edit-lock records, autosave payloads, or half-edited authoring rows.

## Feature set and deliverables

- Process instance creation and persistence.
- Process sessions for row, user, role, and owner scoped execution.
- Configured process instance per row, user, role, or owner.
- Record-level and user-level process switching.
- Main process and sub-process runtime state.
- Stage entry/exit condition evaluation.
- Transition mode support for manual show Next progression and automatic transition when a condition is met.
- Parallel branches, branching, convergence, and previous-stage transition support.
- Condition types and timing for expression, FetchXML, and action-backed conditions, including backend condition evaluation on load and save.
- Action trigger execution for stage and form events.
- Form behaviour orchestration on model-driven forms through XRM/form-context helpers.
- Internal status and portal-status projection fields.
- Runtime diagnostics for why a transition or action did or did not run.
- Published snapshot and definition loading from the R2 compile/publish boundary.
- Explicit rejection of draft, lock, and autosave metadata as runtime inputs.

## Stages

### R3.1 Process instance foundation

Output:
- persisted process instance and context model

Must include:
- `ys_processinstance` binding strategy
- published snapshot/definition lookup strategy
- guard that runtime reads published snapshots/definitions only
- row-scoped and user-scoped sessions
- role/owner scoped instance strategy
- process instance per row, user, role, or owner where configured
- process switching context
- record-level and user-level switching rules
- flow-session access view and table-form access view

### R3.2 Transition runtime

Output:
- back-office stage progression in model-driven forms

Must include:
- entry conditions
- exit conditions
- expression, FetchXML, and action-backed condition evaluation
- backend condition evaluation on load and save
- show Next transition mode
- automatic transition when conditions are met
- branch selection
- parallel branches
- convergence after parallel branches
- previous-stage transitions
- action-trigger coordination
- condition and action execution against published definitions only
- transition diagnostics

### R3.3 Form behaviour runtime

Output:
- DBM-managed form behaviour based on the current process/stage state

Must include:
- show/hide controls
- lock/unlock controls
- requirement changes
- stage-specific form behaviour
- reusable XRM/form-context helpers based on the prototype/EAGiL idea

### R3.4 Runtime hardening

Output:
- release-quality model-driven process runtime

Must include:
- model-driven runtime tests
- plugin/server runtime tests
- tests proving runtime never executes drafts or lock metadata
- tests proving compiled snapshots exclude draft and lock data
- deterministic transition scenarios
- performance baseline for process load and save
- failure and recovery diagnostics

## Exit criteria

- A business user can progress through a process on model-driven forms.
- DBM persists process instance state and projected status.
- DBM can keep separate process sessions where row, user, role, or owner scoping requires it.
- Stage transitions and actions run in the correct back-office contexts.
- Runtime loads published snapshots/definitions only and never executes drafts, edit locks, or autosave payloads.
- Portal runtime is still deferred to `R5`.
