[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

function Read-RepoText {
    param([string]$RelativePath)

    $path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required roadmap reset file is missing: $RelativePath"
    }

    return [System.IO.File]::ReadAllText($path)
}

function Assert-Contains {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Description
    )

    $content = Read-RepoText -RelativePath $RelativePath
    if ($content -notmatch [regex]::Escape($Pattern)) {
        throw $Description
    }
}

function Assert-NotContains {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Description
    )

    $content = Read-RepoText -RelativePath $RelativePath
    if ($content -match [regex]::Escape($Pattern)) {
        throw $Description
    }
}

function Assert-RoadmapLinksResolve {
    $roadmapRoot = Join-Path $RepoRoot 'docs\roadmap'
    $roadmapFiles = @(Get-ChildItem -Path $roadmapRoot -Filter '*.md' -File)
    $failures = [System.Collections.Generic.List[string]]::new()

    foreach ($file in $roadmapFiles) {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\(([^)#][^)]+\.md)(?:#[^)]+)?\)')) {
            $target = $match.Groups[1].Value
            if ($target -match '^[a-z]+://') {
                continue
            }

            $targetPath = Join-Path $file.DirectoryName ($target -replace '/', '\')
            if (-not (Test-Path -LiteralPath $targetPath)) {
                $relativeFile = [System.IO.Path]::GetRelativePath($RepoRoot, $file.FullName)
                $failures.Add("$relativeFile references missing roadmap link $target")
            }
        }
    }

    if ($failures.Count -gt 0) {
        throw "Roadmap links must resolve: $($failures -join '; ')"
    }
}

$releasePlan = 'docs\roadmap\release-plan.md'

Assert-Contains 'docs\adr\0016-product-roadmap-reset-process-first.md' 'Status: Accepted' 'ADR-0016 must accept the product roadmap reset.'
Assert-Contains 'docs\adr\0016-product-roadmap-reset-process-first.md' 'prototype/reference' 'ADR-0016 must reclassify the current implementation as prototype/reference material.'
Assert-Contains 'docs\adr\0016-product-roadmap-reset-process-first.md' 'new product R1' 'ADR-0016 must state that the product roadmap restarts at a new R1.'

$expectedReleaseRows = @(
    '| `R0` | Engineering foundation and governance |',
    '| `R1` | Process/stage designer and actual form render |',
    '| `R2` | DBMScript and action foundation |',
    '| `R3` | Back-office runtime |',
    '| `R4` | Back-office operations |',
    '| `R5` | Portal runtime and return path |',
    '| `R6` | Reuse, templates, artefacts, and documents |',
    '| `R7` | Platform tooling and ALM |',
    '| `R8` | Enterprise maturity |',
    '| `R9` | AI-assisted platform |'
)

foreach ($row in $expectedReleaseRows) {
    Assert-Contains $releasePlan $row "Release plan must include reset release row: $row"
}

foreach ($oldActiveName in @('Builder Platform MVP', 'Designer And Process Experience Platform', 'Pilot-Ready End-To-End Platform', 'Azure Deferred Extension', 'Enterprise Sophistication And Optimization')) {
    Assert-NotContains $releasePlan "| `$oldActiveName` |" "Release plan must not keep old release ladder names as active rows."
}

foreach ($requiredConcept in @('mainProcessId', 'processes[]', 'subProcessVisibility', 'stageSpan', 'fractional main-stage spans')) {
    Assert-Contains $releasePlan $requiredConcept "Release plan must define $requiredConcept as part of the reset model/interface direction."
}

Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'actual model-driven form render' 'R1 must prove actual model-driven form rendering.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'Portal is contract-only in R1' 'R1 must keep portal to a projection contract only.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'fractional main-stage span' 'R1 must support fractional main-stage spans.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'JavaScript first' 'R2 must define JavaScript-first DBMScript/action delivery.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'model-driven forms' 'R3 must focus on back-office/model-driven runtime execution.'
Assert-Contains 'docs\roadmap\release-5-portal-runtime-and-return-path.md' 'actual portal rendering' 'R5 must own actual portal rendering and return path.'
Assert-Contains 'docs\roadmap\release-9-ai-assisted-platform.md' 'after the basic product is stable' 'R9 must defer AI until the basic product is stable.'

Assert-Contains 'docs\architecture\current-state-baseline.md' 'prototype/reference material' 'Current-state baseline must classify current implementation as prototype/reference material.'
Assert-Contains 'docs\architecture\target-platform-architecture.md' 'process portfolio' 'Target architecture must describe the new process portfolio model.'
Assert-Contains 'docs\architecture\product-principles.md' 'process-first reset' 'Product principles must record the process-first reset.'
Assert-Contains 'docs\releases\r1-close-out-0.3.0.md' 'prototype/reference evidence' 'Old R1 closeout must be reclassified as prototype/reference evidence.'

Assert-RoadmapLinksResolve

Write-Host 'Roadmap reset checks passed.'
