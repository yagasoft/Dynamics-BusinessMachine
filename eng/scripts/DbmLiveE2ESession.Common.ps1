[CmdletBinding()]
param()

Set-StrictMode -Version 3

function Get-DbmLiveSessionPaths {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment
    )

    $sessionDirectory = Join-Path $env:LOCALAPPDATA ("DBM\live-e2e\sessions\{0}" -f $TargetEnvironment.ToLowerInvariant())
    return [pscustomobject]@{
        Directory = $sessionDirectory
        ProtectedStatePath = Join-Path $sessionDirectory 'session-state.protected.bin'
        MetadataPath = Join-Path $sessionDirectory 'session-metadata.json'
    }
}

function Assert-DbmPersistedSessionConfig {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Config,

        [Parameter(Mandatory = $true)]
        [string]$TargetEnvironment
    )

    if ($null -eq $Config.liveE2E.authentication) {
        throw "Tracked live E2E configuration is missing '$TargetEnvironment.liveE2E.authentication'."
    }

    if ([string]$Config.liveE2E.authentication.mode -ne 'persisted-user-session') {
        throw "Tracked live E2E configuration must use '$TargetEnvironment.liveE2E.authentication.mode = persisted-user-session'."
    }

    if ([string]$Config.liveE2E.authentication.sessionScope -ne 'environment') {
        throw "Tracked live E2E configuration must use '$TargetEnvironment.liveE2E.authentication.sessionScope = environment'."
    }

    if ([string]$Config.liveE2E.authentication.identityModel -ne 'single-user-simulation') {
        throw "Tracked live E2E configuration must use '$TargetEnvironment.liveE2E.authentication.identityModel = single-user-simulation'."
    }

    if ([string]::IsNullOrWhiteSpace([string]$Config.liveE2E.authentication.sessionUserDisplayName)) {
        throw "Tracked live E2E configuration must declare '$TargetEnvironment.liveE2E.authentication.sessionUserDisplayName'."
    }
}

function Test-DbmLiveSessionMetadataShape {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Metadata,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$ModelDrivenAppUrl
    )

    $issues = @()

    if ([string]$Metadata.targetEnvironment -ne $TargetEnvironment) {
        $issues += "targetEnvironment must be '$TargetEnvironment'."
    }

    if ([string]$Metadata.authenticationMode -ne 'persisted-user-session') {
        $issues += "authenticationMode must be 'persisted-user-session'."
    }

    if ([string]$Metadata.sessionScope -ne 'environment') {
        $issues += "sessionScope must be 'environment'."
    }

    if ([string]$Metadata.identityModel -ne 'single-user-simulation') {
        $issues += "identityModel must be 'single-user-simulation'."
    }

    if ([string]$Metadata.physicalUserMode -ne 'single-user-simulation') {
        $issues += "physicalUserMode must be 'single-user-simulation'."
    }

    if ([string]::IsNullOrWhiteSpace([string]$Metadata.physicalUserDisplayName)) {
        $issues += 'physicalUserDisplayName is required.'
    }

    if ([string]$Metadata.modelDrivenAppUrl -ne $ModelDrivenAppUrl) {
        $issues += 'modelDrivenAppUrl does not match the tracked environment config.'
    }

    if (-not (Test-DbmIsoTimestamp -Value ([string]$Metadata.bootstrapUtc))) {
        $issues += 'bootstrapUtc must be a valid ISO-8601 timestamp.'
    }

    foreach ($optionalField in @('lastSuccessfulUseUtc', 'lastRefreshUtc', 'lastHealthCheckUtc')) {
        $value = [string]$Metadata.$optionalField
        if (-not [string]::IsNullOrWhiteSpace($value) -and -not (Test-DbmIsoTimestamp -Value $value)) {
            $issues += "$optionalField must be a valid ISO-8601 timestamp when present."
        }
    }

    if ([string]$Metadata.sessionHealthStatus -notin @('ready', 'healthy', 'expired', 'invalidated', 'bootstrap-required')) {
        $issues += "sessionHealthStatus '$([string]$Metadata.sessionHealthStatus)' is invalid."
    }

    return $issues
}

