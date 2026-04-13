import type { DbmEntityV1, DbmFieldV1, DbmModelV1, DbmRelationshipV1 } from 'dbm-contract';
import {
  createDiagnostic,
  DEFAULT_GENERATED_METADATA_SOLUTION_NAME,
  getDataverseLogicalName,
  getEntityById,
  getFieldById,
  getPublisherPrefix,
  toCollectionSchemaName,
  toLogicalCollectionName,
  toSchemaName
} from './common';
import type {
  DataverseBehaviorPlan,
  DataverseChoiceOptionPlan,
  DataverseColumnPlan,
  DataverseEntityPlan,
  DataverseFormPlan,
  DataverseRelationshipPlan,
  DataverseSynthesisDiagnostic,
  DataverseSynthesisPlan
} from './types';

function tryGetLogicalName(
  binding: { providerBindings?: { dataverse?: { logicalName?: string } } },
  fallbackLabel: string,
  diagnostics: DataverseSynthesisDiagnostic[],
  modelPath: string
): string | null {
  try {
    return getDataverseLogicalName(binding, fallbackLabel);
  } catch (error) {
    diagnostics.push(
      createDiagnostic(
        'missing-dataverse-logical-name',
        'error',
        error instanceof Error ? error.message : `Missing Dataverse logical name for ${fallbackLabel}.`,
        modelPath
      )
    );
    return null;
  }
}

