# Release 2: Designer And Process Experience Platform

## Goal

Turn the shipped `R1` builder-platform MVP into a product-grade authoring and runtime-foundation release by replacing the bridge-quality designer host and notification-based process runtime with a long-term designer shell, a shared DBM-owned process experience system, and a model-driven placement strategy that is ready to carry forward into portal continuity.

## Feature set and deliverables

- long-term designer shell built around a graph-first authoring experience
- framework and library reset for the designer UX
- `DbmDesignerWorkspaceV1` sidecar for visual authoring state
- `DbmDesignerGraphDocumentV1` as the DBM-owned graph/interchange contract for designer-library portability
- shared process-experience renderer driven by `DbmProcessExperienceSnapshotV1`
- supported model-driven process host plus preferred above-tabs bridge overlay
- synthesis support for process-host artifacts and placement patches on existing forms
- form-state authoring and preview that remain mapping-first on existing Dataverse forms
- portal-facing continuity fixtures and responsive design system for the shared process experience
- release documentation and validation for the new designer and process UX foundation

Out of scope for this release:

- live Power Pages runtime
- queues, reassignment, delegation, escalation, and SLA timers
- timeline and audit trail
- Azure orchestration expansion
- pilot-readiness hardening and `v1.0.0`
- AI-assisted authoring or optimization
- simulation, replay, and governance-at-scale
- full generated main-form ownership

## Stages

### R2.1 Long-term designer shell and workspace contract

Output:
- locked long-term designer architecture that keeps `dbm-designer-core` as the durable editor engine while replacing the current Angular host direction with a React + TypeScript shell

Must include:
- final framework and library decision for the long-term designer UX
- preservation of the host-agnostic `dbm-designer-core` boundary
- `DbmDesignerWorkspaceV1` sidecar definition for canvas, viewport, preview, and UI-only state
- `DbmDesignerGraphDocumentV1` definition as a derived DBM-owned authoring/interchange graph rather than a library save format
- package-level storage strategy for canonical model plus workspace sidecar
- explicit adapter boundary so chosen graph libraries consume DBM graph documents without becoming authoritative persistence
- migration bridge from the legacy Angular shell without treating it as the future foundation

### R2.2 Graph-first authoring and preview-first designer

Output:
- approval/request modeling can be performed through a product-grade visual authoring experience rather than a tree-first property-grid shell

Must include:
- stage, step, outcome, branching, and convergence graph authoring
- actor-oriented visual grouping
- inline validation markers and issue navigation
- undo and redo, copy and paste, and keyboard-friendly editing
- context inspector and live preview alongside the graph canvas
- explicit internal-versus-portal preview switching
- direct inspection of form-state effects from the active process node
- raw JSON access for diagnostics and advanced review without making it the normal authoring path

### R2.3 Shared process experience system and model-driven host strategy

Output:
- one DBM-owned process experience system that renders the same process semantics consistently across model-driven and future portal surfaces

Must include:
- `DbmProcessExperienceSnapshotV1` as the shared derived UI read model
- host-neutral renderer for branching, convergence, status, ownership, progress, and action state
- hidden-stage collapsing and internal-versus-portal projection behavior
- supported model-driven host section placement at the top of the first business tab
- preferred unsupported above-tabs bridge overlay when the host shell can safely support it
- explicit fallback behavior so the supported host remains fully functional when the overlay is disabled or unavailable
- cross-form handoff messaging and jump-to-relevant-form-region affordances

### R2.4 Synthesis expansion, portal continuity fixtures, and release hardening

Output:
- release-shaped `R2` baseline that keeps existing-form ownership boundaries intact while preparing the shared process experience for `R3` portal delivery

Must include:
- synthesis emission for process-host columns, assets, bindings, and form patch instructions
- process-host artifact diff and readback expectations
- responsive process-experience design system and fixture harness for portal continuity
- component, visual-regression, and smoke-validation coverage for designer and process UX surfaces
- release documentation and implementation guidance for supported versus unsupported placement strategy

## Exit criteria

- the approval/request scenario can be authored visually from the new designer without relying on the old tree-first shell for normal work
- the same package can be opened and saved from model-driven and XrmToolBox hosts without divergence between canonical model and workspace sidecar
- business-process definitions remain recoverable from `DbmModelV1` alone, with graph rendering rebuilt through `DbmDesignerGraphDocumentV1` rather than any library-native graph JSON
- the approval/request scenario renders through the shared process-experience system with clear branching, current-state emphasis, audience projection, and cross-form handoff behavior
- the same process renderer works in the supported model-driven host and the preferred above-tabs overlay without changing business logic
- form-state-driven tabs, sections, controls, and field behavior remain coherent on the existing request and review forms
- generated metadata artifacts include the new process-host assets and placement patches without widening `R1` into full-form ownership
- a portal-targeted fixture harness can render the same visible process projection that the model-driven host uses, ready for live Power Pages integration in `R3`