function Test-DbmIsoTimestamp {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    $parsed = [datetime]::MinValue
    return [datetime]::TryParse($Value, [ref]$parsed)
}

function Read-DbmLiveSessionMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MetadataPath
    )

    if (-not (Test-Path $MetadataPath)) {
        return $null
    }

    return Get-Content -Path $MetadataPath -Raw | ConvertFrom-Json
}

function Write-DbmLiveSessionMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MetadataPath,

        [Parameter(Mandatory = $true)]
        [object]$Metadata
    )

    $directory = Split-Path -Path $MetadataPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $Metadata | ConvertTo-Json -Depth 8 | Set-Content -Path $MetadataPath -Encoding UTF8
}

function Protect-DbmLiveSessionStateFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$ProtectedPath
    )

    Ensure-DbmProtectedDataType

    $bytes = [System.IO.File]::ReadAllBytes($SourcePath)
    $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
        $bytes,
        (Get-DbmLiveSessionEntropyBytes),
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    $directory = Split-Path -Path $ProtectedPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllBytes($ProtectedPath, $protectedBytes)
}

function Unprotect-DbmLiveSessionStateFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProtectedPath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    Ensure-DbmProtectedDataType

    $protectedBytes = [System.IO.File]::ReadAllBytes($ProtectedPath)
    $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $protectedBytes,
        (Get-DbmLiveSessionEntropyBytes),
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    $directory = Split-Path -Path $DestinationPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllBytes($DestinationPath, $bytes)
}

function Remove-DbmLiveSessionArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [object]$SessionPaths
    )

    foreach ($path in @($SessionPaths.ProtectedStatePath, $SessionPaths.MetadataPath)) {
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    if ((Test-Path $SessionPaths.Directory) -and -not (Get-ChildItem -Path $SessionPaths.Directory -Force | Select-Object -First 1)) {
        Remove-Item -LiteralPath $SessionPaths.Directory -Force
    }
}

function Test-DbmLiveSessionProtectionRoundTrip {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev', 'UAT')]
        [string]$TargetEnvironment
    )

    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("dbm-live-e2e-session-selftest-{0}-{1}" -f $TargetEnvironment.ToLowerInvariant(), [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root -Force | Out-Null

    $plainPath = Join-Path $root 'plain.json'
    $protectedPath = Join-Path $root 'session-state.protected.bin'
    $restoredPath = Join-Path $root 'restored.json'

    try {
        $payload = "{`"test`":`"$TargetEnvironment`",`"generatedUtc`":`"$(Get-Date).ToUniversalTime().ToString('o')`"}"
        [System.IO.File]::WriteAllText($plainPath, $payload, [System.Text.UTF8Encoding]::new($false))
        Protect-DbmLiveSessionStateFile -SourcePath $plainPath -ProtectedPath $protectedPath
        Unprotect-DbmLiveSessionStateFile -ProtectedPath $protectedPath -DestinationPath $restoredPath

        $restored = [System.IO.File]::ReadAllText($restoredPath)
        if ($restored -ne $payload) {
            throw "DPAPI round-trip produced different content for '$TargetEnvironment'."
        }
    }
    finally {
        if (Test-Path $root) {
            Remove-Item -LiteralPath $root -Recurse -Force
        }
    }
}

function Ensure-DbmProtectedDataType {
    if ('System.Security.Cryptography.ProtectedData' -as [type]) {
        return
    }

    foreach ($candidate in @(
        'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Security.dll',
        'C:\Windows\Microsoft.NET\Framework\v4.0.30319\System.Security.dll'
    )) {
        if (Test-Path $candidate) {
            Add-Type -Path $candidate
            break
        }
    }

    if (-not ('System.Security.Cryptography.ProtectedData' -as [type])) {
        throw 'Failed to load System.Security.Cryptography.ProtectedData for the persisted live E2E session store.'
    }
}

function Get-DbmLiveSessionEntropyBytes {
    return [System.Text.Encoding]::UTF8.GetBytes('DBM.LiveE2E.PersistedSession.v1')
}
