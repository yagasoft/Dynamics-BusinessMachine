# ADR-0008: Canonical Contract Authority And Format

- Status: Accepted
- Date: 2026-04-13
- Decision owners: Ahmed Elsawalhy, Yagasoft

## Context

R1.1 needs a single canonical DBM contract before host adapters, runtime work, or packaging changes can safely proceed. The repo already contains useful runtime scaffolding, declaration surfaces, and packaging pipelines, but those assets still reflect a PoC-era shape and do not yet provide one authoritative product contract. The first R1 slice is therefore docs-first: we need to lock the product shape before we let implementation details harden around it.

## Decision

- The R1.1 canonical DBM contract is authoritative in tracked documentation first.
- The canonical contract must define the process, form, metadata, rule, runtime, and packaging boundaries as one product-level model rather than as host-specific conventions.
- The current `dbm-script-lib`, `dbm-web-resources`, `dbm-js-vm`, and related declaration files are compatibility references only until they are aligned to the canonical contract.
- The future executable authority for the same contract will be TypeScript source plus JSON Schema validation, with the tracked docs remaining the narrative reference for intent and compatibility rules.
- Any implementation that conflicts with the canonical contract must be treated as transitional and redesigned to match the contract, not promoted as the new source of truth.

## Consequences

- We can complete R1.1 without first rewriting host code or runtime plumbing.
- Designers, runtimes, and packaging can converge on one shared shape instead of growing separate conventions.
- Later implementation work will need to align source, generated types, and schema validation to this contract, which may require compatibility shims while the old PoC surfaces are retired.
- Any drift between docs, declarations, and runtime behavior becomes a tracked defect rather than an implicit product rule.

## Alternatives considered

- Keep the current declaration files as the authority
  - rejected because the declarations already diverge from source behavior and would preserve contract drift
- Make the runtime implementation the authority first
  - rejected because it would hard-code PoC-era assumptions before the product contract is stable
- Split authority by host or runtime
  - rejected because R1.1 needs one canonical contract that can be consumed across hosts and runtimes
- Skip a docs-first slice and move straight to code
  - rejected because the current codebase still lacks a stable canonical model and runtime boundary

## Related docs

- [Canonical Model And Runtime Contract v1](../architecture/canonical-model-runtime-contract-v1.md)
- [Release 1: Process/stage designer and actual form render](../roadmap/release-1-process-stage-designer-and-form-render.md)
- [Release Plan](../roadmap/release-plan.md)
- [DBM Documentation Index](../README.md)
