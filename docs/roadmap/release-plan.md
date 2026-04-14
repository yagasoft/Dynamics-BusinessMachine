# DBM Release Plan

This document defines the approved high-level release ladder for DBM and the stage structure inside each release.

## Planning frame

- integration baseline: `main`
- delivery model: GitHub Flow plus release and hotfix branches
- permanent environments: `Dev`, `UAT`, `Prod`
- official docs: tracked in `docs/`
- local planning and execution notes: `_codex/dbm-revival/`
- `v1.0.0`: pilot-ready end-to-end platform, not full product maturity

## Release ladder

| Release | Name | Goal |
| --- | --- | --- |
| `R0` | Engineering Foundation And Product Baseline | make the repo, environments, docs, and delivery posture production-grade enough to support later feature work |
| `R1` | Builder Platform MVP | let architects and developers define and run one real approval/request process through a DBM-owned designer-first experience with portal-compatible state projection |
| `R2` | Designer And Process Experience Platform | turn the `R1` bridges into product-grade designer and process-experience foundations before pilot-readiness work resumes |
| `R3` | Pilot-Ready End-To-End Platform | complete the live portal-to-Dataverse-to-Azure-to-portal loop and harden to pilot-ready `v1.0.0` on top of the new `R2` foundation |
| `R4` | AI-Assisted Platform | add trustworthy AI assistance only after the core platform, designer surfaces, and operations are stable |
| `R5` | Enterprise Sophistication And Optimization | deepen the platform with simulation, reuse, synthesis governance, advanced observability, and optimization beyond the pilot-ready baseline |

## Cross-release rules

- No secrets in Git.
- No release bypasses `Dev` and `UAT`.
- Every stage must end with testable output and clear exit criteria.
- The designer remains the primary product surface.
- Release 1 must include a real DBM-owned model-driven runtime.
- The first post-`R1` release must productize the designer and DBM-owned process experience before pilot-readiness work resumes.
- Portal projection semantics are defined in Release 1 before the live Power Pages runtime arrives in Release 3.
- AI is out of scope until after `v1.0.0`.

## Shared release gates

Every release must pass these base gates before promotion:

- build, package, and static validation for .NET, TypeScript, docs, Dataverse artifacts, and Azure artifacts
- secret scanning, dependency scanning, and release-blocking configuration checks
- promotion through `Dev` and `UAT` before `Prod`
- release-note generation, rollback plan, and smoke tests

## Release summaries

### Release 0

Goal:
- make the repo, environments, docs, security posture, and delivery system production-grade enough that every later feature release can be built without debt

Feature set and deliverables:
- tracked docs baseline in `docs/`
- release governance and acceptance criteria
- branching and versioning model
- CI/CD for code, Dataverse, docs, and Azure
- secret management and environment promotion
- current PoC recovery and deploy validation

Stages:
- `R0.1` Product governance and tracked docs
- `R0.2` Repo and branching foundation
- `R0.3` Delivery and secret-management foundation
- `R0.4` Environment and recovery baseline

Details: [release-0-engineering-foundation.md](release-0-engineering-foundation.md)

### Release 1

Goal:
- give architects and developers a real designer-first platform that can define and run one approval/request process through a DBM-owned model-driven experience, supported Dataverse synthesis, existing Dataverse forms plus DBM-managed behavior, a shared runtime, and portal-compatible state projection

Feature set and deliverables:
- canonical DBM process model v1
- stage + step + form-state semantics
- reusable condition component
- advanced designer core and host adapters
- hybrid Dataverse synthesis pipeline for direct `Dev` proof plus packaged promotion
- Dataverse schema synthesis foundation for tables, columns, and relationships
- existing Dataverse forms plus supported JS behavior
- first real DBM-owned model-driven process runtime
- backend execution engine v1
- one approval/request reference solution
- Azure support services only where they clearly add value

Stages:
- `R1.1` Canonical model and runtime contract
- `R1.2.1` Process semantics and contract alignment
- `R1.2.2` Advanced designer UX foundation
- `R1.2.3a` Dataverse synthesis foundation
- `R1.2.3b` Existing forms and behavior synthesis
- `R1.2.4` Host adapters and portability completion
- `R1.3` Execution engine and model-driven runtime
- `R1.4` Reference solution and release hardening

Details: [release-1-builder-platform-mvp.md](release-1-builder-platform-mvp.md)

Closeout: [r1-close-out-0.3.0.md](../releases/r1-close-out-0.3.0.md)

### Release 2

Goal:
- turn the shipped `R1` builder-platform MVP into a product-grade authoring and runtime-foundation release by replacing the bridge-quality designer host and notification-based process runtime with a long-term designer shell, a shared DBM-owned process experience system, and a model-driven placement strategy that is ready to carry forward into portal continuity

