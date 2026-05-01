# Release 4: Back-office operations

## Goal

Add the operational capabilities needed to run and support back-office processes properly.

## Feature set and deliverables

- Routing through table row templates and update actions.
- Least-loaded owner selection.
- Round-robin owner selection.
- Tasks and work sequences.
- SLA/KPI start, success, pause, extension, and failure logic.
- Validations tied to stages, forms, and fields.
- Notification sending through the R2 template/action foundation.
- History and audit tracking.
- Jobs and retry behaviour.
- Custom messages.
- Operator and support surfaces.

## Stages

### R4.1 Routing and work assignment

Output:
- routing engine for owner/user pools

Must include:
- least-loaded routing
- round-robin routing
- owner pool configuration
- routing update templates
- routing diagnostics

### R4.2 Tasks, validations, and SLA/KPI

Output:
- operational controls tied to process stage state

Must include:
- task creation and completion tracking
- validation execution
- SLA/KPI start and success rules
- SLA/KPI pause and extension rules
- stage-exit and condition-based outcomes

### R4.3 History, jobs, and custom messages

Output:
- supportable operational history and background processing

Must include:
- configurable field tracking
- pre/post image support where available
- job table and job execution model
- retry action support
- custom message definitions

### R4.4 Operations hardening

Output:
- support-ready back-office operations release

Must include:
- operator views
- support diagnostics
- audit/history tests
- SLA and routing tests
- runbooks for common operational failures

## Exit criteria

- Back-office processes can be routed, tracked, validated, timed, and supported.
- Operational behaviour is explainable to admins and support staff.
- Portal execution remains out of scope until `R5`.
