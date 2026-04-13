[CmdletBinding()]
param(
    [string]$AssemblyKeyFile,
    [switch]$Required,
    [string]$Purpose = 'legacy Dataverse packaging'
)

$candidatePath = $null
$source = $null

if (-not [string]::IsNullOrWhiteSpace($AssemblyKeyFile)) {
    $candidatePath = $AssemblyKeyFile
    $source = 'parameter'
}
elseif (-not [string]::IsNullOrWhiteSpace($env:DBM_ASSEMBLY_KEY_FILE)) {
    $candidatePath = $env:DBM_ASSEMBLY_KEY_FILE
    $source = 'DBM_ASSEMBLY_KEY_FILE'
}

if ([string]::IsNullOrWhiteSpace($candidatePath)) {
    if ($Required) {
        throw "The approved DBM strong-name key is required for $Purpose. Pass -AssemblyKeyFile or set DBM_ASSEMBLY_KEY_FILE to the official .snk file."
    }

    return [pscustomobject]@{
        path = $null
        source = $null
    }
}

$resolvedPath = Resolve-Path -LiteralPath $candidatePath -ErrorAction SilentlyContinue
if (-not $resolvedPath) {
    throw "The approved DBM strong-name key path from '$source' does not exist: '$candidatePath'."
}

[pscustomobject]@{
    path = $resolvedPath.Path
    source = $source
}