Feature set and deliverables:
- long-term designer shell built around a graph-first authoring experience
- framework and library reset for the designer UX
- `DbmDesignerWorkspaceV1` sidecar for visual authoring state
- shared process-experience renderer driven by `DbmProcessExperienceSnapshotV1`
- supported model-driven process host plus preferred above-tabs bridge overlay
- synthesis support for process-host artifacts and placement patches on existing forms
- form-state authoring and preview that remain mapping-first on existing Dataverse forms
- portal-facing continuity fixtures and responsive design system for the shared process experience
- release documentation and validation for the new designer and process UX foundation

Stages:
- `R2.1` Long-term designer shell and workspace contract
- `R2.2` Graph-first authoring and preview-first designer
- `R2.3` Shared process experience system and model-driven host strategy
- `R2.4` Synthesis expansion, portal continuity fixtures, and release hardening

Details: [release-2-designer-and-process-experience-platform.md](release-2-designer-and-process-experience-platform.md)

### Release 3

Goal:
- turn the `R2` designer and process-experience foundation into a pilot-ready platform where the same approval/request process uses the shared DBM process experience, starts in Power Pages, runs through Dataverse and Azure, returns to the front door, and is supportable in `UAT` and `Prod`

Feature set and deliverables:
- Power Pages runtime built on the `R1` portal projection contract and the shared process-experience system delivered in `R2`
- work-management core with inboxes, queues, reassignment, delegation, escalation, and SLA timers
- timeline and audit trail as first-class runtime output
- support and administration surfaces
- runtime observability baseline
- Azure orchestration and integration services
- end-to-end state return to the portal
- browser- or Azure-hosted administration surfaces where needed for pilot operation
- observability, supportability, rollback, and pilot runbooks

Stages:
- `R3.1` Portal runtime and external entry
- `R3.2` Azure orchestration and service plane
- `R3.3` End-to-end lifecycle completion
- `R3.4` Pilot readiness and operational hardening

Details: [release-3-pilot-ready-v1.md](release-3-pilot-ready-v1.md)

### Release 4

Goal:
- add trustworthy AI assistance only after the platform contracts, portability, and operations are stable enough that generated output is useful, reviewable, and auditable

Feature set and deliverables:
- requirement-to-process draft generation
- logic and metadata assistance inside the designer
- AI-assisted validation and optimization suggestions
- logic and condition suggestion, missing-step analysis, missing-data analysis, and test-scenario generation from the canonical model
- optimization recommendations for forms, statuses, branching, performance, and cost
- traceable, reviewable AI outputs only

Stages:
- `R4.1` AI guardrails and contract
- `R4.2` Requirement analysis and draft generation
- `R4.3` Validation and optimization assistance
- `R4.4` Adoption and feedback loop

Details: [release-4-ai-assisted-platform.md](release-4-ai-assisted-platform.md)

### Release 5

Goal:
- extend the pilot-ready platform into an enterprise-grade design, governance, simulation, and optimization platform

Feature set and deliverables:
- process simulator and replay debugger
- enterprise-grade explainability across authoring and runtime
- synthesis governance and drift management at scale
- reusable process building blocks, subflows, templates, and policy packs
- advanced observability, analytics, and optimization
- richer multi-table modeling and operational control-plane depth

Stages:
- `R5.1` Simulation and replay debugger
- `R5.2` Reuse, templates, and policy packs
- `R5.3` Synthesis governance and drift control
- `R5.4` Advanced observability and optimization

Details: [release-5-enterprise-sophistication.md](release-5-enterprise-sophistication.md)

## Release-specific acceptance scenarios

- `R0`: the current PoC can be rebuilt, packaged, deployed to `Dev`, promoted to `UAT`, and rolled back without manual secret handling
- `R1`: one approval/request flow can be authored in the designer, synthesized into the required Dataverse schema, bound to existing Dataverse forms with DBM-managed supported behavior, edited from both model-driven and XrmToolBox hosts, rendered through the DBM-owned model-driven process experience, projected to portal-visible status, and executed through the backend runtime
- `R2`: the same approval/request flow can be authored through a graph-first designer, rendered through a shared DBM-owned process-experience system, hosted in model-driven through both supported and preferred bridge placements, and previewed for future portal continuity without changing the canonical model boundary
- `R3`: the same approval/request flow can start in Power Pages, traverse Dataverse and Azure, return state to the portal, pass `UAT`, and be supported with documented rollback and operational diagnostics
- `R4`: AI can generate drafts and recommendations with full traceability, mandatory human review, and no direct unreviewed production mutation
- `R5`: the platform can simulate, explain, govern, and optimize complex process portfolios at enterprise scale without losing portability or operational control

## Current assumptions

- `main` remains the integration branch.
- Official docs and roadmap are tracked in `docs/`; `_codex/` remains local-only.
- The first portable designer host is XrmToolBox.
- Power Pages is the first front-door technology.
- Azure should be used early when it provides clear value.
- The first post-`R1` release is the designer and process-experience productization release rather than the pilot-ready portal release.
- Branding should consistently use Ahmed Elsawalhy and Yagasoft where appropriate without becoming noisy.
