[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $env:TEMP ("dbm-app-signing-key-{0}.snk" -f ([guid]::NewGuid().ToString('N')))),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Resolve-DbmStrongNameToolPath {
    $sn = Get-Command sn -ErrorAction SilentlyContinue
    if ($sn) {
        return $sn.Source
    }

    $candidates = @(
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\x64\sn.exe',
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe',
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.7.2 Tools\x64\sn.exe',
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.7.2 Tools\sn.exe',
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.6.1 Tools\x64\sn.exe',
        'C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.6.1 Tools\sn.exe'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw 'sn.exe must be available to generate a DBM strong-name key.'
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Path $resolvedOutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

if ((Test-Path $resolvedOutputPath) -and -not $Force) {
    throw "Refusing to overwrite an existing key file without -Force: $resolvedOutputPath"
}

$snPath = Resolve-DbmStrongNameToolPath
& $snPath -q -k $resolvedOutputPath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $resolvedOutputPath)) {
    throw "sn.exe failed to generate the DBM strong-name key at '$resolvedOutputPath'."
}

$bytes = [System.IO.File]::ReadAllBytes($resolvedOutputPath)
[pscustomobject]@{
    outputPath = $resolvedOutputPath
    sizeBytes = $bytes.Length
    base64 = [System.Convert]::ToBase64String($bytes)
}