function createSyntheticPrimaryNameColumn(entity: DbmEntityV1, entityLogicalName: string): DataverseColumnPlan {
  const prefix = getPublisherPrefix(entityLogicalName);
  const logicalName = `${prefix}_name`;

  return {
    id: `${entity.id}:synthetic-primary-name`,
    entityId: entity.id,
    fieldId: null,
    logicalName,
    schemaName: toSchemaName(logicalName),
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

function mapChoiceOptions(field: DbmFieldV1): DataverseChoiceOptionPlan[] {
  return (field.choiceOptions ?? []).map((option) => ({
    id: option.id,
    displayName: option.displayName,
    value: option.value
  }));
}

function planColumn(
  model: DbmModelV1,
  entity: DbmEntityV1,
  field: DbmFieldV1,
  diagnostics: DataverseSynthesisDiagnostic[]
): DataverseColumnPlan | null {
  const modelPath = `metadata.entities.${entity.id}.fields.${field.id}`;
  const logicalName = tryGetLogicalName(field, `field '${field.id}'`, diagnostics, modelPath);
  if (!logicalName) {
    return null;
  }

  const column: DataverseColumnPlan = {
    id: `${entity.id}:${field.id}`,
    entityId: entity.id,
    fieldId: field.id,
    logicalName,
    schemaName: toSchemaName(logicalName),
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
        diagnostics.push(
          createDiagnostic(
            'unsupported-choice-without-options',
            'error',
            `Field '${field.id}' cannot be synthesized because it does not declare choiceOptions.`,
            modelPath
          )
        );
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
        diagnostics.push(
          createDiagnostic(
            'unsupported-lookup-without-target',
            'warning',
            `Field '${field.id}' is a lookup without lookupTargetEntityId and will not be synthesized.`,
            modelPath
          )
        );
        break;
      }

      const targetEntity = getEntityById(model, targetEntityId);
      if (!targetEntity) {
        column.supported = false;
        column.unsupportedReason = `Lookup target entity '${targetEntityId}' was not found.`;
        diagnostics.push(
          createDiagnostic(
            'missing-lookup-target-entity',
            'error',
            `Lookup field '${field.id}' targets missing entity '${targetEntityId}'.`,
            modelPath
          )
        );
        break;
      }

      const targetLogicalName = tryGetLogicalName(
        targetEntity,
        `entity '${targetEntity.id}'`,
        diagnostics,
        `metadata.entities.${targetEntity.id}`
      );
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
      column.unsupportedReason = `Field data type '${field.dataType}' is not supported in R1.2.3a synthesis.`;
      diagnostics.push(
        createDiagnostic(
          'unsupported-field-type',
          'warning',
          `Field '${field.id}' has unsupported data type '${field.dataType}' for R1.2.3a synthesis.`,
          modelPath
        )
      );
      break;
  }

  return column;
}

function choosePrimaryNameColumn(entity: DbmEntityV1, columns: DataverseColumnPlan[], entityLogicalName: string): DataverseColumnPlan {
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

function planRelationship(
  model: DbmModelV1,
  relationship: DbmRelationshipV1,
  entityPlans: Map<string, DataverseEntityPlan>,
  diagnostics: DataverseSynthesisDiagnostic[]
): DataverseRelationshipPlan | null {
  const modelPath = `metadata.relationships.${relationship.id}`;
  const logicalName = tryGetLogicalName(
    relationship,
    `relationship '${relationship.id}'`,
    diagnostics,
    modelPath
  );
  if (!logicalName) {
    return null;
  }

  const fromEntity = getEntityById(model, relationship.fromEntityId);
  const toEntity = getEntityById(model, relationship.toEntityId);
  if (!fromEntity || !toEntity) {
    diagnostics.push(
      createDiagnostic(
        'missing-relationship-entity',
        'error',
        `Relationship '${relationship.id}' references missing entities.`,
        modelPath
      )
    );
    return null;
  }

  const referencedEntity = relationship.relationshipType === 'one-to-many' ? fromEntity : toEntity;
  const referencingEntity = relationship.relationshipType === 'one-to-many' ? toEntity : fromEntity;
  const referencedEntityPlan = entityPlans.get(referencedEntity.id);
  const referencingEntityPlan = entityPlans.get(referencingEntity.id);
  const referencingFieldId = relationship.referencingFieldId?.trim() ?? null;

  if (!referencedEntityPlan || !referencingEntityPlan) {
    diagnostics.push(
      createDiagnostic(
        'missing-relationship-entity-plan',
        'error',
        `Relationship '${relationship.id}' could not resolve synthesized entity plans.`,
        modelPath
      )
    );
    return null;
  }

  if (!referencingFieldId) {
    diagnostics.push(
      createDiagnostic(
        'relationship-missing-referencing-field',
        'error',
        `Relationship '${relationship.id}' requires referencingFieldId for Dataverse synthesis.`,
        modelPath
      )
    );
    return {
      id: relationship.id,
      logicalName,
      schemaName: toSchemaName(logicalName),
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

  const referencingField = getFieldById(referencingEntity, referencingFieldId);
  const referencingColumn = referencingEntityPlan.columns.find((column) => column.fieldId === referencingFieldId);

  if (!referencingField || !referencingColumn || !referencingColumn.supported) {
    diagnostics.push(
      createDiagnostic(
        'relationship-referencing-field-missing',
        'error',
        `Relationship '${relationship.id}' references unsupported lookup field '${referencingFieldId}'.`,
        modelPath
      )
    );
    return {
      id: relationship.id,
      logicalName,
      schemaName: toSchemaName(logicalName),
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
    diagnostics.push(
      createDiagnostic(
        'relationship-referencing-field-mismatch',
        'error',
        `Relationship '${relationship.id}' lookup field '${referencingFieldId}' does not target '${referencedEntity.id}'.`,
        modelPath
      )
    );
    return {
      id: relationship.id,
      logicalName,
      schemaName: toSchemaName(logicalName),
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
    schemaName: toSchemaName(logicalName),
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

export function planDataverseSynthesis(model: DbmModelV1): DataverseSynthesisPlan {
  const diagnostics: DataverseSynthesisDiagnostic[] = [];
  const entities: DataverseEntityPlan[] = [];
  const entityPlans = new Map<string, DataverseEntityPlan>();

  for (const entity of model.metadata.entities) {
    const modelPath = `metadata.entities.${entity.id}`;
    const logicalName = tryGetLogicalName(entity, `entity '${entity.id}'`, diagnostics, modelPath);
    if (!logicalName) {
      continue;
    }

    const columns = entity.fields
      .filter((field) => field.id !== entity.primaryKeyFieldId)
      .map((field) => planColumn(model, entity, field, diagnostics))
      .filter((column): column is DataverseColumnPlan => column !== null);

    const primaryNameColumn = choosePrimaryNameColumn(entity, columns, logicalName);
    const normalizedColumns = columns.map((column) =>
      column.logicalName === primaryNameColumn.logicalName
        ? { ...column, required: true, isPrimaryNameAttribute: true }
        : column
    );

    if (!normalizedColumns.some((column) => column.logicalName === primaryNameColumn.logicalName)) {
      normalizedColumns.unshift(primaryNameColumn);
    }

    const primaryKeyField = getFieldById(entity, entity.primaryKeyFieldId);
    const primaryIdLogicalName =
      primaryKeyField?.providerBindings?.dataverse?.logicalName?.trim() ||
      `${logicalName}id`;

    const entityPlan: DataverseEntityPlan = {
      id: entity.id,
      displayName: entity.displayName,
      logicalName,
      schemaName: toSchemaName(logicalName),
      logicalCollectionName: toLogicalCollectionName(logicalName),
      collectionSchemaName: toCollectionSchemaName(toSchemaName(logicalName)),
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
    .filter((relationship): relationship is DataverseRelationshipPlan => relationship !== null);

  for (const relationship of relationships) {
    const ownerPlan =
      relationship.relationshipType === 'one-to-many'
        ? entityPlans.get(relationship.fromEntityId)
        : entityPlans.get(relationship.toEntityId);
    ownerPlan?.relationships.push(relationship);
  }

  const forms: DataverseFormPlan[] = model.forms.map((form) => ({
    id: form.id,
    supported: false,
    reason: 'R1.2.3b owns generated model-driven forms.'
  }));

  const behaviors: DataverseBehaviorPlan[] = model.forms.flatMap((form) =>
    form.formStates.map((formState) => ({
      id: `${form.id}:${formState.id}`,
      supported: false,
      reason: 'R1.2.3b owns same-table form-state behavior generation.'
    }))
  );

  return {
    generatedUtc: new Date().toISOString(),
    modelId: model.package.id,
    modelVersion: model.package.version,
    model,
    modelDeploymentSolutionName: model.package.deployment.solutionName,
    generatedMetadataSolutionName: DEFAULT_GENERATED_METADATA_SOLUTION_NAME,
    entities,
    relationships,
    forms,
    behaviors,
    diagnostics,
    summary: {
      supportedEntities: entities.length,
      supportedColumns: entities.flatMap((entity) => entity.columns).filter((column) => column.supported).length,
      supportedRelationships: relationships.filter((relationship) => relationship.supported).length,
      blockingDiagnostics: diagnostics.filter((entry) => entry.severity === 'error').length
    }
  };
}
