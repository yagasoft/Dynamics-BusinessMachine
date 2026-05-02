import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbmModelV1, DbmProcessV1, DbmStageV1 } from 'dbm-contract';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import {
  applyGraphIntent,
  addNode,
  loadModel,
  moveNode,
  processNodeId,
  processStagesNodeId,
  removeNode,
  resolveMainProcess,
  serializeModel,
  stageNodeId,
  stepNodeId,
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
    childProcessRefs: [],
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
  } as unknown as DbmStageV1;
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

test('adds a child process under a selected parent stage without creating legacy model.process data', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = addNode(document, {
    kind: 'process',
    parentId: stageNodeId('onboarding-main', 'preparation'),
    index: 3,
    value: createSubProcess('background-checks', 3)
  });
  const serialized = serializeModel(result.document) as DbmModelV1 & { process?: unknown };
  const parentStage = serialized.processPortfolio.processes
    .find((process) => process.id === 'onboarding-main')
    ?.stages.find((stage) => stage.id === 'preparation') as unknown as { childProcessRefs?: Array<{ processId: string; blocksParent: boolean }> };
  const addedProcess = serialized.processPortfolio.processes.find((process) => process.id === 'background-checks');

  assert.equal(serialized.process, undefined);
  assert.equal(serialized.processPortfolio.processes[3]?.id, 'background-checks');
  assert.equal(addedProcess?.role, 'sub-process');
  assert.deepEqual(parentStage?.childProcessRefs?.at(-1), {
    id: 'spawn-background-checks',
    processId: 'background-checks',
    displayName: 'Background checks',
    activationRuleId: null,
    blocksParent: true
  });
  assert.equal(result.affectedNodeId, processNodeId('background-checks'));
});

test('adds a grandchild process under a child process stage', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = addNode(document, {
    kind: 'process',
    parentId: stageNodeId('it-readiness', 'prepare-access'),
    value: createSubProcess('security-screening', 4)
  });
  const parentStage = result.document.model.processPortfolio.processes
    .find((process) => process.id === 'it-readiness')
    ?.stages.find((stage) => stage.id === 'prepare-access') as unknown as { childProcessRefs?: Array<{ processId: string }> };

  assert.equal(parentStage?.childProcessRefs?.at(-1)?.processId, 'security-screening');
  assert.equal(validateDocument(result.document).some((issue) => issue.code === 'child-process-target-not-found'), false);
  assert.equal(validateDocument(result.document).some((issue) => issue.code === 'child-process-cycle'), false);
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

test('reorders stages within a selected process while preserving child process refs', () => {
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
  assert.deepEqual((process?.stages[0] as unknown as { childProcessRefs?: unknown[] })?.childProcessRefs, []);
  assert.equal(reordered.issues.some((issue) => issue.code === 'child-process-target-not-found'), false);
  assert.equal(reordered.issues.some((issue) => issue.code === 'child-process-cycle'), false);
});

test('moves a stage across processes with owned steps and child refs without legacy model.process data', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = applyGraphIntent(document, {
    kind: 'move-stage',
    sourceProcessId: 'onboarding-main',
    stageId: 'preparation',
    targetProcessId: 'facilities-readiness',
    targetIndex: 1
  });
  const serialized = serializeModel(result.document) as DbmModelV1 & { process?: unknown };
  const sourceProcess = serialized.processPortfolio.processes.find((process) => process.id === 'onboarding-main');
  const targetProcess = serialized.processPortfolio.processes.find((process) => process.id === 'facilities-readiness');
  const movedStage = targetProcess?.stages[1];
  const movedStep = targetProcess?.steps.find((step) => step.id === 'provision-access-step');

  assert.equal(serialized.process, undefined);
  assert.equal(sourceProcess?.stages.some((stage) => stage.id === 'preparation'), false);
  assert.equal(sourceProcess?.steps.some((step) => step.id === 'provision-access-step'), false);
  assert.equal(sourceProcess?.transitions.some((transition) => transition.fromStageId === 'preparation' || transition.toStageId === 'preparation'), false);
  assert.equal(movedStage?.id, 'preparation');
  assert.equal(movedStage?.actorId, 'facilities-team');
  assert.equal(movedStage?.statusId, 'preparing');
  assert.deepEqual(movedStage?.stepIds, ['provision-access-step']);
  assert.equal(movedStage?.childProcessRefs.at(0)?.processId, 'it-readiness');
  assert.equal(movedStep?.stageId, 'preparation');
  assert.equal(movedStep?.ownerActorId, 'facilities-team');
  assert.equal(validateDocument(result.document).some((issue) => issue.level === 'error'), false);
});

