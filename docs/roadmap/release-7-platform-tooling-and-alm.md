# Release 7: Platform tooling and ALM

## Goal

Make DBM manageable as a platform: source sync, solution packaging, versioning, deployment, post-deploy behaviour, tree/schema tooling, and automation.

R7 exports and imports compiled published snapshots as the portable runtime package. It may also export and import source-normalised artefacts for authoring rows, but imports must report conflicts when target rows changed since the exported base version or rowversion.

## Feature set and deliverables

- DBM Manager for syncing scripts and objects with local files.
- Export/import of compiled published snapshots as the runtime and portable package.
- Optional source-normalised artefacts for DBMScript, DBM Object, actions, notification templates, routing policies, SLA policies, validation rules, and stage-local configs.
- Conflict reporting when source import sees a target row changed since the exported base version or rowversion.
- Explicit Code Apps source/ALM limitation documentation in the source-sync strategy.
- XrmToolBox DBM Script Code Playground.
- DBM Solution packaging with data included through web resources.
- Post-deploy scripts.
- Solution-aware add/remove behaviour.
- Generic versioning model for scripts and DBM objects.
- DBM Tree table inheritance and schema sync.
- Enhanced DBM Jobs.
- Auto-integration discovery.
- Power Automate-style on-premise automation where still relevant.

## Stages

### R7.1 DBM Manager and source sync

Output:
- source-controlled DBMScript, DBM Object, and source-normalised authoring artefact sync path

Must include:
- file-name-to-CRM-ID mapping
- optional map file
- compiled published snapshot export/import
- optional source-normalised artefact export/import for scripts, objects, actions, templates, routing, SLA, validation, and stage-local configs
- base published version and rowversion/ETag capture in exported source-normalised artefacts
- pull/push diagnostics
- conflict reporting when target rows changed since export
- Code Apps source/ALM limitation notes so the designer host does not imply unsupported Power Platform Git/source integration

### R7.2 Solution-aware packaging

Output:
- DBM Solution packages data and post-deploy behaviour

Must include:
- compiled published snapshots stored in packageable solution artefacts
- optional source-normalised artefacts stored in packageable solution artefacts where the selected ALM path supports them
- target-side unpack job
- solution version checks
- conflict report output for source-normalised import
- post-deploy script execution
- current version replacement in solutions

### R7.3 DBM Tree and jobs

Output:
- table inheritance and improved jobs

Must include:
- parent/child table definitions
- abstract parent prevention
- incremental schema sync job
- DBM Job script editor option
- action/query/retry replacement by script where configured

### R7.4 Auto-integration discovery

Output:
- documented auto-integration discovery result that decides what DBM can safely generate, sync, or invoke without bespoke one-off integration work

Must include:
- integration candidate inventory
- integration contract boundaries
- Dataverse, web-resource, plugin, job, and external-service touchpoint map
- explicit defer/accept decision for each candidate
- implementation slices for accepted candidates

### R7.5 Tooling hardening

Output:
- platform tooling ready for repeatable ALM

Must include:
- XrmToolBox code playground
- solution-aware version tests
- source sync tests
- compiled snapshot export/import tests
- source-normalised artefact conflict reporting tests
- tree sync tests
- auto-integration discovery evidence
- deployment runbooks

## Exit criteria

- DBM assets can be synced, versioned, packaged, deployed, and repaired through DBM-owned tooling.
- Compiled published snapshots can be exported/imported as the runtime and portable package.
- Optional source-normalised artefacts can be exported/imported with conflict reporting rather than silent overwrites.
