# Current-state baseline

This document records the current DBM source posture after the process-first roadmap reset.

## Baseline sources

- active source branch: `main`
- reset authority: [ADR-0016](../adr/0016-product-roadmap-reset-process-first.md)
- active roadmap: [Release Plan](../roadmap/release-plan.md)

## Current classification

The current implementation is prototype/reference material.

It remains valuable because it proves several useful ideas, but it is not a shipped product baseline and it does not constrain the new product `R1`.

## Useful reference candidates

The following areas can be mined during future implementation slices:

- `dbm-designer-core` for host-agnostic designer concepts
- `dbm-designer-shell` for graph/workspace and host-shell experiments
- `dbm-process-experience` for process renderer ideas
- `dbm-dataverse-synthesis` for Dataverse synthesis, readback, diff, and generated metadata concepts
- `dbm-script-lib` and `dbm-js-vm` for JavaScript VM and shared runtime ideas
- `dbm-app` editor components for CodeMirror and CKEditor reference implementation
- `DbmSolution\Plugins\Evaluation\Steps\DbmEvaluateScript.cs` for Jint-based server execution reference

## What the current implementation is not

- It is not the active R1 product.
- It is not a released customer baseline.
- It is not proof that the old release ladder should remain active.
- It is not the authoritative process portfolio model.

## Reset implications

- `R0` remains the engineering and governance foundation.
- Product delivery restarts at new `R1`.
- New work should reuse existing code only when it fits the process-first roadmap and passes current TDD expectations.
- Old closeout records remain useful evidence, but they are now historical prototype/reference evidence.
