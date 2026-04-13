[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [ValidateSet('Dev', 'UAT', 'Prod')]
    [string]$TargetEnvironment = 'Dev',

    [string]$DataverseUrl,
    [string]$AppUniqueName = 'ys_YSCommon',
    [string]$DesignerWebResourceName = 'ys_/dbm/apps/editor/index.html',
    [string]$AreaTitle = 'Dynamics Business Machine',
    [string]$GroupTitle = 'Apps',
    [string]$SubAreaTitle = 'DBM App',
    [switch]$Open,
    [switch]$AsJson,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

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

function Invoke-DbmDataverseGet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken
    )

    $headers = @{
        Authorization = "Bearer $AccessToken"
        Accept = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    }

    return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
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
    throw 'DataverseUrl is required.'
}

$normalizedDataverseUrl = $DataverseUrl.TrimEnd('/')
$accessToken = Get-DbmDataverseAccessToken -TargetDataverseUrl $normalizedDataverseUrl
$appFilter = [System.Uri]::EscapeDataString("uniquename eq '$($AppUniqueName.Replace("'", "''"))'")
$appUri = "$normalizedDataverseUrl/api/data/v9.2/appmodules?`$select=appmoduleid,uniquename,name&`$filter=$appFilter"
$appResponse = Invoke-DbmDataverseGet -Uri $appUri -AccessToken $accessToken
$appModule = @($appResponse.value | Select-Object -First 1)[0]

if (-not $appModule) {
    throw "Could not find Dataverse app module '$AppUniqueName' in '$TargetEnvironment'."
}

$resourceFilter = [System.Uri]::EscapeDataString("name eq '$($DesignerWebResourceName.Replace("'", "''"))'")
$resourceUri = "$normalizedDataverseUrl/api/data/v9.2/webresourceset?`$select=webresourceid,name,displayname&`$filter=$resourceFilter"
$resourceResponse = Invoke-DbmDataverseGet -Uri $resourceUri -AccessToken $accessToken
$designerWebResource = @($resourceResponse.value | Select-Object -First 1)[0]

if (-not $designerWebResource) {
    throw "Could not find designer web resource '$DesignerWebResourceName' in '$TargetEnvironment'."
}

$designerUrl = '{0}/main.aspx?appid={1}&pagetype=webresource&webresourceName={2}' -f $normalizedDataverseUrl, $appModule.appmoduleid, [System.Uri]::EscapeDataString($DesignerWebResourceName)

$result = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetEnvironment = $TargetEnvironment
    dataverseUrl = $normalizedDataverseUrl
    appModule = [ordered]@{
        uniqueName = [string]$appModule.uniquename
        appModuleId = [string]$appModule.appmoduleid
        name = [string]$appModule.name
    }
    navigation = [ordered]@{
        areaTitle = $AreaTitle
        groupTitle = $GroupTitle
        subAreaTitle = $SubAreaTitle
    }
    designerWebResource = [ordered]@{
        name = [string]$designerWebResource.name
        webResourceId = [string]$designerWebResource.webresourceid
        displayName = [string]$designerWebResource.displayname
    }
    designerUrl = $designerUrl
}

if ($Open) {
    Start-Process $designerUrl
}

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputDirectory = Split-Path -Path $OutputPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $result | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8
    Write-Host "Designer host context: $OutputPath"
}

if ($AsJson) {
    $result | ConvertTo-Json -Depth 6
    return
}

$result.GetEnumerator() | ForEach-Object {
    if ($_.Value -is [System.Collections.IDictionary]) {
        foreach ($entry in $_.Value.GetEnumerator()) {
            "$($_.Key).$($entry.Key)=$($entry.Value)"
        }
    }
    else {
        "$($_.Key)=$($_.Value)"
    }
}
