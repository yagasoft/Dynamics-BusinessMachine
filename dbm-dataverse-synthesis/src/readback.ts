import type {
  DataverseReadbackColumn,
  DataverseReadbackEntity,
  DataverseReadbackRelationship,
  DataverseReadbackSnapshot,
  DataverseSynthesisPlan
} from './types';

interface DataverseFetchResult {
  ok: boolean;
  status: number;
  payload: any;
}

async function dataverseRequest(
  dataverseUrl: string,
  accessToken: string,
  relativePath: string
): Promise<DataverseFetchResult> {
  const response = await fetch(`${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2/${relativePath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Consistency: 'Strong'
    }
  });

  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : null;
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

function normalizeTargets(payload: any): string[] {
  if (!payload || !Array.isArray(payload.Targets)) {
    return [];
  }

  return payload.Targets.filter((target: unknown): target is string => typeof target === 'string');
}

function normalizeOptionValues(payload: any): number[] {
  const optionSetOptions = payload?.OptionSet?.Options;
  if (!Array.isArray(optionSetOptions)) {
    return [];
  }

  return optionSetOptions
    .map((option) => option?.Value)
    .filter((value: unknown): value is number => typeof value === 'number');
}

async function enrichAttribute(
  dataverseUrl: string,
  accessToken: string,
  entityLogicalName: string,
  attribute: any
): Promise<any> {
  if (attribute.AttributeType === 'Lookup') {
    const lookupResult = await dataverseRequest(
      dataverseUrl,
      accessToken,
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`
    );

    if (!lookupResult.ok) {
      return attribute;
    }

    return {
      ...attribute,
      Targets: lookupResult.payload?.Targets ?? []
    };
  }

  if (attribute.AttributeType === 'Picklist') {
    const picklistResult = await dataverseRequest(
      dataverseUrl,
      accessToken,
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet`
    );

    if (!picklistResult.ok) {
      return attribute;
    }

    return {
      ...attribute,
      OptionSet: picklistResult.payload?.OptionSet ?? null
    };
  }

  if (attribute.AttributeType === 'Boolean') {
    const booleanResult = await dataverseRequest(
      dataverseUrl,
      accessToken,
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.BooleanAttributeMetadata?$select=LogicalName&$expand=OptionSet`
    );

    if (!booleanResult.ok) {
      return attribute;
    }

    return {
      ...attribute,
      OptionSet: booleanResult.payload?.OptionSet ?? null
    };
  }

  return attribute;
}

export function normalizeReadbackEntity(
  entityPayload: any,
  attributePayloads: any[]
): DataverseReadbackEntity {
  const columns: DataverseReadbackColumn[] = attributePayloads.map((attribute) => ({
    logicalName: attribute.LogicalName,
    schemaName: attribute.SchemaName ?? attribute.LogicalName,
    attributeType: attribute.AttributeType ?? attribute['@odata.type'] ?? 'Unknown',
    isPrimaryNameAttribute: Boolean(attribute.IsPrimaryName),
    requiredLevel: attribute.RequiredLevel?.Value ?? attribute.RequiredLevel ?? null,
    targets: normalizeTargets(attribute),
    optionValues: normalizeOptionValues(attribute)
  }));

  return {
    logicalName: entityPayload.LogicalName,
    schemaName: entityPayload.SchemaName ?? entityPayload.LogicalName,
    primaryIdLogicalName: entityPayload.PrimaryIdAttribute ?? null,
    primaryNameAttributeLogicalName: entityPayload.PrimaryNameAttribute ?? null,
    columns
  };
}

async function readEntitySnapshot(
  dataverseUrl: string,
  accessToken: string,
  logicalName: string
): Promise<DataverseReadbackEntity | null> {
  const entityResult = await dataverseRequest(
    dataverseUrl,
    accessToken,
    `EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute`
  );

  if (!entityResult.ok && entityResult.status === 404) {
    return null;
  }

  if (!entityResult.ok) {
    throw new Error(`Failed to retrieve entity '${logicalName}' from Dataverse.`);
  }

  const attributesResult = await dataverseRequest(
    dataverseUrl,
    accessToken,
    `EntityDefinitions(LogicalName='${logicalName}')/Attributes?$select=LogicalName,SchemaName,AttributeType,IsPrimaryName,RequiredLevel`
  );

  if (!attributesResult.ok) {
    throw new Error(`Failed to retrieve attributes for entity '${logicalName}' from Dataverse.`);
  }

  const attributes = Array.isArray(attributesResult.payload?.value) ? attributesResult.payload.value : [];
  const normalizedAttributes = await Promise.all(attributes.map((attribute: any) => enrichAttribute(dataverseUrl, accessToken, logicalName, attribute)));

  return normalizeReadbackEntity(entityResult.payload, normalizedAttributes);
}

async function readRelationshipSnapshot(
  dataverseUrl: string,
  accessToken: string,
  schemaName: string
): Promise<DataverseReadbackRelationship | null> {
  const filter = encodeURIComponent(`SchemaName eq '${schemaName}'`);
  const result = await dataverseRequest(
    dataverseUrl,
    accessToken,
    `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute&$filter=${filter}`
  );

  if (!result.ok) {
    throw new Error(`Failed to retrieve relationship '${schemaName}' from Dataverse.`);
  }

  const relationship = Array.isArray(result.payload?.value) ? result.payload.value[0] : null;
  if (!relationship) {
    return null;
  }

  return {
    logicalName: schemaName,
    schemaName: relationship.SchemaName ?? schemaName,
    relationshipType: 'OneToManyRelationship',
    referencedEntityLogicalName: relationship.ReferencedEntity,
    referencingEntityLogicalName: relationship.ReferencingEntity,
    referencingAttributeLogicalName: relationship.ReferencingAttribute ?? null
  };
}

export async function readbackDataverseMetadata(
  plan: DataverseSynthesisPlan,
  environmentConfig: { dataverseUrl: string },
  auth: { accessToken: string }
): Promise<DataverseReadbackSnapshot> {
  const entities: DataverseReadbackEntity[] = [];
  for (const entityPlan of plan.entities) {
    const entitySnapshot = await readEntitySnapshot(environmentConfig.dataverseUrl, auth.accessToken, entityPlan.logicalName);
    if (entitySnapshot) {
      entities.push(entitySnapshot);
    }
  }

  const relationships: DataverseReadbackRelationship[] = [];
  for (const relationshipPlan of plan.relationships) {
    const relationshipSnapshot = await readRelationshipSnapshot(
      environmentConfig.dataverseUrl,
      auth.accessToken,
      relationshipPlan.schemaName
    );
    if (relationshipSnapshot) {
      relationships.push(relationshipSnapshot);
    }
  }

  return {
    generatedUtc: new Date().toISOString(),
    dataverseUrl: environmentConfig.dataverseUrl,
    solutionName: plan.generatedMetadataSolutionName,
    entities,
    relationships,
    diagnostics: []
  };
}
