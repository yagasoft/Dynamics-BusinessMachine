"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planDataverseSynthesis = planDataverseSynthesis;
const common_1 = require("./common");
const forms_1 = require("./forms");
function tryGetLogicalName(binding, fallbackLabel, diagnostics, modelPath) {
    try {
        return (0, common_1.getDataverseLogicalName)(binding, fallbackLabel);
    }
    catch (error) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-dataverse-logical-name', 'error', error instanceof Error ? error.message : `Missing Dataverse logical name for ${fallbackLabel}.`, modelPath));
        return null;
    }
}
function createSyntheticPrimaryNameColumn(entity, entityLogicalName) {
    const prefix = (0, common_1.getPublisherPrefix)(entityLogicalName);
    const logicalName = `${prefix}_name`;
    return {
        id: `${entity.id}:synthetic-primary-name`,
        entityId: entity.id,
        fieldId: null,
        logicalName,
        schemaName: (0, common_1.toSchemaName)(logicalName),
        displayName: `${entity.displayName} Name`,
        dataType: 'string',
        attributeType: 'String',
        required: true,
        readOnly: false,
        supported: true,
        unsupportedReason: null,
        source: 'synthetic',
        isPrimaryNameAttribute: true,
        maxLength: 200
    };
}
function mapChoiceOptions(field) {
    return (field.choiceOptions ?? []).map((option) => ({
        id: option.id,
        displayName: option.displayName,
        value: option.value
    }));
}
function getRuntimeOwnerEntityId(model) {
    const startStage = model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
    if (!startStage?.formId) {
        return null;
    }
    const form = model.forms.find((entry) => entry.id === startStage.formId);
    if (!form) {
        return null;
    }
    const primaryBinding = form.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
    return primaryBinding?.entityId ?? null;
}
function createSyntheticRuntimeStateColumns(entityId, entityLogicalName) {
    const prefix = (0, common_1.getPublisherPrefix)(entityLogicalName);
    const fieldDefinitions = [
        { id: 'runtime-current-stage-id', logicalName: `${prefix}_currentstageid`, displayName: 'Current Stage Id', readOnly: true },
        { id: 'runtime-current-step-id', logicalName: `${prefix}_currentstepid`, displayName: 'Current Step Id', readOnly: true },
        { id: 'runtime-current-form-state-id', logicalName: `${prefix}_currentformstateid`, displayName: 'Current Form State Id', readOnly: true },
        { id: 'runtime-internal-status-id', logicalName: `${prefix}_internalstatusid`, displayName: 'Internal Status Id', readOnly: true },
        { id: 'runtime-portal-status-id', logicalName: `${prefix}_portalstatusid`, displayName: 'Portal Status Id', readOnly: true },
        { id: 'runtime-portal-command', logicalName: `${prefix}_portalcommand`, displayName: 'Portal Command', readOnly: false },
        { id: 'runtime-portal-profile-key', logicalName: `${prefix}_portalprofilekey`, displayName: 'Portal Profile Key', readOnly: true }
    ];
    return fieldDefinitions.map((definition) => ({
        id: `${entityId}:${definition.id}`,
        entityId,
        fieldId: null,
        logicalName: definition.logicalName,
        schemaName: (0, common_1.toSchemaName)(definition.logicalName),
        displayName: definition.displayName,
        dataType: 'string',
        attributeType: 'String',
        required: false,
        readOnly: definition.readOnly,
        supported: true,
        unsupportedReason: null,
        source: 'synthetic',
        isPrimaryNameAttribute: false,
        maxLength: 200
    }));
}
function buildProcessExperienceRuntimeModel(model) {
    return {
        packageId: model.package.id,
        packageVersion: model.package.version,
        processId: model.process.id,
        actors: model.process.actors.map((actor) => ({
            id: actor.id,
            displayName: actor.displayName,
            actorType: actor.actorType
        })),
        statuses: model.process.statuses.map((status) => ({
            id: status.id,
            displayName: status.displayName,
            audience: status.audience,
            kind: status.kind
        })),
        outcomes: model.process.outcomes.map((outcome) => ({
            id: outcome.id,
            displayName: outcome.displayName
        })),
        stages: model.process.stages.map((stage) => ({
            id: stage.id,
            displayName: stage.displayName,
            stageType: stage.stageType,
            actorId: stage.actorId,
            formId: stage.formId,
            portalVisibility: stage.portalVisibility,
            stepIds: [...stage.stepIds],
            defaultStepId: stage.defaultStepId,
            allowedOutcomeIds: [...stage.allowedOutcomeIds]
        })),
        steps: model.process.steps.map((step) => ({
            id: step.id,
            stageId: step.stageId,
            displayName: step.displayName,
            stepType: step.stepType,
            ownerActorId: step.ownerActorId,
            internalStatusId: step.internalStatusId,
            portalStatusId: step.portalStatusId,
            formStateId: step.formStateId
        })),
        transitions: model.process.transitions.map((transition) => ({
            id: transition.id,
            fromStageId: transition.fromStageId,
            toStageId: transition.toStageId,
            outcomeId: transition.outcomeId
        }))
    };
}
function toPortalRouteSegment(packageId) {
    const normalized = packageId
        .toLowerCase()
        .replace(/^dbm-/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'request';
}
function isSupportedPortalEntryField(field) {
    return (field.dataType === 'string'
        || field.dataType === 'multiline-string'
        || field.dataType === 'integer'
        || field.dataType === 'decimal'
        || field.dataType === 'currency'
        || field.dataType === 'date');
}
function buildPortalRuntimeEntryFields(model, runtimeOwnerEntityId, startStageId, startFormId, diagnostics) {
    const runtimeOwnerEntity = (0, common_1.getEntityById)(model, runtimeOwnerEntityId);
    const startForm = model.forms.find((form) => form.id === startFormId);
    if (!runtimeOwnerEntity || !startForm) {
        diagnostics.push((0, common_1.createDiagnostic)('portal-runtime-entry-fields-incomplete', 'warning', 'Portal runtime entry fields could not be derived from the start-form configuration.', 'forms'));
        return [];
    }
    const startFormStateIds = new Set(model.process.steps
        .filter((step) => step.stageId === startStageId && step.formStateId)
        .map((step) => step.formStateId));
    if (startFormStateIds.size === 0) {
        diagnostics.push((0, common_1.createDiagnostic)('portal-runtime-entry-fields-missing-form-states', 'warning', 'Portal runtime entry fields could not be derived because the start-stage steps do not declare form states.', 'process.steps'));
        return [];
    }
    const visibleElementIds = new Set();
    const hintsByElementId = new Map();
    for (const formState of startForm.formStates) {
        if (!startFormStateIds.has(formState.id)) {
            continue;
        }
        for (const elementBehavior of formState.elementBehaviors) {
            visibleElementIds.add(elementBehavior.elementId);
            if (!hintsByElementId.has(elementBehavior.elementId) && elementBehavior.hint?.trim()) {
                hintsByElementId.set(elementBehavior.elementId, elementBehavior.hint.trim());
            }
        }
    }
    const entryFields = [];
    const emittedLogicalNames = new Set();
    for (const element of startForm.elements) {
        if (!visibleElementIds.has(element.id)
            || !('entityBindingId' in element.binding)
            || !('fieldId' in element.binding)
            || element.binding.entityBindingId !== startForm.primaryEntityBindingId) {
            continue;
        }
        const field = (0, common_1.getFieldById)(runtimeOwnerEntity, element.binding.fieldId);
        if (!field || !isSupportedPortalEntryField(field)) {
            continue;
        }
        const logicalName = tryGetLogicalName(field, `field '${field.id}'`, diagnostics, `metadata.entities.${runtimeOwnerEntity.id}.fields.${field.id}`);
        if (!logicalName || emittedLogicalNames.has(logicalName)) {
            continue;
        }
        emittedLogicalNames.add(logicalName);
        entryFields.push({
            logicalName,
            displayName: element.displayName,
            dataType: field.dataType,
            required: field.isRequired,
            hint: hintsByElementId.get(element.id) ?? null
        });
    }
    return entryFields;
}
function buildPortalRuntimePlan(model, entityPlans, runtimeOwnerEntityId, diagnostics) {
    if (!runtimeOwnerEntityId) {
        diagnostics.push((0, common_1.createDiagnostic)('portal-runtime-missing-owner-entity', 'warning', 'Portal runtime bootstrap was skipped because the process owner entity could not be resolved.', 'process.stages'));
        return null;
    }
    const runtimeOwnerEntity = entityPlans.get(runtimeOwnerEntityId);
    const startStage = model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
    const defaultStep = startStage
        ? model.process.steps.find((step) => step.id === startStage.defaultStepId)
            ?? model.process.steps.find((step) => step.stageId === startStage.id)
        : null;
    if (!runtimeOwnerEntity || !startStage || !defaultStep || !startStage.formId) {
        diagnostics.push((0, common_1.createDiagnostic)('portal-runtime-bootstrap-incomplete', 'warning', 'Portal runtime bootstrap was skipped because the start-stage runtime contract is incomplete.', 'process.stages'));
        return null;
    }
    const prefix = (0, common_1.getPublisherPrefix)(runtimeOwnerEntity.logicalName);
    const routeSegment = toPortalRouteSegment(model.package.id);
    const entryFields = buildPortalRuntimeEntryFields(model, runtimeOwnerEntityId, startStage.id, startStage.formId, diagnostics);
    return {
        bootstrap: {
            schemaVersion: 'dbm.portal-runtime.bootstrap/v1',
            packageId: model.package.id,
            packageVersion: model.package.version,
            processId: model.process.id,
            identityMode: 'anonymous-generic-profile',
            genericProfileKey: 'dev-anonymous-requester',
            entryPage: {
                pageId: `${routeSegment}-entry`,
                routePath: `/${routeSegment}`
            },
            requestShellPage: {
                pageId: `${routeSegment}-request-shell`,
                routePath: `/${routeSegment}/status`
            },
            requestEntityLogicalName: runtimeOwnerEntity.logicalName,
            requestEntitySetName: runtimeOwnerEntity.logicalCollectionName,
            startFormId: startStage.formId,
            entryFields,
            portalCommandFieldLogicalName: `${prefix}_portalcommand`,
            runtimeStateFieldLogicalNames: {
                stageId: `${prefix}_currentstageid`,
                stepId: `${prefix}_currentstepid`,
                formStateId: `${prefix}_currentformstateid`,
                internalStatusId: `${prefix}_internalstatusid`,
                portalStatusId: `${prefix}_portalstatusid`,
                portalProfileKey: `${prefix}_portalprofilekey`
            },
            defaultState: {
                stageId: startStage.id,
                stepId: defaultStep.id,
                formStateId: defaultStep.formStateId,
                internalStatusId: defaultStep.internalStatusId,
                portalStatusId: defaultStep.portalStatusId
            },
            allowedActions: ['create-draft', 'submit-request', 'refresh-status'],
            devAnonymousReadbackEnabled: true
        },
        processExperienceRuntime: buildProcessExperienceRuntimeModel(model),
        requestEntityId: runtimeOwnerEntityId,
        requestEntityLogicalName: runtimeOwnerEntity.logicalName,
        requestEntitySetName: runtimeOwnerEntity.logicalCollectionName,
        bundlePackageName: 'dbm-portal-runtime',
        solutionName: 'DynamicsBusinessMachinePortalRuntime'
    };
}
function appendUniqueColumns(columns, additionalColumns) {
    const existingLogicalNames = new Set(columns.map((column) => column.logicalName));
    const normalized = [...columns];
    for (const column of additionalColumns) {
        if (!existingLogicalNames.has(column.logicalName)) {
            normalized.push(column);
            existingLogicalNames.add(column.logicalName);
        }
    }
    return normalized;
}
function planColumn(model, entity, field, diagnostics) {
    const modelPath = `metadata.entities.${entity.id}.fields.${field.id}`;
    const logicalName = tryGetLogicalName(field, `field '${field.id}'`, diagnostics, modelPath);
    if (!logicalName) {
        return null;
    }
    const column = {
        id: `${entity.id}:${field.id}`,
        entityId: entity.id,
        fieldId: field.id,
        logicalName,
        schemaName: (0, common_1.toSchemaName)(logicalName),
        displayName: field.displayName,
        dataType: field.dataType,
        attributeType: 'String',
        required: field.isRequired,
        readOnly: field.isReadOnly,
        supported: true,
        unsupportedReason: null,
        source: 'field',
        isPrimaryNameAttribute: false
    };
    switch (field.dataType) {
        case 'string':
            column.attributeType = 'String';
            column.maxLength = 200;
            break;
        case 'multiline-string':
            column.attributeType = 'Memo';
            column.maxLength = 2000;
            break;
        case 'currency':
            column.attributeType = 'Money';
            column.precision = 2;
            break;
        case 'integer':
            column.attributeType = 'Integer';
            break;
        case 'decimal':
            column.attributeType = 'Decimal';
            column.precision = 2;
            break;
        case 'boolean':
            column.attributeType = 'Boolean';
            break;
        case 'date':
            column.attributeType = 'DateTime';
            column.dateTimeFormat = 'DateOnly';
            break;
        case 'datetime':
            column.attributeType = 'DateTime';
            column.dateTimeFormat = 'DateAndTime';
            break;
        case 'choice': {
            const choiceOptions = mapChoiceOptions(field);
            if (choiceOptions.length === 0) {
                column.supported = false;
                column.unsupportedReason = 'Choice fields require explicit choiceOptions for Dataverse synthesis.';
                diagnostics.push((0, common_1.createDiagnostic)('unsupported-choice-without-options', 'error', `Field '${field.id}' cannot be synthesized because it does not declare choiceOptions.`, modelPath));
                break;
            }
            column.attributeType = 'Picklist';
            column.choiceOptions = choiceOptions;
            break;
        }
        case 'lookup': {
            const targetEntityId = field.lookupTargetEntityId?.trim() ?? null;
            if (!targetEntityId) {
                column.supported = false;
                column.unsupportedReason = 'Lookup fields require lookupTargetEntityId for Dataverse synthesis.';
                diagnostics.push((0, common_1.createDiagnostic)('unsupported-lookup-without-target', 'warning', `Field '${field.id}' is a lookup without lookupTargetEntityId and will not be synthesized.`, modelPath));
                break;
            }
            const targetEntity = (0, common_1.getEntityById)(model, targetEntityId);
            if (!targetEntity) {
                column.supported = false;
                column.unsupportedReason = `Lookup target entity '${targetEntityId}' was not found.`;
                diagnostics.push((0, common_1.createDiagnostic)('missing-lookup-target-entity', 'error', `Lookup field '${field.id}' targets missing entity '${targetEntityId}'.`, modelPath));
                break;
            }
            const targetLogicalName = tryGetLogicalName(targetEntity, `entity '${targetEntity.id}'`, diagnostics, `metadata.entities.${targetEntity.id}`);
            if (!targetLogicalName) {
                column.supported = false;
                column.unsupportedReason = `Lookup target entity '${targetEntityId}' does not have a Dataverse logical name.`;
                break;
            }
            column.attributeType = 'Lookup';
            column.lookupTargetEntityId = targetEntityId;
            column.lookupTargetLogicalName = targetLogicalName;
            break;
        }
        default:
            column.supported = false;
            column.unsupportedReason = `Field data type '${field.dataType}' is not supported in R1 synthesis.`;
            diagnostics.push((0, common_1.createDiagnostic)('unsupported-field-type', 'warning', `Field '${field.id}' has unsupported data type '${field.dataType}' for R1 synthesis.`, modelPath));
            break;
    }
    return column;
}
function choosePrimaryNameColumn(entity, columns, entityLogicalName) {
    const candidate = columns.find((column) => column.supported && column.dataType === 'string');
    if (candidate) {
        return {
            ...candidate,
            required: true,
            isPrimaryNameAttribute: true
        };
    }
    return createSyntheticPrimaryNameColumn(entity, entityLogicalName);
}
function planRelationship(model, relationship, entityPlans, diagnostics) {
    const modelPath = `metadata.relationships.${relationship.id}`;
    const logicalName = tryGetLogicalName(relationship, `relationship '${relationship.id}'`, diagnostics, modelPath);
    if (!logicalName) {
        return null;
    }
    const fromEntity = (0, common_1.getEntityById)(model, relationship.fromEntityId);
    const toEntity = (0, common_1.getEntityById)(model, relationship.toEntityId);
    if (!fromEntity || !toEntity) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-relationship-entity', 'error', `Relationship '${relationship.id}' references missing entities.`, modelPath));
        return null;
    }
    const referencedEntity = relationship.relationshipType === 'one-to-many' ? fromEntity : toEntity;
    const referencingEntity = relationship.relationshipType === 'one-to-many' ? toEntity : fromEntity;
    const referencedEntityPlan = entityPlans.get(referencedEntity.id);
    const referencingEntityPlan = entityPlans.get(referencingEntity.id);
    const referencingFieldId = relationship.referencingFieldId?.trim() ?? null;
    if (!referencedEntityPlan || !referencingEntityPlan) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-relationship-entity-plan', 'error', `Relationship '${relationship.id}' could not resolve synthesized entity plans.`, modelPath));
        return null;
    }
    if (!referencingFieldId) {
        diagnostics.push((0, common_1.createDiagnostic)('relationship-missing-referencing-field', 'error', `Relationship '${relationship.id}' requires referencingFieldId for Dataverse synthesis.`, modelPath));
        return {
            id: relationship.id,
            logicalName,
            schemaName: logicalName,
            relationshipType: relationship.relationshipType,
            fromEntityId: relationship.fromEntityId,
            toEntityId: relationship.toEntityId,
            referencedEntityLogicalName: referencedEntityPlan.logicalName,
            referencingEntityLogicalName: referencingEntityPlan.logicalName,
            referencingFieldId: null,
            referencingAttributeLogicalName: null,
            supported: false,
            unsupportedReason: 'Relationships require referencingFieldId.'
        };
    }
    const referencingField = (0, common_1.getFieldById)(referencingEntity, referencingFieldId);
    const referencingColumn = referencingEntityPlan.columns.find((column) => column.fieldId === referencingFieldId);
    if (!referencingField || !referencingColumn || !referencingColumn.supported) {
        diagnostics.push((0, common_1.createDiagnostic)('relationship-referencing-field-missing', 'error', `Relationship '${relationship.id}' references unsupported lookup field '${referencingFieldId}'.`, modelPath));
        return {
            id: relationship.id,
            logicalName,
            schemaName: logicalName,
            relationshipType: relationship.relationshipType,
            fromEntityId: relationship.fromEntityId,
            toEntityId: relationship.toEntityId,
            referencedEntityLogicalName: referencedEntityPlan.logicalName,
            referencingEntityLogicalName: referencingEntityPlan.logicalName,
            referencingFieldId,
            referencingAttributeLogicalName: referencingColumn?.logicalName ?? null,
            supported: false,
            unsupportedReason: `Referencing field '${referencingFieldId}' is missing or unsupported.`
        };
    }
    if (referencingField.dataType !== 'lookup' || referencingField.lookupTargetEntityId !== referencedEntity.id) {
        diagnostics.push((0, common_1.createDiagnostic)('relationship-referencing-field-mismatch', 'error', `Relationship '${relationship.id}' lookup field '${referencingFieldId}' does not target '${referencedEntity.id}'.`, modelPath));
        return {
            id: relationship.id,
            logicalName,
            schemaName: logicalName,
            relationshipType: relationship.relationshipType,
            fromEntityId: relationship.fromEntityId,
            toEntityId: relationship.toEntityId,
            referencedEntityLogicalName: referencedEntityPlan.logicalName,
            referencingEntityLogicalName: referencingEntityPlan.logicalName,
            referencingFieldId,
            referencingAttributeLogicalName: referencingColumn.logicalName,
            supported: false,
            unsupportedReason: `Lookup field '${referencingFieldId}' does not align with relationship '${relationship.id}'.`
        };
    }
    return {
        id: relationship.id,
        logicalName,
        schemaName: logicalName,
        relationshipType: relationship.relationshipType,
        fromEntityId: relationship.fromEntityId,
        toEntityId: relationship.toEntityId,
        referencedEntityLogicalName: referencedEntityPlan.logicalName,
        referencingEntityLogicalName: referencingEntityPlan.logicalName,
        referencingFieldId,
        referencingAttributeLogicalName: referencingColumn.logicalName,
        supported: true,
        unsupportedReason: null
    };
}
function planDataverseSynthesis(model) {
    const diagnostics = [];
    const entities = [];
    const entityPlans = new Map();
    const runtimeOwnerEntityId = getRuntimeOwnerEntityId(model);
    for (const entity of model.metadata.entities) {
        const modelPath = `metadata.entities.${entity.id}`;
        const logicalName = tryGetLogicalName(entity, `entity '${entity.id}'`, diagnostics, modelPath);
        if (!logicalName) {
            continue;
        }
        const columns = entity.fields
            .filter((field) => field.id !== entity.primaryKeyFieldId)
            .map((field) => planColumn(model, entity, field, diagnostics))
            .filter((column) => column !== null);
        const primaryNameColumn = choosePrimaryNameColumn(entity, columns, logicalName);
        let normalizedColumns = columns.map((column) => column.logicalName === primaryNameColumn.logicalName
            ? { ...column, required: true, isPrimaryNameAttribute: true }
            : column);
        if (!normalizedColumns.some((column) => column.logicalName === primaryNameColumn.logicalName)) {
            normalizedColumns.unshift(primaryNameColumn);
        }
        if (entity.id === runtimeOwnerEntityId) {
            normalizedColumns = appendUniqueColumns(normalizedColumns, createSyntheticRuntimeStateColumns(entity.id, logicalName));
        }
        const primaryKeyField = (0, common_1.getFieldById)(entity, entity.primaryKeyFieldId);
        const primaryIdLogicalName = primaryKeyField?.providerBindings?.dataverse?.logicalName?.trim() ||
            `${logicalName}id`;
        const entityPlan = {
            id: entity.id,
            displayName: entity.displayName,
            logicalName,
            schemaName: (0, common_1.toSchemaName)(logicalName),
            logicalCollectionName: (0, common_1.toLogicalCollectionName)(logicalName),
            collectionSchemaName: (0, common_1.toCollectionSchemaName)((0, common_1.toSchemaName)(logicalName)),
            primaryIdLogicalName,
            primaryNameAttributeLogicalName: primaryNameColumn.logicalName,
            columns: normalizedColumns,
            relationships: []
        };
        entities.push(entityPlan);
        entityPlans.set(entity.id, entityPlan);
    }
    const relationships = model.metadata.relationships
        .map((relationship) => planRelationship(model, relationship, entityPlans, diagnostics))
        .filter((relationship) => relationship !== null);
    for (const relationship of relationships) {
        const ownerPlan = relationship.relationshipType === 'one-to-many'
            ? entityPlans.get(relationship.fromEntityId)
            : entityPlans.get(relationship.toEntityId);
        ownerPlan?.relationships.push(relationship);
    }
    const existingFormArtifacts = (0, forms_1.planExistingDataverseForms)(model, entityPlans, diagnostics);
    const portalRuntime = buildPortalRuntimePlan(model, entityPlans, runtimeOwnerEntityId, diagnostics);
    return {
        generatedUtc: new Date().toISOString(),
        modelId: model.package.id,
        modelVersion: model.package.version,
        model,
        modelDeploymentSolutionName: model.package.deployment.solutionName,
        generatedMetadataSolutionName: common_1.DEFAULT_GENERATED_METADATA_SOLUTION_NAME,
        entities,
        relationships,
        forms: existingFormArtifacts.forms,
        behaviors: existingFormArtifacts.behaviors,
        portalRuntime,
        diagnostics,
        summary: {
            supportedEntities: entities.length,
            supportedColumns: entities.flatMap((entity) => entity.columns).filter((column) => column.supported).length,
            supportedRelationships: relationships.filter((relationship) => relationship.supported).length,
            supportedForms: existingFormArtifacts.forms.filter((form) => form.supported).length,
            supportedBehaviors: existingFormArtifacts.behaviors.filter((behavior) => behavior.supported).length,
            blockingDiagnostics: diagnostics.filter((entry) => entry.severity === 'error').length
        }
    };
}
