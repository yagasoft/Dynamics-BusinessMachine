[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$bicepFile = Join-Path $RepoRoot 'azure\infra\main.bicep'
if (-not (Test-Path $bicepFile)) {
    throw "Azure contract file is missing: $bicepFile"
}

$appFiles = Get-ChildItem -Path (Join-Path $RepoRoot 'azure\apps') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -notin @('README.md', '.gitkeep')
    }
if (-not $appFiles) {
    Write-Host 'No Azure application artifacts exist yet. Azure deployment is a no-op by design for this release foundation.'
    return
}

$az = Get-Command az -ErrorAction SilentlyContinue
if (-not $az) {
    throw 'Azure CLI must be available on PATH to validate Azure artifacts.'
}

& $az.Source bicep build --file $bicepFile
if ($LASTEXITCODE -ne 0) {
    throw 'Azure Bicep validation failed.'
}
