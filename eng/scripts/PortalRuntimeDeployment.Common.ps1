Set-StrictMode -Version 3

try {
    Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
}
catch {
    if ([string]$_.Exception.Message -notmatch 'already loaded') {
        throw
    }
}

function Get-DbmPortalRuntimeRepoRoot {
    param(
        [string]$RepoRoot
    )

    if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    }

    return (Resolve-Path $RepoRoot).Path
}

function Resolve-DbmAbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$CandidatePath
    )

    if ([System.IO.Path]::IsPathRooted($CandidatePath)) {
        return [System.IO.Path]::GetFullPath($CandidatePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $CandidatePath))
}

function Read-DbmJsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        throw "JSON file is missing: $Path"
    }

    return Get-Content -Path $Path -Raw | ConvertFrom-Json
}

function Get-DbmPortalRuntimePlan {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [string]$PlanPath = 'power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/source/dbm-generated-metadata.plan.json'
    )

    $resolvedPlanPath = Resolve-DbmAbsolutePath -BasePath (Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot) -CandidatePath $PlanPath
    $plan = Read-DbmJsonFile -Path $resolvedPlanPath
    if ($null -eq $plan.portalRuntime -or $null -eq $plan.portalRuntime.bootstrap -or $null -eq $plan.portalRuntime.processExperienceRuntime) {
        throw "Generated metadata plan '$resolvedPlanPath' is missing portalRuntime bootstrap/runtime content."
    }

    return [pscustomobject]@{
        Path = $resolvedPlanPath
        Value = $plan.portalRuntime
    }
}

function Get-DbmPortalRuntimeConfig {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),
        [ValidateSet('Dev')]
        [string]$TargetEnvironment = 'Dev'
    )

    $resolvedRepoRoot = Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot
    $configPath = Join-Path $resolvedRepoRoot ("azure\config\{0}.json" -f $TargetEnvironment.ToLowerInvariant())
    $config = Read-DbmJsonFile -Path $configPath

    if ([string]::IsNullOrWhiteSpace([string]$config.dataverseUrl)) {
        throw "Environment config '$configPath' is missing dataverseUrl."
    }

    return [pscustomobject]@{
        Path = $configPath
        Value = $config
    }
}

function Get-DbmDataverseApiBaseUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl
    )

    return "$($DataverseUrl.TrimEnd('/'))/api/data/v9.2"
}

function Get-DbmDataverseAccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl
    )

    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw 'Azure CLI must be available to validate or run the local portal runtime proof.'
    }

    $resource = $DataverseUrl.TrimEnd('/')
    $token = & $az.Source account get-access-token --resource $resource --query accessToken -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Failed to acquire a Dataverse access token for '$resource'."
    }

    return $token.Trim()
}

function Merge-DbmHashtable {
    param(
        [hashtable]$Base,
        [hashtable]$Overlay
    )

    $merged = @{}
    foreach ($source in @($Base, $Overlay)) {
        if ($null -eq $source) {
            continue
        }

        foreach ($key in $source.Keys) {
            $merged[$key] = $source[$key]
        }
    }

    return $merged
}

function Get-DbmPortalRuntimeRequestTimeoutSeconds {
    param(
        [int]$RequestedTimeoutSeconds
    )

    if ($PSBoundParameters.ContainsKey('RequestedTimeoutSeconds') -and $RequestedTimeoutSeconds -gt 0) {
        return $RequestedTimeoutSeconds
    }

    $envValue = [System.Environment]::GetEnvironmentVariable('DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS')
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        $parsedValue = 0
        if (-not [int]::TryParse($envValue, [ref]$parsedValue) -or $parsedValue -le 0) {
            throw "Environment variable DBM_PORTAL_RUNTIME_HTTP_TIMEOUT_SECONDS must be a positive integer. Actual value: '$envValue'."
        }

        return $parsedValue
    }

    return 120
}

