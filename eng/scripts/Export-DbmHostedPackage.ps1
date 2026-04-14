[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment,

    [Parameter(Mandatory = $true)]
    [string]$PackageName,

    [string]$DataverseUrl,
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $RepoRoot "artifacts\designer-packages\$PackageName"
}

if ([string]::IsNullOrWhiteSpace($DataverseUrl)) {
    $configPath = Join-Path $RepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    if (-not (Test-Path $configPath)) {
        throw "Tracked environment baseline file is missing: $configPath"
    }

    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    $DataverseUrl = [string]$config.dataverseUrl
}

if ([string]::IsNullOrWhiteSpace($DataverseUrl)) {
    throw 'DataverseUrl is required to export a hosted DBM package.'
}

function Get-DbmDataverseAccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetDataverseUrl
    )

    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available on PATH to export a hosted DBM package.'
    }

    $resource = $TargetDataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'. Run 'az login' and retry."
    }

    return $token.Trim()
}

function Invoke-DbmDataverseRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $headers = @{
        Authorization     = "Bearer $AccessToken"
        Accept            = 'application/json'
        'OData-Version'   = '4.0'
        'OData-MaxVersion' = '4.0'
    }

    return Invoke-RestMethod -Method GET -Uri $Uri -Headers $headers
}

function ConvertFrom-DbmWebResourceContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Content))
}

function Write-DbmUtf8FileNoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    $normalizedContent = if ($Content.Length -gt 0 -and $Content[0] -eq [char]0xFEFF) {
        $Content.Substring(1)
    }
    else {
        $Content
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $normalizedContent, $utf8NoBom)
}

$normalizedDataverseUrl = $DataverseUrl.TrimEnd('/')
$accessToken = Get-DbmDataverseAccessToken -TargetDataverseUrl $normalizedDataverseUrl

$modelResourceName = "ys_/dbm/data/models/$PackageName.json"
$workspaceResourceName = "ys_/dbm/data/models/$PackageName.workspace.json"
$escapedModelResourceName = $modelResourceName.Replace("'", "''")
$escapedWorkspaceResourceName = $workspaceResourceName.Replace("'", "''")
$filter = "name eq '$escapedModelResourceName' or name eq '$escapedWorkspaceResourceName'"
$uri = "$normalizedDataverseUrl/api/data/v9.2/webresourceset?`$select=webresourceid,name,content,modifiedon&`$filter=$([System.Uri]::EscapeDataString($filter))"
$response = Invoke-DbmDataverseRequest -Uri $uri -AccessToken $accessToken

$resources = @($response.value)
$modelResource = $resources | Where-Object { [string]$_.name -eq $modelResourceName } | Select-Object -First 1
if (-not $modelResource) {
    throw "Could not find hosted DBM model web resource '$modelResourceName' in '$TargetEnvironment'."
}

$workspaceResource = $resources | Where-Object { [string]$_.name -eq $workspaceResourceName } | Select-Object -First 1

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$modelOutputPath = Join-Path $OutputRoot "$PackageName.json"
$workspaceOutputPath = Join-Path $OutputRoot "$PackageName.workspace.json"
$manifestOutputPath = Join-Path $OutputRoot 'export-manifest.json'

Write-DbmUtf8FileNoBom -Path $modelOutputPath -Content (ConvertFrom-DbmWebResourceContent -Content ([string]$modelResource.content))
if ($workspaceResource) {
    Write-DbmUtf8FileNoBom -Path $workspaceOutputPath -Content (ConvertFrom-DbmWebResourceContent -Content ([string]$workspaceResource.content))
}

$manifest = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $normalizedDataverseUrl
    packageName = $PackageName
    modelResourceName = $modelResourceName
    workspaceResourceName = if ($workspaceResource) { $workspaceResourceName } else { $null }
    output = [ordered]@{
        model = $modelOutputPath
        workspace = if ($workspaceResource) { $workspaceOutputPath } else { $null }
    }
}

Write-DbmUtf8FileNoBom -Path $manifestOutputPath -Content ($manifest | ConvertTo-Json -Depth 5)

Write-Host "Exported hosted DBM package '$PackageName' from '$TargetEnvironment'."
Write-Host "Model path: $modelOutputPath"
if ($workspaceResource) {
    Write-Host "Workspace path: $workspaceOutputPath"
}
Write-Host "Manifest: $manifestOutputPath"
