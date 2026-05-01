# Release 6: Reuse, templates, artefacts, and documents

## Goal

Turn DBM from a process designer into a reusable business automation platform with templates, generated artefacts, cloning, numbering, and document support.

## Feature set and deliverables

- Process templates and base flows.
- Sub-process reuse.
- Table row templates for create/update and related-row generation.
- Cloning with transform expressions.
- Generated artefacts from DBM maps.
- Service definitions and templates.
- String generator and auto-numbering support.
- Document management integration.
- Artefact browsing and use from process definitions.

## Stages

### R6.1 Process and sub-process reuse

Output:
- reusable templates and base flows

Must include:
- copyable templates
- expandable base flows
- reusable sub-process definitions
- versioned reuse references

### R6.2 Table row templates and cloning

Output:
- reusable row generation and cloning

Must include:
- create/update row templates
- related-row template links
- transform expressions
- custom step trigger contract
- returned record handling

### R6.3 Artefacts, services, and documents

Output:
- generated business artefacts tied to process definitions

Must include:
- artefact definition
- DBM map generation
- service definitions
- document management hooks
- artefact browsing per process

### R6.4 String generation and numbering

Output:
- reusable string and numbering foundation

Must include:
- CrmParser auto-numbering integration
- named indexes
- automatic index reference rows
- tests for repeatable numbering behaviour

## Exit criteria

- Users can reuse process pieces instead of copying one-off logic.
- Generated artefacts, rows, documents, and numbering are first-class platform assets.
