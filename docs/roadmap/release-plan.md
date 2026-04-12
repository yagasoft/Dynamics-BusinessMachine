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
| `R1` | Builder Platform MVP | let architects and developers define and run one real approval/request process through a designer-first experience |
| `R2` | Pilot-Ready End-To-End Platform | complete the portal-to-Dataverse-to-Azure-to-portal loop and harden to pilot-ready `v1.0.0` |
| `R3` | AI-Assisted Platform | add trustworthy AI assistance only after the core platform and operations are stable |

## Cross-release rules

- No secrets in Git.
- No release bypasses `Dev` and `UAT`.
- Every stage must end with testable output and clear exit criteria.
- The designer remains the primary product surface.
- Release 1 must include a real PCF runtime on model-driven forms.
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
- give architects and developers a real designer-first platform that can define and run one approval/request process through a model-driven experience, a portable XrmToolBox designer host, a shared runtime, and a real PCF form runtime

Feature set and deliverables:
- canonical DBM process model v1
- designer core extracted from host-specific UI
- model-driven designer host
- XrmToolBox designer host
- first real PCF process runtime on forms
- backend execution engine v1
- one approval/request reference solution
- Azure support services only where they clearly add value

Stages:
- `R1.1` Canonical model and runtime contract
- `R1.2` Designer core and host adapters
- `R1.3` Execution engine and PCF runtime
- `R1.4` Reference solution and release hardening

Details: [release-1-builder-platform-mvp.md](release-1-builder-platform-mvp.md)

### Release 2

Goal:
- turn the builder MVP into a pilot-ready platform where a real approval/request process starts in Power Pages, runs through Dataverse and Azure, returns to the front door, and is supportable in `UAT` and `Prod`

Feature set and deliverables:
- Power Pages front-door integration
- Azure orchestration and integration services
- end-to-end state return to the portal
- browser- or Azure-hosted administration surfaces where needed for pilot operation
- observability, supportability, rollback, and pilot runbooks

Stages:
- `R2.1` Portal contract and external entry
- `R2.2` Azure orchestration and service plane
- `R2.3` End-to-end lifecycle completion
- `R2.4` Pilot readiness and operational hardening

Details: [release-2-pilot-ready-v1.md](release-2-pilot-ready-v1.md)

### Release 3

Goal:
- add trustworthy AI assistance only after the platform contracts, portability, and operations are stable enough that generated output is useful and auditable

Feature set and deliverables:
- requirement-to-process draft generation
- logic and metadata assistance inside the designer
- AI-assisted validation and optimization suggestions
- traceable, reviewable AI outputs only

Stages:
- `R3.1` AI guardrails and contract
- `R3.2` Requirement analysis and draft generation
- `R3.3` Validation and optimization assistance
- `R3.4` Adoption and feedback loop

Details: [release-3-ai-assisted-platform.md](release-3-ai-assisted-platform.md)

## Release-specific acceptance scenarios

- `R0`: the current PoC can be rebuilt, packaged, deployed to `Dev`, promoted to `UAT`, and rolled back without manual secret handling
- `R1`: one approval/request flow can be authored in the designer, edited from both model-driven and XrmToolBox hosts, deployed by pipeline, rendered through PCF on forms, and executed through the backend runtime
- `R2`: the same approval/request flow can start in Power Pages, traverse Dataverse and Azure, return state to the portal, pass `UAT`, and be supported with documented rollback and operational diagnostics
- `R3`: AI can generate drafts and recommendations with full traceability, mandatory human review, and no direct unreviewed production mutation

## Current assumptions

- `main` remains the integration branch.
- Official docs and roadmap are tracked in `docs/`; `_codex/` remains local-only.
- The first portable designer host is XrmToolBox.
- Power Pages is the first front-door technology.
- Azure should be used early when it provides clear value.
- Branding should consistently use Ahmed Elsawalhy and Yagasoft where appropriate without becoming noisy.