function ConvertTo-DbmDataverseErrorPayload {
    param(
        [AllowNull()]
        [string]$Payload
    )

    if ([string]::IsNullOrWhiteSpace($Payload)) {
        return $null
    }

    $trimmedPayload = $Payload.Trim()
    if ($trimmedPayload.Length -gt 4000) {
        return $trimmedPayload.Substring(0, 4000) + ' ...[truncated]'
    }

    return $trimmedPayload
}

function Format-DbmDataverseRequestFailureMessage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [string]$Description,

        [Parameter(Mandatory = $true)]
        [TimeSpan]$Elapsed,

        [AllowNull()]
        [int]$StatusCode,

        [AllowNull()]
        [string]$ReasonPhrase,

        [AllowNull()]
        [string]$ErrorPayload,

        [AllowNull()]
        [string]$ExceptionMessage
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('Dataverse request failed.')
    $lines.Add(("Description: {0}" -f $(if ([string]::IsNullOrWhiteSpace($Description)) { '(unspecified)' } else { $Description })))
    $lines.Add("Method: $Method")
    $lines.Add("Uri: $Uri")
    $lines.Add("ElapsedMs: $([math]::Round($Elapsed.TotalMilliseconds, 2))")
    if ($StatusCode -gt 0) {
        $statusLine = "HttpStatus: $StatusCode"
        if (-not [string]::IsNullOrWhiteSpace($ReasonPhrase)) {
            $statusLine = "$statusLine ($ReasonPhrase)"
        }
        $lines.Add($statusLine)
    }
    if (-not [string]::IsNullOrWhiteSpace($ExceptionMessage)) {
        $lines.Add("Error: $ExceptionMessage")
    }

    $formattedPayload = ConvertTo-DbmDataverseErrorPayload -Payload $ErrorPayload
    if (-not [string]::IsNullOrWhiteSpace($formattedPayload)) {
        $lines.Add('DataverseErrorPayload:')
        $lines.Add($formattedPayload)
    }

    return $lines -join [Environment]::NewLine
}

function ConvertTo-DbmDataverseResponseHeaders {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.Http.HttpResponseMessage]$Response
    )

    $headers = @{}
    foreach ($header in $Response.Headers) {
        $headers[$header.Key] = ($header.Value -join ', ')
    }

    if ($null -ne $Response.Content) {
        foreach ($header in $Response.Content.Headers) {
            $headers[$header.Key] = ($header.Value -join ', ')
        }
    }

    return $headers
}

function New-DbmDataverseRawResponse {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.Http.HttpResponseMessage]$Response,

        [AllowNull()]
        [string]$Content
    )

    return [pscustomobject]@{
        StatusCode = [int]$Response.StatusCode
        ReasonPhrase = [string]$Response.ReasonPhrase
        Headers = ConvertTo-DbmDataverseResponseHeaders -Response $Response
        Content = $Content
    }
}

function ConvertFrom-DbmDataverseResponseContent {
    param(
        [AllowNull()]
        [string]$Content
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return $null
    }

    try {
        return $Content | ConvertFrom-Json
    }
    catch {
        return $Content
    }
}

function Get-DbmCreatedRecordIdFromResponse {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Response,

        [Parameter(Mandatory = $true)]
        [string]$PrimaryIdAttribute
    )

    $entityIdHeader = $Response.Headers['OData-EntityId']
    if ([string]::IsNullOrWhiteSpace($entityIdHeader)) {
        $entityIdHeader = $Response.Headers['odata-entityid']
    }

    if (-not [string]::IsNullOrWhiteSpace($entityIdHeader)) {
        $match = [regex]::Match($entityIdHeader, '\(([0-9a-fA-F-]{36})\)$')
        if ($match.Success) {
            return ([guid]$match.Groups[1].Value).Guid
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($Response.Content)) {
        try {
            $payload = $Response.Content | ConvertFrom-Json
            $value = $payload.PSObject.Properties[$PrimaryIdAttribute]
            if ($value -and -not [string]::IsNullOrWhiteSpace([string]$value.Value)) {
                return ([guid][string]$value.Value).Guid
            }
        }
        catch {
        }
    }

    throw "Dataverse create response did not include '$PrimaryIdAttribute'."
}

