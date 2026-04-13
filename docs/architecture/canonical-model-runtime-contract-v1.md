# Canonical Model And Runtime Contract v1

This document defines the approved R1.1 baseline for the DBM canonical model, runtime contract, and packaging contract.

For this docs-first R1.1 slice, this document is the authoritative product specification. The future executable authority will be implemented as TypeScript backed by JSON Schema, as locked by ADR-0008.

## Status

- Status: Approved R1.1 baseline
- Release scope: `R1.1 Canonical model and runtime contract`
- Intended first scenario: one approval/request flow
- Current slice: docs-first contract definition only

## Purpose

DBM needs one portable contract that all later hosts and runtimes consume.

This contract must:

- define one authoring model that is not tied to the current web-resource PoC shape
- allow both supported R1 hosts to edit the same model
- support runtime execution across PCF, Dataverse, and Azure-backed services
- keep deployment assets attached to the model without turning those assets into the model
- give the next implementation slice a decision-complete target for TypeScript types and JSON Schema

## Normative Rules

- A DBM model is serialized as one UTF-8 JSON document.
- The top-level shape is fixed for `v1` and must contain these sections in this order:
  - `schemaVersion`
  - `package`
  - `process`
  - `forms`
  - `metadata`
  - `rules`
  - `runtime`
  - `artifacts`
- All cross-references inside the model use stable string IDs, not host-specific paths, Dataverse web-resource names, or assembly-qualified names.
- Host-specific and runtime-specific bindings are allowed only under explicit provider-binding fields. They must not replace the portable IDs.
- External scripts, templates, binaries, and other deployable payloads are referenced through `artifacts`. They are supporting assets, not the canonical model itself.
- `schemaVersion` is the contract family marker. Package release versioning belongs under `package.version`.

## Canonical Envelope

Every `DbmModelV1` document must follow this logical shape:

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

### Top-Level Sections

| Section | Type | Purpose |
| --- | --- | --- |
| `schemaVersion` | string | Fixed contract family identifier for the serialized model |
| `package` | object | Identity, compatibility, deployment metadata, and supported surfaces |
| `process` | object | The portable business-process definition |
| `forms` | array | Form definitions used by process stages |
| `metadata` | object | Portable business data model plus provider bindings |
| `rules` | array | Validation, condition, derivation, and action rules |
| `runtime` | object | Execution contract, capabilities, and request/response envelopes |
| `artifacts` | array | Referenced deployable assets such as scripts, templates, controls, or binaries |

## Package Contract

`package` is the identity and compatibility envelope for the model.

### Required Fields

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Stable package identifier, lowercase kebab-case |
| `displayName` | string | Human-readable name |
| `version` | string | SemVer for the model package |
| `publisher` | object | Product/publisher identity metadata |
| `entryProcessId` | string | Must reference `process.id` |
| `supportedHosts` | array | R1 values are `model-driven` and `xrmtoolbox` |
| `supportedRuntimes` | array | R1 values are `pcf`, `dataverse`, and optional `azure` support services |
| `compatibility` | object | Reader/writer compatibility rules |
| `deployment` | object | Product deployment metadata needed by later packaging flows |

### Required `publisher` Fields

- `name`
- `website`
- `prefix`

### Required `compatibility` Fields

- `minimumReaderSchemaVersion`
- `maximumReaderSchemaVersion`
- `breakingChangePolicy`

For `v1`, use:

- `minimumReaderSchemaVersion`: `dbm.model/v1`
- `maximumReaderSchemaVersion`: `dbm.model/v1`
- `breakingChangePolicy`: `reject-newer-major`

### Required `deployment` Fields

- `solutionName`
- `releaseLine`
- `artifactRoot`

`solutionName` may align with Dataverse packaging, but the package contract remains portable. Dataverse solution naming is deployment metadata, not the package identity.

## Process Contract

`process` defines the portable approval/request flow itself.

### Required Fields

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Stable process identifier |
| `displayName` | string | Human-readable name |
| `scenarioType` | string | For R1 this is `approval-request` |
| `actors` | array | All actors referenced by stages or rules |
| `variables` | array | Process-scoped variables |
| `stages` | array | Ordered stage definitions |
| `transitions` | array | Allowed stage-to-stage movement |
| `outcomes` | array | Terminal or externally visible result states |

### Actor Definition

Each actor must define:

- `id`
- `displayName`
- `actorType`
- `source`

R1 actor types are:

- `requester`
- `approver`
- `system`

R1 actor sources are:

- `current-user`
- `field-binding`
- `rule-derived`
- `system`

### Variable Definition

Each variable must define:

- `id`
- `dataType`
- `scope`
- `defaultValue`
- `persistence`

R1 variable scope is always `process`.

R1 persistence values are:

- `runtime-only`
- `persisted`

### Stage Definition

Each stage must define:

- `id`
- `displayName`
- `stageType`
- `actorId`
- `formId`
- `entryRuleIds`
- `exitRuleIds`
- `allowedOutcomeIds`

R1 stage types are:

- `start`
- `task`
- `approval`
- `system`
- `end`

Rules:

- `stageType: start` must be unique within the process.
- `stageType: end` may appear multiple times only when distinct outcomes are required.
- `actorId` must reference a declared actor unless `stageType` is `system`.
- `formId` is required for `task` and `approval` stages and omitted for pure `system` stages.

### Transition Definition

Each transition must define:

- `id`
- `fromStageId`
- `toStageId`
- `outcomeId`
- `guardRuleId`

Rules:

- `fromStageId` and `toStageId` must reference declared stages.
- `guardRuleId` must reference a `condition` rule.
- Terminal transitions must lead to an `end` stage.

## Form Contract

`forms` defines portable form surfaces consumed by the PCF runtime and later by host adapters.

Each form must define:

- `id`
- `displayName`
- `entityId`
- `layout`
- `elements`

### Layout

`layout` must define:

- `layoutType`
- `regions`

R1 `layoutType` is `single-page`.

Each region must define:

- `id`
- `displayName`
- `order`

### Element Definition

Each element must define:

- `id`
- `elementType`
- `regionId`
- `displayName`
- `binding`
- `behavior`

R1 `elementType` values are:

- `text`
- `multiline-text`
- `number`
- `currency`
- `choice`
- `lookup`
- `date`
- `read-only-text`

`binding` must reference either:

- a `metadata` field via `fieldId`, or
- a `process` variable via `variableId`

`behavior` must define:

- `requiredRuleIds`
- `visibleRuleIds`
- `editableRuleIds`

All three are arrays of rule IDs and may be empty.

## Metadata Contract

`metadata` defines the portable business data model and its provider-specific bindings.

### Required Fields

- `entities`
- `relationships`

### Entity Definition

Each entity must define:

- `id`
- `displayName`
- `providerBindings`
- `primaryKeyFieldId`
- `fields`

For R1, `providerBindings` may include `dataverse`, and later may include other providers. Portable consumers must use the canonical `id`, not the provider logical name.

### Field Definition

Each field must define:

- `id`
- `displayName`
- `dataType`
- `providerBindings`
- `isRequired`
- `isReadOnly`

R1 field data types are:

- `string`
- `multiline-string`
- `integer`
- `decimal`
- `currency`
- `boolean`
- `choice`
- `lookup`
- `date`
- `datetime`

### Relationship Definition

Each relationship must define:

- `id`
- `fromEntityId`
- `toEntityId`
- `relationshipType`
- `providerBindings`

R1 relationship types are:

- `one-to-many`
- `many-to-one`

## Rule Contract

`rules` contains all reusable business rules referenced by process stages, transitions, and forms.

Each rule must define:

- `id`
- `displayName`
- `ruleType`
- `scope`
- `language`
- `body`

### Rule Types

R1 rule types are:

- `condition`
- `validation`
- `derivation`
- `action`

### Scope Values

R1 scopes are:

- `process`
- `stage`
- `transition`
- `form`
- `field`

### Language Boundary

R1 language values are:

- `dbm-expression-v1`
- `javascript-artifact-v1`

Rules:

- `condition` and `validation` rules use `dbm-expression-v1`.
- `derivation` and `action` rules may use either `dbm-expression-v1` or `javascript-artifact-v1`.
- `javascript-artifact-v1` rules must reference an `artifactId` from `artifacts`; they must not inline host-specific file paths or Dataverse web-resource names.

### Expression Boundary

`dbm-expression-v1` is the portable expression subset used for:

- field and variable comparisons
- boolean composition
- null and emptiness checks
- simple arithmetic and threshold checks

It does not own:

- direct persistence
- direct network access
- direct Dataverse request construction
- host UI manipulation

Those imperative behaviors belong to runtime adapters and referenced artifacts.

## Runtime Contract

`runtime` defines the common execution boundary that all later runtime adapters must implement.

### Required Fields

- `capabilities`
- `requestContract`
- `resultContract`
- `ownership`

### Capabilities

R1 capabilities are:

- `load-record`
- `render-form`
- `validate-input`
- `evaluate-rules`
- `persist-record`
- `advance-stage`
- `invoke-artifact`
- `emit-notification`

### Ownership

Runtime ownership is fixed for R1:

- `pcf`
  - owns form rendering and local interaction
  - may run non-authoritative validation and derivation for responsiveness
  - must not commit authoritative stage changes without backend confirmation
- `dataverse`
  - owns authoritative persistence and stage transition decisions for the R1 scenario
  - owns in-platform artifact execution and final validation outcome
- `azure`
  - optional in R1
  - used only when support services add clear value
  - must not define an alternate process model

### Runtime Request Envelope

The later executable contract must implement this logical request shape:

```json
{
  "schemaVersion": "dbm.runtime.request/v1",
  "operation": "initialize | load-form | validate | submit | transition",
  "model": {
    "packageId": "string",
    "packageVersion": "string",
    "processId": "string"
  },
  "runtime": {
    "host": "model-driven | xrmtoolbox",
    "engine": "pcf | dataverse | azure",
    "capabilities": ["..."]
  },
  "actor": {
    "actorId": "string",
    "userId": "string",
    "roleIds": ["..."]
  },
  "subject": {
    "entityId": "string",
    "recordId": "string"
  },
  "state": {
    "stageId": "string",
    "fields": {},
    "variables": {}
  },
  "command": {
    "requestedOutcomeId": "string"
  },
  "correlationId": "string"
}
```

### Runtime Result Envelope

The later executable contract must implement this logical result shape:

```json
{
  "schemaVersion": "dbm.runtime.result/v1",
  "status": "ok | validation-failed | blocked | error",
  "state": {
    "stageId": "string",
    "fields": {},
    "variables": {}
  },
  "effects": {
    "persist": [],
    "notifications": [],
    "artifactCalls": []
  },
  "messages": [],
  "errors": [],
  "correlationId": "string"
}
```

Rules:

- `correlationId` must round-trip from request to result.
- Portable consumers must depend on `status`, `state`, and structured `effects`, not runtime-specific log text.
- Validation failures are business outcomes, not transport failures.

## Packaging Contract

The packaging contract keeps deployable assets associated with the model without making deployment structure the primary authoring surface.

### Artifact Definition

Each `artifacts` entry must define:

- `id`
- `artifactType`
- `displayName`
- `runtimeTargets`
- `packagingTarget`
- `sourceRef`
- `required`

R1 `artifactType` values are:

- `script`
- `template`
- `static-asset`
- `pcf-control`
- `plugin-assembly`
- `config`

R1 `packagingTarget` values are:

- `dataverse-webresource`
- `dataverse-plugin`
- `repo-only`
- `azure-app`

Rules:

- Model-internal references use `artifactId`.
- `sourceRef` identifies the source payload in repo or package space.
- Dataverse-specific names such as `ys_/dbm/...` may exist only in packaging metadata, not in the canonical references used by process, form, metadata, or rule sections.
- A package is invalid if any referenced required artifact is missing.

## Serialization Defaults

- IDs are lowercase kebab-case.
- Arrays preserve author order.
- Object maps inside runtime state are keyed by canonical field ID or variable ID.
- Nullable data is represented explicitly as `null`.
- Provider bindings are optional, but any model intended for Dataverse deployment must include the `dataverse` provider bindings needed by its metadata and artifacts.

## Approval/Request Example

This example defines the minimum R1 scenario the contract must support.

### Actors

| Actor ID | Type | Source | Purpose |
| --- | --- | --- | --- |
| `requester` | `requester` | `current-user` | Creates and submits the request |
| `manager-approver` | `approver` | `field-binding` | Reviews and decides the request |
| `platform` | `system` | `system` | Applies system-owned updates |

### Metadata

