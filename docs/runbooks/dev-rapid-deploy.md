# Dev Rapid Deploy

## Purpose

Update the `Dev` Dataverse environment quickly from the local working tree for inner-loop validation without waiting for the full GitHub release pipeline.

This runbook is for local `Dev` validation only. It is not a release or promotion mechanism.

## Guardrails

- `Dev` only
- local rapid deploy is not release evidence
- do not use it for `UAT` or `Prod`
- after a fix is validated in `Dev`, move it through the normal PR and release-candidate flow
- the command packages the current working tree, so isolate unrelated deployable changes before running it

## Prerequisites

- local `pac` is installed
- local `git` is installed
- local build prerequisites are installed
  - Node.js and npm
  - MSBuild
  - NuGet CLI
- tracked environment baseline in [`../../azure/config/dev.json`](../../azure/config/dev.json) is current
- preferred local PAC profile name for `Dev` is `dbm-dev`
- create one named local PAC profile per environment so local scripts can auto-select them:
  - `dbm-dev`
  - `dbm-uat`
  - `dbm-prod`
- if `dbm-dev` does not exist yet, you can still use `-InteractiveLogin` and let the script create it

## Command

```powershell
.\eng\scripts\Invoke-DevRapidDeploy.ps1
```

Optional usage:

```powershell
.\eng\scripts\Invoke-DevRapidDeploy.ps1 -Components Plugins,DbmApp
.\eng\scripts\Invoke-DevRapidDeploy.ps1 -InteractiveLogin
```

One-time local PAC profile setup:

```powershell
pac auth create --name dbm-dev  --deviceCode --environment https://ldv-rd-min.crm4.dynamics.com/
pac auth create --name dbm-uat  --deviceCode --environment https://ldv-rd-min-3.crm4.dynamics.com/
pac auth create --name dbm-prod --deviceCode --environment https://ldv-rd.crm4.dynamics.com/
```

## Component model

Tracked component detection is defined in:

- `eng/dev-rapid-deploy.components.json`

Current component names:

- `Plugins`
- `DbmApp`
- `ScriptLib`
- `JsVm`
- `WebResources`
- `DbmContract`
- `DbmDesignerCore`
- `DbmDataverseSynthesis`
- `SolutionAssets`

Rules:

- when `-Components` is omitted, the command detects affected components from local changes versus `HEAD`
- when `-Components` is provided, the command still checks for conflicting deployable changes outside that override and stops if the working tree is not isolated
- `SolutionAssets` forces the broader local build path
- `JsVm` is tracked for future extensibility, but it is not currently staged into Dataverse artifacts on its own

## Expected behavior

- validates the tracked `Dev` environment baseline
- builds only the required local component set
- packages an unmanaged-only Dataverse artifact set from the current working tree
- imports `DynamicsBusinessMachine` and then `DynamicsBusinessMachineGeneratedMetadata` into `Dev`
- runs the normal Dataverse smoke validation locally
- writes evidence under `artifacts/dev-rapid-deploy/<timestamp>/`

## Evidence

Keep the local evidence when troubleshooting:

- `deployment-evidence/environment-baseline.json`
- `deployment-evidence/deployment-summary.json`
- `deployment-evidence/smoke-test-results.json`
- `deployment-evidence/smoke-test-summary.md`
- `deployment-evidence/rapid-deploy-plan.json`
- `deployment-evidence/changed-files.txt`

## Failure handling

- if the command reports conflicting deployable changes, isolate the working tree or widen `-Components`
- if local PAC auth is missing, create or select a profile for `Dev` and rerun
- if a named local PAC profile becomes stale, delete and recreate it with the same name
- if the rapid path becomes ambiguous or too broad, stop and use the normal release-candidate flow instead
