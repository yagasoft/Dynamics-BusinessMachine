import { buildLabel, buildRequiredLevel, DEFAULT_LOCALE_CODE } from './common';
import { readbackDataverseMetadata } from './readback';
import type {
  DataverseApplyAction,
  DataverseApplyReport,
  DataverseColumnPlan,
  DataverseEntityPlan,
  DataverseEnvironmentConfig,
  DataverseRelationshipPlan,
  DataverseSynthesisPlan
} from './types';

interface DataverseResponse {
  ok: boolean;
  status: number;
  payload: any;
}

function dataverseHeaders(accessToken: string, solutionName?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0'
  };

  if (solutionName) {
    headers['MSCRM.SolutionUniqueName'] = solutionName;
  }

  return headers;
}

async function dataverseRequest(
  dataverseUrl: string,
  accessToken: string,
  method: 'GET' | 'POST',
  relativePath: string,
  body?: unknown,
  solutionName?: string
): Promise<DataverseResponse> {
  const response = await fetch(`${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2/${relativePath}`, {
    method,
    headers: dataverseHeaders(accessToken, solutionName),
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : null;
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

function buildOptionLabel(optionLabel: string, languageCode: number): Record<string, unknown> {
  return {
    Value: optionLabel === 'Yes' ? 1 : 0,
    Label: buildLabel(optionLabel, languageCode),
    Description: buildLabel(optionLabel, languageCode)
  };
}

function buildAttributeBody(column: DataverseColumnPlan, languageCode: number): Record<string, unknown> {
  const common = {
    Description: buildLabel(column.displayName, languageCode),
    DisplayName: buildLabel(column.displayName, languageCode),
    RequiredLevel: buildRequiredLevel(column.required),
    SchemaName: column.schemaName
  };

  switch (column.attributeType) {
    case 'String':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        AttributeType: 'String',
        AttributeTypeName: { Value: 'StringType' },
        FormatName: { Value: 'Text' },
        MaxLength: column.maxLength ?? 200,
        ...common,
        ...(column.isPrimaryNameAttribute ? { IsPrimaryName: true } : {})
      };
    case 'Memo':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
        AttributeType: 'Memo',
        AttributeTypeName: { Value: 'MemoType' },
        Format: 'TextArea',
        ImeMode: 'Disabled',
        IsLocalizable: false,
        MaxLength: column.maxLength ?? 2000,
        ...common
      };
    case 'Money':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
        AttributeType: 'Money',
        AttributeTypeName: { Value: 'MoneyType' },
        ImeMode: 'Disabled',
        MaxValue: 1000000000.0,
        MinValue: 0.0,
        Precision: column.precision ?? 2,
        PrecisionSource: 1,
        SourceTypeMask: 0,
        IsBaseCurrency: false,
        ...common
      };
    case 'Integer':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        AttributeType: 'Integer',
        AttributeTypeName: { Value: 'IntegerType' },
        MaxValue: 2147483647,
        MinValue: -2147483648,
        Format: 'None',
        SourceTypeMask: 0,
        ...common
      };
    case 'Decimal':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
        AttributeType: 'Decimal',
        AttributeTypeName: { Value: 'DecimalType' },
        MaxValue: 1000000000,
        MinValue: -1000000000,
        Precision: column.precision ?? 2,
        ...common
      };
    case 'Boolean':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        AttributeType: 'Boolean',
        AttributeTypeName: { Value: 'BooleanType' },
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          FalseOption: buildOptionLabel('No', languageCode),
          TrueOption: buildOptionLabel('Yes', languageCode),
          OptionSetType: 'Boolean'
        },
        ...common
      };
    case 'Picklist':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
        AttributeType: 'Picklist',
        AttributeTypeName: { Value: 'PicklistType' },
        SourceTypeMask: 0,
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
          Options: (column.choiceOptions ?? []).map((option) => ({
            Value: option.value,
            Label: buildLabel(option.displayName, languageCode)
          })),
          IsGlobal: false,
          OptionSetType: 'Picklist'
        },
        ...common
      };
    case 'Lookup':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
        AttributeType: 'Lookup',
        AttributeTypeName: { Value: 'LookupType' },
        Targets: [column.lookupTargetLogicalName],
        ...common
      };
    case 'DateTime':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        AttributeType: 'DateTime',
        AttributeTypeName: { Value: 'DateTimeType' },
        Format: column.dateTimeFormat ?? 'DateOnly',
        DateTimeBehavior: {
          Value: column.dateTimeFormat ?? 'DateOnly'
        },
        ImeMode: 'Disabled',
        ...common
      };
    default:
      throw new Error(`Unsupported Dataverse attribute type '${column.attributeType}'.`);
  }
}

