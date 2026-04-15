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

function Assert-DbmThrowsLike {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action,

        [Parameter(Mandatory = $true)]
        [string]$Pattern,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    try {
        & $Action
    }
    catch {
        if ([string]$_.Exception.Message -match $Pattern) {
            return
        }

        throw "Unexpected error for '$Message': $([string]$_.Exception.Message)"
    }

    throw $Message
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$planRecord = Get-DbmPortalRuntimePlan -RepoRoot $resolvedRepoRoot
$bootstrap = $planRecord.Value.bootstrap
$runtimeModel = $planRecord.Value.processExperienceRuntime

Assert-DbmCondition -Condition ([string]$bootstrap.identityMode -eq 'generic-profile') -Message 'Portal runtime bootstrap should use the host-neutral generic-profile identity mode.'
Assert-DbmCondition -Condition ([string]$bootstrap.routes.entryPath -eq '/approval-request') -Message 'Portal runtime bootstrap should expose the approval-request entry route.'
Assert-DbmCondition -Condition ([string]$bootstrap.routes.statusPath -eq '/approval-request/status') -Message 'Portal runtime bootstrap should expose the approval-request status route.'
Assert-DbmCondition -Condition (-not ($bootstrap.PSObject.Properties.Name -contains 'entryPage')) -Message 'Portal runtime bootstrap should not carry the retired Power Pages entryPage shape.'
Assert-DbmCondition -Condition (-not ($bootstrap.PSObject.Properties.Name -contains 'requestShellPage')) -Message 'Portal runtime bootstrap should not carry the retired Power Pages requestShellPage shape.'
Assert-DbmCondition -Condition ([string]$planRecord.Value.hostPackageName -eq 'dbm-portal-runtime') -Message 'Portal runtime plan should describe dbm-portal-runtime as the local proof host package.'
Assert-DbmCondition -Condition (@($runtimeModel.stages | Where-Object { [string]$_.portalVisibility -eq 'hidden' }).Count -ge 1) -Message 'Portal runtime model should still include at least one hidden internal stage.'

$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment Dev
Assert-DbmCondition -Condition (-not [string]::IsNullOrWhiteSpace([string]$configRecord.Value.dataverseUrl)) -Message 'Dev config should still provide dataverseUrl.'
Assert-DbmCondition -Condition (-not ($configRecord.Value.PSObject.Properties.Name -contains 'powerPages')) -Message 'Dev config should not retain the retired powerPages block.'

$stepDefinitions = Get-DbmPortalRuntimePluginStepDefinitions
Assert-DbmCondition -Condition (@($stepDefinitions).Count -eq 2) -Message 'Portal runtime plugin step definitions should contain exactly two steps.'
Assert-DbmCondition -Condition ([string]$stepDefinitions[0].messageName -eq 'Create') -Message 'First portal runtime plugin step should target Create.'
Assert-DbmCondition -Condition ([string]$stepDefinitions[1].filteringAttributes -eq 'dbm_portalcommand') -Message 'Update portal runtime plugin step should filter on dbm_portalcommand.'

$missingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[0] -ActualStep $null
Assert-DbmCondition -Condition ($missingDrift.requiresUpdate -and $missingDrift.differences -contains 'step-missing') -Message 'Missing plugin-step drift should require creation.'

$matchingDrift = Get-DbmPortalRuntimePluginStepDrift -ExpectedStep $stepDefinitions[1] -ActualStep ([pscustomobject]@{
    stage = 20
    mode = 0
    rank = 1
    supporteddeployment = 0
    filteringattributes = 'dbm_portalcommand'
})
Assert-DbmCondition -Condition (-not $matchingDrift.requiresUpdate) -Message 'Matching portal runtime plugin steps should not require an update.'

$evidenceManifest = New-DbmR3PortalRuntimeEvidenceManifest `
    -TargetEnvironment 'Dev' `
    -Status 'passed' `
    -EvidenceRoot (Join-Path $resolvedRepoRoot 'artifacts\test-r3-portal-runtime-automation') `
    -Steps @(
        [pscustomobject]@{
            name = 'sample-step'
            status = 'passed'
        }
    ) `
    -Metadata ([ordered]@{
        baseUrl = 'http://127.0.0.1:4173'
    })

Assert-DbmCondition -Condition (@($evidenceManifest.steps).Count -eq 1) -Message 'Evidence manifest should preserve the supplied step payload.'
Assert-DbmCondition -Condition ([string]$evidenceManifest.targetEnvironment -eq 'Dev') -Message 'Evidence manifest should preserve the target environment.'
Assert-DbmCondition -Condition ([string]$evidenceManifest.metadata.baseUrl -eq 'http://127.0.0.1:4173') -Message 'Evidence manifest should preserve local proof metadata.'

$createdRecordId = Get-DbmCreatedRecordIdFromResponse `
    -Response ([pscustomobject]@{
        Headers = @{
            'OData-EntityId' = 'https://example.crm.dynamics.com/api/data/v9.2/dbm_requests(66666666-6666-6666-6666-666666666666)'
        }
        Content = ''
    }) `
    -PrimaryIdAttribute 'dbm_requestid'
Assert-DbmCondition -Condition ($createdRecordId -eq '66666666-6666-6666-6666-666666666666') -Message 'Dataverse create-response header parsing should work with the lightweight raw-response contract.'

$failureMessage = Format-DbmDataverseRequestFailureMessage `
    -Method 'PATCH' `
    -Uri 'https://example.crm.dynamics.com/api/data/v9.2/dbm_requests(1)' `
    -Description 'submit local runtime request' `
    -Elapsed ([TimeSpan]::FromSeconds(3)) `
    -StatusCode 429 `
    -ReasonPhrase 'Too Many Requests' `
    -ErrorPayload '{"error":{"message":"retry later"}}' `
    -ExceptionMessage 'Request throttled.'
Assert-DbmCondition -Condition ($failureMessage -match 'Description: submit local runtime request') -Message 'Formatted Dataverse failure message should include the request description.'
Assert-DbmCondition -Condition ($failureMessage -match 'Method: PATCH') -Message 'Formatted Dataverse failure message should include the HTTP method.'
Assert-DbmCondition -Condition ($failureMessage -match 'HttpStatus: 429') -Message 'Formatted Dataverse failure message should include the HTTP status.'
Assert-DbmCondition -Condition ($failureMessage -match 'DataverseErrorPayload') -Message 'Formatted Dataverse failure message should include the Dataverse error payload.'

$originalTimeoutEnv = [System.Environment]::GetEnvironmentVariable('DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS')
try {
    [System.Environment]::SetEnvironmentVariable('DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS', '45')
    Assert-DbmCondition -Condition ((Get-DbmPortalRuntimeRequestTimeoutSeconds) -eq 45) -Message 'Request timeout helper should honor DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS.'

    [System.Environment]::SetEnvironmentVariable('DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS', 'invalid')
    Assert-DbmThrowsLike `
        -Action { Get-DbmPortalRuntimeRequestTimeoutSeconds | Out-Null } `
        -Pattern 'must be a positive integer' `
        -Message 'Invalid DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS should fail fast.'
}
finally {
    [System.Environment]::SetEnvironmentVariable('DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS', $originalTimeoutEnv)
}

