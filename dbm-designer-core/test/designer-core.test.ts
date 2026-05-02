import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbmModelV1, DbmProcessV1, DbmStageV1 } from 'dbm-contract';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import {
  addNode,
  loadModel,
  moveNode,
  processNodeId,
  processStagesNodeId,
  resolveMainProcess,
  serializeModel,
  stageNodeId,
  updateNode,
  validateDocument
} from '../src/index';
import { PROCESS_PORTFOLIO_PROCESSES_NODE_ID } from '../src/node-ids';

function loadGenericMatrixModel(): DbmModelV1 {
  return structuredClone(employeeOnboarding as DbmModelV1);
}

function createSubProcess(id: string, renderOrder: number): DbmProcessV1 {
  return {
    id,
    displayName: 'Background checks',
    role: 'sub-process',
    processTypeId: 'background-checks',
    mainDisplayMode: 'expanded',
    statusId: 'preparing',
    portalStatusId: null,
    renderOrder,
    subProcessVisibility: [],
    actors: [
      {
        id: 'security-team',
        displayName: 'Security',
        actorCategory: 'team',
        roleKey: 'security',
        source: 'field-binding'
      }
    ],
    variables: [],
    statuses: [
      {
        id: 'preparing',
        displayName: 'Preparing',
        audience: 'internal',
        kind: 'progress'
      }
    ],
    tasks: [],
    notifications: [],
    stages: [],
    steps: [],
    transitions: [],
    stepTransitions: [],
    outcomes: []
  };
}

function createStage(id: string): DbmStageV1 {
  return {
    id,
    displayName: 'Security screening',
    stageCategory: 'work',
    stageKindId: 'security-screening',
    scope: 'back-office',
    stageSpan: {
      start: {
        stageId: 'offer-accepted',
        fraction: 0.1
      },
      end: {
        stageId: 'preparation',
        fraction: 0.9
      }
    },
    actorId: 'security-team',
    formId: null,
    portalVisibility: 'hidden',
    statusId: 'preparing',
    portalStatusId: null,
    stepIds: [],
    defaultStepId: null,
    entryRuleIds: [],
    exitRuleIds: [],
    allowedOutcomeIds: []
  };
}

test('loads a generic matrix model and resolves the main process from processPortfolio.mainProcessId', () => {
  const document = loadModel(loadGenericMatrixModel());
  const mainProcess = resolveMainProcess(document);

  assert.equal(mainProcess.id, 'onboarding-main');
  assert.equal(mainProcess.role, 'main');
  assert.equal(document.graph.processId, 'onboarding-main');
  assert.equal(document.index[processNodeId('onboarding-main')]?.kind, 'process');
  assert.equal(document.issues.filter((issue) => issue.level === 'error').length, 0);
});

test('adds a sub-process without creating legacy model.process data', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = addNode(document, {
    kind: 'process',
    parentId: PROCESS_PORTFOLIO_PROCESSES_NODE_ID,
    index: 3,
    value: createSubProcess('background-checks', 3)
  });
  const serialized = serializeModel(result.document) as DbmModelV1 & { process?: unknown };

  assert.equal(serialized.process, undefined);
  assert.equal(serialized.processPortfolio.processes.at(-1)?.id, 'background-checks');
  assert.equal(serialized.processPortfolio.processes.at(-1)?.role, 'sub-process');
  assert.equal(result.affectedNodeId, processNodeId('background-checks'));
});

test('adds a generic stage to a selected process', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = addNode(document, {
    kind: 'stage',
    parentId: processStagesNodeId('it-readiness'),
    index: 1,
    value: createStage('security-screening')
  });
  const process = result.document.model.processPortfolio.processes.find((entry) => entry.id === 'it-readiness');
  const stage = process?.stages.find((entry) => entry.id === 'security-screening');

  assert.ok(stage);
  assert.equal(stage.stageCategory, 'work');
  assert.equal(stage.stageKindId, 'security-screening');
  assert.equal(result.affectedNodeId, stageNodeId('it-readiness', 'security-screening'));
});

test('reorders stages within a selected process while preserving valid span anchors', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = addNode(document, {
    kind: 'stage',
    parentId: processStagesNodeId('it-readiness'),
    index: 1,
    value: createStage('security-screening')
  });
  const reordered = moveNode(result.document, {
    nodeId: stageNodeId('it-readiness', 'security-screening'),
    targetIndex: 0
  });
  const process = reordered.document.model.processPortfolio.processes.find((entry) => entry.id === 'it-readiness');

  assert.equal(process?.stages[0]?.id, 'security-screening');
  assert.deepEqual(process?.stages[0]?.stageSpan, createStage('security-screening').stageSpan);
  assert.equal(reordered.issues.some((issue) => issue.code === 'stage-span-anchor-not-found'), false);
  assert.equal(reordered.issues.some((issue) => issue.code === 'stage-span-reversed'), false);
});

test('edits sub-process visibility for form and portal audiences', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = updateNode(document, {
    nodeId: processNodeId('it-readiness'),
    value: {
      subProcessVisibility: [
        {
          audience: 'form',
          ruleId: 'show-it-readiness',
          visibleWhen: true
        },
        {
          audience: 'portal',
          ruleId: null,
          visibleWhen: false
        }
      ]
    }
  });
  const process = result.document.model.processPortfolio.processes.find((entry) => entry.id === 'it-readiness');

  assert.deepEqual(process?.subProcessVisibility, [
    {
      audience: 'form',
      ruleId: 'show-it-readiness',
      visibleWhen: true
    },
    {
      audience: 'portal',
      ruleId: null,
      visibleWhen: false
    }
  ]);
});

test('validates missing or duplicate main process, invalid roles, spans, and ambiguous anchors', () => {
  const missingMain = loadGenericMatrixModel();
  missingMain.processPortfolio.mainProcessId = 'missing-main';
  assert.equal(validateDocument(loadModel(missingMain)).some((issue) => issue.code === 'main-process-not-found'), true);

  const duplicateMain = loadGenericMatrixModel();
  duplicateMain.processPortfolio.processes[1].role = 'main';
  assert.equal(validateDocument(loadModel(duplicateMain)).some((issue) => issue.code === 'main-process-duplicate'), true);

  const invalidRole = loadGenericMatrixModel();
  invalidRole.processPortfolio.processes[1].role = 'supporting' as DbmProcessV1['role'];
  assert.equal(validateDocument(loadModel(invalidRole)).some((issue) => issue.code === 'sub-process-role-invalid'), true);

  const invalidAnchor = loadGenericMatrixModel();
  invalidAnchor.processPortfolio.processes[1].stages[0].stageSpan.start.stageId = 'missing-stage';
  assert.equal(validateDocument(loadModel(invalidAnchor)).some((issue) => issue.code === 'stage-span-anchor-not-found'), true);

  const invalidFraction = loadGenericMatrixModel();
  invalidFraction.processPortfolio.processes[1].stages[0].stageSpan.end.fraction = 1.2;
  assert.equal(validateDocument(loadModel(invalidFraction)).some((issue) => issue.code === 'stage-span-fraction-out-of-range'), true);

  const ambiguousAnchor = loadGenericMatrixModel();
  ambiguousAnchor.processPortfolio.processes[0].stages[1].id = 'offer-accepted';
  assert.equal(validateDocument(loadModel(ambiguousAnchor)).some((issue) => issue.code === 'stage-span-anchor-ambiguous'), true);
});