function buildEntityBody(entity: DataverseEntityPlan, languageCode: number): Record<string, unknown> {
  const primaryNameColumn = entity.columns.find((column) => column.isPrimaryNameAttribute);
  if (!primaryNameColumn) {
    throw new Error(`Entity '${entity.logicalName}' does not define a primary name attribute.`);
  }

  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: entity.schemaName,
    LogicalName: entity.logicalName,
    LogicalCollectionName: entity.logicalCollectionName,
    CollectionSchemaName: entity.collectionSchemaName,
    DisplayName: buildLabel(entity.displayName, languageCode),
    DisplayCollectionName: buildLabel(`${entity.displayName}s`, languageCode),
    Description: buildLabel(`${entity.displayName} generated by DBM synthesis.`, languageCode),
    OwnershipType: 'UserOwned',
    IsActivity: false,
    HasActivities: false,
    HasNotes: true,
    Attributes: [buildAttributeBody(primaryNameColumn, languageCode)]
  };
}

async function ensureEntity(
  entity: DataverseEntityPlan,
  environmentConfig: DataverseEnvironmentConfig,
  accessToken: string,
  solutionName: string,
  actions: DataverseApplyAction[],
  languageCode: number
): Promise<void> {
  const existing = await dataverseRequest(
    environmentConfig.dataverseUrl,
    accessToken,
    'GET',
    `EntityDefinitions(LogicalName='${entity.logicalName}')?$select=LogicalName`
  );

  if (existing.ok) {
    actions.push({
      componentType: 'entity',
      logicalName: entity.logicalName,
      state: 'skipped',
      message: `Entity '${entity.logicalName}' already exists in Dataverse.`
    });
    return;
  }

  const result = await dataverseRequest(
    environmentConfig.dataverseUrl,
    accessToken,
    'POST',
    'EntityDefinitions',
    buildEntityBody(entity, languageCode),
    solutionName
  );

  if (!result.ok) {
    throw new Error(`Failed to create entity '${entity.logicalName}'.`);
  }

  actions.push({
    componentType: 'entity',
    logicalName: entity.logicalName,
    state: 'created',
    message: `Created entity '${entity.logicalName}'.`
  });
}

async function ensureColumn(
  entity: DataverseEntityPlan,
  column: DataverseColumnPlan,
  environmentConfig: DataverseEnvironmentConfig,
  accessToken: string,
  solutionName: string,
  actions: DataverseApplyAction[],
  languageCode: number
): Promise<void> {
  if (!column.supported || column.isPrimaryNameAttribute) {
    actions.push({
      componentType: 'column',
      logicalName: `${entity.logicalName}.${column.logicalName}`,
      state: 'skipped',
      message: column.supported
        ? `Column '${column.logicalName}' is already handled as the primary name attribute.`
        : `Column '${column.logicalName}' is skipped: ${column.unsupportedReason ?? 'unsupported'}.`
    });
    return;
  }

  const existing = await dataverseRequest(
    environmentConfig.dataverseUrl,
    accessToken,
    'GET',
    `EntityDefinitions(LogicalName='${entity.logicalName}')/Attributes(LogicalName='${column.logicalName}')?$select=LogicalName`
  );

  if (existing.ok) {
    actions.push({
      componentType: 'column',
      logicalName: `${entity.logicalName}.${column.logicalName}`,
      state: 'skipped',
      message: `Column '${column.logicalName}' already exists in Dataverse.`
    });
    return;
  }

  const result = await dataverseRequest(
    environmentConfig.dataverseUrl,
    accessToken,
    'POST',
    `EntityDefinitions(LogicalName='${entity.logicalName}')/Attributes`,
    buildAttributeBody(column, languageCode),
    solutionName
  );

  if (!result.ok) {
    throw new Error(`Failed to create column '${column.logicalName}' on entity '${entity.logicalName}'.`);
  }

  actions.push({
    componentType: 'column',
    logicalName: `${entity.logicalName}.${column.logicalName}`,
    state: 'created',
    message: `Created column '${column.logicalName}' on entity '${entity.logicalName}'.`
  });
}

