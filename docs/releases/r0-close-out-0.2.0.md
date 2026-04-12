# R0 Close-Out: 0.2.0

## Status

- Release line: `0.2.0`
- Release branch: `release/0.2.0`
- Candidate commit used for the final Dataverse proof: `3a9374eb01912c4e5a68593053806ec1842826d9`
- Close-out date: `2026-04-13`
- Status: accepted for R1 planning

## Summary

R0 closed with repository validation, security, packaging, release-candidate creation, Azure environment validation, and formal Dataverse promotion proof completed for the `0.2.0` line.

The R0 rollback rehearsal was not completed to end-state through the platform restore path because same-environment restore on the `UAT` developer environment remained operationally long-running and PAC restore behavior was not reliable enough to complete inside the close-out window. Closure was accepted by operator direction on `2026-04-13` with rollback treated as an explicit assumption rather than recorded as a completed rehearsal.

## Candidate and release evidence

- release-candidate run: `24316953702`
- validate run on final candidate commit: `24316953706`
- security run on final candidate commit: `24316953712`
- package-dataverse run on final candidate commit: `24316953710`
- npm audit exception manifest: `eng/security/npm-audit-exceptions.json`
- active npm audit exception expiry: `2026-05-31`

## Environment proof

- Azure validation evidence
  - `Dev`: `24312930287`
  - `UAT`: `24312930285`
  - `Prod`: `24312934648`
- Dataverse deployment evidence
  - formal `Dev`: `24316310782`
  - formal `UAT`: `24317118421`
- `Dev` environment state after the final solution metadata fix
  - local unmanaged validation import completed successfully
  - `DynamicsBusinessMachine` online version remained `0.2.0.0`
- `UAT` environment state after the final solution metadata fix
  - managed dependency `YSCommonSolution` updated to `5.3.1.5`
  - formal managed deployment succeeded
  - `DynamicsBusinessMachine` online version is `0.2.0.0`

## Backup and rollback record

- UAT backup label: `r0-proof`
- UAT backup ID: `4f5c4a9b-837f-4698-8e47-b27be971d45e`
- UAT backup point date: `12-Apr-26 9:05:48 PM`
- rollback rehearsal status: assumed successful by operator direction, not executed to recorded completion
- re-promotion status: not required because the rollback rehearsal was not completed to end-state

## R0 fixes landed during proof

- smoke validation now falls back to the solution list when `pac solution online-version` is unreliable
- CodeQL was moved off the day-to-day Dev PR path and is enforced before `UAT` and `Prod`
- stale solution references to `ys_dbmobject` and `ys_dbmscript` were removed from the DBM solution package baseline
- local operator backup automation was added through `eng/scripts/Invoke-DataverseBackup.ps1`, but it is intentionally not wired into GitHub deployment workflows yet

## Deferred risks entering R1

- the Angular and PrimeNG vulnerability set covered by `eng/security/npm-audit-exceptions.json` still requires dependency remediation before the exception expires on `2026-05-31`
- the rollback rehearsal remains an explicit close-out assumption and should be re-proven on a more restoration-friendly nonproduction environment model
- GitHub Actions currently warn about Node.js 20 action deprecation and should be refreshed before the June 2, 2026 runner default shift
