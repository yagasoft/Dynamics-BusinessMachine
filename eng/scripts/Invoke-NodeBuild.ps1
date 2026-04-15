[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string[]]$Projects
)

$nodeProjects = @(
    @{ Name = 'dbm-contract'; Path = 'dbm-contract'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-designer-core'; Path = 'dbm-designer-core'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-process-experience'; Path = 'dbm-process-experience'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-portal-runtime'; Path = 'dbm-portal-runtime'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-dataverse-synthesis'; Path = 'dbm-dataverse-synthesis'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-live-e2e'; Path = 'dbm-live-e2e'; OutputPaths = @('dist'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-app'; Path = 'dbm-designer-shell'; OutputPaths = @('..\dbm-app\bundle'); Commands = @('npm ci', 'npm run build') },
    @{ Name = 'dbm-script-lib'; Path = 'dbm-script-lib'; OutputPaths = @('bin'); Commands = @('npm ci', 'npx webpack --config webpack.config.js') },
    @{ Name = 'dbm-js-vm'; Path = 'dbm-js-vm'; OutputPaths = @('bin'); Commands = @('npm ci', 'npx webpack --config webpack.config.js') },
    @{ Name = 'dbm-web-resources'; Path = 'dbm-web-resources'; OutputPaths = @(); Commands = @('npm ci', 'npx tsc -p tsconfig.json') }
)

$availableProjects = $nodeProjects | ForEach-Object { $_.Name }
$selectedProjects = if ($Projects -and $Projects.Count -gt 0) {
    $invalidProjects = @($Projects | Where-Object { $_ -notin $availableProjects } | Select-Object -Unique)
    if ($invalidProjects.Count -gt 0) {
        throw "Unknown Node build project(s): $($invalidProjects -join ', '). Valid values: $($availableProjects -join ', ')"
    }

    @($nodeProjects | Where-Object { $_.Name -in $Projects })
}
else {
    $nodeProjects
}

foreach ($project in $selectedProjects) {
    $projectPath = Join-Path $RepoRoot $project.Path
    foreach ($outputPath in $project.OutputPaths) {
        $fullOutputPath = Join-Path $projectPath $outputPath
        if (Test-Path $fullOutputPath) {
            Write-Host "Cleaning '$fullOutputPath'"
            Remove-Item -Path $fullOutputPath -Recurse -Force
        }
    }

    foreach ($command in $project.Commands) {
        Write-Host "Running '$command' in $projectPath"
        Push-Location $projectPath
        try {
            Invoke-Expression $command
            if ($LASTEXITCODE -ne 0) {
                throw "Command failed with exit code ${LASTEXITCODE}: $command"
            }
        }
        finally {
            Pop-Location
        }
    }
}
