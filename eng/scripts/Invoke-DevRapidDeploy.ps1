[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'artifacts\dev-rapid-deploy'),
    [string[]]$Components,
    [switch]$InteractiveLogin,
    [switch]$SkipGeneratedMetadataDeployment
)

$ErrorActionPreference = 'Stop'

function Resolve-DbmPacPath {
    if (-not [string]::IsNullOrWhiteSpace($env:POWERPLATFORMTOOLS_PACPATH) -and (Test-Path $env:POWERPLATFORMTOOLS_PACPATH)) {
        return (Resolve-Path $env:POWERPLATFORMTOOLS_PACPATH).Path
    }

    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if ($pac) {
        return $pac.Source
    }

    throw 'pac must be available on PATH or via POWERPLATFORMTOOLS_PACPATH to run Dev rapid deploy.'
}

function Resolve-DbmGitPath {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        throw 'git must be available on PATH to detect local changes for Dev rapid deploy.'
    }

    return $git.Source
}

function Normalize-DbmRelativePath {
    param(
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $null
    }

    return $Path.Replace('\', '/').Trim().TrimStart('.').TrimStart('/')
}

function Invoke-DbmTextCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandPath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $CommandPath @Arguments 2>&1

    [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = ($output | Out-String).Trim()
    }
}

function Get-DbmRapidDeployRegistry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RegistryPath
    )

    if (-not (Test-Path $RegistryPath)) {
        throw "Dev rapid deploy component registry is missing: $RegistryPath"
    }

    $registry = Get-Content -Path $RegistryPath -Raw | ConvertFrom-Json
    if (-not $registry.components) {
        throw "Dev rapid deploy component registry does not contain any components: $RegistryPath"
    }

    $components = @($registry.components)
    $duplicateNames = $components | Group-Object name | Where-Object { $_.Count -gt 1 }
    if ($duplicateNames) {
        $names = $duplicateNames | ForEach-Object { $_.Name }
        throw "Dev rapid deploy component registry contains duplicate component names: $($names -join ', ')"
    }

    return $components
}

function Get-DbmChangedFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$GitPath,

        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $tracked = & $GitPath -C $RepoRoot -c core.safecrlf=false diff --name-only --relative HEAD 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'git diff failed while detecting local changes for Dev rapid deploy.'
    }

    $untracked = & $GitPath -C $RepoRoot -c core.safecrlf=false ls-files --others --exclude-standard 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'git ls-files failed while detecting local changes for Dev rapid deploy.'
    }

    return @(
        @($tracked) + @($untracked) |
            Where-Object { $_ -and $_.ToString().Trim() -notmatch '^warning:' } |
            ForEach-Object { Normalize-DbmRelativePath -Path $_ } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique
    )
}

function Test-DbmPathPatternMatch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Pattern
    )

    $normalizedPath = Normalize-DbmRelativePath -Path $Path
    $normalizedPattern = Normalize-DbmRelativePath -Path $Pattern

    return $normalizedPath -like $normalizedPattern
}

function Get-DbmMatchedComponents {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$RegistryComponents,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$ChangedFiles
    )

    $matched = New-Object System.Collections.Generic.List[object]

    foreach ($component in $RegistryComponents) {
        $componentMatched = $false
        foreach ($changedFile in $ChangedFiles) {
            foreach ($pattern in @($component.sourcePatterns)) {
                if (Test-DbmPathPatternMatch -Path $changedFile -Pattern $pattern) {
                    $componentMatched = $true
                    break
                }
            }

            if ($componentMatched) {
                break
            }
        }

        if ($componentMatched) {
            [void]$matched.Add($component)
        }
    }

    return $matched.ToArray()
}

function Get-DbmSelectedComponents {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$RegistryComponents,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$DetectedComponents,

        [string[]]$RequestedComponents
    )

    if (-not $RequestedComponents -or $RequestedComponents.Count -eq 0) {
        return @($DetectedComponents)
    }

    $componentMap = @{}
    foreach ($component in $RegistryComponents) {
        $componentMap[[string]$component.name] = $component
    }

    $invalid = @($RequestedComponents | Where-Object { -not $componentMap.ContainsKey($_) } | Select-Object -Unique)
    if ($invalid.Count -gt 0) {
        $valid = $RegistryComponents | ForEach-Object { [string]$_.name }
        throw "Unknown Dev rapid deploy component(s): $($invalid -join ', '). Valid values: $($valid -join ', ')"
    }

    $selected = foreach ($name in $RequestedComponents | Select-Object -Unique) {
        $componentMap[$name]
    }

    return @($selected)
}

