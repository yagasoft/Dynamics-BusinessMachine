[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$requiredPaths = @(
    '.github\workflows\validate.yml',
    '.github\workflows\security.yml',
    '.github\workflows\package-dataverse.yml',
    'eng\version.json',
    'power-platform\manifests\webresources.yml',
    'azure\infra\main.bicep',
    'docs\releases\release-governance.md'
)

$missing = foreach ($relativePath in $requiredPaths) {
    $fullPath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        $relativePath
    }
}

if ($missing) {
    throw "Missing required repo foundation files: $($missing -join ', ')"
}

Write-Host 'Repo hygiene checks passed.'