async function checkRelationship(
  relationship: DataverseRelationshipPlan,
  environmentConfig: DataverseEnvironmentConfig,
  accessToken: string,
  actions: DataverseApplyAction[]
): Promise<void> {
  if (!relationship.supported) {
    actions.push({
      componentType: 'relationship',
      logicalName: relationship.logicalName,
      state: 'skipped',
      message: `Relationship '${relationship.logicalName}' is skipped: ${relationship.unsupportedReason ?? 'unsupported'}.`
    });
    return;
  }

  const filter = encodeURIComponent(`SchemaName eq '${relationship.schemaName}'`);
  const result = await dataverseRequest(
    environmentConfig.dataverseUrl,
    accessToken,
    'GET',
    `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName&$filter=${filter}`
  );

  if (!result.ok) {
    throw new Error(`Failed to validate relationship '${relationship.logicalName}' in Dataverse.`);
  }

  const exists = Array.isArray(result.payload?.value) && result.payload.value.length > 0;
  actions.push({
    componentType: 'relationship',
    logicalName: relationship.logicalName,
    state: exists ? 'skipped' : 'failed',
    message: exists
      ? `Relationship '${relationship.logicalName}' is present in Dataverse.`
      : `Relationship '${relationship.logicalName}' was not observed after lookup synthesis.`
  });
}

async function publishChanges(
  environmentConfig: DataverseEnvironmentConfig,
  accessToken: string,
  actions: DataverseApplyAction[]
): Promise<void> {
  const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'PublishAllXml', {});
  if (!result.ok) {
    throw new Error('Failed to publish Dataverse metadata changes.');
  }

  actions.push({
    componentType: 'publish',
    logicalName: 'PublishAllXml',
    state: 'updated',
    message: 'Published Dataverse metadata changes.'
  });
}

export async function applySynthesisPlanToDev(
  plan: DataverseSynthesisPlan,
  environmentConfig: DataverseEnvironmentConfig,
  auth: { accessToken: string }
): Promise<DataverseApplyReport> {
  const actions: DataverseApplyAction[] = [];
  const languageCode = environmentConfig.localeCode ?? DEFAULT_LOCALE_CODE;

  for (const entity of plan.entities) {
    await ensureEntity(entity, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions, languageCode);
    for (const column of entity.columns) {
      await ensureColumn(entity, column, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions, languageCode);
    }
  }

  for (const relationship of plan.relationships) {
    await checkRelationship(relationship, environmentConfig, auth.accessToken, actions);
  }

  await publishChanges(environmentConfig, auth.accessToken, actions);
  const snapshot = await readbackDataverseMetadata(plan, environmentConfig, auth);
  const relationshipFailures = actions.some(
    (action) => action.componentType === 'relationship' && action.state === 'failed'
  );

  return {
    generatedUtc: new Date().toISOString(),
    dataverseUrl: environmentConfig.dataverseUrl,
    solutionName: plan.generatedMetadataSolutionName,
    status: relationshipFailures || plan.diagnostics.some((entry) => entry.severity === 'error') ? 'warning' : 'success',
    actions,
    diagnostics: [...plan.diagnostics, ...snapshot.diagnostics]
  };
}