function Resolve-DbmRapidDeployPlan {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$RegistryComponents,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$DetectedComponents,

        [Parameter(Mandatory = $true)]
        [object[]]$SelectedComponents
    )

    $forceFullBuild = @($SelectedComponents | Where-Object { $_.forceFullBuild -eq $true }).Count -gt 0
    $effectiveComponents = if ($forceFullBuild) {
        @($RegistryComponents | Where-Object {
            $_.requiresDotNetBuild -eq $true -or
            @($_.nodeProjects).Count -gt 0
        })
    }
    else {
        @($SelectedComponents)
    }

    $detectedDeployable = @($DetectedComponents | Where-Object { $_.deployable -eq $true })
    $selectedNames = @($SelectedComponents | ForEach-Object { [string]$_.name })
    $conflictingDetected = @(
        $detectedDeployable |
            Where-Object { [string]$_.name -notin $selectedNames } |
            ForEach-Object { [string]$_.name } |
            Select-Object -Unique
    )

    $selectedDeployable = @($SelectedComponents | Where-Object { $_.deployable -eq $true })
    if ($selectedDeployable.Count -eq 0) {
        $nonDeployableNotes = @(
            $SelectedComponents |
                ForEach-Object {
                    $name = [string]$_.name
                    $notes = if ($_.PSObject.Properties['notes']) { [string]$_.notes } else { $null }
                    if ([string]::IsNullOrWhiteSpace($notes)) {
                        $name
                    }
                    else {
                        "$name ($notes)"
                    }
                }
        )

        throw "The selected Dev rapid deploy component set does not currently map to Dataverse-packaged outputs: $($nonDeployableNotes -join ', ')"
    }

    if ($conflictingDetected.Count -gt 0) {
        throw "The working tree contains deployable changes outside the selected component override: $($conflictingDetected -join ', '). Include them in -Components or isolate them before running Dev rapid deploy."
    }

    $nodeProjects = New-Object System.Collections.Generic.List[string]
    foreach ($component in $effectiveComponents) {
        foreach ($project in @($component.nodeProjects)) {
            if (-not [string]::IsNullOrWhiteSpace($project) -and -not $nodeProjects.Contains([string]$project)) {
                $nodeProjects.Add([string]$project)
            }
        }
    }

    [pscustomobject]@{
        forceFullBuild = $forceFullBuild
        detectedComponentNames = @($DetectedComponents | ForEach-Object { [string]$_.name })
        selectedComponentNames = $selectedNames
        effectiveComponentNames = @($effectiveComponents | ForEach-Object { [string]$_.name })
        nodeProjects = @($nodeProjects)
        requiresDotNetBuild = @($effectiveComponents | Where-Object { $_.requiresDotNetBuild -eq $true }).Count -gt 0
    }
}

$registryPath = Join-Path $RepoRoot 'eng\dev-rapid-deploy.components.json'
$registryComponents = Get-DbmRapidDeployRegistry -RegistryPath $registryPath
$gitPath = Resolve-DbmGitPath
$version = & (Join-Path $PSScriptRoot 'Get-DbmVersion.ps1') -AsJson | ConvertFrom-Json
$devConfigPath = Join-Path $RepoRoot 'azure\config\dev.json'

if (-not (Test-Path $devConfigPath)) {
    throw "Dev rapid deploy requires the tracked Dev baseline file: $devConfigPath"
}

$devConfig = Get-Content -Path $devConfigPath -Raw | ConvertFrom-Json
if ([string]$devConfig.environment -ne 'Dev') {
    throw "Dev rapid deploy expected azure/config/dev.json to declare environment 'Dev' but found '$($devConfig.environment)'."
}

$changedFiles = @(Get-DbmChangedFiles -GitPath $gitPath -RepoRoot $RepoRoot)
if ((-not $Components -or $Components.Count -eq 0) -and $changedFiles.Count -eq 0) {
    throw 'No local changes were detected relative to HEAD. Commit, edit files, or pass -Components to force a scoped Dev rapid deploy.'
}

$detectedComponents = @(Get-DbmMatchedComponents -RegistryComponents $registryComponents -ChangedFiles $changedFiles)
if ((-not $Components -or $Components.Count -eq 0) -and $detectedComponents.Count -eq 0) {
    $changedFileText = if ($changedFiles.Count -gt 0) { $changedFiles -join ', ' } else { 'none' }
    throw "No changed files matched the tracked Dev rapid deploy component registry. Changed files: $changedFileText"
}

$selectedComponents = Get-DbmSelectedComponents -RegistryComponents $registryComponents -DetectedComponents $detectedComponents -RequestedComponents $Components
$plan = Resolve-DbmRapidDeployPlan -RegistryComponents $registryComponents -DetectedComponents $detectedComponents -SelectedComponents $selectedComponents

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$runRoot = Join-Path $OutputRoot $timestamp
$packageRoot = Join-Path $runRoot 'dataverse'
$evidenceRoot = Join-Path $runRoot 'deployment-evidence'
$changedFilesPath = Join-Path $evidenceRoot 'changed-files.txt'
$planPath = Join-Path $evidenceRoot 'rapid-deploy-plan.json'
$summaryPath = Join-Path $evidenceRoot 'deployment-summary.json'

New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
Set-Content -Path $changedFilesPath -Value $changedFiles -Encoding UTF8

