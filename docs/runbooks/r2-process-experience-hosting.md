# R2 Process Experience Hosting

This runbook is the release-shaped operator guide for the `R2` DBM-owned process experience hosted in model-driven forms.

## Scope

- Shared renderer package: `dbm-process-experience`
- Supported Dataverse host: generated process-host section rendered inside the target main form
- Preferred bridge: above-tabs overlay rendered from the same snapshot and host config
- Release-hardening checks: synthesis/runtime tests, visual baselines, and Dataverse smoke validation

This runbook does not cover live Power Pages integration. Portal continuity in `R2` is fixture-validated only and becomes a live runtime concern in `R3`.

## Host Modes

### Supported section host

- This is the required baseline for `R2`.
- The process experience is rendered inside a generated Dataverse form section at the top of the first business tab.
- The supported host owns the minimum guaranteed business-correct experience.
- If any overlay path is disabled or fails, the supported section host must still render the full DBM process experience.

### Preferred overlay bridge

- This is an optional placement enhancement for `R2`.
- It mounts the same shared renderer above the form tabs when the shell capability guard allows it.
- The overlay must not own unique business logic.
- The overlay reads the same `DbmProcessExperienceSnapshotV1` and `processHost` runtime config as the supported section host.

## Fallback Rules

- The supported section host is always the source of guaranteed availability.
- The overlay is allowed to fail closed.
- If overlay bootstrap fails, is disabled, or cannot find the target DOM shell:
  - the supported section host still renders
  - no runtime semantics are lost
  - form-state control beneath the process shell still behaves as synthesized
- Release validation must treat any overlay-only success as insufficient.

## When Overlay Is Allowed

- Use the overlay only as a placement bridge when top-of-form placement materially improves the experience.
- Keep overlay enablement explicit in generated runtime config.
- Treat overlay support as best-effort DOM integration, not as a supported Dataverse extensibility contract.
- Do not widen overlay usage into custom business behavior, persistence, or semantic branching.

## Generated Artifacts

The `R2` process-host delivery is complete only when these artifacts are present and drift-tracked:

- Form web resources:
  - `ys_/dbm/process-experience/renderer.js`
  - `ys_/dbm/process-experience/host.html`
- Form runtime web resources:
  - `ys_/dbm/forms/runtime.js`
  - one `ys_/dbm/forms/config/<form-id>.js` resource for every Dataverse-backed form selected in the package
- Form XML artifacts for every Dataverse-backed form selected in the package:
  - process-host section `dbm_process_host_<safe-form-id>`
  - host control `WebResource_dbmProcessHost_<safe-form-id>`
- Runtime config:
  - `processHost.supported`
  - `processHost.overlay`
  - `processHost.jumpTargetsByFormStateId`

## Local Validation

Run these checks before treating `R2` as ready for closeout:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-process-experience
npm test
npm run build
npm run test:visual
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine\dbm-dataverse-synthesis
npm test
npm run build
```

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Invoke-NodeBuild.ps1 -Projects dbm-process-experience,dbm-dataverse-synthesis,dbm-app
```

## Visual Baselines

The `R2` shared renderer must maintain visual baselines for:

- `designer-preview` current-stage rendering
- `portal-fixture` hidden-stage-collapsed rendering
- `portal-fixture` cross-form handoff rendering

If a baseline changes intentionally, update the snapshot in the same branch and explain the change in the commit or PR summary.

## Dataverse Smoke Validation

Use the normal Dataverse smoke entrypoint and keep generated metadata validation enabled:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Test-DataverseSmoke.ps1 `
  -TargetEnvironment Dev `
  -DataverseUrl https://<your-org>.crm?.dynamics.com `
  -ModelPath .\docs\architecture\examples\approval-request-v1.model.json
```

`R2` process-host smoke is considered passing only when the smoke evidence confirms all of the following:

- every Dataverse-backed form declared in the supplied model is present
- each supplied form XML contains the generated process-host section and control for that form id
- `renderer.js` and `host.html` are present in the readback snapshot
- every generated form config web resource contains a `processHost` runtime block
- generated metadata diff is free of blocking drift
- designer host validation still passes

For the generic `R2.5` close-out proof, prefer:

```powershell
Set-Location C:\Git\Dynamics-BusinessMachine
.\eng\scripts\Test-DataverseSmoke.ps1 `
  -TargetEnvironment Dev `
  -DataverseUrl https://<your-org>.crm?.dynamics.com `
  -ModelPath .\docs\architecture\examples\generic-existing-form-v1.model.json
```

## Release Decision

`R3` remains blocked until this runbook is executable end to end and the following are all true:

- shared renderer tests pass
- visual baselines pass
- synthesis/runtime tests pass
- Dataverse smoke validation passes with process-host artifact checks
- overlay failure or disablement still leaves one supported render path working
