[CmdletBinding()]
param(
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'PortalRuntimeDeployment.Common.ps1')

function Assert-DbmCondition {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$assets = Get-DbmPortalRuntimeDeployableAssets -RepoRoot $resolvedRepoRoot
$contextScript = New-DbmPortalRuntimeContextScript -PortalRuntimePlan $assets.plan.Value

Assert-DbmCondition -Condition ($contextScript -match 'dbmPortalRuntimeBootstrap') -Message 'Generated portal context script is missing dbmPortalRuntimeBootstrap.'
Assert-DbmCondition -Condition ($contextScript -match 'dbmPortalRuntimeProcessModel') -Message 'Generated portal context script is missing dbmPortalRuntimeProcessModel.'
Assert-DbmCondition -Condition (@($assets.webFiles).Count -eq 2) -Message 'Portal runtime deployable assets should include exactly two web files.'
Assert-DbmCondition -Condition ((@($assets.webFiles | Where-Object webFilePath -eq 'dbm/portal-runtime/portal-runtime-context.js')).Count -eq 1) -Message 'Portal runtime context web file is missing from the deployable asset map.'
Assert-DbmCondition -Condition ((@($assets.pages | Where-Object routePath -eq '/approval-request')).Count -eq 1) -Message 'Approval request entry route was not resolved from manifest.'
Assert-DbmCondition -Condition ((@($assets.pages | Where-Object routePath -eq '/approval-request/status')).Count -eq 1) -Message 'Approval request status route was not resolved from manifest.'

$stepDefinitions = Get-DbmPortalRuntimePluginStepDefinitions
Assert-DbmCondition -Condition (@($stepDefinitions).Count -eq 2) -Message 'Portal runtime plugin step definitions should contain exactly two steps.'

$missingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[0] -ActualStep $null
Assert-DbmCondition -Condition ($missingDrift.requiresUpdate -and $missingDrift.differences -contains 'step-missing') -Message 'Missing step drift should require an update.'

$matchingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[1] -ActualStep ([pscustomobject]@{
    stage = 20
    mode = 0
    rank = 1
    supporteddeployment = 0
    filteringattributes = 'dbm_portalcommand'
})
Assert-DbmCondition -Condition (-not $matchingDrift.requiresUpdate) -Message 'Matching step drift should not require an update.'

$evidenceManifest = New-DbmR3PortalRuntimeEvidenceManifest `
    -TargetEnvironment 'Dev' `
    -Status 'passed' `
    -EvidenceRoot (Join-Path $resolvedRepoRoot 'artifacts\test-r3-portal-runtime-automation') `
    -Steps @(
        [pscustomobject]@{
            name = 'sample-step'
            status = 'passed'
        }
    )

Assert-DbmCondition -Condition (@($evidenceManifest.steps).Count -eq 1) -Message 'Evidence manifest did not preserve the supplied step payload.'
Assert-DbmCondition -Condition ([string]$evidenceManifest.targetEnvironment -eq 'Dev') -Message 'Evidence manifest did not preserve the target environment.'

Write-Host 'R3 portal runtime automation validation passed.'
