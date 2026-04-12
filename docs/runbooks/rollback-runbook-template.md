# Rollback Runbook Template

## Runbook metadata

- Runbook name:
- Release:
- Environment:
- Owner:
- Last reviewed:

## Purpose

Describe what rollback path this runbook covers and the events that should trigger it.

## Rollback triggers

- smoke-test failure
- production regression
- deployment corruption
- security or configuration issue requiring immediate reversal

## Preconditions

- rollback authority confirmed
- target rollback version identified
- data-impact assessment completed where required

## Rollback steps

1. Confirm the rollback trigger and target version.
2. Pause additional promotions or dependent deployments.
3. Execute the approved rollback workflow.
4. Re-validate application health and critical flows.
5. Capture evidence, timings, and observed side effects.
6. Open or update the incident and follow-up work.

## Validation after rollback

- application access restored
- critical business flow verified
- telemetry and logs reviewed
- environment returned to known-good state

## Communication checklist

- release owner informed
- stakeholders informed
- incident or issue updated

## Evidence links

- failed release reference:
- rollback workflow:
- validation evidence:
