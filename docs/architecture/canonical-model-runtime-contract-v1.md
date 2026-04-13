# Canonical Model And Runtime Contract v1

This document defines the approved architectural target for the DBM canonical model, runtime contract, and packaging contract after the portal-spanning process refresh.

## Status

- Status: Approved architecture target
- Release scope: `R1.1` baseline plus the `R1.2.1` contract-alignment target
- Intended first scenario: one approval/request flow
- Current executable status:
  - `dbm-contract` and the checked-in example model still implement the earlier minimal stage-only baseline
  - `R1.2.1` must align the executable TypeScript types, JSON Schema, fixtures, and example model to this document

## Purpose

DBM needs one portable contract that all later hosts and runtimes consume.

This contract must:

- define one authoring model that is not tied to the current web-resource PoC shape
- define one business process that spans portal to backend to portal
- preserve a coherent DBM-owned process experience across model-driven and portal surfaces
- support hidden internal stages and steps without losing portal-visible status clarity
- support runtime execution across model-driven runtime, Dataverse, portal, and Azure-backed services
- keep Dataverse provider bindings, supported form behavior, and synthesis-owned artifacts attached to the model without turning those artifacts into the model
- give the next executable contract slice a decision-complete target

## Normative Platform Rules

- A DBM model is serialized as one UTF-8 JSON document.
- The top-level shape remains:
  - `schemaVersion`
  - `package`
  - `process`
  - `forms`
  - `metadata`
  - `rules`
  - `runtime`
  - `artifacts`
- The canonical DBM model is the source of truth for:
  - process semantics
  - portal-visible state projection
  - Dataverse provider bindings and synthesis-owned artifacts
  - runtime contracts
- Native Dataverse business process flow is not the source of truth. It may be generated later as an optional integration artifact where it adds value.
- All cross-references inside the model use stable string IDs, not host-specific paths, FormXml identifiers, Dataverse web-resource names, or assembly-qualified names.
- Host-specific and runtime-specific bindings are allowed only under explicit provider-binding fields. They must not replace portable IDs.
- `schemaVersion` is the contract family marker. Package release versioning belongs under `package.version`.

## Canonical Envelope

Every `DbmModelV1` document continues to follow this logical shape:

```json
{
  "schemaVersion": "dbm.model/v1",
  "package": {},
  "process": {},
  "forms": [],
  "metadata": {},
  "rules": [],
  "runtime": {},
  "artifacts": []
}
```

The architectural expansion approved here happens inside those sections.

## Package Contract

`package` remains the identity and compatibility envelope for the model.

It must continue to define:

- stable package identity and versioning
- supported hosts and runtimes
- compatibility policy
- deployment metadata

It now also needs to capture:

- which process UI surfaces are supported by the package
- whether the package exposes portal-visible state
- whether Dataverse schema synthesis and form-behavior patching are owned by the DBM synthesis layer

## Process Contract

`process` now describes a stage + step + form-state business process rather than a stage-only flow.

### Required process concerns

The architectural target for `process` must define:

- ordered stages
- stage branching and convergence
- steps within each stage
- step branching that can converge back to the same linked stage output
- form states that control what the user sees or can do at each point
- internal status versus portal-visible status
- ownership, notifications, and task expectations at the step level

### Stage model

Each stage must represent a durable process milestone and must define:

- stable identity and display metadata
- stage type
- entry and exit conditions
- portal visibility policy
- linked step flow
- linked outcome or stage-transition targets

Stage branching is allowed.

Stage visibility rules must support:

- visible to model-driven users
- visible to portal users
- internal-only stages hidden from portal users

### Step model

Steps are first-class process elements nested under a stage or otherwise linked to a stage-owned flow.

Each step must be capable of defining:

- stable identity and display metadata
- owner
- notification behavior
- task behavior
- internal status
- portal-visible status, when applicable
- assigned form state
- entry and exit conditions
- next-step branching
- convergence back to the same stage outcome or linked downstream stage

The contract must allow one stage to contain multiple alternative step paths that still resolve to the same stage-level outcome.

### Process state projection

The canonical process state must distinguish:

- full internal runtime state
- model-driven-visible state
- portal-visible state

Portal-visible state is a projection of canonical state, not a separate process model.

That projection must support:

- hiding internal stages and steps
- mapping one or more internal states to a single portal-facing status
- preserving user-friendly portal status without leaking internal process detail

## Form Contract

`forms` defines the model-driven form bindings, related form states, and DBM-managed form behavior consumed by the runtime and synthesis layer.

### Form rules

- Forms are model-driven forms, not custom form components.
- The DBM process UI is separate from the underlying model-driven forms.
- Forms may span multiple tables through declared bindings and related data projections.
- In `R1`, canonical forms bind to existing Dataverse forms through explicit provider bindings rather than generating full new form layouts.
- Same-table form variants should reuse the same underlying model-driven form and apply stateful manipulation through generated behavior instead of multiplying full standalone forms.

### Form-state model

Each form must support one or more `formStates` that define the active UI shape for a stage or step.

The architectural target for each form state must allow:

- tab, section, and control visibility
- editability and requirement changes
- state-specific labels or hints where needed
- state-specific logic bindings
- same-form variation without treating each variation as a separate full form

