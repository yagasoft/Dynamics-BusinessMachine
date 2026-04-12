[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$DataverseUrl,

    [switch]$InteractiveLogin
)

$ErrorActionPreference = 'Stop'

if ($env:GITHUB_ACTIONS -eq 'true') {
    return [pscustomobject]@{
        mode = 'github-actions'
        profileName = $null
        dataverseUrl = $DataverseUrl
    }
}

$pac = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pac) {
    throw 'pac must be available on PATH to select a local PAC profile.'
}

$defaultProfiles = @{
    Dev = 'dbm-dev'
    UAT = 'dbm-uat'
    Prod = 'dbm-prod'
}

$profileName = $defaultProfiles[$TargetEnvironment]

function Invoke-DbmPacTextCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $pac.Source @Arguments 2>&1

    [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = ($output | Out-String).Trim()
    }
}

function Test-DbmPacProfileAccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProfileName,

        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl
    )

    $selectResult = Invoke-DbmPacTextCommand -Arguments @('auth', 'select', '--name', $ProfileName)
    if ($selectResult.ExitCode -ne 0) {
        return [pscustomobject]@{
            Success = $false
            Phase = 'select'
            Message = $selectResult.Output
        }
    }

    $whoResult = Invoke-DbmPacTextCommand -Arguments @('org', 'who', '--environment', $DataverseUrl)
    if ($whoResult.ExitCode -ne 0) {
        return [pscustomobject]@{
            Success = $false
            Phase = 'who'
            Message = $whoResult.Output
        }
    }

    return [pscustomobject]@{
        Success = $true
        Phase = 'who'
        Message = $whoResult.Output
    }
}

$access = Test-DbmPacProfileAccess -ProfileName $profileName -DataverseUrl $DataverseUrl
if (-not $access.Success) {
    if (-not $InteractiveLogin) {
        if ($access.Phase -eq 'select') {
            throw "Local PAC profile '$profileName' was not found. Create it with 'pac auth create --name $profileName --deviceCode --environment $DataverseUrl'."
        }

        throw "Local PAC profile '$profileName' could not access '$DataverseUrl'. Re-authenticate with 'pac auth delete --name $profileName' followed by 'pac auth create --name $profileName --deviceCode --environment $DataverseUrl', or re-run with -InteractiveLogin."
    }

    if ($access.Phase -eq 'who') {
        & $pac.Source auth delete --name $profileName | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to delete local PAC profile '$profileName' before re-authentication."
        }
    }

    & $pac.Source auth create --name $profileName --deviceCode --environment $DataverseUrl | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "pac auth create failed for local profile '$profileName'."
    }

    $access = Test-DbmPacProfileAccess -ProfileName $profileName -DataverseUrl $DataverseUrl
    if (-not $access.Success) {
        throw "Local PAC profile '$profileName' still could not access '$DataverseUrl' after interactive login.`n$($access.Message)"
    }
}

Write-Host "Using local PAC profile '$profileName' for '$TargetEnvironment'."

[pscustomobject]@{
    mode = 'local-profile'
    profileName = $profileName
    dataverseUrl = $DataverseUrl
}
