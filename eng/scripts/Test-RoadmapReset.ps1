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
Assert-Contains 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md' 'Dataverse-normalised authoring rows' 'ADR-0017 must lock Dataverse-normalised authoring rows as the collaborative authoring source.'
Assert-Contains 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md' 'Power Apps Code Apps' 'ADR-0017 must record the Code Apps designer host direction.'
Assert-Contains 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md' 'dbm_designersession' 'ADR-0017 must define designer-session presence separately from edit locks.'
Assert-Contains 'docs\adr\0017-collaborative-authoring-and-code-apps-designer.md' 'Repeated display names are expected' 'ADR-0017 must preserve duplicate same-user designer sessions.'
Assert-Contains 'docs\adr\README.md' '0017-collaborative-authoring-and-code-apps-designer.md' 'ADR index must reference ADR-0017.'
Assert-Contains 'docs\roadmap\progress-tracker.md' 'Active planning' 'Roadmap progress tracker must show active planning status.'
Assert-Contains 'docs\roadmap\progress-tracker.md' 'R2.1 DBMScript contract and collaborative authoring foundation' 'Roadmap progress tracker must name the active R2.1 slice.'
Assert-Contains 'docs\roadmap\progress-tracker.md' 'Historical/reference' 'Roadmap progress tracker must classify old R1 to R3.1 work as historical/reference.'
Assert-Contains 'docs\roadmap\README.md' 'progress-tracker.md' 'Roadmap README must link to the human-readable progress tracker.'
Assert-Contains 'docs\README.md' 'Roadmap progress tracker' 'Docs reading order must include the roadmap progress tracker.'

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

foreach ($requiredConcept in @('mainProcessId', 'processes[]', 'subProcessVisibility', 'childProcessRefs[]', 'parent-stage locking')) {
    Assert-Contains $releasePlan $requiredConcept "Release plan must define $requiredConcept as part of the reset model/interface direction."
}

Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'actual model-driven form render' 'R1 must prove actual model-driven form rendering.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'Portal is contract-only in R1' 'R1 must keep portal to a projection contract only.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'childProcessRefs[]' 'R1 must support stage-owned child process links.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'blocked/awaiting-child status' 'R1 must show parent stages awaiting child completion.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'first implementation tests' 'R1 must name the first executable implementation tests after the roadmap reset.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'R1.2 Generic process design contract' 'R1 must include a generic process design contract slice after the R1.1 portfolio foundation.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'user-defined process type' 'R1.2 must make process type user-defined rather than approval/request-led.'
Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'generic fixture matrix' 'R1.2 must name the generic fixture matrix as active proof.'
foreach ($genericFixture in @('linear service fulfilment', 'employee onboarding', 'case investigation', 'document lifecycle', 'field inspection')) {
    Assert-Contains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' $genericFixture "R1.2 roadmap must include generic fixture matrix case: $genericFixture"
}
Assert-NotContains 'docs\roadmap\release-1-process-stage-designer-and-form-render.md' 'approval/request-led example' 'Active R1 roadmap must not treat approval/request as the canonical design.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'JavaScript first' 'R2 must define JavaScript-first DBMScript/action delivery.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'DBMScript language/runtime contract' 'R2 must define the DBMScript language/runtime contract.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'DBM Object' 'R2 must treat DBM Object as a first-class companion to DBMScript.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'browser, model-driven, plugin/server, and Dataverse/Jint execution contexts' 'R2 must name the supported execution-context planning boundary.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'version history' 'R2 must include script/object lifecycle and version history.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'query editor' 'R2 must preserve the query editor requirement from the original notes.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'test case support' 'R2 must include script and object test case support.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'granular edit leases' 'R2 must include granular edit leases before meaningful non-mergeable edits begin.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'private Dataverse-backed drafts' 'R2 must create private Dataverse-backed drafts when editing starts.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'active designer sessions' 'R2 must show active designer sessions for process-level and component-level authoring awareness.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'not aggregated by user' 'R2 must keep same-user duplicate designer sessions visible.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'optimistic concurrency/ETags as final consistency guards' 'R2 must use optimistic concurrency and ETags as final consistency guards, not the primary long-edit UX.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'Power Apps Code Apps proof slice' 'R2 must include a Power Apps Code Apps proof slice before selecting Code Apps as the designer host.'
Assert-Contains 'docs\roadmap\release-2-dbmscript-and-action-foundation.md' 'Process JSON remains a compiled published/export/import/runtime snapshot' 'R2 must preserve process JSON as a compiled snapshot rather than the collaborative authoring row.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'model-driven forms' 'R3 must focus on back-office/model-driven runtime execution.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'process sessions' 'R3 must explicitly define process session semantics.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'process instance per row, user, role, or owner' 'R3 must support configured row/user/role/owner process instances.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'record-level and user-level process switching' 'R3 must include record-level and user-level process switching.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'show Next' 'R3 must distinguish manual Next progression from automatic transition.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'automatic transition' 'R3 must support automatic progression when conditions are met.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'parallel branches' 'R3 must include parallel branch semantics.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'FetchXML' 'R3 must include FetchXML condition support.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'backend condition evaluation on load and save' 'R3 must document backend condition timing.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'XRM/form-context helpers' 'R3 must tie form behaviour to XRM/form-context helpers.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'published snapshots/definitions only' 'R3 runtime must consume published snapshots and definitions only.'
Assert-Contains 'docs\roadmap\release-3-back-office-runtime.md' 'never executes drafts' 'R3 runtime must explicitly reject draft execution.'
Assert-Contains 'docs\roadmap\release-4-back-office-operations.md' 'first-class Dataverse authoring rows' 'R4 operations must model routing, SLA, notifications, validations, and operational config as first-class authoring rows.'
Assert-Contains 'docs\roadmap\release-4-back-office-operations.md' 'own lock/draft/version lifecycle' 'R4 operational config rows must have their own lock, draft, and version lifecycle.'
Assert-Contains 'docs\roadmap\release-5-portal-runtime-and-return-path.md' 'actual portal rendering' 'R5 must own actual portal rendering and return path.'
Assert-Contains 'docs\roadmap\release-7-platform-tooling-and-alm.md' 'auto-integration discovery' 'R7 must define auto-integration as a concrete discovery slice instead of leaving it vague.'
Assert-Contains 'docs\roadmap\release-7-platform-tooling-and-alm.md' 'compiled published snapshots' 'R7 ALM must export and import compiled published snapshots.'
Assert-Contains 'docs\roadmap\release-7-platform-tooling-and-alm.md' 'source-normalised artefacts' 'R7 ALM must optionally handle source-normalised authoring artefacts.'
Assert-Contains 'docs\roadmap\release-7-platform-tooling-and-alm.md' 'conflict reporting' 'R7 source sync must report conflicts instead of silently overwriting changed rows.'
Assert-Contains 'docs\roadmap\release-9-ai-assisted-platform.md' 'after the basic product is stable' 'R9 must defer AI until the basic product is stable.'

