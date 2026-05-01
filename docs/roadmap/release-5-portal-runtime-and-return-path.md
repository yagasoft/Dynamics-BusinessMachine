# Release 5: Portal runtime and return path

## Goal

Add actual portal rendering and the return path after the back-office runtime is stable.

## Feature set and deliverables

- Actual portal rendering of the portal-safe process projection.
- Portal user initiation and continuation.
- Portal status projection from internal process state.
- Hidden internal stage and step handling.
- Portal-safe action execution.
- Return path from back office to portal.
- Portal-facing status messages and available actions.
- Portal runtime diagnostics without leaking internal process detail.

## Stages

### R5.1 Portal projection runtime

Output:
- portal-visible process rendering from the canonical process portfolio

Must include:
- visible main process projection
- conditional sub-process projection
- hidden internal stage handling
- portal status text
- portal-safe available actions

### R5.2 Portal initiation and continuation

Output:
- portal user can start and continue the portal leg of a process

Must include:
- portal identity assumptions
- start form and data capture
- portal command contract
- state refresh
- safe session continuation

### R5.3 Return path

Output:
- back-office state returns coherently to the portal user

Must include:
- status return
- required action return
- rejection/send-back return
- completion return
- support diagnostics

### R5.4 Portal hardening

Output:
- reliable portal runtime release

Must include:
- responsive rendering tests
- hidden-stage leakage tests
- portal action tests
- end-to-end portal/back-office/portal smoke path

## Exit criteria

- A portal user sees actual portal rendering of the correct process projection.
- Internal-only stages remain hidden.
- Back-office state returns to the portal in business-user language.
