# Runbooks

This section holds operational runbooks that support delivery, promotion, rollback, secret rotation, and local engineering bootstrap.

## Files

- [local-bootstrap-and-build.md](local-bootstrap-and-build.md)
- [dev-rapid-deploy.md](dev-rapid-deploy.md)
- [dev-deployment-runbook.md](dev-deployment-runbook.md)
- [uat-promotion-runbook.md](uat-promotion-runbook.md)
- [prod-promotion-runbook.md](prod-promotion-runbook.md)
- [rollback-runbook.md](rollback-runbook.md)
- [secret-rotation-and-identity-recovery.md](secret-rotation-and-identity-recovery.md)
- [codex-dataverse-metadata-synthesis-skill-handoff.md](codex-dataverse-metadata-synthesis-skill-handoff.md)
- [deployment-promotion-runbook-template.md](deployment-promotion-runbook-template.md)
- [rollback-runbook-template.md](rollback-runbook-template.md)

## Usage

- Use the real runbooks for Release 0 operations.
- Use [dev-rapid-deploy.md](dev-rapid-deploy.md) only for local `Dev` inner-loop validation.
- Treat `azure/config/*.json` as the non-secret source of truth for environment target metadata.
- Keep templates only for future runbook patterns that do not yet have an operational version.
- Keep runbooks explicit enough that another engineer can execute them safely without making new release or security decisions.
