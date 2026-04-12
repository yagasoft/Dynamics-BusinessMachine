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
- legacy plugin merge/sign packaging is opt-in and requires `DbmAssemblyKeyFile`
- legacy packaging side effects in `DynamicsDbmXtbPlugin` are disabled by default through `DbmEnableLegacyPackaging=false`
- hosted release packaging hydrates `app-signing-key` from Azure Key Vault and promotes the signed merged plugin assembly onto the standard Dataverse package source path

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

Use `-RunSolutionCheck:$true` only when PAC auth has already been established and the environment is meant to support solution checking.

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