### Form provider ownership

In `R1`, the synthesis layer is responsible for patching DBM-managed fragments onto referenced Dataverse forms in `Dev`.

Release artifacts remain tracked and pipeline-driven. Direct environment mutation does not become the release source of truth. Full generated-form ownership is deferred to post-R1.

## Metadata Contract

`metadata` continues to define the portable business data model and provider-specific bindings.

### Expanded scope

The architectural target now assumes that the synthesis layer can generate or update:

- Dataverse columns
- Dataverse form bindings and DBM-managed form-behavior assets
- related metadata needed by the first reference scenario

Initial proof scope is:

- tables, columns, and relationships
- model-driven form bindings plus managed fragment patching on existing forms

Deferred target scope includes:

- generated main forms
- generated quick-view forms
- grids
- richer native Dataverse controls
- other native Dataverse components beyond the first proof scenario

### Multi-table process support

The canonical metadata model must support process forms that span multiple tables, including:

- a primary business record
- related supporting records
- reusable multi-table condition evaluation
- explicit provider bindings for joins or related record navigation

## Rules And Conditions Contract

`rules` continues to hold reusable business logic, but the contract now explicitly requires a first-class reusable condition component.

### Condition component

The condition component must be reusable anywhere a condition definition is required, including:

- stage branching
- step branching
- visibility
- assignment
- status projection
- form-state activation
- runtime guards

### Condition expectations

Conditions must be able to express:

- same-table comparisons
- multi-table comparisons
- join-like related-record navigation
- boolean composition
- reusable references from multiple parts of the model

The runtime implementation must evaluate conditions efficiently through compilation, caching, or other equivalent optimization. The architecture does not require conditions to be written in raw Dataverse query syntax.

## Runtime Contract

`runtime` defines the common execution boundary that all later runtime adapters must implement.

### Process experience ownership

The runtime contract now assumes:

- DBM owns the process UI and status experience
- model-driven runtime and portal runtime are different projections of the same canonical process state
- Dataverse owns authoritative persistence and stage or step transition decisions
- Azure remains optional support infrastructure where it adds clear value

### Model-driven experience target

The preferred model-driven target is a DBM-owned process experience rendered at the top of the form, above tabs.

If no supported placement can achieve the required proof in early `R1`, a simplified unsupported placement method may be used temporarily, but that does not change the product boundary or long-term target.

### Runtime request and result implications

The runtime request and result envelopes must evolve to carry:

- stage and step identity
- active form state
- full internal status
- portal-visible status projection
- multi-table subject context where the scenario needs it

## Packaging Contract

The packaging contract keeps deployable assets associated with the model without making deployment structure the primary authoring surface.

It now also needs to account for:

- generated Dataverse columns
- patched existing Dataverse form fragments
- process UI assets
- generated behavior needed for same-table form-state variation

Tracked release artifacts remain the durable release source of truth even when the designer engine can apply changes directly in `Dev`.

## Approval/Request Example Alignment

The approval/request scenario remains the first proof scenario.

That scenario must now be understood as supporting:

- internal stages and steps that may not all be visible to portal users
- step-level ownership, notifications, tasks, and status
- form states within the request and decision lifecycle
- a portal-facing status projection derived from internal process state

The currently checked-in example model remains a simplified stage-only baseline until `R1.2.1` updates the executable contract and example together.

## Legacy And Implementation Implications

The architectural direction approved here means:

- `dbm-contract` must be revised in `R1.2.1`, not just documented
- `dbm-designer-core` must evolve from stage-only editing into stage + step + form-state authoring
- Dataverse schema synthesis and provider-bound form behavior become part of the synthesis boundary
- native BPF, if generated later, is downstream from the canonical model rather than upstream into it

## Non-Normative Future Capability Extension Areas

This appendix records likely future sophistication surfaces. It is descriptive only.

- It does not change the current executable `v1` contract.
- It does not imply that `dbm-contract`, the current example model, or the checked-in schemas already support these surfaces.
- Any executable adoption of these areas must happen through deliberate later revisions to `dbm-contract`, `dbm-designer-core`, and the example models.

Likely future extension areas include:

- work-item and queue contracts for assignment, reassignment, delegation, escalation, and SLA behavior
- timeline and audit-event contracts for transitions, notifications, mutations, and support diagnostics
- explainability traces for branching, visibility, assignment, status projection, synthesis, and validation outcomes
- synthesis plans, preview diffs, and drift-report surfaces
- reusable templates, subflows, policy packs, and shared step groups
- simulation, replay, and debugger session hooks
- richer observability and optimization signals

## Related Docs

- [Product Principles](product-principles.md)
- [Current-State Baseline](current-state-baseline.md)
- [Target Platform Architecture](target-platform-architecture.md)
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
- [ADR-0002: Designer-First And Portable Host Strategy](../adr/0002-designer-first-and-host-strategy.md)
- [ADR-0003: Shared Runtime Contract And Mandatory Model-Driven Runtime](../adr/0003-runtime-and-pcf-strategy.md)
- [ADR-0008: Canonical Contract Authority And Format](../adr/0008-canonical-contract-authority-and-format.md)
- [ADR-0009: DBM Process UI, Portal State Projection, and Generated Dataverse Artifacts](../adr/0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
