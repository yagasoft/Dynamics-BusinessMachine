# Deployment Promotion Runbook Template

## Runbook metadata

- Runbook name:
- Release:
- Target environment:
- Owner:
- Last reviewed:

## Purpose

Describe what this runbook promotes and when it should be used.

## Preconditions

- approved release candidate
- linked release notes
- required pipeline status green
- required secrets and environment access available

## Inputs

- source artifact version:
- source branch or tag:
- target environment:
- supporting configuration references:

## Promotion steps

1. Confirm the target release candidate and target environment.
2. Verify the required pipeline checks and release evidence.
3. Execute the approved promotion workflow.
4. Capture deployment evidence and timestamps.
5. Run smoke tests and capture results.
6. Record any deviations, issues, or follow-up actions.

## Smoke tests

- smoke test
- smoke test

## Failure handling

- stop conditions:
- escalation path:
- rollback reference:

## Post-promotion checks

- operational health
- application accessibility
- expected runtime behavior

## Evidence links

- workflow run:
- release notes:
- test evidence:
- rollback runbook:
