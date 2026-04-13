import type { APIRequestContext } from '@playwright/test';

import type {
  LiveE2ECaseResult,
  LiveE2EEntityConfig,
  LiveE2EEnvironmentConfig,
  LiveE2EProcessStateAssertion,
  LiveE2ERecordFieldAssertion,
  LiveE2ERecordReference
} from './types.js';

export function getDataverseApiBaseUrl(dataverseUrl: string): string {
  return `${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2`;
}

export async function createRecord(
  request: APIRequestContext,
  accessToken: string,
  dataverseUrl: string,
  entityConfig: LiveE2EEntityConfig,
  fields: Record<string, unknown>
): Promise<string> {
  const response = await request.fetch(`${getDataverseApiBaseUrl(dataverseUrl)}/${entityConfig.entitySetName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0',
      Prefer: 'return=representation'
    },
    data: fields
  });

  if (!response.ok()) {
    throw new Error(`Failed to create record in '${entityConfig.entitySetName}': ${await response.text()}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const id = payload[entityConfig.primaryIdField];
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Dataverse did not return the primary id field '${entityConfig.primaryIdField}' for '${entityConfig.entitySetName}'.`);
  }

  return id;
}

export async function retrieveRecord(
  request: APIRequestContext,
  accessToken: string,
  dataverseUrl: string,
  entityConfig: LiveE2EEntityConfig,
  id: string,
  select?: string[]
): Promise<Record<string, unknown>> {
  const selectClause = select && select.length > 0 ? `?$select=${select.join(',')}` : '';
  const normalizedId = id.replace(/[{}]/g, '');
  const response = await request.fetch(`${getDataverseApiBaseUrl(dataverseUrl)}/${entityConfig.entitySetName}(${normalizedId})${selectClause}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0'
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to retrieve record '${id}' from '${entityConfig.entitySetName}': ${await response.text()}`);
  }

  return await response.json() as Record<string, unknown>;
}

export async function deleteRecord(
  request: APIRequestContext,
  accessToken: string,
  dataverseUrl: string,
  entityConfig: LiveE2EEntityConfig,
  id: string,
  ignoreMissing = false
): Promise<void> {
  const normalizedId = id.replace(/[{}]/g, '');
  const response = await request.fetch(`${getDataverseApiBaseUrl(dataverseUrl)}/${entityConfig.entitySetName}(${normalizedId})`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0'
    }
  });

  if (response.status() === 204 || response.status() === 1223) {
    return;
  }

  if (ignoreMissing && response.status() === 404) {
    return;
  }

  if (!response.ok()) {
    throw new Error(`Failed to delete record '${id}' from '${entityConfig.entitySetName}': ${await response.text()}`);
  }
}

export async function assertRecordField(
  request: APIRequestContext,
  accessToken: string,
  dataverseUrl: string,
  entityConfig: LiveE2EEntityConfig,
  recordReference: LiveE2ERecordReference,
  assertion: LiveE2ERecordFieldAssertion
): Promise<void> {
  const record = await retrieveRecord(request, accessToken, dataverseUrl, entityConfig, recordReference.id, [assertion.fieldLogicalName]);
  const actualValue = record[assertion.fieldLogicalName];

  if (Object.prototype.hasOwnProperty.call(assertion, 'equals') && actualValue !== assertion.equals) {
    throw new Error(`Expected Dataverse field '${assertion.fieldLogicalName}' on '${recordReference.id}' to equal '${String(assertion.equals)}' but found '${String(actualValue)}'.`);
  }

  if (Object.prototype.hasOwnProperty.call(assertion, 'notEquals') && actualValue === assertion.notEquals) {
    throw new Error(`Expected Dataverse field '${assertion.fieldLogicalName}' on '${recordReference.id}' not to equal '${String(assertion.notEquals)}'.`);
  }
}

export async function assertProcessState(
  request: APIRequestContext,
  accessToken: string,
  dataverseUrl: string,
  entityConfig: LiveE2EEntityConfig,
  recordReference: LiveE2ERecordReference,
  assertion: LiveE2EProcessStateAssertion,
  caseResult: LiveE2ECaseResult
): Promise<void> {
  if (!entityConfig.stateFields) {
    throw new Error(`Entity alias '${recordReference.entityAlias}' does not declare process state fields in the tracked live E2E config.`);
  }

  const record = await retrieveRecord(request, accessToken, dataverseUrl, entityConfig, recordReference.id, [
    entityConfig.stateFields.stageIdField,
    entityConfig.stateFields.stepIdField,
    entityConfig.stateFields.internalStatusField,
    entityConfig.stateFields.portalStatusField
  ]);

  caseResult.observedProcessState.push(record);

  const comparisons: Array<[string | undefined, unknown, string]> = [
    [assertion.expected.stageId, record[entityConfig.stateFields.stageIdField], entityConfig.stateFields.stageIdField],
    [assertion.expected.stepId, record[entityConfig.stateFields.stepIdField], entityConfig.stateFields.stepIdField],
    [assertion.expected.internalStatus, record[entityConfig.stateFields.internalStatusField], entityConfig.stateFields.internalStatusField],
    [assertion.expected.portalStatus, record[entityConfig.stateFields.portalStatusField], entityConfig.stateFields.portalStatusField]
  ];

  for (const [expectedValue, actualValue, fieldName] of comparisons) {
    if (expectedValue !== undefined && actualValue !== expectedValue) {
      throw new Error(`Expected process field '${fieldName}' on '${recordReference.id}' to equal '${expectedValue}' but found '${String(actualValue)}'.`);
    }
  }
}

export function resolveEntityConfig(environmentConfig: LiveE2EEnvironmentConfig, entityAlias: string): LiveE2EEntityConfig {
  const entityConfig = environmentConfig.liveE2E.entities[entityAlias];
  if (!entityConfig) {
    throw new Error(`Unknown live E2E entity alias '${entityAlias}'. Update the tracked environment config before running the suite.`);
  }

  return entityConfig;
}
