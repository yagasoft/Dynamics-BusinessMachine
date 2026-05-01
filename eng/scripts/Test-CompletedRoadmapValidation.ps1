[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [switch]$ListOnly,
    [switch]$IncludeVisual
)

$ErrorActionPreference = 'Stop'

$resolvedRepoRoot = (Resolve-Path $RepoRoot).Path

function New-CompletedRoadmapGate {
    param(
        [string]$Name,
        [string]$Script,
        [string]$Description
    )

    [pscustomobject]@{
        Name = $Name
        Script = $Script
        Description = $Description
    }
}

$gates = [System.Collections.Generic.List[object]]::new()
$gates.Add((New-CompletedRoadmapGate -Name 'Docs' -Script 'eng\scripts\Test-Docs.ps1' -Description 'required documentation and CI evidence checks'))
$gates.Add((New-CompletedRoadmapGate -Name 'Completed-roadmap matrix' -Script 'eng\scripts\Test-CompletedRoadmapTddMatrix.ps1' -Description 'capability routing, proof ledger, and warning governance'))
$gates.Add((New-CompletedRoadmapGate -Name 'Environment proof readiness' -Script 'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1' -Description 'repo-owned proof assets and local readiness warnings'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM contract' -Script 'eng\scripts\Test-DbmContract.ps1' -Description 'contract build, tests, and fixture validation'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM process experience' -Script 'eng\scripts\Test-DbmProcessExperience.ps1' -Description 'shared process renderer package test and build'))

if ($IncludeVisual) {
    $gates.Add((New-CompletedRoadmapGate -Name 'DBM process experience visual' -Script 'eng\scripts\Test-DbmProcessExperienceVisual.ps1' -Description 'optional environment-bound visual snapshot proof'))
}

$gates.Add((New-CompletedRoadmapGate -Name 'DBM portal runtime' -Script 'eng\scripts\Test-DbmPortalRuntime.ps1' -Description 'local SPA runtime package test and build'))
$gates.Add((New-CompletedRoadmapGate -Name 'DBM designer shell' -Script 'eng\scripts\Test-DbmDesignerShell.ps1' -Description 'designer shell package test and build'))
$gates.Add((New-CompletedRoadmapGate -Name 'Node build' -Script 'eng\scripts\Invoke-NodeBuild.ps1' -Description 'full Node asset build path'))

if ($ListOnly) {
    Write-Host 'Completed-roadmap validation gates run sequentially in this order:'
    for ($index = 0; $index -lt $gates.Count; $index++) {
        $gate = $gates[$index]
        Write-Host ("{0}. {1} - {2} ({3})" -f ($index + 1), $gate.Name, $gate.Script, $gate.Description)
    }

    if (-not $IncludeVisual) {
        Write-Host 'Optional visual proof is excluded. Pass -IncludeVisual to add the environment-bound visual gate.'
    }

    return
}

for ($index = 0; $index -lt $gates.Count; $index++) {
    $gate = $gates[$index]
    $scriptPath = Join-Path $resolvedRepoRoot $gate.Script
    if (-not (Test-Path $scriptPath)) {
        throw "Completed-roadmap validation gate script is missing: $($gate.Script)"
    }

    Write-Host ("[{0}/{1}] {2}: {3}" -f ($index + 1), $gates.Count, $gate.Name, $gate.Description)
    & $scriptPath -RepoRoot $resolvedRepoRoot
}

Write-Host 'Completed-roadmap validation passed.'
