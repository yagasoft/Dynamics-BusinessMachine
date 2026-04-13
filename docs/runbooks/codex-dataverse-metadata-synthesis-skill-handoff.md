# Codex Dataverse Metadata Synthesis Skill Handoff

## Purpose

This document preserves the approved handoff prompt for a separate thread that will build a **global Codex skill** for Dataverse metadata synthesis. The skill itself is intentionally out of scope for the current DBM implementation branch.

## Approved prompt

```text
Build a new global Codex skill named `dataverse-metadata-synthesis` under `%USERPROFILE%\.codex\skills` (or `${CODEX_HOME}/skills` if `CODEX_HOME` is set).

This skill must be global and reusable across projects, not DBM-specific. Its purpose is to help Codex understand and work with Dataverse metadata synthesis, including:
- solution structure (`solution.xml`, `customizations.xml`, root components, component types, layering)
- model-driven form XML / `systemform`
- metadata API operations for tables, columns, relationships, publish, and solution-component registration
- readback, normalization, diff, and drift analysis
- when to use direct Dataverse metadata mutation in Dev versus tracked solution-source emission and PAC packaging

Use the local `skill-creator` guidance first:
- open `C:\Users\Ahmed Elsawalhy\.codex\skills\.system\skill-creator\SKILL.md`
- follow the normal Codex skill layout with `SKILL.md`, `agents/openai.yaml`, `references/`, and `scripts/`

Important design rules:
- keep the skill project-agnostic
- do not hardcode DBM-specific assumptions into the main SKILL.md
- if DBM examples are useful, put them in optional references and clearly mark them as examples rather than global rules
- the skill should teach a hybrid strategy:
  - canonical app model as source of truth
  - direct Dev metadata apply/readback where appropriate
  - tracked solution-source emission and PAC packaging for durable release artifacts
- do not make raw solution XML the primary authoring surface; treat it as one artifact family within a broader synthesis workflow

Build the skill from a curated corpus, not from a full default-solution export. Use these preferred inputs if available:
1. a small unmanaged “skill-seed” solution export containing:
   - one custom table
   - representative column types
   - one relationship
   - one main form
   - one view
2. a second unmanaged export focused on richer form structure
3. matching metadata API readback snapshots for those components
4. optionally, one DBM solution export as a project-specific reference, not as the global baseline

If those curated exports are not yet available, design the skill so it can accept them later and start with the best available compact exports.

Deliverables:
- a complete `dataverse-metadata-synthesis` skill folder
- concise `SKILL.md`
- `agents/openai.yaml`
- reference files covering solution structure, FormXML, metadata APIs, PAC packaging, and drift/readback
- helper scripts to inventory and normalize solution exports and summarize form XML
- validation using the local skill validation flow
- forward-testing on:
  - one DBM-style task
  - one non-DBM Dataverse-style task

The final result should let another Codex instance use the skill to:
- analyze an exported or unpacked Dataverse solution
- identify what artifacts are needed for new tables/columns/forms
- reason about Dev direct-apply vs packaged release outputs
- summarize form XML structure
- reason about drift between live Dataverse metadata and tracked solution source
```
