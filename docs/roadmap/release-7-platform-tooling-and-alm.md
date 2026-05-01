# Release 7: Platform tooling and ALM

## Goal

Make DBM manageable as a platform: source sync, solution packaging, versioning, deployment, post-deploy behaviour, tree/schema tooling, and automation.

## Feature set and deliverables

- DBM Manager for syncing scripts and objects with local files.
- XrmToolBox DBM Script Code Playground.
- DBM Solution packaging with data included through web resources.
- Post-deploy scripts.
- Solution-aware add/remove behaviour.
- Generic versioning model for scripts and DBM objects.
- DBM Tree table inheritance and schema sync.
- Enhanced DBM Jobs.
- Auto-integration.
- Power Automate-style on-premise automation where still relevant.

## Stages

### R7.1 DBM Manager and source sync

Output:
- source-controlled DBMScript and DBM Object sync path

Must include:
- file-name-to-CRM-ID mapping
- optional map file
- pull/push diagnostics
- conflict handling

### R7.2 Solution-aware packaging

Output:
- DBM Solution packages data and post-deploy behaviour

Must include:
- data stored in web resources
- target-side unpack job
- solution version checks
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

### R7.4 Tooling hardening

Output:
- platform tooling ready for repeatable ALM

Must include:
- XrmToolBox code playground
- solution-aware version tests
- source sync tests
- tree sync tests
- deployment runbooks

## Exit criteria

- DBM assets can be synced, versioned, packaged, deployed, and repaired through DBM-owned tooling.
