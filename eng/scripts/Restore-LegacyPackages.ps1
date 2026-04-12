[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$SolutionPath = 'DbmSolution\DbmSolution.sln'
)

$nuget = Get-Command nuget -ErrorAction SilentlyContinue
if (-not $nuget) {
    throw 'nuget.exe must be available on PATH to restore packages.config dependencies.'
}

$fullSolutionPath = Join-Path $RepoRoot $SolutionPath
& $nuget.Source restore $fullSolutionPath
if ($LASTEXITCODE -ne 0) {
    throw "NuGet restore failed for $fullSolutionPath"
}
