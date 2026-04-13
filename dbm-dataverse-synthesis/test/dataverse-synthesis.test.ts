import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { DbmModelV1 } from 'dbm-contract';
import approvalRequestModel from '../../docs/architecture/examples/approval-request-v1.model.json';
import { diffSynthesisPlan, emitGeneratedMetadataSolution, normalizeReadbackEntity, planDataverseSynthesis } from '../src/index';
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
  const relationshipFileName = `${plan.relationships[0]?.schemaName}.xml`.replace(/[^A-Za-z0-9_.-]/g, '_');
  const relationshipXml = await fs.readFile(
    path.join(outputRoot, 'src', 'Other', 'Relationships', relationshipFileName),
    'utf8'
  );

  assert.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
  assert.match(entityXml, /dbm_request/);
  assert.match(relationshipXml, /dbm_request_dbm_requestdecision/);

  await fs.rm(outputRoot, { recursive: true, force: true });
});
