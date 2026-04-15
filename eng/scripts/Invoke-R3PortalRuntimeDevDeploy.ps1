[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('Dev')]
    [string]$TargetEnvironment = 'Dev'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'PortalRuntimeDeployment.Common.ps1')

function Resolve-DbmExecutable {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    throw "Could not resolve any executable from: $($Names -join ', ')."
}

function Invoke-DbmLoggedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$LogPath
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    foreach ($argument in $Arguments) {
        [void]$psi.ArgumentList.Add($argument)
    }
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $combined = @(
        "COMMAND: $FilePath $($Arguments -join ' ')"
        "WORKDIR: $WorkingDirectory"
        ''
        $stdout.TrimEnd()
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            ''
            '[stderr]'
            $stderr.TrimEnd()
        }
    ) -join [Environment]::NewLine

    [System.IO.File]::WriteAllText($LogPath, $combined, [System.Text.UTF8Encoding]::new($false))

    if ($stdout) {
        $stdout.TrimEnd() | Out-Host
    }
    if ($stderr) {
        $stderr.TrimEnd() | Out-Host
    }

    if ($process.ExitCode -ne 0) {
        throw "Command failed with exit code $($process.ExitCode): $FilePath $($Arguments -join ' ')"
    }
}

function Invoke-DbmStepCommands {
    param(
        [Parameter(Mandatory = $true)]
        [int]$StepNumber,

        [Parameter(Mandatory = $true)]
        [string]$StepName,

        [Parameter(Mandatory = $true)]
        [object[]]$Commands,

        [Parameter(Mandatory = $true)]
        [string]$EvidenceRoot,

        [Parameter(Mandatory = $true)]
        [System.Collections.ArrayList]$StepResults
    )

    $stepFolder = Join-Path $EvidenceRoot ("{0:D2}-{1}" -f $StepNumber, ($StepName -replace '[^A-Za-z0-9-]+', '-'))
    New-Item -ItemType Directory -Path $stepFolder -Force | Out-Null

    $startUtc = (Get-Date).ToUniversalTime()
    $status = 'passed'
    $failureMessage = $null

    try {
        $commandIndex = 1
        foreach ($command in $Commands) {
            $logPath = Join-Path $stepFolder ("command-{0:D2}.log" -f $commandIndex)
            Invoke-DbmLoggedProcess `
                -FilePath $command.filePath `
                -Arguments $command.arguments `
                -WorkingDirectory $command.workingDirectory `
                -LogPath $logPath
            $commandIndex += 1
        }
    }
    catch {
        $status = 'failed'
        $failureMessage = $_.Exception.Message
        throw
    }
    finally {
        $StepResults.Add([pscustomobject]@{
            stepNumber = $StepNumber
            stepName = $StepName
            status = $status
            startedUtc = $startUtc.ToString('o')
            completedUtc = (Get-Date).ToUniversalTime().ToString('o')
            stepFolder = $stepFolder
            failureMessage = $failureMessage
        }) | Out-Null
    }
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$evidenceRoot = Join-Path $resolvedRepoRoot ("artifacts\r3-portal-runtime-dev-deploy\{0}" -f $timestamp)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$packageRoot = Join-Path $evidenceRoot 'dataverse-package'
$powerShellExe = Resolve-DbmExecutable -Names @('pwsh', 'powershell')
$npmExe = Resolve-DbmExecutable -Names @('npm')
$nugetExe = Resolve-DbmExecutable -Names @('nuget')
$msbuildExe = Resolve-DbmExecutable -Names @('msbuild')

$stepResults = New-Object System.Collections.ArrayList

try {
    Invoke-DbmStepCommands -StepNumber 1 -StepName 'dbm-contract-build-and-validate' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $npmExe
            arguments = @('run', 'build')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-contract'
        },
        @{
            filePath = $npmExe
            arguments = @('run', 'validate')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-contract'
        }
    )

    Invoke-DbmStepCommands -StepNumber 2 -StepName 'dbm-process-experience-test-and-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $npmExe
            arguments = @('test')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-process-experience'
        },
        @{
            filePath = $npmExe
            arguments = @('run', 'build')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-process-experience'
        }
    )

    Invoke-DbmStepCommands -StepNumber 3 -StepName 'dbm-portal-runtime-test-and-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $npmExe
            arguments = @('test')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-portal-runtime'
        },
        @{
            filePath = $npmExe
            arguments = @('run', 'build')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-portal-runtime'
        }
    )

    Invoke-DbmStepCommands -StepNumber 4 -StepName 'dbm-dataverse-synthesis-test-and-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $npmExe
            arguments = @('test')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-dataverse-synthesis'
        },
        @{
            filePath = $npmExe
            arguments = @('run', 'build')
            workingDirectory = Join-Path $resolvedRepoRoot 'dbm-dataverse-synthesis'
        }
    )

    Invoke-DbmStepCommands -StepNumber 5 -StepName 'nuget-restore' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $nugetExe
            arguments = @('restore', '.\DbmSolution\DbmSolution.sln')
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 6 -StepName 'plugin-release-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $msbuildExe
            arguments = @('.\DbmSolution\Plugins\Plugins.csproj', '/p:Configuration=Release', '/p:DbmSignAssembly=false')
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 7 -StepName 'dataverse-packaging' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $powerShellExe
            arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-DataversePackaging.ps1'), '-RepoRoot', $resolvedRepoRoot, '-OutputRoot', $packageRoot, '-PackageSet', 'UnmanagedOnly', '-RunSolutionCheck:$false', '-GenerateSettings:$false')
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 8 -StepName 'dataverse-deployment' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $powerShellExe
            arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-DataverseDeployment.ps1'), '-TargetEnvironment', $TargetEnvironment, '-PackageRoot', $packageRoot, '-DataverseUrl', $dataverseUrl, '-EvidenceRoot', (Join-Path $evidenceRoot 'dataverse-deployment'))
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 9 -StepName 'portal-runtime-deployment' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $powerShellExe
            arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-PortalRuntimeDeployment.ps1'), '-RepoRoot', $resolvedRepoRoot, '-TargetEnvironment', $TargetEnvironment, '-EvidenceRoot', (Join-Path $evidenceRoot 'portal-runtime-deployment'))
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 10 -StepName 'portal-runtime-plugin-steps' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $powerShellExe
            arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Sync-DbmPortalRuntimePluginSteps.ps1'), '-RepoRoot', $resolvedRepoRoot, '-TargetEnvironment', $TargetEnvironment, '-EvidenceRoot', (Join-Path $evidenceRoot 'portal-runtime-plugin-steps'))
            workingDirectory = $resolvedRepoRoot
        }
    )

    Invoke-DbmStepCommands -StepNumber 11 -StepName 'portal-runtime-dev-smoke' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{
            filePath = $powerShellExe
            arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Test-R3PortalRuntimeDevSmoke.ps1'), '-RepoRoot', $resolvedRepoRoot, '-TargetEnvironment', $TargetEnvironment, '-EvidenceRoot', (Join-Path $evidenceRoot 'portal-runtime-dev-smoke'))
            workingDirectory = $resolvedRepoRoot
        }
    )

    $status = 'passed'
}
catch {
    $status = 'failed'
    throw
}
finally {
    $manifest = New-DbmR3PortalRuntimeEvidenceManifest -TargetEnvironment $TargetEnvironment -Status $status -EvidenceRoot $evidenceRoot -Steps @($stepResults)
    $manifestPath = Join-Path $evidenceRoot 'deploy-manifest.json'
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding UTF8
    Write-Host "R3 portal runtime Dev deployment evidence: $manifestPath"
}
