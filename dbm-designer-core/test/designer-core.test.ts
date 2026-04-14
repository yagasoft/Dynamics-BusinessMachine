import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbmDesignerWorkspaceV1, DbmFormStateV1, DbmRuntimeStateV1, DbmStatusV1, DbmStepV1 } from 'dbm-contract';
import {
  addNode,
  buildProcessExperienceSnapshot,
  createDefaultWorkspace,
  createApprovalRequestTemplate,
  loadModel,
  loadModelPackage,
  moveNode,
  removeNode,
  serializeModel,
  serializeModelPackage,
  updateNode,
  validateDocument
} from '../src/index';
import {
  formStateNodeId,
  formStatesNodeId,
  PROCESS_STATUSES_NODE_ID,
  stageNodeId,
  stageStepsNodeId,
  statusNodeId,
  stepNodeId
} from '../src/node-ids';

test('approval request template round-trips through load and serialize', () => {
  const template = createApprovalRequestTemplate();
  const document = loadModel(template);

  assert.equal(document.tree.length, 1);
  assert.equal(document.tree[0].id, 'document:root');
  assert.deepEqual(serializeModel(document), template);
});

test('legacy model packages auto-generate a default workspace and first save preserves canonical semantics', () => {
  const template = createApprovalRequestTemplate();
  const document = loadModelPackage(template, null);
  const serialized = serializeModelPackage(document);

  assert.equal(serialized.workspace.schemaVersion, 'dbm.designer.workspace/v1');
  assert.equal(serialized.workspace.packageId, template.package.id);
  assert.equal(serialized.workspace.packageVersion, template.package.version);
  assert.equal(serialized.workspace.preview.stageId, 'draft-request');
  assert.equal(serialized.workspace.preview.stepId, 'capture-request');
  assert.deepEqual(serialized.model, template);
});

test('workspace sidecar round-trips selection, viewport, and preview state independently of the canonical model', () => {
  const template = createApprovalRequestTemplate();
  const workspace: DbmDesignerWorkspaceV1 = {
    ...createDefaultWorkspace(template),
    viewport: {
      x: 480,
      y: 240,
      zoom: 0.8
    },
    selectionNodeId: stageNodeId('manager-review'),
    preview: {
      mode: 'portal',
      stageId: 'internal-screening-stage',
      stepId: 'screen-request'
    }
  };

  const document = loadModelPackage(template, workspace);
  const serialized = serializeModelPackage(document);

  assert.equal(document.selectionId, stageNodeId('manager-review'));
  assert.equal(serialized.workspace.viewport.zoom, 0.8);
  assert.equal(serialized.workspace.preview.mode, 'portal');
  assert.equal(serialized.model.package.id, template.package.id);
  assert.equal(serialized.model.process.id, template.process.id);
});

test('designer commands support statuses, stage steps, and form states', () => {
  let document = loadModel(createApprovalRequestTemplate());

  const newStatus: DbmStatusV1 = {
    id: 'needs-more-info',
    displayName: 'Needs More Info',
    audience: 'portal',
    kind: 'progress'
  };
  document = addNode(document, {
    kind: 'status',
    parentId: PROCESS_STATUSES_NODE_ID,
    value: newStatus
  }).document;

  const newStep: DbmStepV1 = {
    id: 'collect-missing-details',
    stageId: 'draft-request',
    displayName: 'Collect Missing Details',
    stepType: 'data-entry',
    ownerActorId: 'requester',
    notificationId: 'notify-request-received',
    taskId: 'capture-request-details',
    internalStatusId: 'draft',
    portalStatusId: 'needs-more-info',
    formStateId: 'request-supporting-state',
    entryRuleIds: [],
    exitRuleIds: []
  };
  document = addNode(document, {
    kind: 'step',
    parentId: stageStepsNodeId('draft-request'),
    value: newStep
  }).document;

  const newState: DbmFormStateV1 = {
    id: 'request-clarification-state',
    displayName: 'Request Clarification',
    activationRuleIds: ['needs-supporting-details'],
    visibleEntityBindingIds: ['request-primary'],
    elementBehaviors: []
  };
  document = addNode(document, {
    kind: 'form-state',
    parentId: formStatesNodeId('request-form'),
    value: newState
  }).document;

  document = updateNode(document, {
    nodeId: stepNodeId('collect-missing-details'),
    value: {
      ownerActorId: 'finance-reviewer',
      internalStatusId: 'under-review'
    }
  }).document;

  document = moveNode(document, {
    nodeId: stepNodeId('collect-missing-details'),
    targetIndex: 0
  }).document;

  document = moveNode(document, {
    nodeId: statusNodeId('needs-more-info'),
    targetIndex: 0
  }).document;

  document = removeNode(document, {
    nodeId: formStateNodeId('request-form', 'request-clarification-state')
  }).document;

  assert.equal(document.model.process.statuses[0]?.id, 'needs-more-info');
  assert.equal(document.model.process.steps.find((step) => step.id === 'collect-missing-details')?.ownerActorId, 'finance-reviewer');
  assert.equal(document.model.process.stages.find((stage) => stage.id === 'draft-request')?.stepIds[0], 'collect-missing-details');
  assert.equal(document.model.forms.find((form) => form.id === 'request-form')?.formStates.some((state) => state.id === 'request-clarification-state'), false);
});

