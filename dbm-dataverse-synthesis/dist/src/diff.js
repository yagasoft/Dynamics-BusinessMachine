"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffSynthesisPlan = diffSynthesisPlan;
function compareColumn(plan, snapshot) {
    if (!plan.supported) {
        return [];
    }
    if (!snapshot) {
        return [
            {
                kind: 'column',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Column '${plan.logicalName}' is missing from the Dataverse snapshot.`
            }
        ];
    }
    const differences = [];
    if (snapshot.attributeType !== plan.attributeType) {
        differences.push({
            kind: 'column',
            severity: 'error',
            logicalName: plan.logicalName,
            message: `Column '${plan.logicalName}' expected attribute type '${plan.attributeType}' but found '${snapshot.attributeType}'.`
        });
    }
    if (snapshot.isPrimaryNameAttribute !== plan.isPrimaryNameAttribute) {
        differences.push({
            kind: 'column',
            severity: 'error',
            logicalName: plan.logicalName,
            message: `Column '${plan.logicalName}' primary-name expectation does not match the Dataverse snapshot.`
        });
    }
    if (plan.attributeType === 'Lookup') {
        const expectedTargets = [plan.lookupTargetLogicalName ?? ''].filter((value) => value.length > 0).sort();
        const actualTargets = [...snapshot.targets].sort();
        if (JSON.stringify(expectedTargets) !== JSON.stringify(actualTargets)) {
            differences.push({
                kind: 'column',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Lookup column '${plan.logicalName}' targets do not match the Dataverse snapshot.`
            });
        }
    }
    if (plan.attributeType === 'Picklist') {
        const expectedValues = [...(plan.choiceOptions ?? []).map((option) => option.value)].sort((left, right) => left - right);
        const actualValues = [...snapshot.optionValues].sort((left, right) => left - right);
        if (JSON.stringify(expectedValues) !== JSON.stringify(actualValues)) {
            differences.push({
                kind: 'column',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Choice column '${plan.logicalName}' option values do not match the Dataverse snapshot.`
            });
        }
    }
    return differences;
}
function compareEntity(planEntity, snapshotEntity) {
    if (!snapshotEntity) {
        return [
            {
                kind: 'entity',
                severity: 'error',
                logicalName: planEntity.logicalName,
                message: `Entity '${planEntity.logicalName}' is missing from the Dataverse snapshot.`
            }
        ];
    }
    const differences = [];
    if (snapshotEntity.primaryNameAttributeLogicalName !== planEntity.primaryNameAttributeLogicalName) {
        differences.push({
            kind: 'entity',
            severity: 'error',
            logicalName: planEntity.logicalName,
            message: `Entity '${planEntity.logicalName}' primary name attribute does not match the Dataverse snapshot.`
        });
    }
    for (const planColumn of planEntity.columns) {
        differences.push(...compareColumn(planColumn, snapshotEntity.columns.find((column) => column.logicalName === planColumn.logicalName)));
    }
    return differences;
}
function compareRelationship(plan, snapshot) {
    if (!plan.supported) {
        return [];
    }
    if (!snapshot) {
        return [
            {
                kind: 'relationship',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Relationship '${plan.logicalName}' is missing from the Dataverse snapshot.`
            }
        ];
    }
    if (snapshot.referencingAttributeLogicalName !== plan.referencingAttributeLogicalName) {
        return [
            {
                kind: 'relationship',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Relationship '${plan.logicalName}' referencing attribute does not match the Dataverse snapshot.`
            }
        ];
    }
    if (snapshot.referencedEntityLogicalName !== plan.referencedEntityLogicalName) {
        return [
            {
                kind: 'relationship',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Relationship '${plan.logicalName}' referenced entity does not match the Dataverse snapshot.`
            }
        ];
    }
    if (snapshot.referencingEntityLogicalName !== plan.referencingEntityLogicalName) {
        return [
            {
                kind: 'relationship',
                severity: 'error',
                logicalName: plan.logicalName,
                message: `Relationship '${plan.logicalName}' referencing entity does not match the Dataverse snapshot.`
            }
        ];
    }
    return [];
}
function diffSynthesisPlan(plan, snapshot) {
    const differences = [];
    for (const entityPlan of plan.entities) {
        differences.push(...compareEntity(entityPlan, snapshot.entities.find((entity) => entity.logicalName === entityPlan.logicalName)));
    }
    for (const relationshipPlan of plan.relationships) {
        differences.push(...compareRelationship(relationshipPlan, snapshot.relationships.find((relationship) => relationship.logicalName === relationshipPlan.logicalName ||
            relationship.schemaName === relationshipPlan.schemaName)));
    }
    return {
        generatedUtc: new Date().toISOString(),
        solutionName: plan.generatedMetadataSolutionName,
        hasBlockingDrift: differences.some((difference) => difference.severity === 'error'),
        differences,
        diagnostics: snapshot.diagnostics
    };
}