| Entity ID | Purpose | Example Dataverse Binding |
| --- | --- | --- |
| `request` | Primary request record | `ys_request` |
| `request-decision` | Optional review/decision data | `ys_requestdecision` |

| Field ID | Entity | Type | Purpose |
| --- | --- | --- | --- |
| `request-title` | `request` | `string` | Request summary |
| `request-amount` | `request` | `currency` | Approval amount |
| `request-justification` | `request` | `multiline-string` | Business reason |
| `request-status` | `request` | `choice` | Draft, submitted, approved, rejected |
| `assigned-approver` | `request` | `lookup` | Target approver |
| `decision-comment` | `request-decision` | `multiline-string` | Review note |

### Forms

| Form ID | Used By | Key Elements |
| --- | --- | --- |
| `request-entry-form` | Draft/requester stage | title, amount, justification, assigned approver |
| `manager-decision-form` | Approval stage | read-only request summary, decision comment |

### Stages

| Stage ID | Type | Actor | Form | Outcome |
| --- | --- | --- | --- | --- |
| `draft-request` | `start` | `requester` | `request-entry-form` | submit or cancel |
| `manager-review` | `approval` | `manager-approver` | `manager-decision-form` | approve or reject |
| `approved` | `end` | `platform` | none | approved |
| `rejected` | `end` | `platform` | none | rejected |

### Transition Rules

| Transition | Guard |
| --- | --- |
| `draft-request` -> `manager-review` | required fields present and approver assigned |
| `manager-review` -> `approved` | approval outcome selected |
| `manager-review` -> `rejected` | rejection outcome selected and rejection comment present |

### Rule Expectations

- Submission validates requester-entered required fields.
- Rejection requires a decision comment.
- Approval or rejection updates the canonical `request-status`.
- Runtime adapters may invoke scripts to enrich the process, but the stage flow and business meaning remain in the model.

## Appendix A: Legacy Mapping

| Area | Current Role | R1.1 Classification | Treatment |
| --- | --- | --- | --- |
| `dbm-app` | Web-resource editor plus JSON tree/property editing | selective reuse | Reuse editor interaction patterns only; redesign content model and host boundary |
| `dbm-script-lib` | Shared JS runtime primitives and object model | reusable seed | Keep entity/service/cache/logger patterns where they fit the new contract |
| `dbm-js-vm` | Thin browser fetch-and-run bridge | adapter-only seed | Redesign around the runtime request/result contract |
| `dbm-web-resources` | Dataverse helper code and BroadcastChannel form bridge | selective reuse | Reuse Dataverse helper patterns only; current bridge is not the target runtime shape |
| `DbmSolution/Plugins` | Jint-based Dataverse execution proof | reusable seed | Keep backend execution concepts; redesign inputs and outputs to the canonical contract |
| `DbmSolution/DynamicsDbmXtbPlugin` | XrmToolBox plugin for patch promotion, not a designer host | redesign | Do not treat current plugin UX as the R1 designer host foundation |
| `power-platform` | Dataverse solution baseline and package manifest | reusable foundation | Keep as the delivery baseline while moving model references away from web-resource identity |
| `eng` and `.github/workflows` | Build, validation, packaging, deployment, release evidence | reusable foundation | Keep and extend as later executable contract artifacts appear |

## Appendix B: Implementation Notes For The Next Slice

The next implementation slice should create the executable contract, not revisit product decisions. It should:

- encode `DbmModelV1` as TypeScript types
- encode the same contract as JSON Schema
- add one checked-in approval/request example model owned by tracked docs
- keep the executable schema in a dedicated top-level contract package
- validate that example model in CI
- leave host and runtime rewiring for the following slice unless explicitly expanded

## Related Docs

- [Product Principles](product-principles.md)
- [Current-State Baseline](current-state-baseline.md)
- [Target Platform Architecture](target-platform-architecture.md)
- [Release 1 Builder Platform MVP](../roadmap/release-1-builder-platform-mvp.md)
- [ADR-0002: Designer-First And Portable Host Strategy](../adr/0002-designer-first-and-host-strategy.md)
- [ADR-0003: Shared Runtime Contract And Mandatory PCF Form Runtime](../adr/0003-runtime-and-pcf-strategy.md)
- [ADR-0008: Canonical Contract Authority And Format](../adr/0008-canonical-contract-authority-and-format.md)