$writeTestRoot = Join-Path $resolvedRepoRoot 'artifacts\test-r3-portal-runtime-automation'
New-Item -ItemType Directory -Path $writeTestRoot -Force | Out-Null
$writeTestPath = Join-Path $writeTestRoot 'utf8-file.txt'
Write-DbmUtf8File -Path $writeTestPath -Content "local spa proof`n"
$writeTestBytes = [System.IO.File]::ReadAllBytes($writeTestPath)
Assert-DbmCondition -Condition (-not ($writeTestBytes.Length -ge 3 -and $writeTestBytes[0] -eq 239 -and $writeTestBytes[1] -eq 187 -and $writeTestBytes[2] -eq 191)) -Message 'Write-DbmUtf8File should emit UTF-8 without a BOM.'

$matchingProcesses = Find-DbmPortalRuntimeLocalProofProcesses `
    -RepoRoot $resolvedRepoRoot `
    -CurrentProcessId 999 `
    -Processes @(
        [pscustomobject]@{
            ProcessId = 1001
            Name = 'node.exe'
            CommandLine = "node $resolvedRepoRoot\\dbm-portal-runtime\\dist\\src\\server-entry.js --repo-root $resolvedRepoRoot --host 127.0.0.1 --port 4173"
        },
        [pscustomobject]@{
            ProcessId = 1002
            Name = 'pwsh.exe'
            CommandLine = "pwsh -NoProfile -File $resolvedRepoRoot\\eng\\scripts\\Invoke-R3PortalRuntimeLocalProof.ps1 -TargetEnvironment Dev"
        },
        [pscustomobject]@{
            ProcessId = 1003
            Name = 'pwsh.exe'
            CommandLine = 'pwsh -NoProfile -File C:\Other\Invoke-R3PortalRuntimeLocalProof.ps1 -TargetEnvironment Dev'
        },
        [pscustomobject]@{
            ProcessId = 999
            Name = 'node.exe'
            CommandLine = "node $resolvedRepoRoot\\dbm-portal-runtime\\dist\\src\\server-entry.js --repo-root $resolvedRepoRoot --host 127.0.0.1 --port 4173"
        }
    )
Assert-DbmCondition -Condition (@($matchingProcesses).Count -eq 2) -Message 'Local proof process detection should match only other local-proof processes in this repo.'
Assert-DbmCondition -Condition (@($matchingProcesses | Where-Object { [int]$_.processId -eq 1001 }).Count -eq 1) -Message 'Local proof process detection should preserve the node host process.'
Assert-DbmCondition -Condition (@($matchingProcesses | Where-Object { [int]$_.processId -eq 1002 }).Count -eq 1) -Message 'Local proof process detection should preserve the wrapper process.'

$commonScriptSource = Get-Content -Path (Join-Path $resolvedRepoRoot 'eng\scripts\PortalRuntimeDeployment.Common.ps1') -Raw
Assert-DbmCondition -Condition ($commonScriptSource -match 'System\.Net\.Http\.HttpClient') -Message 'Portal runtime helper should use HttpClient for Dataverse requests.'
Assert-DbmCondition -Condition ($commonScriptSource -match 'SendAsync\(') -Message 'Portal runtime helper should issue Dataverse requests through HttpClient.SendAsync.'
Assert-DbmCondition -Condition ($commonScriptSource -match 'function Find-DbmPortalRuntimeLocalProofProcesses') -Message 'Portal runtime helper should expose local proof process detection.'

$dataverseDeploymentSource = Get-Content -Path (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-DataverseDeployment.ps1') -Raw
Assert-DbmCondition -Condition ($dataverseDeploymentSource -match 'function Invoke-DbmPacImportWithRetry') -Message 'Dataverse deployment should retry transient solution import lock failures.'
Assert-DbmCondition -Condition ($dataverseDeploymentSource -match 'function Invoke-DbmPacDeleteWithRetry') -Message 'Dataverse deployment should retry transient solution delete lock failures.'
Assert-DbmCondition -Condition ($dataverseDeploymentSource -match "blocked by an active Dataverse customization operation") -Message 'Dataverse deployment should surface a clear retry warning for transient import locks.'

$wrapperScriptSource = Get-Content -Path (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1') -Raw
Assert-DbmCondition -Condition ($wrapperScriptSource -notmatch 'ReadToEnd\(') -Message 'Local proof wrapper should not buffer child output with ReadToEnd().'
Assert-DbmCondition -Condition ($wrapperScriptSource -match '-RedirectStandardOutput') -Message 'Local proof wrapper should redirect child stdout to a log file.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match '-RedirectStandardError') -Message 'Local proof wrapper should redirect child stderr to a log file.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'Resolve-DbmAssemblyKeyFile\.ps1') -Message 'Local proof wrapper should preflight the approved DBM signing key.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'Build-DotNet\.ps1') -Message 'Local proof wrapper should use the signed legacy packaging build path.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'Invoke-DataverseDeployment\.ps1.*-AllowSameVersionImport') -Message 'Local proof wrapper should force same-version Dataverse imports so Dev proof changes are not skipped.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'Invoke-DataverseDeployment\.ps1.*-AllowSolutionReplaceOnPluginIdentityChange') -Message 'Local proof wrapper should allow Dev remediation of stale plugin assembly identities.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'server-entry\.js') -Message 'Local proof wrapper should start the Node local proof host.'
Assert-DbmCondition -Condition ($wrapperScriptSource -match 'Test-R3PortalRuntimeLocalSmoke\.ps1') -Message 'Local proof wrapper should execute the local smoke script.'

$browserSmokeSource = Get-Content -Path (Join-Path $resolvedRepoRoot 'dbm-live-e2e\src\portal-runtime-smoke.ts') -Raw
Assert-DbmCondition -Condition ($browserSmokeSource -match 'dbm-local-proof-root') -Message 'Browser smoke should target the local SPA root.'
Assert-DbmCondition -Condition ($browserSmokeSource -notmatch 'portal-runtime-context\.js') -Message 'Browser smoke should not look for the retired Power Pages context script.'
Assert-DbmCondition -Condition ($browserSmokeSource -notmatch 'portal-runtime\.js') -Message 'Browser smoke should not look for retired Power Pages script tags.'

$localSmokeSource = Get-Content -Path (Join-Path $resolvedRepoRoot 'eng\scripts\Test-R3PortalRuntimeLocalSmoke.ps1') -Raw
Assert-DbmCondition -Condition ($localSmokeSource -match 'http://127\.0\.0\.1:4173') -Message 'Local smoke should default to the local proof host base URL.'
Assert-DbmCondition -Condition ($localSmokeSource -match 'portal-runtime-local-smoke\.json') -Message 'Local smoke should emit a local proof summary artifact.'

Write-Host 'R3 portal runtime automation validation passed.'
