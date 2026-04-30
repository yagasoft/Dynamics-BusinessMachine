[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'

$msbuild = Get-Command msbuild -ErrorAction SilentlyContinue
if (-not $msbuild) {
    throw 'msbuild must be available on PATH to run the DBM plugin runtime tests.'
}

$testProjectPath = Join-Path $RepoRoot 'DbmSolution\Plugins.Tests\Plugins.Tests.csproj'
if (-not (Test-Path $testProjectPath)) {
    throw "DBM plugin runtime test project is missing: $testProjectPath"
}

& (Join-Path $PSScriptRoot 'Restore-LegacyPackages.ps1') -RepoRoot $RepoRoot

& $msbuild.Source $testProjectPath /t:Build /p:Configuration=$Configuration
if ($LASTEXITCODE -ne 0) {
    throw "DBM plugin runtime test build failed with exit code $LASTEXITCODE."
}

$testExecutable = Join-Path $RepoRoot "DbmSolution\Plugins.Tests\bin\$Configuration\Yagasoft.Dbm.Plugins.Tests.exe"
if (-not (Test-Path $testExecutable)) {
    throw "DBM plugin runtime test executable is missing: $testExecutable"
}

& $testExecutable
if ($LASTEXITCODE -ne 0) {
    throw "DBM plugin runtime tests failed with exit code $LASTEXITCODE."
}
