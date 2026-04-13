import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { DbmModelV1 } from 'dbm-contract';
import approvalRequestModel from '../../docs/architecture/examples/approval-request-v1.model.json';
import {
  applySynthesisPlanToDev,
  diffSynthesisPlan,
  emitGeneratedMetadataSolution,
  normalizeReadbackEntity,
  planDataverseSynthesis
} from '../src/index';
import type { DataverseReadbackSnapshot } from '../src/types';

test('planDataverseSynthesis maps the approval example into Dataverse entities, columns, and relationships', () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);

  assert.equal(plan.generatedMetadataSolutionName, 'DynamicsBusinessMachineGeneratedMetadata');
  assert.equal(plan.entities.length, 2);
  assert.equal(plan.relationships.some((relationship) => relationship.logicalName === 'dbm_request_dbm_requestdecision'), true);
  assert.equal(
    plan.entities
      .flatMap((entity) => entity.columns)
      .some((column) => column.logicalName === 'dbm_screeningresult' && column.attributeType === 'Picklist' && column.supported),
    true
  );
  assert.equal(
    plan.entities
      .flatMap((entity) => entity.columns)
      .some((column) => column.logicalName === 'dbm_requestid' && column.attributeType === 'Lookup' && column.supported),
    true
  );
});

test('normalizeReadbackEntity captures lookup targets and picklist values', () => {
  const entity = normalizeReadbackEntity(
    {
      LogicalName: 'dbm_request',
      SchemaName: 'dbm_Request',
      PrimaryIdAttribute: 'dbm_requestid',
      PrimaryNameAttribute: 'dbm_title'
    },
    [
      {
        LogicalName: 'dbm_title',
        SchemaName: 'dbm_Title',
        AttributeType: 'String',
        IsPrimaryName: true,
        RequiredLevel: { Value: 'ApplicationRequired' }
      },
      {
        LogicalName: 'dbm_requestid',
        SchemaName: 'dbm_RequestId',
        AttributeType: 'Lookup',
        IsPrimaryName: false,
        RequiredLevel: { Value: 'ApplicationRequired' },
        Targets: ['dbm_request']
      },
      {
        LogicalName: 'dbm_screeningresult',
        SchemaName: 'dbm_ScreeningResult',
        AttributeType: 'Picklist',
        IsPrimaryName: false,
        RequiredLevel: { Value: 'None' },
        OptionSet: { Options: [{ Value: 100000000 }, { Value: 100000001 }] }
      }
    ]
  );

  assert.equal(entity.primaryNameAttributeLogicalName, 'dbm_title');
  assert.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_requestid')?.targets, ['dbm_request']);
  assert.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_screeningresult')?.optionValues, [100000000, 100000001]);
});

test('diffSynthesisPlan detects missing columns and relationships as blocking drift', () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const snapshot: DataverseReadbackSnapshot = {
    generatedUtc: new Date().toISOString(),
    dataverseUrl: 'https://example.invalid',
    solutionName: plan.generatedMetadataSolutionName,
    entities: [
      {
        logicalName: 'dbm_request',
        schemaName: 'dbm_Request',
        primaryIdLogicalName: 'dbm_requestid',
        primaryNameAttributeLogicalName: 'dbm_title',
        columns: []
      }
    ],
    relationships: [],
    diagnostics: []
  };

  const report = diffSynthesisPlan(plan, snapshot);
  assert.equal(report.hasBlockingDrift, true);
  assert.equal(report.differences.some((difference) => difference.kind === 'column'), true);
  assert.equal(report.differences.some((difference) => difference.kind === 'relationship'), true);
});

test('emitGeneratedMetadataSolution writes a tracked solution-source tree', async () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const outputRoot = path.join(process.cwd(), 'dist', 'test-output');
  await emitGeneratedMetadataSolution(plan, outputRoot);

  const solutionXml = await fs.readFile(path.join(outputRoot, 'src', 'Other', 'Solution.xml'), 'utf8');
  const entityXml = await fs.readFile(path.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'Entity.xml'), 'utf8');
  const relationshipsIndexXml = await fs.readFile(path.join(outputRoot, 'src', 'Other', 'Relationships.xml'), 'utf8');
  const relationshipFileName = `${plan.relationships[0]?.schemaName}.xml`.replace(/[^A-Za-z0-9_.-]/g, '_');
  const relationshipXml = await fs.readFile(
    path.join(outputRoot, 'src', 'Other', 'Relationships', relationshipFileName),
    'utf8'
  );

  assert.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
  assert.match(entityXml, /<Type>primarykey<\/Type>/);
  assert.match(entityXml, /<Name>dbm_title<\/Name>/);
  assert.match(entityXml, /PrimaryName\|ValidForAdvancedFind\|ValidForForm\|ValidForGrid\|RequiredForForm/);
  assert.match(relationshipsIndexXml, /dbm_RequestDbmRequestdecision/);
  assert.match(relationshipXml, /dbm_request_dbm_requestdecision/);

  await fs.rm(outputRoot, { recursive: true, force: true });
});