test('semantic validation catches broken step references and invalid convergence targets', () => {
  const model = createApprovalRequestTemplate();
  const step = model.process.steps.find((entry) => entry.id === 'choose-decision');
  assert.ok(step);
  step.ownerActorId = 'missing-owner';
  step.internalStatusId = 'missing-status';
  step.formStateId = 'missing-form-state';

  const transition = model.process.stepTransitions.find((entry) => entry.id === 'capture-to-screening');
  assert.ok(transition);
  transition.target = { stageId: 'missing-stage' };

  const issues = validateDocument(loadModel(model));

  assert.equal(issues.some((entry) => entry.code === 'missing-step-owner'), true);
  assert.equal(issues.some((entry) => entry.code === 'missing-step-internal-status'), true);
  assert.equal(issues.some((entry) => entry.code === 'missing-step-form-state'), true);
  assert.equal(issues.some((entry) => entry.code === 'missing-step-transition-target'), true);
});

test('hidden internal stages can still project a portal-visible status without validation errors', () => {
  const document = loadModel(createApprovalRequestTemplate());
  const issues = validateDocument(document);
  const screenStage = document.model.process.stages.find((stage) => stage.id === 'internal-screening-stage');
  const screenStep = document.model.process.steps.find((step) => step.id === 'screen-request');

  assert.ok(screenStage);
  assert.ok(screenStep);
  assert.equal(screenStage.portalVisibility, 'hidden');
  assert.equal(screenStep.portalStatusId, 'under-review');
  assert.deepEqual(issues.filter((issue) => issue.level === 'error'), []);
});

test('process experience snapshot collapses hidden internal stages for portal preview while keeping current status and next branch clarity', () => {
  const model = createApprovalRequestTemplate();
  const runtimeState: DbmRuntimeStateV1 = {
    stageId: 'internal-screening-stage',
    stepId: 'screen-request',
    formStateId: 'request-screening-state',
    internalStatusId: 'internal-screening',
    portalStatusId: 'under-review',
    records: [],
    variables: {}
  };

  const snapshot = buildProcessExperienceSnapshot(model, runtimeState, {
    audience: 'portal'
  });

  const hiddenStage = snapshot.stages.find((stage) => stage.id === 'internal-screening-stage');
  const nextStage = snapshot.stages.find((stage) => stage.id === 'manager-review');
  const hiddenStep = snapshot.steps.find((step) => step.id === 'screen-request');

  assert.ok(hiddenStage);
  assert.ok(hiddenStep);
  assert.ok(nextStage);
  assert.equal(hiddenStage.visibility, 'collapsed-hidden');
  assert.equal(hiddenStage.state, 'current');
  assert.equal(hiddenStep.visibility, 'collapsed-hidden');
  assert.equal(snapshot.portalStatus?.id, 'under-review');
  assert.equal(snapshot.projection.message, 'Current work is progressing in an internal stage.');
  assert.equal(nextStage.state, 'available');
});
