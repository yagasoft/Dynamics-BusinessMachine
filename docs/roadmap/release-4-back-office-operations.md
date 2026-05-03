# Release 4: Back-office operations

## Goal

Add the operational capabilities needed to run and support back-office processes properly.

Operational configuration is authored through first-class Dataverse authoring rows. Routing policies, SLA policies, notification templates, validation rules, and stage-local operational settings have their own lock/draft/version lifecycle.

## Feature set and deliverables

- Routing through table row templates and update actions.
- Routing policies as first-class Dataverse authoring rows with granular locks.
- Least-loaded owner selection.
- Round-robin owner selection.
- Tasks and work sequences.
- SLA/KPI policies as first-class Dataverse authoring rows with granular locks.
- Validations tied to stages, forms, and fields as first-class Dataverse authoring rows with granular locks.
- Notification sending through the R2 template/action foundation, with notification templates remaining first-class authoring rows.
- Stage-local operational configs as first-class Dataverse authoring rows.
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
- routing policy rows with private drafts, published versions, rowversion/ETag, and lockable metadata
- lock ownership enforcement before routing policy edits save or publish
- routing update templates
- routing diagnostics

### R4.2 Tasks, validations, and SLA/KPI

Output:
- operational controls tied to process stage state

Must include:
- task creation and completion tracking
- validation execution
- validation rule rows with private drafts, published versions, rowversion/ETag, and lockable metadata
- SLA/KPI start and success rules
- SLA/KPI pause and extension rules
- SLA policy rows with private drafts, published versions, rowversion/ETag, and lockable metadata
- stage-local config rows with private drafts, published versions, rowversion/ETag, and lockable metadata
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
- custom message and operational config rows with their own lock/draft/version lifecycle where they are edited by users

### R4.4 Operations hardening

Output:
- support-ready back-office operations release

Must include:
- operator views
- support diagnostics
- audit/history tests
- SLA and routing tests
- lock/draft/version lifecycle tests for routing, SLA, notification, validation, and stage-local operational rows
- runbooks for common operational failures

## Exit criteria

- Back-office processes can be routed, tracked, validated, timed, and supported.
- Operational behaviour is explainable to admins and support staff.
- Routing, SLA, notification, validation, and stage-local operational settings are first-class Dataverse authoring rows with their own lock/draft/version lifecycle.
- Portal execution remains out of scope until `R5`.
