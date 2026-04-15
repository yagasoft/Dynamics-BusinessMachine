[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('Dev')]
    [string]$TargetEnvironment = 'Dev',
    [string]$AssemblyKeyFile
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

function ConvertTo-DbmProcessArgumentString {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    return (@(
        foreach ($argument in $Arguments) {
            $value = [string]$argument
            if ($value -match '[\s"]') {
                '"' + (($value -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
            }
            else {
                $value
            }
        }
    ) -join ' ')
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

    $argumentString = ConvertTo-DbmProcessArgumentString -Arguments $Arguments
    $logDirectory = Split-Path -Path $LogPath -Parent
    $logBaseName = [System.IO.Path]::GetFileNameWithoutExtension($LogPath)
    $stdoutPath = Join-Path $logDirectory "$logBaseName.stdout.log"
    $stderrPath = Join-Path $logDirectory "$logBaseName.stderr.log"

    $header = @(
        "COMMAND: $FilePath $($Arguments -join ' ')"
        "WORKDIR: $WorkingDirectory"
        "STDOUT: $stdoutPath"
        "STDERR: $stderrPath"
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText($LogPath, $header + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $argumentString `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -NoNewWindow `
        -Wait `
        -PassThru

    if ($process.ExitCode -ne 0) {
        $stderrTail = if (Test-Path $stderrPath) {
            @((Get-Content -Path $stderrPath -Tail 60) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        }
        else {
            @()
        }

        $stdoutTail = if (Test-Path $stdoutPath) {
            @((Get-Content -Path $stdoutPath -Tail 30) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        }
        else {
            @()
        }

        $tail = if ($stderrTail.Count -gt 0) { $stderrTail } else { $stdoutTail }
        $tailText = if ($tail.Count -gt 0) { [Environment]::NewLine + ($tail -join [Environment]::NewLine) } else { '' }
        throw "Command failed with exit code $($process.ExitCode): $FilePath $($Arguments -join ' ')$tailText"
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
        [AllowEmptyCollection()]
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

function Start-DbmLocalProofHost {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeExe,

        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,

        [Parameter(Mandatory = $true)]
        [string]$EvidenceRoot
    )

    $existing = @(Find-DbmPortalRuntimeLocalProofProcesses -RepoRoot $RepoRoot -CurrentProcessId $PID)
    if ($existing.Count -gt 0) {
        $details = @($existing | ForEach-Object { "$([int]$_.processId): $([string]$_.commandLine)" })
        throw "A local portal runtime proof host is already running for this repo. Stop it before rerunning.`n$($details -join [Environment]::NewLine)"
    }

    $stepFolder = Join-Path $EvidenceRoot '10-local-proof-host'
    New-Item -ItemType Directory -Path $stepFolder -Force | Out-Null
    $stdoutPath = Join-Path $stepFolder 'host.stdout.log'
    $stderrPath = Join-Path $stepFolder 'host.stderr.log'
    $commandPath = Join-Path $RepoRoot 'dbm-portal-runtime\dist\src\server-entry.js'
    $argumentString = ConvertTo-DbmProcessArgumentString -Arguments @(
        $commandPath,
        '--repo-root', $RepoRoot,
        '--host', '127.0.0.1',
        '--port', '4173'
    )

    $process = Start-Process `
        -FilePath $NodeExe `
        -ArgumentList $argumentString `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -NoNewWindow `
        -PassThru

    $health = Wait-DbmPortalRuntimeLocalProofHealth -BaseUrl 'http://127.0.0.1:4173'
    return [pscustomobject]@{
        Process = $process
        Health = $health
        StepFolder = $stepFolder
        StdoutPath = $stdoutPath
        StderrPath = $stderrPath
        BaseUrl = 'http://127.0.0.1:4173'
    }
}

$resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$evidenceRoot = Join-Path $resolvedRepoRoot ("artifacts\r3-portal-runtime-local-proof\{0}" -f $timestamp)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$assemblyKey = & (Join-Path $resolvedRepoRoot 'eng\scripts\Resolve-DbmAssemblyKeyFile.ps1') `
    -AssemblyKeyFile $AssemblyKeyFile `
    -Required `
    -Purpose 'R3 local portal runtime proof Dataverse packaging'
$resolvedAssemblyKeyFile = [string]$assemblyKey.path

$configRecord = Get-DbmPortalRuntimeConfig -RepoRoot $resolvedRepoRoot -TargetEnvironment $TargetEnvironment
$dataverseUrl = [string]$configRecord.Value.dataverseUrl
$packageRoot = Join-Path $evidenceRoot 'dataverse-package'
$powerShellExe = Resolve-DbmExecutable -Names @('pwsh', 'powershell')
$nodeExe = Resolve-DbmExecutable -Names @('node')
$npmExe = Resolve-DbmExecutable -Names @('npm')
$nugetExe = Resolve-DbmExecutable -Names @('nuget')
$dataversePackagingScriptPath = Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-DataversePackaging.ps1'
$escapedDataversePackagingScriptPath = $dataversePackagingScriptPath.Replace("'", "''")
$escapedResolvedRepoRoot = $resolvedRepoRoot.Replace("'", "''")
$escapedPackageRoot = $packageRoot.Replace("'", "''")
$dataversePackagingCommand = "& { & '$escapedDataversePackagingScriptPath' -RepoRoot '$escapedResolvedRepoRoot' -OutputRoot '$escapedPackageRoot' -PackageSet 'UnmanagedOnly' -RunSolutionCheck:`$false -GenerateSettings:`$false }"

$stepResults = New-Object System.Collections.ArrayList
$localHost = $null
$status = 'failed'
$manifestMetadata = $null

try {
    Invoke-DbmStepCommands -StepNumber 1 -StepName 'dbm-contract-build-and-validate' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $npmExe; arguments = @('run', 'build'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-contract' },
        @{ filePath = $npmExe; arguments = @('run', 'validate'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-contract' }
    )

    Invoke-DbmStepCommands -StepNumber 2 -StepName 'dbm-process-experience-test-build-and-visual' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $npmExe; arguments = @('test'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-process-experience' },
        @{ filePath = $npmExe; arguments = @('run', 'build'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-process-experience' },
        @{ filePath = $npmExe; arguments = @('run', 'test:visual'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-process-experience' }
    )

    Invoke-DbmStepCommands -StepNumber 3 -StepName 'dbm-portal-runtime-test-and-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $npmExe; arguments = @('test'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-portal-runtime' },
        @{ filePath = $npmExe; arguments = @('run', 'build'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-portal-runtime' }
    )

    Invoke-DbmStepCommands -StepNumber 4 -StepName 'dbm-dataverse-synthesis-test-and-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $npmExe; arguments = @('test'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-dataverse-synthesis' },
        @{ filePath = $npmExe; arguments = @('run', 'build'); workingDirectory = Join-Path $resolvedRepoRoot 'dbm-dataverse-synthesis' }
    )

    Invoke-DbmStepCommands -StepNumber 5 -StepName 'nuget-restore' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $nugetExe; arguments = @('restore', '.\DbmSolution\DbmSolution.sln'); workingDirectory = $resolvedRepoRoot }
    )

    Invoke-DbmStepCommands -StepNumber 6 -StepName 'signed-legacy-dataverse-build' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $powerShellExe; arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Build-DotNet.ps1'), '-RepoRoot', $resolvedRepoRoot, '-Configuration', 'Release', '-EnableLegacyPackaging', '-AssemblyKeyFile', $resolvedAssemblyKeyFile); workingDirectory = $resolvedRepoRoot }
    )

    Invoke-DbmStepCommands -StepNumber 7 -StepName 'dataverse-packaging' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $powerShellExe; arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $dataversePackagingCommand); workingDirectory = $resolvedRepoRoot }
    )

    Invoke-DbmStepCommands -StepNumber 8 -StepName 'dataverse-deployment' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $powerShellExe; arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Invoke-DataverseDeployment.ps1'), '-TargetEnvironment', $TargetEnvironment, '-PackageRoot', $packageRoot, '-DataverseUrl', $dataverseUrl, '-EvidenceRoot', (Join-Path $evidenceRoot 'dataverse-deployment'), '-AllowSameVersionImport', '-AllowSolutionReplaceOnPluginIdentityChange'); workingDirectory = $resolvedRepoRoot }
    )

    Invoke-DbmStepCommands -StepNumber 9 -StepName 'portal-runtime-plugin-steps' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $powerShellExe; arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Sync-DbmPortalRuntimePluginSteps.ps1'), '-RepoRoot', $resolvedRepoRoot, '-TargetEnvironment', $TargetEnvironment, '-EvidenceRoot', (Join-Path $evidenceRoot 'portal-runtime-plugin-steps')); workingDirectory = $resolvedRepoRoot }
    )

    $hostStartUtc = (Get-Date).ToUniversalTime()
    $localHost = Start-DbmLocalProofHost -NodeExe $nodeExe -RepoRoot $resolvedRepoRoot -EvidenceRoot $evidenceRoot
    $stepResults.Add([pscustomobject]@{
        stepNumber = 10
        stepName = 'local-proof-host'
        status = 'passed'
        startedUtc = $hostStartUtc.ToString('o')
        completedUtc = (Get-Date).ToUniversalTime().ToString('o')
        stepFolder = $localHost.StepFolder
        failureMessage = $null
        pid = [int]$localHost.Process.Id
        baseUrl = $localHost.BaseUrl
    }) | Out-Null

    Invoke-DbmStepCommands -StepNumber 11 -StepName 'local-spa-smoke' -EvidenceRoot $evidenceRoot -StepResults $stepResults -Commands @(
        @{ filePath = $powerShellExe; arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $resolvedRepoRoot 'eng\scripts\Test-R3PortalRuntimeLocalSmoke.ps1'), '-RepoRoot', $resolvedRepoRoot, '-TargetEnvironment', $TargetEnvironment, '-EvidenceRoot', (Join-Path $evidenceRoot 'local-smoke'), '-BaseUrl', $localHost.BaseUrl); workingDirectory = $resolvedRepoRoot }
    )

    $manifestMetadata = [ordered]@{
        dataverseUrl = $dataverseUrl
        assemblyKeySource = [string]$assemblyKey.source
        localProofHost = [ordered]@{
            baseUrl = $localHost.BaseUrl
            pid = [int]$localHost.Process.Id
            health = $localHost.Health
        }
    }
    $status = 'passed'
}
catch {
    if ($null -ne $localHost -and $null -ne $localHost.Process -and -not $localHost.Process.HasExited) {
        Stop-Process -Id $localHost.Process.Id -Force -ErrorAction SilentlyContinue
    }
    throw
}
finally {
    $manifest = New-DbmR3PortalRuntimeEvidenceManifest -TargetEnvironment $TargetEnvironment -Status $status -EvidenceRoot $evidenceRoot -Steps @($stepResults) -Metadata $manifestMetadata
    $manifestPath = Join-Path $evidenceRoot 'local-proof-manifest.json'
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding UTF8
    Write-Host "R3 local portal runtime proof evidence: $manifestPath"
}
