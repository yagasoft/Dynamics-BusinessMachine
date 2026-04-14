import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbmDesignerWorkspaceV1, DbmFormStateV1, DbmRuntimeStateV1, DbmStatusV1, DbmStepV1 } from 'dbm-contract';
import genericExistingFormModel from '../../docs/architecture/examples/generic-existing-form-v1.model.json';
import {
  addNode,
  applyGraphIntent,
  buildDesignerClipboardPayload,
  buildDesignerGraphDocument,
  buildProcessExperienceSnapshot,
  createDefaultWorkspace,
  createApprovalRequestTemplate,
  graphStageOutcomePortId,
  graphStepOutPortId,
  isStableDesignerGraphNodeId,
  loadModel,
  loadModelPackage,
  moveNode,
  pasteDesignerClipboardPayload,
  removeNode,
  serializeModel,
  serializeModelPackage,
  translateGraphIntentToCommands,
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

test('generic existing-form proof model validates cleanly as a custom scenario', () => {
  const document = loadModel(genericExistingFormModel);

  assert.equal(document.model.process.scenarioType, 'custom');
  assert.equal(document.issues.filter((entry) => entry.severity === 'error').length, 0);
  assert.equal(document.model.process.transitions.find((transition) => transition.id === 'submit-case')?.subjectHandoff?.strategy, 'create-related');
});

test('cross-entity transitions fail validation when subject handoff is missing', () => {
  const mutated = structuredClone(genericExistingFormModel);
  const submitTransition = mutated.process.transitions.find((transition) => transition.id === 'submit-case');
  assert.ok(submitTransition);
  delete submitTransition.subjectHandoff;

  const document = loadModel(mutated);

  assert.equal(document.issues.some((entry) => entry.code === 'missing-subject-handoff'), true);
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
  assert.equal(document.graph.processId, template.process.id);
  assert.equal(document.graph.nodes.some((node) => node.id === stageNodeId('manager-review')), true);
});

test('designer graph document is rebuilt from canonical process semantics with stable node, port, and edge identifiers', () => {
  const template = createApprovalRequestTemplate();
  const graph = buildDesignerGraphDocument(template);
  const stageNode = graph.nodes.find((node) => node.id === stageNodeId('draft-request'));
  const stepNode = graph.nodes.find((node) => node.id === stepNodeId('capture-request'));
  const transitionEdge = graph.edges.find((edge) => edge.id === 'transition:submit-request');
  const stepTransitionEdge = graph.edges.find((edge) => edge.id === 'step-transition:capture-to-screening');

  assert.ok(stageNode);
  assert.ok(stepNode);
  assert.ok(transitionEdge);
  assert.ok(stepTransitionEdge);
  assert.equal(stageNode.groupId, 'group:actor:requester');
  assert.equal(stepNode.parentNodeId, stageNodeId('draft-request'));
  assert.equal(isStableDesignerGraphNodeId(stageNode.id), true);
  assert.equal(isStableDesignerGraphNodeId(stepNode.id), true);
  assert.equal(transitionEdge.sourcePortId, graphStageOutcomePortId('draft-request', 'submit'));
  assert.equal(stepTransitionEdge.sourcePortId, graphStepOutPortId('capture-request'));
  assert.deepEqual(buildDesignerGraphDocument(template), graph);
});

test('workspace node positions must use DBM-owned stable graph node identifiers', () => {
  const template = createApprovalRequestTemplate();
  const workspace: DbmDesignerWorkspaceV1 = {
    ...createDefaultWorkspace(template),
    nodePositions: {
      'xyflow-node-1': {
        x: 120,
        y: 240
      }
    }
  };

  const document = loadModelPackage(template, workspace);

  assert.equal(document.issues.some((issue) => issue.code === 'workspace-graph-node-id-invalid'), true);
});

test('graph intents translate into canonical designer commands rather than persisting library graph JSON', () => {
  const document = loadModel(createApprovalRequestTemplate());

  assert.deepEqual(
    translateGraphIntentToCommands(
      {
        kind: 'rename-node',
        nodeId: stageNodeId('manager-review'),
        label: 'Manager Resolution'
      },
      document
    ),
    [
      {
        nodeId: stageNodeId('manager-review'),
        value: {
          displayName: 'Manager Resolution'
        }
      }
    ]
  );

  assert.deepEqual(
    translateGraphIntentToCommands(
      {
        kind: 'move-step',
        stepId: 'record-approval',
        targetStageId: 'manager-review',
        targetIndex: 0
      },
      document
    ),
    [
      {
        nodeId: stepNodeId('record-approval'),
        targetIndex: 0,
        targetParentId: stageStepsNodeId('manager-review')
      }
    ]
  );
});

test('applyGraphIntent can add stages and steps while keeping graph identifiers stable', () => {
  const initialDocument = loadModel(createApprovalRequestTemplate());
  const stageResult = applyGraphIntent(initialDocument, {
    kind: 'add-stage',
    targetIndex: 1,
    actorId: 'finance-reviewer'
  });
  const newStage = stageResult.document.model.process.stages[1];

  assert.ok(newStage);
  assert.equal(newStage.actorId, 'finance-reviewer');
  assert.equal(stageResult.document.graph.nodes.some((node) => node.id === stageNodeId(newStage.id)), true);

  const stepResult = applyGraphIntent(stageResult.document, {
    kind: 'add-step',
    stageId: newStage.id,
    targetIndex: 0
  });
  const newStep = stepResult.document.model.process.steps.find((step) => step.stageId === newStage.id);

  assert.ok(newStep);
  assert.equal(stepResult.document.model.process.stages.find((stage) => stage.id === newStage.id)?.stepIds.includes(newStep.id), true);
  assert.equal(stepResult.document.graph.nodes.some((node) => node.id === stepNodeId(newStep.id)), true);
});

test('applyGraphIntent can add outcomes and update stage outcome exposure through canonical semantics', () => {
  const initialDocument = loadModel(createApprovalRequestTemplate());
  const outcomeResult = applyGraphIntent(initialDocument, {
    kind: 'add-outcome',
    targetIndex: initialDocument.model.process.outcomes.length
  });
  const newOutcome = outcomeResult.document.model.process.outcomes.at(-1);

  assert.ok(newOutcome);
  assert.equal(outcomeResult.document.graph.nodes.some((node) => node.id === `outcome:${newOutcome.id}`), true);

  const updateResult = applyGraphIntent(outcomeResult.document, {
    kind: 'update-stage-outcomes',
    stageId: 'draft-request',
    outcomeIds: ['submit', newOutcome.id]
  });

  const updatedStage = updateResult.document.model.process.stages.find((stage) => stage.id === 'draft-request');
  assert.deepEqual(updatedStage?.allowedOutcomeIds, ['submit', newOutcome.id]);
});

test('applyGraphIntent can create stage and step transitions through canonical commands', () => {
  const initialDocument = loadModel(createApprovalRequestTemplate());

  const stageTransitionResult = applyGraphIntent(initialDocument, {
    kind: 'create-stage-transition',
    fromStageId: 'draft-request',
    toStageId: 'approved',
    outcomeId: 'approve'
  });

  const addedStageTransition = stageTransitionResult.document.model.process.transitions.find((transition) => transition.toStageId === 'approved' && transition.fromStageId === 'draft-request');
  assert.ok(addedStageTransition);
  assert.equal(stageTransitionResult.document.model.rules.some((rule) => rule.id === addedStageTransition.guardRuleId), true);

  const stepTransitionResult = applyGraphIntent(stageTransitionResult.document, {
    kind: 'create-step-transition',
    fromStepId: 'capture-request',
    target: { stepId: 'choose-decision' }
  });

  const addedStepTransition = stepTransitionResult.document.model.process.stepTransitions.find((transition) => transition.fromStepId === 'capture-request' && 'stepId' in transition.target && transition.target.stepId === 'choose-decision');
  assert.ok(addedStepTransition);
  assert.equal(stepTransitionResult.document.model.rules.some((rule) => rule.id === addedStepTransition.guardRuleId), true);
});

test('applyGraphIntent removes graph edges through canonical transition deletion', () => {
  const initialDocument = loadModel(createApprovalRequestTemplate());
  const result = applyGraphIntent(initialDocument, {
    kind: 'remove-edge',
    edgeId: 'transition:approve-request'
  });

  assert.equal(result.document.model.process.transitions.some((transition) => transition.id === 'approve-request'), false);
  assert.equal(result.document.graph.edges.some((edge) => edge.id === 'transition:approve-request'), false);
});

test('DBM-owned clipboard helpers duplicate stages and steps without persisting transitions', () => {
  const initialDocument = loadModel(createApprovalRequestTemplate());
  const stagePayload = buildDesignerClipboardPayload(initialDocument, stageNodeId('manager-review'));
  assert.ok(stagePayload);
  assert.equal(stagePayload.kind, 'stage');

  const pastedStage = pasteDesignerClipboardPayload(initialDocument, stagePayload);
  const pastedStageNode = pastedStage.document.model.process.stages.find((stage) => stage.displayName === 'Manager Review Copy');
  assert.ok(pastedStageNode);
  assert.equal(
    pastedStage.document.model.process.transitions.some((transition) => transition.fromStageId === pastedStageNode.id || transition.toStageId === pastedStageNode.id),
    false
  );

  const stepPayload = buildDesignerClipboardPayload(initialDocument, stepNodeId('record-approval'));
  assert.ok(stepPayload);
  assert.equal(stepPayload.kind, 'step');

  const pastedStep = pasteDesignerClipboardPayload(initialDocument, stepPayload);
  const pastedStepNode = pastedStep.document.model.process.steps.find((step) => step.displayName === 'Record Approval Copy');
  assert.ok(pastedStepNode);
  assert.equal(
    pastedStep.document.model.process.stepTransitions.some((transition) =>
      transition.fromStepId === pastedStepNode.id
      || ('stepId' in transition.target && transition.target.stepId === pastedStepNode.id)
    ),
    false
  );
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

test('process experience snapshot supports terminal end stages without an active step', () => {
  const model = structuredClone(genericExistingFormModel);
  const runtimeState: DbmRuntimeStateV1 = {
    stageId: 'completed',
    stepId: 'prepare-assignment',
    formStateId: 'assignment-work-state',
    internalStatusId: 'complete',
    portalStatusId: 'complete',
    records: [],
    variables: {}
  };

  const snapshot = buildProcessExperienceSnapshot(model, runtimeState, {
    audience: 'internal'
  });

  assert.equal(snapshot.currentStageId, 'completed');
  assert.equal(snapshot.currentStepId, null);
  assert.equal(snapshot.activeFormStateId, null);
  assert.equal(snapshot.internalStatus?.id, 'complete');
  assert.equal(snapshot.projection.projectedStepId, null);
});

test('validateDocument rejects library-specific graph metadata and graph drift from the canonical model', () => {
  const document = loadModel(createApprovalRequestTemplate());
  const mutatedGraph = {
    ...document.graph,
    nodes: document.graph.nodes.map((node, index) => (
      index === 0
        ? {
            ...node,
            selected: true
          }
        : node
    ))
  };

  const issues = validateDocument({
    ...document,
    graph: mutatedGraph as unknown as typeof document.graph
  });

  assert.equal(issues.some((entry) => entry.code === 'library-specific-graph-key'), true);
  assert.equal(issues.some((entry) => entry.code === 'graph-schema-invalid'), true);
  assert.equal(issues.some((entry) => entry.code === 'graph-document-not-derived'), true);
});

test('validateDocument warns when both stage and step routing target the same downstream stage', () => {
  const model = createApprovalRequestTemplate();
  model.process.stepTransitions.push({
    id: 'decision-to-approved-direct',
    fromStepId: 'choose-decision',
    guardRuleId: model.rules[0]?.id ?? 'rule',
    target: {
      stageId: 'approved'
    }
  });

  const issues = validateDocument(loadModel(model));

  assert.equal(issues.some((entry) => entry.code === 'duplicate-cross-stage-routing'), true);
});
