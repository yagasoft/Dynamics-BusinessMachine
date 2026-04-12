[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$EnvironmentName,

    [string]$Ref = $env:GITHUB_REF
)

if ([string]::IsNullOrWhiteSpace($Ref)) {
    throw 'No Git reference was provided. Set GITHUB_REF or pass -Ref explicitly.'
}

$allowed = switch ($EnvironmentName) {
    'Dev' {
        $Ref -eq 'refs/heads/main' -or
        $Ref.StartsWith('refs/heads/release/') -or
        $Ref.StartsWith('refs/heads/hotfix/')
    }
    'UAT' {
        $Ref.StartsWith('refs/heads/release/') -or
        $Ref.StartsWith('refs/heads/hotfix/') -or
        ($Ref.StartsWith('refs/tags/v') -and $Ref.Length -gt 'refs/tags/v'.Length)
    }
    'Prod' {
        $Ref.StartsWith('refs/heads/hotfix/') -or
        ($Ref.StartsWith('refs/tags/v') -and $Ref.Length -gt 'refs/tags/v'.Length)
    }
    default {
        $false
    }
}

if (-not $allowed) {
    throw "Git reference '$Ref' is not allowed to deploy to '$EnvironmentName'."
}

Write-Host "Git reference '$Ref' is allowed for '$EnvironmentName'."
