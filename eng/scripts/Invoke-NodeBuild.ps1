[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$nodeProjects = @(
    @{ Path = 'dbm-app'; OutputPaths = @('dist', 'bundle'); Commands = @('npm ci', 'npm run build', 'npm run bundle') },
    @{ Path = 'dbm-script-lib'; OutputPaths = @('bin'); Commands = @('npm ci', 'npx webpack --config webpack.config.js') },
    @{ Path = 'dbm-js-vm'; OutputPaths = @('bin'); Commands = @('npm ci', 'npx webpack --config webpack.config.js') },
    @{ Path = 'dbm-web-resources'; OutputPaths = @(); Commands = @('npm ci', 'npx tsc -p tsconfig.json') }
)

foreach ($project in $nodeProjects) {
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
