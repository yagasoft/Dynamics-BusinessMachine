# Live Connected E2E

## Purpose

Run the DBM connected live end-to-end harness against the deployed model-driven host and real Dataverse/backend state using only the existing `Dev`, `UAT`, and `Prod` environments.

This runbook governs the automated browser-driven E2E path.

- `Dev` is the always-runnable full-suite environment.
- `UAT` is the promotion-gate subset environment.
- `Prod` is intentionally excluded from automated browser-driven E2E in this slice.

## Guardrails

- no extra environments are created for live E2E
- every run must create and clean its own test data
- `Dev` and `UAT` runs are serialized through a Dataverse-side live lock
- one persisted browser session is reused per environment
- the browser harness is single-user simulation, not multi-user browser automation
- local runs use the same harness and lock contract as GitHub Actions
- `Prod` stays on non-destructive smoke/manual verification only unless a later release explicitly changes that policy

## Tracked config

Tracked non-secret live E2E metadata lives in:

- [`../../azure/config/dev.json`](../../azure/config/dev.json)
- [`../../azure/config/uat.json`](../../azure/config/uat.json)
- [`../../azure/config/prod.json`](../../azure/config/prod.json)

Tracked config includes:

- `modelDrivenAppUrl`
- `liveE2E.lock.webResourceName`
- `liveE2E.cleanup`
- `liveE2E.authentication`
- `liveE2E.caseSets`
- `liveE2E.entities` for Dataverse assertion and cleanup aliases

Secrets and real credentials do not belong in tracked JSON.

## Required local prerequisites

- Azure CLI authenticated to the correct tenant
- `pac` installed
- the preferred local PAC profile for the target environment exists, or `-InteractiveLogin` is used
- Playwright browser dependencies will be installed by the script when needed
- the same Windows user owns:
  - the persisted browser session under `%LOCALAPPDATA%\DBM\live-e2e\sessions\<environment>\`
  - the self-hosted GitHub runner process
  - the DPAPI CurrentUser scope used to decrypt the stored browser session
- the self-hosted runner machine stays signed in for unattended `Dev` and `UAT` browser gates

## One-time bootstrap

Initialize the persisted browser session once per environment:

```powershell
.\eng\scripts\Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment Dev
```

This command:

- launches a headed Playwright Chromium login flow
- lets you complete enterprise sign-in once
- validates that the model-driven app opens successfully
- stores an encrypted session artifact under `%LOCALAPPDATA%\DBM\live-e2e\sessions\<environment>\`
- writes plaintext non-secret metadata beside it

Optional helpers:

```powershell
.\eng\scripts\Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment Dev -ValidateOnly
.\eng\scripts\Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment Dev -Reset
```

Use `-SessionUserDisplayName "<actual Dataverse user display name>"` during bootstrap if the tracked default display name hint is not the right lookup value for your tenant.

## Core commands

Validate the package, case catalog, and tracked config without a live browser run:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment Dev -ValidateOnly
```

Check only the persisted browser session health and refresh the stored session state without creating business data:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment Dev -SessionHealthOnly
```

Run the full connected suite in `Dev`:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment Dev -CaseSet full
```

Run the promotion-gate subset in `UAT`:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment UAT -CaseSet promotion
```

Reclaim a stale lock only after confirming the previous run is dead:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment Dev -CaseSet full -AllowStaleLockRecovery
```

Clean up orphaned E2E records that still carry the tracked test prefix:

```powershell
.\eng\scripts\Test-LiveDbmE2E.ps1 -TargetEnvironment Dev -CleanupOrphansOnly -AllowStaleLockRecovery
```

## Case catalog

Tracked machine-readable cases live under:

- [`../../eng/live-e2e/cases`](../../eng/live-e2e/cases)

The deterministic baseline suite currently covers:

- create request and save draft
- submit request and verify stage/step/status advance
- hidden internal stage with safe visible status projection
- approval path
- rejection path

Logical workflow roles remain in the case catalog, but all browser actions now execute through the same persisted physical user session. Evidence records that explicitly as `physicalUserMode: single-user-simulation`.

## Evidence

Local and workflow runs write evidence under:

- `artifacts/live-e2e/<environment>/<run-id>/`

Expected artifacts include:

- `environment.json`
- `lock.json`
- `run-context.json`
- session metadata references
- `summary.json`
- `summary.md`
- `playwright-results.json`
- per-case `case-result.json`
- Playwright traces/screenshots/videos on failure

## Current salvage scope

This salvage lands the live E2E harness, case catalog, scripts, session bootstrap, and tracked config contract on top of the shipped `R1` baseline.

It does **not** yet wire browser-driven live E2E into GitHub Actions or promotion gates. In this first safe landing:

- local validation and operator-driven execution are supported
- self-hosted runner preparation is documented and script-ready
- workflow wiring remains deferred until it can be layered onto `main` without regressing the shipped `R1` line

When workflow wiring is reintroduced later, it must remain additive to the current release packaging and smoke path.

## Failure handling

- if the live lock is active and not stale, stop and let the earlier run finish
- if cleanup fails, keep the evidence, run orphan cleanup intentionally, and record the leftover ids
- if the stored browser session is missing or expired, re-run `Initialize-LiveDbmE2ESession.ps1`
- if backend assertions fail, treat the environment as not promotion-ready until the mismatch is explained
- if `UAT` promotion-gate live E2E fails, stop promotion and investigate before retrying