foreach ($historicalRunbook in @(
    'docs\runbooks\r1-decisions-log.md',
    'docs\runbooks\release-performance-baseline.md',
    'docs\runbooks\r2-process-experience-hosting.md',
    'docs\runbooks\r3-portal-runtime-dev-proof.md',
    'docs\runbooks\live-connected-e2e.md'
)) {
    Assert-Contains $historicalRunbook 'Historical/prototype reference' "Old runbook must be marked as historical/prototype reference: $historicalRunbook"
}

Assert-Contains 'docs\architecture\current-state-baseline.md' 'prototype/reference material' 'Current-state baseline must classify current implementation as prototype/reference material.'
Assert-Contains 'docs\architecture\target-platform-architecture.md' 'process portfolio' 'Target architecture must describe the new process portfolio model.'
Assert-Contains 'docs\architecture\target-platform-architecture.md' 'Dataverse-normalised authoring rows' 'Target architecture must define Dataverse-normalised collaborative authoring rows.'
Assert-Contains 'docs\architecture\target-platform-architecture.md' 'Power Apps Code Apps' 'Target architecture must capture the R2+ Code Apps designer host direction.'
Assert-Contains 'docs\architecture\product-principles.md' 'process-first reset' 'Product principles must record the process-first reset.'
Assert-Contains 'docs\architecture\product-principles.md' 'Acquire the granular edit lease before meaningful edits begin' 'Product principles must prevent long non-mergeable edits from waiting until save to discover conflicts.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'processTypeId' 'Canonical contract docs must replace scenario-specific process typing with processTypeId.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'actorCategory' 'Canonical contract docs must replace approval/request actor types with generic actor categories.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'stageKindId' 'Canonical contract docs must support user-defined stage kinds.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'workKindId' 'Canonical contract docs must support user-defined work kinds.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'compiled published/export/import/runtime snapshot' 'Canonical contract docs must state that process JSON is a compiled snapshot.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'dbm_editlock' 'Canonical contract docs must define the edit-lock public contract.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'dbm_designersession' 'Canonical contract docs must define the designer-session public contract.'
Assert-Contains 'docs\architecture\canonical-model-runtime-contract-v1.md' 'Presence sessions never grant or deny edits' 'Canonical contract docs must keep designer-session awareness separate from edit authority.'
foreach ($activeHierarchyDoc in @(
    'docs\roadmap\release-1-process-stage-designer-and-form-render.md',
    'docs\roadmap\release-plan.md',
    'docs\architecture\canonical-model-runtime-contract-v1.md',
    'docs\architecture\examples\README.md'
)) {
    Assert-NotContains $activeHierarchyDoc 'stageSpan' "Active hierarchy docs must not describe stageSpan as active authority: $activeHierarchyDoc"
    Assert-NotContains $activeHierarchyDoc 'fractional main-stage' "Active hierarchy docs must not describe fractional main-stage spans as active authority: $activeHierarchyDoc"
}
Assert-Contains 'docs\architecture\examples\README.md' 'approval-request-v1.model.json is historical/prototype reference' 'Approval/request example must be marked as reference only where retained.'
Assert-NotContains 'eng\scripts\Invoke-DataverseSynthesis.ps1' 'approval-request-v1.model.json' 'Active Dataverse synthesis default model path must not point at the retired approval/request example.'
Assert-NotContains 'eng\scripts\Invoke-DataversePackaging.ps1' 'approval-request-v1.model.json' 'Active Dataverse packaging default model path must not point at the retired approval/request example.'
Assert-NotContains 'eng\scripts\Test-DataverseSmoke.ps1' 'approval-request-v1.model.json' 'Active Dataverse smoke default model path must not point at the retired approval/request example.'
Assert-Contains 'docs\releases\r1-close-out-0.3.0.md' 'prototype/reference evidence' 'Old R1 closeout must be reclassified as prototype/reference evidence.'

Assert-RoadmapLinksResolve

Write-Host 'Roadmap reset checks passed.'