$planPayload = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    requestedComponents = @($Components | Select-Object -Unique)
    skipGeneratedMetadataDeployment = [bool]$SkipGeneratedMetadataDeployment
    detectedComponents = $plan.detectedComponentNames
    selectedComponents = $plan.selectedComponentNames
    effectiveComponents = $plan.effectiveComponentNames
    nodeProjects = $plan.nodeProjects
    requiresDotNetBuild = $plan.requiresDotNetBuild
    forceFullBuild = $plan.forceFullBuild
    changedFiles = $changedFiles
}
$planPayload | ConvertTo-Json -Depth 6 | Set-Content -Path $planPath -Encoding UTF8

& (Join-Path $PSScriptRoot 'Test-EnvironmentBaseline.ps1') `
    -EnvironmentName Dev `
    -OutputPath (Join-Path $evidenceRoot 'environment-baseline.json') | Out-Host

Write-Host "Detected components: $($plan.detectedComponentNames -join ', ')"
Write-Host "Selected components: $($plan.selectedComponentNames -join ', ')"
Write-Host "Effective build components: $($plan.effectiveComponentNames -join ', ')"

if ($plan.requiresDotNetBuild) {
    & (Join-Path $PSScriptRoot 'Restore-LegacyPackages.ps1') -RepoRoot $RepoRoot
    & (Join-Path $PSScriptRoot 'Build-DotNet.ps1') -RepoRoot $RepoRoot
}

if ($plan.nodeProjects.Count -gt 0) {
    & (Join-Path $PSScriptRoot 'Invoke-NodeBuild.ps1') -RepoRoot $RepoRoot -Projects $plan.nodeProjects
}

& (Join-Path $PSScriptRoot 'Invoke-DataversePackaging.ps1') `
    -RepoRoot $RepoRoot `
    -OutputRoot $packageRoot `
    -PackageSet UnmanagedOnly `
    -RunSolutionCheck:$false `
    -GenerateSettings:$false

$authListPath = Join-Path $evidenceRoot 'pac-auth-list.txt'
$pacAuthList = Invoke-DbmTextCommand -CommandPath (Resolve-DbmPacPath) -Arguments @('auth', 'list')
Set-Content -Path $authListPath -Value $pacAuthList.Output -Encoding UTF8

$pacProfileSelection = & (Join-Path $PSScriptRoot 'Use-DbmPacProfile.ps1') `
    -TargetEnvironment Dev `
    -DataverseUrl ([string]$devConfig.dataverseUrl) `
    -InteractiveLogin:$InteractiveLogin

if ($pacProfileSelection -and $pacProfileSelection.profileName) {
    Set-Content -Path (Join-Path $evidenceRoot 'pac-profile.txt') -Value ([string]$pacProfileSelection.profileName) -Encoding UTF8
}

& (Join-Path $PSScriptRoot 'Invoke-DataverseDeployment.ps1') `
    -TargetEnvironment Dev `
    -PackageRoot $packageRoot `
    -DataverseUrl ([string]$devConfig.dataverseUrl) `
    -SolutionName ([string]$version.solutionName) `
    -ExpectedSolutionVersion ([string]$version.solutionVersion) `
    -EvidenceRoot $evidenceRoot `
    -AllowSameVersionImport `
    -SkipGeneratedMetadataDeployment:$SkipGeneratedMetadataDeployment

& (Join-Path $PSScriptRoot 'Test-DataverseSmoke.ps1') `
    -TargetEnvironment Dev `
    -DataverseUrl ([string]$devConfig.dataverseUrl) `
    -SolutionName ([string]$version.solutionName) `
    -ExpectedSolutionVersion ([string]$version.solutionVersion) `
    -EvidenceRoot $evidenceRoot `
    -SkipGeneratedMetadataValidation:$SkipGeneratedMetadataDeployment

$currentBranch = (& $gitPath -C $RepoRoot branch --show-current | Select-Object -First 1).Trim()
$currentCommit = (& $gitPath -C $RepoRoot rev-parse HEAD | Select-Object -First 1).Trim()

$summary = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = 'Dev'
    dataverseUrl = [string]$devConfig.dataverseUrl
    gitBranch = $currentBranch
    gitCommit = $currentCommit
    requestedComponents = @($Components | Select-Object -Unique)
    detectedComponents = $plan.detectedComponentNames
    selectedComponents = $plan.selectedComponentNames
    effectiveComponents = $plan.effectiveComponentNames
    nodeProjectsBuilt = $plan.nodeProjects
    dotNetBuilt = $plan.requiresDotNetBuild
    forceFullBuild = $plan.forceFullBuild
    skipGeneratedMetadataDeployment = [bool]$SkipGeneratedMetadataDeployment
    expectedSolutionVersion = [string]$version.solutionVersion
    packageRoot = $packageRoot
    evidenceRoot = $evidenceRoot
}

$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host "Dev rapid deploy root: $runRoot"
Write-Host "Deployment evidence: $evidenceRoot"
