# Architecture Decision Records

ADRs capture durable product and delivery decisions that are important enough to survive planning sessions and implementation turnover.

## Conventions

- File naming: `NNNN-short-title.md`
- Status values: `Proposed`, `Accepted`, `Superseded`, `Deprecated`
- Keep one decision per ADR.
- Link related architecture and roadmap docs when a decision changes them.
- When a decision is replaced, add a superseding ADR instead of silently editing history.

## Current ADRs

- [0000-adr-template.md](0000-adr-template.md)
- [0001-working-baseline-and-branching.md](0001-working-baseline-and-branching.md)
- [0002-designer-first-and-host-strategy.md](0002-designer-first-and-host-strategy.md)
- [0003-runtime-and-pcf-strategy.md](0003-runtime-and-pcf-strategy.md)
- [0004-secrets-environments-and-ci-cd.md](0004-secrets-environments-and-ci-cd.md)
- [0005-versioning-and-release-branch-policy.md](0005-versioning-and-release-branch-policy.md)
- [0006-dataverse-alm-source-and-packaging-model.md](0006-dataverse-alm-source-and-packaging-model.md)
- [0007-github-oidc-key-vault-and-federated-delivery.md](0007-github-oidc-key-vault-and-federated-delivery.md)
- [0008-canonical-contract-authority-and-format.md](0008-canonical-contract-authority-and-format.md)
- [0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md](0009-dbm-process-ui-portal-state-projection-and-generated-dataverse-artifacts.md)
- [0010-dataverse-metadata-synthesis-and-layered-generated-solution-strategy.md](0010-dataverse-metadata-synthesis-and-layered-generated-solution-strategy.md)
- [0011-post-r1-roadmap-reset-and-designer-process-experience-platform.md](0011-post-r1-roadmap-reset-and-designer-process-experience-platform.md)
- [0012-generic-existing-form-authoring-required-for-r2-closeout.md](0012-generic-existing-form-authoring-required-for-r2-closeout.md)
- [0013-anonymous-power-pages-proof-and-dataverse-portal-initiation-authority.md](0013-anonymous-power-pages-proof-and-dataverse-portal-initiation-authority.md) - superseded history only; replaced by ADR-0014
- [0014-local-spa-proof-and-dataverse-runtime-authority.md](0014-local-spa-proof-and-dataverse-runtime-authority.md) - current authority for the `R3.1` external front-door/runtime direction