function Invoke-DbmDataverseRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [AllowNull()]
        [object]$Body,

        [AllowNull()]
        [byte[]]$BinaryBody,

        [string]$ContentType = 'application/json; charset=utf-8',

        [hashtable]$AdditionalHeaders,

        [switch]$ReturnRawResponse,

        [string]$Description,

        [int]$RequestTimeoutSeconds
    )

    $timeoutSeconds = Get-DbmPortalRuntimeRequestTimeoutSeconds -RequestedTimeoutSeconds $RequestTimeoutSeconds
    $headers = Merge-DbmHashtable -Base @{
        Authorization = "Bearer $AccessToken"
        Accept = 'application/json'
        'OData-Version' = '4.0'
        'OData-MaxVersion' = '4.0'
    } -Overlay $AdditionalHeaders

    $requestBody = $null
    if ($null -ne $BinaryBody) {
        $requestBody = $BinaryBody
    }
    elseif ($null -ne $Body) {
        $requestBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 -Compress }
    }

    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [System.Threading.Timeout]::InfiniteTimeSpan
    $requestMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Uri)
    $cancellationSource = [System.Threading.CancellationTokenSource]::new()
    $response = $null
    $responseContent = $null
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $requestMessage.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $AccessToken)
        $requestMessage.Headers.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new('application/json'))
        [void]$requestMessage.Headers.TryAddWithoutValidation('OData-Version', '4.0')
        [void]$requestMessage.Headers.TryAddWithoutValidation('OData-MaxVersion', '4.0')

        if ($null -ne $requestBody) {
            if ($requestBody -is [byte[]]) {
                $requestMessage.Content = [System.Net.Http.ByteArrayContent]::new($requestBody)
            }
            else {
                $requestBytes = [System.Text.Encoding]::UTF8.GetBytes([string]$requestBody)
                $requestMessage.Content = [System.Net.Http.ByteArrayContent]::new($requestBytes)
            }

            $requestMessage.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
        }

        foreach ($headerKey in $headers.Keys) {
            if ($headerKey -in @('Authorization', 'Accept', 'OData-Version', 'OData-MaxVersion')) {
                continue
            }

            $headerValue = [string]$headers[$headerKey]
            if (-not $requestMessage.Headers.TryAddWithoutValidation($headerKey, $headerValue)) {
                if ($null -eq $requestMessage.Content) {
                    $requestMessage.Content = [System.Net.Http.ByteArrayContent]::new([byte[]]@())
                }

                [void]$requestMessage.Content.Headers.TryAddWithoutValidation($headerKey, $headerValue)
            }
        }

        $cancellationSource.CancelAfter([TimeSpan]::FromSeconds($timeoutSeconds))
        $response = $client.SendAsync($requestMessage, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $cancellationSource.Token).GetAwaiter().GetResult()
        if ($null -ne $response.Content) {
            $responseContent = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
    }
    catch [System.OperationCanceledException] {
        $stopwatch.Stop()
        $message = Format-DbmDataverseRequestFailureMessage `
            -Method $Method `
            -Uri $Uri `
            -Description $Description `
            -Elapsed $stopwatch.Elapsed `
            -ExceptionMessage ("Request timed out after {0} seconds." -f $timeoutSeconds)
        throw $message
    }
    catch {
        $stopwatch.Stop()
        $message = Format-DbmDataverseRequestFailureMessage `
            -Method $Method `
            -Uri $Uri `
            -Description $Description `
            -Elapsed $stopwatch.Elapsed `
            -ExceptionMessage $_.Exception.Message
        throw $message
    }

    $stopwatch.Stop()
    try {
        if (-not $response.IsSuccessStatusCode) {
            $message = Format-DbmDataverseRequestFailureMessage `
                -Method $Method `
                -Uri $Uri `
                -Description $Description `
                -Elapsed $stopwatch.Elapsed `
                -StatusCode ([int]$response.StatusCode) `
                -ReasonPhrase ([string]$response.ReasonPhrase) `
                -ErrorPayload $responseContent
            throw $message
        }

        if ($ReturnRawResponse) {
            return New-DbmDataverseRawResponse -Response $response -Content $responseContent
        }

        return ConvertFrom-DbmDataverseResponseContent -Content $responseContent
    }
    finally {
        if ($null -ne $response) {
            $response.Dispose()
        }
        $requestMessage.Dispose()
        $cancellationSource.Dispose()
        $client.Dispose()
    }
}

function ConvertTo-DbmODataStringLiteral {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return "'{0}'" -f $Value.Replace("'", "''")
}

function Invoke-DbmDataverseQuery {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [int]$Top = 50,
        [string]$Description,
        [int]$RequestTimeoutSeconds
    )

    $queryParts = @()
    if ($SelectFields -and $SelectFields.Count -gt 0) {
        $queryParts += "`$select=$([System.Uri]::EscapeDataString(($SelectFields -join ',')))"
    }
    if (-not [string]::IsNullOrWhiteSpace($Filter)) {
        $queryParts += "`$filter=$([System.Uri]::EscapeDataString($Filter))"
    }
    if (-not [string]::IsNullOrWhiteSpace($OrderBy)) {
        $queryParts += "`$orderby=$([System.Uri]::EscapeDataString($OrderBy))"
    }
    if ($Top -gt 0) {
        $queryParts += "`$top=$Top"
    }

    $uri = "{0}/{1}{2}" -f (Get-DbmDataverseApiBaseUrl -DataverseUrl $DataverseUrl), $EntitySetName, ($(if ($queryParts.Count -gt 0) { '?' + ($queryParts -join '&') } else { '' }))
    $response = Invoke-DbmDataverseRequest `
        -Method GET `
        -Uri $uri `
        -AccessToken $AccessToken `
        -Description $(if ([string]::IsNullOrWhiteSpace($Description)) { "query $EntitySetName" } else { $Description }) `
        -RequestTimeoutSeconds $RequestTimeoutSeconds
    if ($null -eq $response) {
        return @()
    }

    return @($response.value)
}

function Get-DbmDataverseSingleRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DataverseUrl,

        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$EntitySetName,

        [string[]]$SelectFields,
        [string]$Filter,
        [string]$OrderBy,
        [string]$Description = $EntitySetName,
        [switch]$AllowMissing,
        [int]$RequestTimeoutSeconds
    )

    $records = @(Invoke-DbmDataverseQuery `
        -DataverseUrl $DataverseUrl `
        -AccessToken $AccessToken `
        -EntitySetName $EntitySetName `
        -SelectFields $SelectFields `
        -Filter $Filter `
        -OrderBy $OrderBy `
        -Top 2 `
        -Description $Description `
        -RequestTimeoutSeconds $RequestTimeoutSeconds)
    if ($records.Count -eq 0) {
        if ($AllowMissing) {
            return $null
        }

        throw "Dataverse query did not return a record for $Description."
    }

    if ($records.Count -gt 1) {
        throw "Dataverse query returned multiple records for $Description."
    }

    return $records[0]
}

function Get-DbmPortalRuntimePluginStepDefinitions {
    return @(
        [pscustomobject]@{
            name = 'DBM Portal Runtime - Create dbm_request'
            messageName = 'Create'
            primaryEntityLogicalName = 'dbm_request'
            stage = 20
            stageLabel = 'PreOperation'
            mode = 0
            modeLabel = 'Synchronous'
            rank = 1
            supportedDeployment = 0
            filteringAttributes = $null
        },
        [pscustomobject]@{
            name = 'DBM Portal Runtime - Update dbm_request portal submit'
            messageName = 'Update'
            primaryEntityLogicalName = 'dbm_request'
            stage = 20
            stageLabel = 'PreOperation'
            mode = 0
            modeLabel = 'Synchronous'
            rank = 1
            supportedDeployment = 0
            filteringAttributes = 'dbm_portalcommand'
        }
    )
}

function Get-DbmPortalRuntimePluginStepDrift {
    param(
        [Parameter(Mandatory = $true)]
        [object]$ExpectedStep,

        [AllowNull()]
        [object]$ActualStep
    )

    if ($null -eq $ActualStep) {
        return [pscustomobject]@{
            exists = $false
            requiresUpdate = $true
            differences = @('step-missing')
        }
    }

    $normalizeFilter = {
        param([AllowNull()][string]$Value)
        if ([string]::IsNullOrWhiteSpace($Value)) {
            return ''
        }

        return (@($Value.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ }) | Sort-Object) -join ','
    }

    $differences = New-Object System.Collections.Generic.List[string]
    if ([int]$ActualStep.stage -ne [int]$ExpectedStep.stage) {
        $differences.Add('stage')
    }
    if ([int]$ActualStep.mode -ne [int]$ExpectedStep.mode) {
        $differences.Add('mode')
    }
    if ([int]$ActualStep.rank -ne [int]$ExpectedStep.rank) {
        $differences.Add('rank')
    }
    if ([int]$ActualStep.supporteddeployment -ne [int]$ExpectedStep.supportedDeployment) {
        $differences.Add('supporteddeployment')
    }
    if ((& $normalizeFilter $ActualStep.filteringattributes) -ne (& $normalizeFilter $ExpectedStep.filteringAttributes)) {
        $differences.Add('filteringattributes')
    }

    return [pscustomobject]@{
        exists = $true
        requiresUpdate = $differences.Count -gt 0
        differences = @($differences)
    }
}

