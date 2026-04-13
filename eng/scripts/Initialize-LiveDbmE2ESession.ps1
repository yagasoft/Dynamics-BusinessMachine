[CmdletBinding()]
param(
    [string]$RepoRoot,

    [ValidateSet('Dev', 'UAT')]
    [string]$TargetEnvironment = 'Dev',

    [string]$SessionUserDisplayName,

    [int]$TimeoutMinutes = 20,

    [switch]$ValidateOnly,
    [switch]$Reset
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

. (Join-Path $PSScriptRoot 'DbmLiveE2ESession.Common.ps1')

function Invoke-DbmNpmCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        Write-Host "Running 'npm $($Arguments -join ' ')' in $WorkingDirectory"
        & npm @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: npm $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-DbmTsxScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        $nodePath = (Get-Command node -ErrorAction Stop).Source
        $tsxCliPath = Join-Path $WorkingDirectory 'node_modules\tsx\dist\cli.mjs'
        if (-not (Test-Path $tsxCliPath)) {
            throw "TSX CLI entrypoint is missing: $tsxCliPath. Run 'npm ci' first."
        }

        Write-Host "Running 'tsx $ScriptPath $($Arguments -join ' ')' in $WorkingDirectory"
        & $nodePath $tsxCliPath $ScriptPath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: tsx $ScriptPath $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

$configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
Assert-DbmPersistedSessionConfig -Config $config -TargetEnvironment $TargetEnvironment

& (Join-Path $PSScriptRoot 'Test-EnvironmentBaseline.ps1') -RepoRoot $RepoRoot -EnvironmentName $TargetEnvironment | Out-Host
$sessionPaths = Get-DbmLiveSessionPaths -TargetEnvironment $TargetEnvironment
$resolvedDisplayName = if ([string]::IsNullOrWhiteSpace($SessionUserDisplayName)) {
    [string]$config.liveE2E.authentication.sessionUserDisplayName
}
else {
    $SessionUserDisplayName.Trim()
}

if ($Reset) {
    Remove-DbmLiveSessionArtifacts -SessionPaths $sessionPaths
    Write-Host "Removed persisted DBM live E2E session artifacts for '$TargetEnvironment' from '$($sessionPaths.Directory)'."
    if ($ValidateOnly) {
        return
    }

    return
}

Test-DbmLiveSessionProtectionRoundTrip -TargetEnvironment $TargetEnvironment

$livePackageRoot = Join-Path $RepoRoot 'dbm-live-e2e'
Invoke-DbmNpmCommand -WorkingDirectory $livePackageRoot -Arguments @('ci')
Invoke-DbmNpmCommand -WorkingDirectory $livePackageRoot -Arguments @('run', 'validate')
Invoke-DbmNpmCommand -WorkingDirectory $livePackageRoot -Arguments @('run', 'install:browsers')

if ($ValidateOnly) {
    Write-Host "Validated persisted-session bootstrap prerequisites for '$TargetEnvironment'."
    Write-Host "Expected session directory: $($sessionPaths.Directory)"
    return
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dbm-live-e2e-bootstrap-{0}-{1}" -f $TargetEnvironment.ToLowerInvariant(), [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
$plainSessionPath = Join-Path $tempRoot 'session-state.json'

try {
    Invoke-DbmTsxScript -WorkingDirectory $livePackageRoot -ScriptPath 'src/session-bootstrap.ts' -Arguments @(
        '--environment', $TargetEnvironment,
        '--modelDrivenAppUrl', ([string]$config.modelDrivenAppUrl),
        '--outputPath', $plainSessionPath,
        '--timeoutMinutes', $TimeoutMinutes
    )

    Protect-DbmLiveSessionStateFile -SourcePath $plainSessionPath -ProtectedPath $sessionPaths.ProtectedStatePath

    $metadata = [ordered]@{
        targetEnvironment = $TargetEnvironment
        authenticationMode = 'persisted-user-session'
        sessionScope = 'environment'
        identityModel = 'single-user-simulation'
        physicalUserMode = 'single-user-simulation'
        physicalUserDisplayName = $resolvedDisplayName
        modelDrivenAppUrl = [string]$config.modelDrivenAppUrl
        bootstrapUtc = (Get-Date).ToUniversalTime().ToString('o')
        lastSuccessfulUseUtc = (Get-Date).ToUniversalTime().ToString('o')
        lastRefreshUtc = (Get-Date).ToUniversalTime().ToString('o')
        lastHealthCheckUtc = (Get-Date).ToUniversalTime().ToString('o')
        sessionHealthStatus = 'ready'
        machineName = $env:COMPUTERNAME
        windowsUser = "$env:USERDOMAIN\$env:USERNAME"
    }

    Write-DbmLiveSessionMetadata -MetadataPath $sessionPaths.MetadataPath -Metadata $metadata
    Write-Host "Persisted DBM live E2E session initialized for '$TargetEnvironment'."
    Write-Host "Session metadata: $($sessionPaths.MetadataPath)"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
