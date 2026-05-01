[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

function Assert-DbmContract {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Get-RequiredTextFile {
    param([string]$RelativePath)

    $path = Join-Path $RepoRoot $RelativePath
    Assert-DbmContract -Condition (Test-Path $path) -Message "Required release promotion contract file is missing: $RelativePath"
    return Get-Content -Path $path -Raw
}

function Assert-TextMatch {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Message
    )

    Assert-DbmContract -Condition ($Content -match $Pattern) -Message $Message
}

$dataverseWorkflow = Get-RequiredTextFile -RelativePath '.github\workflows\deploy-dataverse.yml'
$azureWorkflow = Get-RequiredTextFile -RelativePath '.github\workflows\deploy-azure.yml'
$uatRunbook = Get-RequiredTextFile -RelativePath 'docs\runbooks\uat-promotion-runbook.md'
$prodRunbook = Get-RequiredTextFile -RelativePath 'docs\runbooks\prod-promotion-runbook.md'
$rollbackRunbook = Get-RequiredTextFile -RelativePath 'docs\runbooks\rollback-runbook.md'
$releaseGovernance = Get-RequiredTextFile -RelativePath 'docs\releases\release-governance.md'

Assert-TextMatch -Content $dataverseWorkflow -Pattern 'environment:\s*\$\{\{\s*inputs\.target_environment\s*\}\}' -Message 'deploy-dataverse must bind the job to the requested GitHub Environment.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Test-DeploymentRefPolicy\.ps1\s+-EnvironmentName "\$\{\{\s*inputs\.target_environment\s*\}\}"' -Message 'deploy-dataverse must enforce the deployment ref policy.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Test-WorkflowGate\.ps1\s*`\s*\r?\n\s*-WorkflowFileName ''security\.yml''' -Message 'deploy-dataverse must enforce the security workflow gate before UAT or Prod.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Test-EnvironmentBaseline\.ps1[\s\S]+-RequireEnvironmentVariables[\s\S]+artifacts\\deployment-evidence\\environment-baseline\.json' -Message 'deploy-dataverse must validate tracked environment variables and write baseline evidence.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Invoke-NodeBuild\.ps1 -Projects dbm-contract,dbm-dataverse-synthesis' -Message 'deploy-dataverse must build synthesis validation packages before import.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Get-GitHubArtifact\.ps1 -ArtifactName \$env:ARTIFACT_NAME' -Message 'deploy-dataverse must deploy from an immutable release-candidate artifact.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Invoke-DataverseDeployment\.ps1[\s\S]+-PackageRoot \$packageRoot[\s\S]+-ExpectedSolutionVersion "\$\{\{\s*steps\.candidate\.outputs\.solutionVersion\s*\}\}"' -Message 'deploy-dataverse must import the candidate Dataverse package at the expected solution version.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Test-DataverseSmoke\.ps1[\s\S]+-ExpectedSolutionVersion "\$\{\{\s*steps\.candidate\.outputs\.solutionVersion\s*\}\}"' -Message 'deploy-dataverse must run post-import Dataverse smoke validation.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'workflowRunId\s*=\s*\$env:GITHUB_RUN_ID' -Message 'deploy-dataverse deployment summary must include the workflow run id.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'targetEnvironment\s*=\s*\$env:TARGET_ENVIRONMENT' -Message 'deploy-dataverse deployment summary must include the target environment.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'dataverseUrl\s*=\s*"\$\{\{\s*vars\.DATAVERSE_URL\s*\}\}"' -Message 'deploy-dataverse deployment summary must include the Dataverse URL.'
Assert-TextMatch -Content $dataverseWorkflow -Pattern 'Upload deployment evidence' -Message 'deploy-dataverse must upload deployment evidence.'

Assert-TextMatch -Content $azureWorkflow -Pattern 'environment:\s*\$\{\{\s*inputs\.target_environment\s*\}\}' -Message 'deploy-azure must bind the job to the requested GitHub Environment.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'Test-DeploymentRefPolicy\.ps1\s+-EnvironmentName "\$\{\{\s*inputs\.target_environment\s*\}\}"' -Message 'deploy-azure must enforce the deployment ref policy.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'Test-WorkflowGate\.ps1\s*`\s*\r?\n\s*-WorkflowFileName ''security\.yml''' -Message 'deploy-azure must enforce the security workflow gate before UAT or Prod.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'Test-AzureContract\.ps1' -Message 'deploy-azure must validate the Azure delivery contract.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'Detect deployable Azure app assets' -Message 'deploy-azure must detect deployable app assets before deployment.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'No-op Azure deployment' -Message 'deploy-azure must keep the completed baseline no-op path explicit.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'no-op-contract-validation' -Message 'deploy-azure summary must record no-op-contract-validation when no app assets exist.'
Assert-TextMatch -Content $azureWorkflow -Pattern 'Upload Azure deployment evidence' -Message 'deploy-azure must upload Azure deployment evidence.'

foreach ($runbookEntry in @(
    @{ Name = 'UAT'; Content = $uatRunbook; Environment = 'UAT' },
    @{ Name = 'Prod'; Content = $prodRunbook; Environment = 'Prod' }
)) {
    Assert-TextMatch -Content $runbookEntry.Content -Pattern 'pre-promotion backup' -Message "$($runbookEntry.Name) promotion runbook must require a pre-promotion backup."
    Assert-TextMatch -Content $runbookEntry.Content -Pattern 'Invoke-DataverseBackup\.ps1 -TargetEnvironment ' -Message "$($runbookEntry.Name) promotion runbook must point to the backup automation script."
    Assert-TextMatch -Content $runbookEntry.Content -Pattern 'backup-reference\.json' -Message "$($runbookEntry.Name) promotion runbook must retain backup-reference.json evidence."
    Assert-TextMatch -Content $runbookEntry.Content -Pattern 'deployment evidence' -Message "$($runbookEntry.Name) promotion runbook must require deployment evidence."
}

Assert-TextMatch -Content $rollbackRunbook -Pattern 'backup-reference\.json' -Message 'rollback runbook must use the recorded backup reference as restore evidence.'
Assert-TextMatch -Content $releaseGovernance -Pattern 'pre-promotion backup' -Message 'release governance must document pre-promotion backup expectations.'
Assert-TextMatch -Content $releaseGovernance -Pattern 'direct deterministic automated coverage' -Message 'release governance must require deterministic completed-roadmap coverage.'
Assert-TextMatch -Content $releaseGovernance -Pattern 'supplemental live proof' -Message 'release governance must keep live proof supplemental to deterministic TDD coverage.'

Write-Host 'DBM release promotion contract validation passed.'
