[CmdletBinding()]
param(
    [ValidateSet('Plan', 'ApplyDev', 'Readback', 'EmitSource', 'Diff')]
    [string]$Mode = 'Plan',

    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [string]$ModelPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'dbm-contract\fixtures\valid\generic-process-matrix\linear-service-fulfilment.model.json'),

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment = 'Dev',

    [string]$DataverseUrl,
    [string]$SnapshotPath,
    [string]$OutputPath,
    [string]$OutputRoot,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

function Resolve-DbmAbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$CandidatePath
    )

    if ([string]::IsNullOrWhiteSpace($CandidatePath)) {
        return $null
    }

    if ([System.IO.Path]::IsPathRooted($CandidatePath)) {
        return [System.IO.Path]::GetFullPath($CandidatePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $CandidatePath))
}

function Get-DbmDataverseAccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetDataverseUrl
    )

    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available on PATH to acquire a Dataverse Web API access token.'
    }

    $resource = $TargetDataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'. Run 'az login' and retry."
    }

    return $token.Trim()
}

$packageRoot = Join-Path $RepoRoot 'dbm-dataverse-synthesis'
if (-not (Test-Path $packageRoot)) {
    throw "DBM Dataverse synthesis package is missing: $packageRoot"
}

if (-not (Test-Path $ModelPath)) {
    throw "DBM model file is missing: $ModelPath"
}

if (-not $SkipBuild) {
    Push-Location $packageRoot
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "dbm-dataverse-synthesis build failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

$resolvedOutputPath = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    switch ($Mode) {
        'Plan' { Join-Path $RepoRoot 'artifacts\dataverse-synthesis\plan.json' }
        'ApplyDev' { Join-Path $RepoRoot 'artifacts\dataverse-synthesis\apply-report.json' }
        'Readback' { Join-Path $RepoRoot 'artifacts\dataverse-synthesis\readback-snapshot.json' }
        'Diff' { Join-Path $RepoRoot 'artifacts\dataverse-synthesis\drift-report.json' }
        default { $null }
    }
}
else {
    Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath $OutputPath
}

$resolvedOutputRoot = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    switch ($Mode) {
        'EmitSource' { Join-Path $RepoRoot 'power-platform\solutions\DynamicsBusinessMachineGeneratedMetadata\source' }
        default { $null }
    }
}
else {
    Resolve-DbmAbsolutePath -BasePath $RepoRoot -CandidatePath $OutputRoot
}

$nodeScript = Join-Path $packageRoot 'dist\src\cli.js'
if (-not (Test-Path $nodeScript)) {
    throw "DBM Dataverse synthesis CLI is missing after build: $nodeScript"
}

$command = switch ($Mode) {
    'Plan' { 'plan' }
    'ApplyDev' { 'apply-dev' }
    'Readback' { 'readback' }
    'EmitSource' { 'emit-source' }
    'Diff' { 'diff' }
}

$arguments = @($nodeScript, $command, '--model', (Resolve-Path $ModelPath).Path)

if ($resolvedOutputPath) {
    $arguments += @('--output', $resolvedOutputPath)
}

if ($resolvedOutputRoot) {
    $arguments += @('--output-root', $resolvedOutputRoot)

    if ($Mode -eq 'EmitSource') {
        $templateRoot = Join-Path $RepoRoot 'power-platform\solutions\DynamicsBusinessMachineGeneratedMetadata\template'
        $arguments += @('--template-root', $templateRoot)
    }
}

if ($Mode -in @('ApplyDev', 'Readback')) {
    if ([string]::IsNullOrWhiteSpace($DataverseUrl)) {
        $configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
        if (-not (Test-Path $configPath)) {
            throw "Tracked environment baseline file is missing: $configPath"
        }

        $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
        $DataverseUrl = [string]$config.dataverseUrl
    }

    if ([string]::IsNullOrWhiteSpace($DataverseUrl)) {
        throw 'DataverseUrl is required for ApplyDev and Readback modes.'
    }

    $arguments += @('--dataverse-url', $DataverseUrl.TrimEnd('/'))
    $env:DBM_DATAVERSE_ACCESS_TOKEN = Get-DbmDataverseAccessToken -TargetDataverseUrl $DataverseUrl
}

if ($Mode -eq 'Diff') {
    if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
        $SnapshotPath = Join-Path $RepoRoot 'artifacts\dataverse-synthesis\readback-snapshot.json'
    }

    if (-not (Test-Path $SnapshotPath)) {
        throw "Dataverse synthesis snapshot file is missing: $SnapshotPath"
    }

    $arguments += @('--snapshot', (Resolve-Path $SnapshotPath).Path)
}

Push-Location $packageRoot
try {
    node @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dbm-dataverse-synthesis CLI failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
    if ($Mode -in @('ApplyDev', 'Readback')) {
        Remove-Item Env:DBM_DATAVERSE_ACCESS_TOKEN -ErrorAction SilentlyContinue
    }
}

if ($resolvedOutputPath) {
    Write-Host "Dataverse synthesis output: $resolvedOutputPath"
}

if ($resolvedOutputRoot) {
    Write-Host "Dataverse synthesis source root: $resolvedOutputRoot"
}
