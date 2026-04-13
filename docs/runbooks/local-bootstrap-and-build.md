# Local Bootstrap And Build

## Purpose

Provide the minimum reproducible local setup for engineers working on Release 0.2 and Release 0.3 without depending on hidden machine-local assets.

## Required tools

- Windows development environment
- Git
- Node.js 20.x
- npm
- Visual Studio Build Tools or Visual Studio with MSBuild
- NuGet CLI
- .NET 10 SDK
  - required for Power Platform CLI 2.x
- optional for deployment work:
  - Azure CLI
  - Power Platform CLI 2.4.1 or later

## Repo assumptions

- `main` is the integration baseline
- `feature/script-lib/main` is reference-only
- checked-in Angular environment files are:
  - `dbm-app/src/environments/environment.dev.ts`
  - `dbm-app/src/environments/environment.prod.ts`
- strong-name signing material is not kept in Git
- legacy plugin merge/sign packaging requires the approved key through `-AssemblyKeyFile` or `DBM_ASSEMBLY_KEY_FILE`
- legacy packaging side effects in `DynamicsDbmXtbPlugin` are disabled by default through `DbmEnableLegacyPackaging=false`
- hosted release packaging prefers `app-signing-key` from Azure Key Vault and may fall back to GitHub Actions secret `APP_SIGNING_KEY_B64` during bootstrap or recovery before promoting the signed merged plugin assembly onto the standard Dataverse package source path

## First-time bootstrap

1. Clone the repository.
2. Create a short-lived working branch from `main`.
3. Verify the version source in `eng/version.json`.
4. Install local prerequisites.
5. Run the validation sequence from the repo root:

```powershell
.\eng\scripts\Test-RepoHygiene.ps1
.\eng\scripts\Test-Docs.ps1
.\eng\scripts\Invoke-NodeBuild.ps1
.\eng\scripts\Test-DbmDataverseSynthesis.ps1
.\eng\scripts\Restore-LegacyPackages.ps1
.\eng\scripts\Build-DotNet.ps1
.\eng\scripts\New-DataverseSolutionSource.ps1
.\eng\scripts\Test-AzureContract.ps1
```

## Packaging locally

To produce Dataverse artifacts locally:

```powershell
.\eng\scripts\Invoke-DataversePackaging.ps1 -RunSolutionCheck:$false
```

This packages the core `DynamicsBusinessMachine` solution and the layered `DynamicsBusinessMachineGeneratedMetadata` solution in the tracked import order.

Before packaging or running local `Dev` rapid deploy, make sure the core plugin assembly is rebuilt with the approved strong-name key:

```powershell
$env:DBM_ASSEMBLY_KEY_FILE = 'C:\path\to\app-signing-key.snk'
.\eng\scripts\Build-DotNet.ps1 -EnableLegacyPackaging
```

If the approved key has been lost during a controlled recovery, generate one replacement `.snk` outside Git with `.\eng\scripts\New-DbmAssemblySigningKey.ps1`, then seed it through the documented secret-rotation flow before using it as the new official key.

Use `-RunSolutionCheck:$true` only when PAC auth has already been established and the environment is meant to support solution checking.

To package only the unmanaged artifact for local `Dev` rapid deploy:

```powershell
.\eng\scripts\Invoke-DataversePackaging.ps1 -PackageSet UnmanagedOnly -RunSolutionCheck:$false -GenerateSettings:$false
```

To exercise the script-driven synthesis path directly in `Dev`:

```powershell
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode Plan
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode EmitSource
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode ApplyDev -TargetEnvironment Dev
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode Readback -TargetEnvironment Dev
.\eng\scripts\Invoke-DataverseSynthesis.ps1 -Mode Diff
```

Use direct `ApplyDev` only for authoring proof in `Dev`. `UAT` and `Prod` remain packaged-import-only.

To run the local `Dev` rapid deploy path:

```powershell
.\eng\scripts\Invoke-DevRapidDeploy.ps1
```

`Invoke-DevRapidDeploy.ps1` now expects the approved strong-name key through `-AssemblyKeyFile` or `DBM_ASSEMBLY_KEY_FILE`, because the normal packaged refresh path always includes the core plugin assembly.

Use `-Components` to force a scoped local build and `-InteractiveLogin` if PAC needs a local interactive sign-in for `Dev`.

## Hosted designer access in Dev

The recommended way to use the current DBM designer is the Dataverse-hosted app in `Dev`, not plain localhost. The checked-in Angular MSAL environment values are still placeholders, so localhost remains a build/test path rather than the primary interactive usage path.

To resolve the current hosted designer URL:

```powershell
.\eng\scripts\Get-DbmDesignerHost.ps1 -TargetEnvironment Dev
```

To open the hosted designer directly in your browser:

```powershell
.\eng\scripts\Get-DbmDesignerHost.ps1 -TargetEnvironment Dev -Open
```

To validate the hosted designer prerequisites and capture evidence:

```powershell
.\eng\scripts\Test-DbmDesignerHost.ps1 -TargetEnvironment Dev
```

For the exact manual create/edit/save/reopen walkthrough, use [designer-hosted-validation.md](designer-hosted-validation.md).

Preferred one-time local PAC profile setup:

```powershell
pac auth create --name dbm-dev  --deviceCode --environment https://ldv-rd-min.crm4.dynamics.com/
pac auth create --name dbm-uat  --deviceCode --environment https://ldv-rd-min-3.crm4.dynamics.com/
pac auth create --name dbm-prod --deviceCode --environment https://ldv-rd.crm4.dynamics.com/
```

Local Dataverse scripts prefer these profile names automatically outside GitHub Actions:

- `dbm-dev`
- `dbm-uat`
- `dbm-prod`

To opt into legacy plugin merge/sign packaging locally:

```powershell
.\eng\scripts\Build-DotNet.ps1 -EnableLegacyPackaging -AssemblyKeyFile 'C:\path\to\app-signing-key.snk'
```

Legacy XrmToolBox package outputs are written to `DbmSolution\artifacts\legacy-packages`.

## Local build guardrails

- do not add secrets to Git, `.env`, or ad hoc config files
- do not re-enable machine-local packaging scripts as the formal path
- do not create new version sources outside `eng/version.json`
- do not rely on `feature/script-lib/main` for direct promotion work

## When local build fails

- if Node builds fail, confirm each project still has a `package-lock.json`
- if legacy .NET restore fails, confirm `nuget` is available on `PATH`
- if .NET build fails, confirm `msbuild` is available on `PATH`
- if npm audit fails, review `artifacts\security\npm-audit\summary.md` and confirm every exception in `eng/security/npm-audit-exceptions.json` is still valid
- if PAC commands fail, confirm .NET 10 is installed before installing PAC CLI 2.x
- if Dev rapid deploy reports conflicting deployable changes, isolate the working tree or widen the `-Components` selection before re-running
