# ADR-0015: Dataverse-first roadmap and Azure deferral

- Status: Superseded by ADR-0016
- Date: 2026-05-01
- Decision owners: Ahmed Elsawalhy, Yagasoft
- Supersedes: parts of [ADR-0007](0007-github-oidc-key-vault-and-federated-delivery.md) for near-term secret/configuration direction

## Context

Historical note: this ADR described an earlier Dataverse-first adjustment to the old roadmap. It is superseded as active roadmap authority by [ADR-0016](0016-product-roadmap-reset-process-first.md), while its Dataverse-first reasoning remains useful reference material.

The old `R3` roadmap previously described Azure orchestration and service-plane capability as part of the pilot-ready path. On review, many of those responsibilities were better delivered first in Dataverse because Dataverse was already the authoritative runtime system for request state, process progression, ownership, and operational metadata.

Azure remains useful for cases Dataverse cannot reasonably own, but it should not be treated as a mandatory early dependency for work management, queues, delegation, SLA tracking, or support configuration.

## Decision

- Dataverse is the near-term authority for runtime state, work ownership, inboxes/queues, reassignment, delegation, escalation/SLA logic, operational configuration, and product telemetry where feasible.
- `R3.2` is reframed as a Dataverse-owned work-management and service-plane slice.
- `R3.3` remains end-to-end lifecycle completion, but the reference path no longer requires Azure runtime services.
- Product/runtime Azure capability moves to a new `R5` release and is limited to capabilities Dataverse cannot reasonably own.
- The former `R5` enterprise sophistication release moves to `R6`.
- Power Platform CLI and Dataverse-native tooling are the preferred direction for Dataverse authentication and operational automation. Azure CLI usage that only exists to acquire Dataverse access tokens is transitional and should be replaced in later implementation slices.
- Azure Key Vault, GitHub OIDC, and Azure deployment workflow references remain historical or deferred delivery context unless a later ADR reintroduces them for a concrete need.

## Consequences

- Pilot readiness can focus on the Dataverse-first external-runtime loop without provisioning Azure resources simply to satisfy roadmap wording.
- Work-management features can be designed around Dataverse tables, views, plugins, flows, jobs, or supported platform automation before any external service plane is introduced.
- Secrets and operational configuration should move toward Dataverse-owned environment/configuration records or platform-owned settings where feasible, with no secrets in Git.
- Existing completed evidence that used Azure validation or Key Vault remains historical truth; this ADR does not rewrite completed `R0` through `R3.1` evidence.
- Later Azure work must justify why Dataverse is insufficient and must define the smallest Azure responsibility boundary.

## Related docs

- [Release Plan](../roadmap/release-plan.md)
- [Superseded old release 3 plan](../roadmap/release-3-pilot-ready-v1.md)
- [Capability Map](../roadmap/capability-map.md)
- [Target Platform Architecture](../architecture/target-platform-architecture.md)
- [Release Governance](../releases/release-governance.md)