test('attaches, reconnects, and detaches reusable child process refs without deleting process definitions', () => {
  const document = loadModel(loadGenericMatrixModel());
  const attached = applyGraphIntent(document, {
    kind: 'attach-child-process-ref',
    parentProcessId: 'onboarding-main',
    parentStageId: 'first-day',
    childProcessId: 'facilities-readiness'
  });
  const firstDay = attached.document.model.processPortfolio.processes
    .find((process) => process.id === 'onboarding-main')
    ?.stages.find((stage) => stage.id === 'first-day');
  const refId = firstDay?.childProcessRefs.find((ref) => ref.processId === 'facilities-readiness')?.id ?? '';

  assert.ok(refId);
  assert.equal(firstDay?.childProcessRefs.filter((ref) => ref.processId === 'facilities-readiness').length, 1);

  const reconnected = applyGraphIntent(attached.document, {
    kind: 'move-child-process-ref',
    sourceProcessId: 'onboarding-main',
    sourceStageId: 'first-day',
    refId,
    targetProcessId: 'onboarding-main',
    targetStageId: 'onboarding-complete'
  });
  const sourceStage = reconnected.document.model.processPortfolio.processes
    .find((process) => process.id === 'onboarding-main')
    ?.stages.find((stage) => stage.id === 'first-day');
  const targetStage = reconnected.document.model.processPortfolio.processes
    .find((process) => process.id === 'onboarding-main')
    ?.stages.find((stage) => stage.id === 'onboarding-complete');

  assert.equal(sourceStage?.childProcessRefs.some((ref) => ref.id === refId), false);
  assert.equal(targetStage?.childProcessRefs.some((ref) => ref.id === refId && ref.processId === 'facilities-readiness'), true);

  const detached = applyGraphIntent(reconnected.document, {
    kind: 'detach-child-process-ref',
    parentProcessId: 'onboarding-main',
    parentStageId: 'onboarding-complete',
    refId
  });
  const detachedStage = detached.document.model.processPortfolio.processes
    .find((process) => process.id === 'onboarding-main')
    ?.stages.find((stage) => stage.id === 'onboarding-complete');

  assert.equal(detachedStage?.childProcessRefs.some((ref) => ref.id === refId), false);
  assert.equal(detached.document.model.processPortfolio.processes.some((process) => process.id === 'facilities-readiness'), true);
});

test('rejects child process refs that target the same process or create a cycle', () => {
  const document = loadModel(loadGenericMatrixModel());

  assert.throws(() => applyGraphIntent(document, {
    kind: 'attach-child-process-ref',
    parentProcessId: 'it-readiness',
    parentStageId: 'prepare-access',
    childProcessId: 'it-readiness'
  }), /Cannot attach child process 'it-readiness'/);

  assert.throws(() => applyGraphIntent(document, {
    kind: 'attach-child-process-ref',
    parentProcessId: 'access-review',
    parentStageId: 'verify-access',
    childProcessId: 'onboarding-main'
  }), /would create a circular process hierarchy/);
});

test('removes a stage with owned steps and invalid process-local transitions while keeping child process definitions', () => {
  const document = loadModel(loadGenericMatrixModel());
  const result = removeNode(document, {
    nodeId: stageNodeId('onboarding-main', 'preparation')
  });
  const process = result.document.model.processPortfolio.processes.find((entry) => entry.id === 'onboarding-main');

  assert.equal(process?.stages.some((stage) => stage.id === 'preparation'), false);
  assert.equal(process?.steps.some((step) => step.id === 'provision-access-step'), false);
  assert.equal(process?.transitions.some((transition) => transition.fromStageId === 'preparation' || transition.toStageId === 'preparation'), false);
  assert.equal(result.document.index[stepNodeId('onboarding-main', 'provision-access-step')], undefined);
  assert.equal(result.document.model.processPortfolio.processes.some((entry) => entry.id === 'it-readiness'), true);
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

test('validates missing or duplicate main process, invalid roles, and invalid child process refs', () => {
  const missingMain = loadGenericMatrixModel();
  missingMain.processPortfolio.mainProcessId = 'missing-main';
  assert.equal(validateDocument(loadModel(missingMain)).some((issue) => issue.code === 'main-process-not-found'), true);

  const duplicateMain = loadGenericMatrixModel();
  duplicateMain.processPortfolio.processes[1].role = 'main';
  assert.equal(validateDocument(loadModel(duplicateMain)).some((issue) => issue.code === 'main-process-duplicate'), true);

  const invalidRole = loadGenericMatrixModel();
  invalidRole.processPortfolio.processes[1].role = 'supporting' as DbmProcessV1['role'];
  assert.equal(validateDocument(loadModel(invalidRole)).some((issue) => issue.code === 'sub-process-role-invalid'), true);

  const missingChild = loadGenericMatrixModel();
  const stage = missingChild.processPortfolio.processes[0].stages[0] as unknown as { childProcessRefs: Array<{ id: string; processId: string; displayName: string; activationRuleId: null; blocksParent: boolean }> };
  stage.childProcessRefs.push({
    id: 'spawn-missing',
    processId: 'missing-process',
    displayName: 'Missing process',
    activationRuleId: null,
    blocksParent: true
  });
  assert.equal(validateDocument(loadModel(missingChild)).some((issue) => issue.code === 'child-process-target-not-found'), true);

  const circular = loadGenericMatrixModel();
  const grandchild = circular.processPortfolio.processes.find((process) => process.id === 'access-review');
  const childStage = grandchild?.stages[0] as unknown as { childProcessRefs: Array<{ id: string; processId: string; displayName: string; activationRuleId: null; blocksParent: boolean }> };
  childStage.childProcessRefs.push({
    id: 'cycle-to-root',
    processId: 'onboarding-main',
    displayName: 'Cycle to root',
    activationRuleId: null,
    blocksParent: true
  });
  assert.equal(validateDocument(loadModel(circular)).some((issue) => issue.code === 'child-process-cycle'), true);
});