function New-DbmR3PortalRuntimeEvidenceManifest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Dev')]
        [string]$TargetEnvironment,

        [Parameter(Mandatory = $true)]
        [string]$Status,

        [Parameter(Mandatory = $true)]
        [string]$EvidenceRoot,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Steps,

        [AllowNull()]
        [object]$Metadata
    )

    return [ordered]@{
        generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
        targetEnvironment = $TargetEnvironment
        status = $Status
        evidenceRoot = $EvidenceRoot
        steps = @($Steps)
        metadata = $Metadata
    }
}

function Write-DbmUtf8File {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Find-DbmPortalRuntimeLocalProofProcesses {
    param(
        [string]$RepoRoot = (Get-DbmPortalRuntimeRepoRoot),

        [int]$CurrentProcessId = $PID,

        [AllowNull()]
        [object[]]$Processes
    )

    $resolvedRepoRoot = (Get-DbmPortalRuntimeRepoRoot -RepoRoot $RepoRoot).ToLowerInvariant()
    if ($null -eq $Processes) {
        $Processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId, Name, CommandLine)
    }

    return @(
        foreach ($process in @($Processes)) {
            $processId = 0
            try {
                $processId = [int]$process.ProcessId
            }
            catch {
                continue
            }

            if ($processId -eq $CurrentProcessId) {
                continue
            }

            $commandLine = [string]$process.CommandLine
            if ([string]::IsNullOrWhiteSpace($commandLine)) {
                continue
            }

            $normalizedCommandLine = $commandLine.ToLowerInvariant()
            if ($normalizedCommandLine -notlike "*$resolvedRepoRoot*") {
                continue
            }

            if ($normalizedCommandLine -notlike '*server-entry.js*' -and $normalizedCommandLine -notlike '*invoke-r3portalruntimelocalproof.ps1*') {
                continue
            }

            [pscustomobject]@{
                processId = $processId
                name = [string]$process.Name
                commandLine = $commandLine
            }
        }
    )
}

function Wait-DbmPortalRuntimeLocalProofHealth {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).ToUniversalTime().AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri ("{0}/api/runtime/health" -f $BaseUrl.TrimEnd('/')) -Method GET -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return ($response.Content | ConvertFrom-Json)
            }
        }
        catch {
        }

        Start-Sleep -Seconds 2
    } while ((Get-Date).ToUniversalTime() -lt $deadline)

    throw "Timed out waiting for the local portal runtime proof host at '$BaseUrl'."
}
