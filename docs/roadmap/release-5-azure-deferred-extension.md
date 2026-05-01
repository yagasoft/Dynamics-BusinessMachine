# Release 5: Azure Deferred Extension

## Goal

Add Azure-backed services only where Dataverse cannot reasonably own the required runtime, integration, telemetry, or operational responsibility.

## Feature set and deliverables

- explicit Dataverse-first fit assessment for every Azure capability
- Azure-hosted runtime or service components only when Dataverse-native implementation is insufficient
- external integration services that need durable cloud execution outside Dataverse
- Azure telemetry or analytics only when Dataverse and Power Platform evidence surfaces cannot meet the need
- Azure delivery, rollback, and support evidence for any approved Azure component

## Stages

### R5.1 Azure need assessment and boundary

Output:
- approved Azure responsibility boundary with each capability traced to a Dataverse limitation

Must include:
- Dataverse-first alternative assessment
- cost, security, support, and rollback implications
- ADR update before any Azure runtime asset is introduced

### R5.2 Azure service implementation

Output:
- first approved Azure service or integration component

Must include:
- minimal deployable Azure workload
- clear contract with Dataverse
- environment-gated deployment and evidence

### R5.3 Azure observability and operations

Output:
- supportable Azure operations for approved Azure components

Must include:
- telemetry and alerting for Azure-owned responsibilities
- rollback and recovery runbooks
- support diagnostics tied back to Dataverse records

## Exit criteria

- every Azure component has an accepted Dataverse-first exception rationale
- Azure assets are deployable, supportable, and rollback-ready through tracked governance
- Azure responsibilities complement Dataverse without duplicating Dataverse-owned runtime authority
