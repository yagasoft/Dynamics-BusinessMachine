[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Get-CompletedRoadmapMarkdownTableRows {
    param(
        [string[]]$Lines,
        [string]$Heading,
        [int]$ExpectedCellCount
    )

    $rows = @()
    $inSection = $false
    $foundHeading = $false

    foreach ($line in $Lines) {
        if ($line -eq $Heading) {
            $inSection = $true
            $foundHeading = $true
            continue
        }

        if ($inSection -and $line -like '## *') {
            break
        }

        if (-not $inSection -or -not $line.TrimStart().StartsWith('|')) {
            continue
        }

        $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        if ($cells.Count -ne $ExpectedCellCount) {
            throw "$Heading contains a table row with $($cells.Count) cells; expected $ExpectedCellCount cells: $line"
        }

        if ($cells[0] -in @('Capability', 'Exposed by', 'Warning source') -or $cells[0] -match '^-+$') {
            continue
        }

        $rows += ,$cells
    }

    if (-not $foundHeading) {
        throw "Completed roadmap TDD matrix is missing required section: $Heading"
    }

    return $rows
}

function Get-CompletedRoadmapMatrixLines {
    param([string]$RepoRoot)

    $matrixPath = Join-Path $RepoRoot 'docs\roadmap\completed-roadmap-tdd-matrix.md'
    if (-not (Test-Path $matrixPath)) {
        throw "Completed roadmap TDD matrix is missing: $matrixPath"
    }

    return (Get-Content -Path $matrixPath -Raw) -split "`r?`n"
}

function Get-CompletedRoadmapMatrixRows {
    param([string]$RepoRoot)

    Get-CompletedRoadmapMarkdownTableRows -Lines (Get-CompletedRoadmapMatrixLines -RepoRoot $RepoRoot) -Heading '## Matrix' -ExpectedCellCount 5 |
        ForEach-Object {
            [pscustomobject]@{
                Capability = $_[0]
                CompletedBehaviour = $_[1]
                TddAnchor = $_[2]
                VerificationSurface = $_[3]
                FutureBoundary = $_[4]
            }
        }
}

function Get-CompletedRoadmapProofLedgerRows {
    param([string]$RepoRoot)

    Get-CompletedRoadmapMarkdownTableRows -Lines (Get-CompletedRoadmapMatrixLines -RepoRoot $RepoRoot) -Heading '## Supplemental live proof ledger' -ExpectedCellCount 7 |
        ForEach-Object {
            [pscustomobject]@{
                Capability = $_[0]
                ProofType = $_[1]
                CommandOrRunbook = $_[2]
                Prerequisites = $_[3]
                EvidenceOutput = $_[4]
                WhyNotCi = $_[5]
                FutureBoundary = $_[6]
            }
        }
}

function Get-CompletedRoadmapIssueRows {
    param([string]$RepoRoot)

    Get-CompletedRoadmapMarkdownTableRows -Lines (Get-CompletedRoadmapMatrixLines -RepoRoot $RepoRoot) -Heading '## Retrofit issue log' -ExpectedCellCount 4 |
        ForEach-Object {
            [pscustomobject]@{
                ExposedBy = $_[0]
                CapabilityRoute = $_[1]
                Issue = $_[2]
                Resolution = $_[3]
            }
        }
}

function Get-CompletedRoadmapWarningRows {
    param([string]$RepoRoot)

    Get-CompletedRoadmapMarkdownTableRows -Lines (Get-CompletedRoadmapMatrixLines -RepoRoot $RepoRoot) -Heading '## Verification warning ledger' -ExpectedCellCount 5 |
        ForEach-Object {
            [pscustomobject]@{
                WarningSource = $_[0]
                Classification = $_[1]
                Warning = $_[2]
                ExpectedHandling = $_[3]
                FutureBoundary = $_[4]
            }
        }
}

function Get-EnvironmentProofAssetReferences {
    param([string]$RepoRoot)

    $proofReferences = [System.Collections.Generic.List[string]]::new()
    $proofReferences.Add('docs\roadmap\completed-roadmap-tdd-matrix.md')

    $ledgerRows = Get-CompletedRoadmapProofLedgerRows -RepoRoot $RepoRoot
    foreach ($row in $ledgerRows) {
        $commandOrRunbook = [string]$row.CommandOrRunbook
        $references = @([regex]::Matches($commandOrRunbook, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value })
        foreach ($reference in $references) {
            if ($reference -notmatch '\.(ps1|md|json|yml|yaml|ts|tsx)$') {
                continue
            }

            $proofReferences.Add(($reference -replace '/', '\'))
        }
    }

    if ($proofReferences -contains 'eng\scripts\Test-DbmProcessExperienceVisual.ps1') {
        $proofReferences.Add('dbm-process-experience\package.json')
    }

    if (
        $proofReferences -contains 'docs\runbooks\live-connected-e2e.md' -or
        $proofReferences -contains 'eng\scripts\Test-R3PortalRuntimeLocalSmoke.ps1' -or
        $proofReferences -contains 'eng\scripts\Invoke-R3PortalRuntimeLocalProof.ps1'
    ) {
        $proofReferences.Add('dbm-live-e2e\package.json')
    }

    return @($proofReferences | Select-Object -Unique)
}

function Get-CompletedRoadmapValidationGateScripts {
    param([string]$RepoRoot)

    $validationWrapperPath = Join-Path $RepoRoot 'eng\scripts\Test-CompletedRoadmapValidation.ps1'
    if (-not (Test-Path $validationWrapperPath)) {
        throw "Completed-roadmap sequential validation wrapper is missing: $validationWrapperPath"
    }

    $validationWrapper = Get-Content -Path $validationWrapperPath -Raw
    return @(
        [regex]::Matches($validationWrapper, "New-CompletedRoadmapGate[^\r\n]+-Script\s+'([^']+)'") |
            ForEach-Object { $_.Groups[1].Value -replace '/', '\' } |
            Select-Object -Unique
    )
}

function Get-ValidateWorkflowGateScripts {
    param([string]$RepoRoot)

    $workflowPath = Join-Path $RepoRoot '.github\workflows\validate.yml'
    if (-not (Test-Path $workflowPath)) {
        throw "Validate workflow is missing: $workflowPath"
    }

    $workflowContent = Get-Content -Path $workflowPath -Raw
    return @(
        [regex]::Matches($workflowContent, '(?m)^\s*run:\s*\.\\(eng\\scripts\\(?:Test|Invoke)-[A-Za-z0-9-]+\.ps1)\b') |
            ForEach-Object { $_.Groups[1].Value -replace '/', '\' } |
            Select-Object -Unique
    )
}

function Test-CompletedRoadmapCiParity {
    param([string]$RepoRoot)

    $localOnlyGateScripts = @(
        'eng\scripts\Test-CompletedRoadmapEnvironmentProofReadiness.ps1'
    )

    $wrapperGateScripts = @(
        Get-CompletedRoadmapValidationGateScripts -RepoRoot $RepoRoot |
            Where-Object { $_ -notin $localOnlyGateScripts }
    )

    $workflowGateScripts = @(Get-ValidateWorkflowGateScripts -RepoRoot $RepoRoot)

    $missingWorkflowGates = @(
        $wrapperGateScripts |
            Where-Object { $_ -notin $workflowGateScripts }
    )

    if ($missingWorkflowGates.Count -gt 0) {
        throw "Validate workflow is missing deterministic completed-roadmap gates from the local wrapper: $($missingWorkflowGates -join ', ')"
    }

    $unexpectedLocalOnlyWorkflowGates = @(
        $localOnlyGateScripts |
            Where-Object { $_ -in $workflowGateScripts }
    )

    if ($unexpectedLocalOnlyWorkflowGates.Count -gt 0) {
        throw "Validate workflow must not run local-only completed-roadmap gates: $($unexpectedLocalOnlyWorkflowGates -join ', ')"
    }
}