test('applySynthesisPlanToDev bootstraps the generated solution and creates relationship-backed metadata idempotently', async () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const requests: Array<{ method: string; url: string; body?: any; headers: Record<string, string> }> = [];
  const queuedResponses: Array<{ status: number; payload?: any }> = [
    { status: 200, payload: { value: [] } },
    { status: 200, payload: { value: [{ publisherid: '11111111-1111-1111-1111-111111111111', uniquename: 'yagasoft' }] } },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 404 },
    { status: 204 },
    { status: 200, payload: { value: [] } },
    { status: 204 },
    { status: 204 },
    {
      status: 200,
      payload: {
        LogicalName: 'dbm_request',
        SchemaName: 'dbm_Request',
        PrimaryIdAttribute: 'dbm_requestid',
        PrimaryNameAttribute: 'dbm_title'
      }
    },
    {
      status: 200,
      payload: {
        value: [
          {
            LogicalName: 'dbm_title',
            SchemaName: 'dbm_Title',
            AttributeType: 'String',
            IsPrimaryName: true,
            RequiredLevel: { Value: 'ApplicationRequired' }
          },
          {
            LogicalName: 'dbm_amount',
            SchemaName: 'dbm_Amount',
            AttributeType: 'Money',
            IsPrimaryName: false,
            RequiredLevel: { Value: 'ApplicationRequired' }
          }
        ]
      }
    },
    {
      status: 200,
      payload: {
        LogicalName: 'dbm_requestdecision',
        SchemaName: 'dbm_Requestdecision',
        PrimaryIdAttribute: 'dbm_requestdecisionid',
        PrimaryNameAttribute: 'dbm_name'
      }
    },
    {
      status: 200,
      payload: {
        value: [
          {
            LogicalName: 'dbm_name',
            SchemaName: 'dbm_Name',
            AttributeType: 'String',
            IsPrimaryName: true,
            RequiredLevel: { Value: 'ApplicationRequired' }
          },
          {
            LogicalName: 'dbm_requestid',
            SchemaName: 'dbm_RequestId',
            AttributeType: 'Lookup',
            IsPrimaryName: false,
            RequiredLevel: { Value: 'ApplicationRequired' }
          }
        ]
      }
    },
    { status: 200, payload: { Targets: ['dbm_request'] } },
    {
      status: 200,
      payload: {
        value: [
          {
            SchemaName: 'dbm_Request_DbM_Requestdecision',
            ReferencedEntity: 'dbm_request',
            ReferencingEntity: 'dbm_requestdecision',
            ReferencingAttribute: 'dbm_requestid'
          }
        ]
      }
    }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const next = queuedResponses.shift();
    assert.ok(next, `Unexpected fetch call: ${String(input)}`);
    const bodyText = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({
      method: init?.method ?? 'GET',
      url: String(input),
      body: bodyText ? JSON.parse(bodyText) : undefined,
      headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries())
    });

    return new Response(next.payload ? JSON.stringify(next.payload) : null, {
      status: next.status,
      headers: next.payload ? { 'Content-Type': 'application/json' } : undefined
    });
  }) as typeof fetch;

  try {
    const report = await applySynthesisPlanToDev(
      plan,
      { dataverseUrl: 'https://example.crm.dynamics.com' },
      { accessToken: 'token' }
    );

    assert.equal(report.status, 'success');
    assert.equal(report.actions.some((action) => action.componentType === 'solution' && action.state === 'created'), true);
    assert.equal(report.actions.some((action) => action.componentType === 'relationship' && action.state === 'created'), true);
    assert.equal(
      report.actions.some(
        (action) =>
          action.componentType === 'column' &&
          action.logicalName === 'dbm_requestdecision.dbm_requestid' &&
          action.message.includes('relationship metadata')
      ),
      true
    );

    const relationshipCreate = requests.find((request) => request.url.endsWith('/RelationshipDefinitions') && request.method === 'POST');
    assert.ok(relationshipCreate);
    assert.equal(relationshipCreate?.headers['mscrm.solutionuniquename'], 'DynamicsBusinessMachineGeneratedMetadata');
    assert.equal(relationshipCreate?.body?.Lookup?.SchemaName, 'dbm_Requestid');
    assert.equal(relationshipCreate?.body?.ReferencedEntity, 'dbm_request');
    assert.equal(relationshipCreate?.body?.ReferencingEntity, 'dbm_requestdecision');

    const entityCreate = requests.find((request) => request.url.endsWith('/EntityDefinitions') && request.method === 'POST');
    assert.ok(entityCreate);
    assert.equal(entityCreate?.body?.PrimaryNameAttribute, 'dbm_title');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(queuedResponses.length, 0);
});
