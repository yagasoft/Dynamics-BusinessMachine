import type {
  DbmActorV1,
  DbmArtifactV1,
  DbmEntityV1,
  DbmFieldV1,
  DbmFormElementV1,
  DbmFormEntityBindingV1,
  DbmFormStateV1,
  DbmFormV1,
  DbmLayoutRegionV1,
  DbmNotificationDefinitionV1,
  DbmOutcomeV1,
  DbmProcessV1,
  DbmRelationshipV1,
  DbmRuleV1,
  DbmStageV1,
  DbmStatusV1,
  DbmStepTransitionV1,
  DbmStepV1,
  DbmTaskDefinitionV1,
  DbmTransitionV1,
  DbmVariableV1
} from 'dbm-contract';
import {
  ARTIFACTS_NODE_ID,
  DOCUMENT_NODE_ID,
  METADATA_NODE_ID,
  PACKAGE_NODE_ID,
  PROCESS_PORTFOLIO_NODE_ID,
  PROCESS_PORTFOLIO_PROCESSES_NODE_ID,
  RUNTIME_NODE_ID,
  RUNTIME_OWNERSHIP_NODE_ID,
  RUNTIME_REQUEST_CONTRACT_NODE_ID,
  RUNTIME_RESULT_CONTRACT_NODE_ID,
  actorNodeId,
  artifactNodeId,
  elementNodeId,
  entityFieldsNodeId,
  entityNodeId,
  fieldNodeId,
  formElementsNodeId,
  formEntityBindingNodeId,
  formEntityBindingsNodeId,
  formLayoutNodeId,
  formNodeId,
  formStateNodeId,
  formStatesNodeId,
  notificationNodeId,
  outcomeNodeId,
  parseProcessIdFromCollectionNodeId,
  parseProcessScopedNodeId,
  processActorsNodeId,
  processNodeId,
  processNotificationsNodeId,
  processOutcomesNodeId,
  processStagesNodeId,
  processStatusesNodeId,
  processStepTransitionsNodeId,
  processTasksNodeId,
  processTransitionsNodeId,
  processVariablesNodeId,
  regionNodeId,
  relationshipNodeId,
  ruleNodeId,
  stageNodeId,
  stageStepsNodeId,
  statusNodeId,
  stepNodeId,
  stepTransitionNodeId,
  taskNodeId,
  transitionNodeId,
  variableNodeId
} from './node-ids';
import { createDocument } from './model';
import {
  findProcess,
  insertAt,
  moveWithin,
  resolveMainProcess,
  uniqueId
} from './portfolio';
import type { AddNodeCommand, DesignerCommandResult, DesignerDocument, MoveNodeCommand, RemoveNodeCommand, UpdateNodeCommand } from './types';

function cloneModel(document: DesignerDocument) {
  return structuredClone(document.model);
}

function rebuild(document: DesignerDocument, model: DesignerDocument['model'], affectedNodeId: string | null): DesignerCommandResult {
  normalizeAllStepMembership(model);
  const nextDocument = createDocument(model, true, affectedNodeId ?? document.selectionId, document.workspace);
  return { document: nextDocument, affectedNodeId, issues: nextDocument.issues };
}

function normalizeAllStepMembership(model: DesignerDocument['model']): void {
  model.processPortfolio.processes.forEach((process) => {
    const stepsById = new Map(process.steps.map((step) => [step.id, step]));
    process.stages.forEach((stage) => {
      stage.stepIds = stage.stepIds.filter((stepId) => stepsById.get(stepId)?.stageId === stage.id);
      process.steps
        .filter((step) => step.stageId === stage.id && !stage.stepIds.includes(step.id))
        .forEach((step) => stage.stepIds.push(step.id));
      if (stage.defaultStepId && !stage.stepIds.includes(stage.defaultStepId)) {
        stage.defaultStepId = stage.stepIds[0] ?? null;
      }
      if (!stage.defaultStepId && stage.stepIds.length > 0) {
        stage.defaultStepId = stage.stepIds[0];
      }
    });
    const orderedStepIds = process.stages.flatMap((stage) => stage.stepIds);
    const orderedSteps = orderedStepIds.map((stepId) => stepsById.get(stepId)).filter((step): step is DbmStepV1 => !!step);
    const orphanSteps = process.steps.filter((step) => !orderedStepIds.includes(step.id));
    process.steps = [...orderedSteps, ...orphanSteps];
  });
}

function processFromParentId(model: DesignerDocument['model'], parentId: string): DbmProcessV1 | undefined {
  const collections: Array<[string, string]> = [
    ['actors', 'actors'],
    ['variables', 'variables'],
    ['statuses', 'statuses'],
    ['tasks', 'tasks'],
    ['notifications', 'notifications'],
    ['stages', 'stages'],
    ['transitions', 'transitions'],
    ['step-transitions', 'step-transitions'],
    ['outcomes', 'outcomes']
  ];

  for (const [suffix] of collections) {
    const processId = parseProcessIdFromCollectionNodeId(parentId, suffix);
    if (processId) {
      return findProcess(model, processId);
    }
  }

  if (parentId.startsWith('process:')) {
    return findProcess(model, parentId.slice('process:'.length));
  }

  return undefined;
}

function findStageByParentId(model: DesignerDocument['model'], parentId: string): { process: DbmProcessV1; stage: DbmStageV1 } | undefined {
  const direct = parseProcessScopedNodeId(parentId, 'stage');
  if (direct) {
    const process = findProcess(model, direct.processId);
    const stage = process?.stages.find((entry) => entry.id === direct.id);
    return process && stage ? { process, stage } : undefined;
  }

  const collection = /^collection:stage:(?<processId>[^:]+):(?<stageId>[^:]+):steps$/.exec(parentId);
  if (collection?.groups) {
    const process = findProcess(model, collection.groups.processId);
    const stage = process?.stages.find((entry) => entry.id === collection.groups?.stageId);
    return process && stage ? { process, stage } : undefined;
  }

  return undefined;
}

function findFormByParentId(model: DesignerDocument['model'], parentId: string): DbmFormV1 | undefined {
  return model.forms.find((form) =>
    formNodeId(form.id) === parentId ||
    formEntityBindingsNodeId(form.id) === parentId ||
    formLayoutNodeId(form.id) === parentId ||
    formElementsNodeId(form.id) === parentId ||
    formStatesNodeId(form.id) === parentId
  );
}

function defaultProcess(model: DesignerDocument['model']): DbmProcessV1 {
  const id = uniqueId(model.processPortfolio.processes.map((process) => process.id), 'sub-process');
  const main = resolveMainProcess(model);
  return {
    id,
    displayName: 'New sub-process',
    role: 'sub-process',
    processTypeId: 'sub-process',
    mainDisplayMode: 'expanded',
    statusId: main.statusId,
    portalStatusId: null,
    renderOrder: model.processPortfolio.processes.length,
    subProcessVisibility: [],
    actors: [],
    variables: [],
    statuses: main.statuses.slice(0, 1).map((status) => structuredClone(status)),
    tasks: [],
    notifications: [],
    stages: [],
    steps: [],
    transitions: [],
    stepTransitions: [],
    outcomes: []
  };
}

function defaultActor(process: DbmProcessV1): DbmActorV1 {
  const id = uniqueId(process.actors.map((actor) => actor.id), 'actor');
  return { id, displayName: 'New actor', actorCategory: 'team', roleKey: 'author', source: 'field-binding' };
}

function defaultStatus(process: DbmProcessV1): DbmStatusV1 {
  const id = uniqueId(process.statuses.map((status) => status.id), 'status');
  return { id, displayName: 'New status', audience: 'internal', kind: 'progress' };
}

function defaultTask(process: DbmProcessV1): DbmTaskDefinitionV1 {
  const id = uniqueId(process.tasks.map((task) => task.id), 'task');
  return { id, displayName: 'New task', workCategory: 'work', workKindId: 'work', instructions: null };
}

function defaultNotification(process: DbmProcessV1): DbmNotificationDefinitionV1 {
  const id = uniqueId(process.notifications.map((notification) => notification.id), 'notification');
  return { id, displayName: 'New notification', channel: 'email', templateRef: `notifications/${id}` };
}

function defaultStage(model: DesignerDocument['model'], process: DbmProcessV1): DbmStageV1 {
  const id = uniqueId(process.stages.map((stage) => stage.id), 'stage');
  return {
    id,
    displayName: 'New stage',
    stageCategory: 'work',
    stageKindId: 'work',
    scope: 'back-office',
    childProcessRefs: [],
    actorId: process.actors[0]?.id ?? '',
    formId: model.forms[0]?.id ?? null,
    portalVisibility: 'hidden',
    statusId: process.statuses[0]?.id ?? '',
    portalStatusId: null,
    stepIds: [],
    defaultStepId: null,
    entryRuleIds: [],
    exitRuleIds: [],
    allowedOutcomeIds: []
  };
}

function defaultStep(process: DbmProcessV1, stage: DbmStageV1): DbmStepV1 {
  const id = uniqueId(process.steps.map((step) => step.id), 'step');
  return {
    id,
    stageId: stage.id,
    displayName: 'New step',
    workCategory: 'work',
    workKindId: 'work',
    ownerActorId: stage.actorId || process.actors[0]?.id || '',
    notificationId: process.notifications[0]?.id ?? null,
    taskId: process.tasks[0]?.id ?? null,
    internalStatusId: process.statuses.find((status) => status.audience !== 'portal')?.id ?? process.statuses[0]?.id ?? '',
    portalStatusId: process.statuses.find((status) => status.audience !== 'internal')?.id ?? null,
    formStateId: null,
    entryRuleIds: [],
    exitRuleIds: []
  };
}

function defaultOutcome(process: DbmProcessV1): DbmOutcomeV1 {
  const id = uniqueId(process.outcomes.map((outcome) => outcome.id), 'outcome');
  return { id, displayName: 'New outcome' };
}

function defaultTransition(process: DbmProcessV1, rules: DbmRuleV1[]): DbmTransitionV1 {
  const id = uniqueId(process.transitions.map((transition) => transition.id), 'transition');
  return {
    id,
    fromStageId: process.stages[0]?.id ?? '',
    toStageId: process.stages[1]?.id ?? process.stages[0]?.id ?? '',
    outcomeId: process.outcomes[0]?.id ?? '',
    guardRuleId: rules[0]?.id ?? ''
  };
}

function defaultStepTransition(process: DbmProcessV1, rules: DbmRuleV1[]): DbmStepTransitionV1 {
  const id = uniqueId(process.stepTransitions.map((transition) => transition.id), 'step-transition');
  return {
    id,
    fromStepId: process.steps[0]?.id ?? '',
    guardRuleId: rules[0]?.id ?? '',
    target: process.steps[1] ? { stepId: process.steps[1].id } : process.stages[0] ? { stageId: process.stages[0].id } : { outcomeId: process.outcomes[0]?.id ?? '' }
  };
}

function removeById<T extends { id: string }>(items: T[], nodeId: string, nodeIdFactory: (id: string) => string): boolean {
  const index = items.findIndex((item) => nodeIdFactory(item.id) === nodeId);
  if (index < 0) {
    return false;
  }

  items.splice(index, 1);
  return true;
}

function moveById<T extends { id: string }>(items: T[], nodeId: string, targetIndex: number, nodeIdFactory: (id: string) => string): boolean {
  const currentIndex = items.findIndex((item) => nodeIdFactory(item.id) === nodeId);
  if (currentIndex < 0) {
    return false;
  }

  moveWithin(items, currentIndex, targetIndex);
  return true;
}

function detachStepFromStages(process: DbmProcessV1, stepId: string): void {
  process.stages.forEach((stage) => {
    stage.stepIds = stage.stepIds.filter((candidate) => candidate !== stepId);
    if (stage.defaultStepId === stepId) {
      stage.defaultStepId = stage.stepIds[0] ?? null;
    }
  });
}

function attachStepToStage(stage: DbmStageV1, stepId: string, index?: number): void {
  if (stage.stepIds.includes(stepId)) {
    return;
  }
  insertAt(stage.stepIds, stepId, index);
  if (!stage.defaultStepId) {
    stage.defaultStepId = stage.stepIds[0] ?? stepId;
  }
}

function primaryActorId(process: DbmProcessV1): string {
  return process.actors[0]?.id ?? '';
}

function internalStatusId(process: DbmProcessV1): string {
  return process.statuses.find((status) => status.audience !== 'portal')?.id ?? process.statuses[0]?.id ?? '';
}

function portalStatusId(process: DbmProcessV1): string | null {
  return process.statuses.find((status) => status.audience !== 'internal')?.id ?? null;
}

function rebindStageForProcess(process: DbmProcessV1, stage: DbmStageV1, steps: DbmStepV1[]): void {
  const outcomeIds = new Set(process.outcomes.map((outcome) => outcome.id));
  stage.allowedOutcomeIds = stage.allowedOutcomeIds.filter((outcomeId) => outcomeIds.has(outcomeId));
  if (!process.actors.some((actor) => actor.id === stage.actorId)) {
    stage.actorId = primaryActorId(process);
  }
  if (!process.statuses.some((status) => status.id === stage.statusId)) {
    stage.statusId = internalStatusId(process);
  }
  if (stage.portalStatusId && !process.statuses.some((status) => status.id === stage.portalStatusId)) {
    stage.portalStatusId = portalStatusId(process);
  }

  steps.forEach((step) => {
    step.stageId = stage.id;
    if (!process.actors.some((actor) => actor.id === step.ownerActorId)) {
      step.ownerActorId = stage.actorId || primaryActorId(process);
    }
    if (!process.statuses.some((status) => status.id === step.internalStatusId)) {
      step.internalStatusId = internalStatusId(process);
    }
    if (step.portalStatusId && !process.statuses.some((status) => status.id === step.portalStatusId)) {
      step.portalStatusId = portalStatusId(process);
    }
  });
}

function removeInvalidReferencesToStage(process: DbmProcessV1, stage: DbmStageV1, stepIds: Set<string>): void {
  process.transitions = process.transitions.filter((transition) => transition.fromStageId !== stage.id && transition.toStageId !== stage.id);
  process.stepTransitions = process.stepTransitions.filter((transition) => {
    if (stepIds.has(transition.fromStepId)) {
      return false;
    }
    if ('stepId' in transition.target && stepIds.has(transition.target.stepId)) {
      return false;
    }
    if ('stageId' in transition.target && transition.target.stageId === stage.id) {
      return false;
    }
    return true;
  });
}

function attachChildProcessToStage(model: DesignerDocument['model'], stage: DbmStageV1, process: DbmProcessV1): void {
  stage.childProcessRefs ??= [];
  if (stage.childProcessRefs.some((ref) => ref.processId === process.id)) {
    return;
  }

  const id = uniqueId(stage.childProcessRefs.map((ref) => ref.id), `spawn-${process.id}`);
  stage.childProcessRefs.push({
    id,
    processId: process.id,
    displayName: process.displayName,
    activationRuleId: null,
    blocksParent: true
  });

  if (process.role === 'sub-process' && process.renderOrder === undefined) {
    process.renderOrder = model.processPortfolio.processes.length;
  }
}

function defaultForm(model: DesignerDocument['model']): DbmFormV1 {
  const id = uniqueId(model.forms.map((form) => form.id), 'form');
  const entityId = model.metadata.entities[0]?.id ?? '';
  return {
    id,
    displayName: 'New form',
    primaryEntityBindingId: 'primary',
    entityBindings: [{ id: 'primary', displayName: 'Primary', entityId, relationshipId: null, role: 'primary' }],
    layout: { layoutType: 'single-page', regions: [{ id: 'main', displayName: 'Main', order: 1 }] },
    elements: [],
    formStates: []
  };
}

function defaultFormEntityBinding(form: DbmFormV1, model: DesignerDocument['model']): DbmFormEntityBindingV1 {
  const id = uniqueId(form.entityBindings.map((binding) => binding.id), 'binding');
  return { id, displayName: 'New binding', entityId: model.metadata.entities[0]?.id ?? '', relationshipId: null, role: form.entityBindings.some((binding) => binding.role === 'primary') ? 'related' : 'primary' };
}

function defaultRegion(form: DbmFormV1): DbmLayoutRegionV1 {
  const id = uniqueId(form.layout.regions.map((region) => region.id), 'region');
  return { id, displayName: 'New region', order: form.layout.regions.length + 1 };
}

function defaultElement(form: DbmFormV1, model: DesignerDocument['model']): DbmFormElementV1 {
  const id = uniqueId(form.elements.map((element) => element.id), 'element');
  const binding = form.entityBindings[0];
  const defaultFieldId = binding ? model.metadata.entities.find((entity) => entity.id === binding.entityId)?.fields[0]?.id ?? '' : '';
  return {
    id,
    elementType: 'text',
    regionId: form.layout.regions[0]?.id ?? 'main',
    displayName: 'New element',
    binding: binding ? { entityBindingId: binding.id, fieldId: defaultFieldId } : { variableId: resolveMainProcess(model).variables[0]?.id ?? '' },
    behavior: { requiredRuleIds: [], visibleRuleIds: [], editableRuleIds: [] }
  };
}

function defaultFormState(form: DbmFormV1): DbmFormStateV1 {
  const id = uniqueId(form.formStates.map((state) => state.id), 'state');
  return { id, displayName: 'New form state', activationRuleIds: [], visibleEntityBindingIds: form.entityBindings.map((binding) => binding.id), elementBehaviors: [] };
}

function defaultEntity(model: DesignerDocument['model']): DbmEntityV1 {
  const id = uniqueId(model.metadata.entities.map((entity) => entity.id), 'entity');
  const primaryFieldId = `${id}-id`;
  return {
    id,
    displayName: 'New entity',
    providerBindings: {},
    primaryKeyFieldId: primaryFieldId,
    fields: [{ id: primaryFieldId, displayName: 'Primary key', dataType: 'string', providerBindings: {}, isRequired: true, isReadOnly: true }]
  };
}

function defaultField(entity: DbmEntityV1): DbmFieldV1 {
  const id = uniqueId(entity.fields.map((field) => field.id), 'field');
  return { id, displayName: 'New field', dataType: 'string', providerBindings: {}, isRequired: false, isReadOnly: false };
}

function defaultRelationship(model: DesignerDocument['model']): DbmRelationshipV1 {
  const id = uniqueId(model.metadata.relationships.map((relationship) => relationship.id), 'relationship');
  return { id, fromEntityId: model.metadata.entities[0]?.id ?? '', toEntityId: model.metadata.entities[1]?.id ?? model.metadata.entities[0]?.id ?? '', relationshipType: 'one-to-many', providerBindings: {} };
}

function defaultRule(model: DesignerDocument['model']): DbmRuleV1 {
  const id = uniqueId(model.rules.map((rule) => rule.id), 'rule');
  return { id, displayName: 'New rule', ruleType: 'condition', scope: 'process', language: 'dbm-expression-v1', body: 'true' };
}

function defaultArtifact(model: DesignerDocument['model']): DbmArtifactV1 {
  const id = uniqueId(model.artifacts.map((artifact) => artifact.id), 'artifact');
  return { id, artifactType: 'script', displayName: 'New artifact', runtimeTargets: [model.package.supportedRuntimes[0] ?? 'dataverse'], packagingTarget: 'repo-only', sourceRef: `artifacts/${id}.txt`, required: false };
}

export function addNode(document: DesignerDocument, command: AddNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);

  if (command.kind === 'process') {
    const process = (command.value as DbmProcessV1 | undefined) ?? defaultProcess(model);
    const parent = findStageByParentId(model, command.parentId);
    insertAt(model.processPortfolio.processes, process, command.index);
    if (parent) {
      attachChildProcessToStage(model, parent.stage, process);
    }
    return rebuild(document, model, processNodeId(process.id));
  }

  const process = processFromParentId(model, command.parentId);

  switch (command.kind) {
    case 'actor': {
      if (!process) throw new Error(`Unable to add actor. Unsupported parent '${command.parentId}'.`);
      const actor = (command.value as DbmActorV1 | undefined) ?? defaultActor(process);
      insertAt(process.actors, actor, command.index);
      return rebuild(document, model, actorNodeId(process.id, actor.id));
    }
    case 'variable': {
      if (!process) throw new Error(`Unable to add variable. Unsupported parent '${command.parentId}'.`);
      const id = uniqueId(process.variables.map((variable) => variable.id), 'variable');
      const variable = (command.value as DbmVariableV1 | undefined) ?? { id, dataType: 'string', scope: 'process', defaultValue: null, persistence: 'runtime-only' };
      insertAt(process.variables, variable, command.index);
      return rebuild(document, model, variableNodeId(process.id, variable.id));
    }
    case 'status': {
      if (!process) throw new Error(`Unable to add status. Unsupported parent '${command.parentId}'.`);
      const status = (command.value as DbmStatusV1 | undefined) ?? defaultStatus(process);
      insertAt(process.statuses, status, command.index);
      return rebuild(document, model, statusNodeId(process.id, status.id));
    }
    case 'task': {
      if (!process) throw new Error(`Unable to add task. Unsupported parent '${command.parentId}'.`);
      const task = (command.value as DbmTaskDefinitionV1 | undefined) ?? defaultTask(process);
      insertAt(process.tasks, task, command.index);
      return rebuild(document, model, taskNodeId(process.id, task.id));
    }
    case 'notification': {
      if (!process) throw new Error(`Unable to add notification. Unsupported parent '${command.parentId}'.`);
      const notification = (command.value as DbmNotificationDefinitionV1 | undefined) ?? defaultNotification(process);
      insertAt(process.notifications, notification, command.index);
      return rebuild(document, model, notificationNodeId(process.id, notification.id));
    }
    case 'stage': {
      if (!process) throw new Error(`Unable to add stage. Unsupported parent '${command.parentId}'.`);
      const stage = (command.value as DbmStageV1 | undefined) ?? defaultStage(model, process);
      insertAt(process.stages, stage, command.index);
      return rebuild(document, model, stageNodeId(process.id, stage.id));
    }
    case 'step': {
      const parent = findStageByParentId(model, command.parentId);
      if (!parent) throw new Error(`Unable to add step. Unsupported parent '${command.parentId}'.`);
      const step = (command.value as DbmStepV1 | undefined) ?? defaultStep(parent.process, parent.stage);
      insertAt(parent.process.steps, step, command.index);
      attachStepToStage(parent.stage, step.id, command.index);
      return rebuild(document, model, stepNodeId(parent.process.id, step.id));
    }
    case 'transition': {
      if (!process) throw new Error(`Unable to add transition. Unsupported parent '${command.parentId}'.`);
      const transition = (command.value as DbmTransitionV1 | undefined) ?? defaultTransition(process, model.rules);
      insertAt(process.transitions, transition, command.index);
      return rebuild(document, model, transitionNodeId(process.id, transition.id));
    }
    case 'step-transition': {
      if (!process) throw new Error(`Unable to add step transition. Unsupported parent '${command.parentId}'.`);
      const transition = (command.value as DbmStepTransitionV1 | undefined) ?? defaultStepTransition(process, model.rules);
      insertAt(process.stepTransitions, transition, command.index);
      return rebuild(document, model, stepTransitionNodeId(process.id, transition.id));
    }
    case 'outcome': {
      if (!process) throw new Error(`Unable to add outcome. Unsupported parent '${command.parentId}'.`);
      const outcome = (command.value as DbmOutcomeV1 | undefined) ?? defaultOutcome(process);
      insertAt(process.outcomes, outcome, command.index);
      return rebuild(document, model, outcomeNodeId(process.id, outcome.id));
    }
    case 'form': {
      const form = (command.value as DbmFormV1 | undefined) ?? defaultForm(model);
      insertAt(model.forms, form, command.index);
      return rebuild(document, model, formNodeId(form.id));
    }
    case 'form-entity-binding': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) throw new Error(`Unable to add form entity binding. Unsupported parent '${command.parentId}'.`);
      const binding = (command.value as DbmFormEntityBindingV1 | undefined) ?? defaultFormEntityBinding(form, model);
      insertAt(form.entityBindings, binding, command.index);
      return rebuild(document, model, formEntityBindingNodeId(form.id, binding.id));
    }
    case 'region': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) throw new Error(`Unable to add region. Unsupported parent '${command.parentId}'.`);
      const region = (command.value as DbmLayoutRegionV1 | undefined) ?? defaultRegion(form);
      insertAt(form.layout.regions, region, command.index);
      form.layout.regions.forEach((entry, index) => { entry.order = index + 1; });
      return rebuild(document, model, regionNodeId(form.id, region.id));
    }
    case 'element': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) throw new Error(`Unable to add element. Unsupported parent '${command.parentId}'.`);
      const element = (command.value as DbmFormElementV1 | undefined) ?? defaultElement(form, model);
      insertAt(form.elements, element, command.index);
      return rebuild(document, model, elementNodeId(form.id, element.id));
    }
    case 'form-state': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) throw new Error(`Unable to add form state. Unsupported parent '${command.parentId}'.`);
      const state = (command.value as DbmFormStateV1 | undefined) ?? defaultFormState(form);
      insertAt(form.formStates, state, command.index);
      return rebuild(document, model, formStateNodeId(form.id, state.id));
    }
    case 'entity': {
      const entity = (command.value as DbmEntityV1 | undefined) ?? defaultEntity(model);
      insertAt(model.metadata.entities, entity, command.index);
      return rebuild(document, model, entityNodeId(entity.id));
    }
    case 'field': {
      const entity = model.metadata.entities.find((candidate) => entityNodeId(candidate.id) === command.parentId || entityFieldsNodeId(candidate.id) === command.parentId);
      if (!entity) throw new Error(`Unable to add field. Unsupported parent '${command.parentId}'.`);
      const field = (command.value as DbmFieldV1 | undefined) ?? defaultField(entity);
      insertAt(entity.fields, field, command.index);
      return rebuild(document, model, fieldNodeId(entity.id, field.id));
    }
    case 'relationship': {
      const relationship = (command.value as DbmRelationshipV1 | undefined) ?? defaultRelationship(model);
      insertAt(model.metadata.relationships, relationship, command.index);
      return rebuild(document, model, relationshipNodeId(relationship.id));
    }
    case 'rule': {
      const rule = (command.value as DbmRuleV1 | undefined) ?? defaultRule(model);
      insertAt(model.rules, rule, command.index);
      return rebuild(document, model, ruleNodeId(rule.id));
    }
    case 'artifact': {
      const artifact = (command.value as DbmArtifactV1 | undefined) ?? defaultArtifact(model);
      insertAt(model.artifacts, artifact, command.index);
      return rebuild(document, model, artifactNodeId(artifact.id));
    }
    default:
      throw new Error(`Unsupported add node kind '${command.kind}'.`);
  }
}

export function updateNode(document: DesignerDocument, command: UpdateNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);
  const value = command.value as Record<string, unknown>;

  if (command.nodeId === DOCUMENT_NODE_ID) return rebuild(document, model, DOCUMENT_NODE_ID);
  if (command.nodeId === PACKAGE_NODE_ID) {
    Object.assign(model.package, value);
    return rebuild(document, model, PACKAGE_NODE_ID);
  }
  if (command.nodeId === PROCESS_PORTFOLIO_NODE_ID) {
    Object.assign(model.processPortfolio, value);
    return rebuild(document, model, PROCESS_PORTFOLIO_NODE_ID);
  }
  if (command.nodeId === METADATA_NODE_ID) {
    Object.assign(model.metadata, value);
    return rebuild(document, model, METADATA_NODE_ID);
  }
  if (command.nodeId === RUNTIME_NODE_ID) {
    Object.assign(model.runtime, value);
    return rebuild(document, model, RUNTIME_NODE_ID);
  }
  if (command.nodeId === RUNTIME_REQUEST_CONTRACT_NODE_ID) {
    Object.assign(model.runtime.requestContract, value);
    return rebuild(document, model, RUNTIME_REQUEST_CONTRACT_NODE_ID);
  }
  if (command.nodeId === RUNTIME_RESULT_CONTRACT_NODE_ID) {
    Object.assign(model.runtime.resultContract, value);
    return rebuild(document, model, RUNTIME_RESULT_CONTRACT_NODE_ID);
  }
  if (command.nodeId === RUNTIME_OWNERSHIP_NODE_ID) {
    Object.assign(model.runtime.ownership, value);
    return rebuild(document, model, RUNTIME_OWNERSHIP_NODE_ID);
  }

  for (const process of model.processPortfolio.processes) {
    if (processNodeId(process.id) === command.nodeId) {
      Object.assign(process, value);
      return rebuild(document, model, processNodeId(process.id));
    }

    const scopedCollections: Array<[string, { items: Array<{ id: string }>; nodeId: (id: string) => string }]> = [
      ['actor', { items: process.actors, nodeId: (id) => actorNodeId(process.id, id) }],
      ['variable', { items: process.variables, nodeId: (id) => variableNodeId(process.id, id) }],
      ['status', { items: process.statuses, nodeId: (id) => statusNodeId(process.id, id) }],
      ['task', { items: process.tasks, nodeId: (id) => taskNodeId(process.id, id) }],
      ['notification', { items: process.notifications, nodeId: (id) => notificationNodeId(process.id, id) }],
      ['stage', { items: process.stages, nodeId: (id) => stageNodeId(process.id, id) }],
      ['transition', { items: process.transitions, nodeId: (id) => transitionNodeId(process.id, id) }],
      ['step-transition', { items: process.stepTransitions, nodeId: (id) => stepTransitionNodeId(process.id, id) }],
      ['outcome', { items: process.outcomes, nodeId: (id) => outcomeNodeId(process.id, id) }]
    ];

    for (const [, collection] of scopedCollections) {
      const item = collection.items.find((entry) => collection.nodeId(entry.id) === command.nodeId);
      if (item) {
        Object.assign(item, value);
        return rebuild(document, model, command.nodeId);
      }
    }

    const step = process.steps.find((entry) => stepNodeId(process.id, entry.id) === command.nodeId);
    if (step) {
      const previousStageId = step.stageId;
      Object.assign(step, value);
      if (value['stageId'] && typeof value['stageId'] === 'string' && value['stageId'] !== previousStageId) {
        detachStepFromStages(process, step.id);
        const targetStage = process.stages.find((stage) => stage.id === step.stageId);
        if (targetStage) {
          attachStepToStage(targetStage, step.id);
        }
      }
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const form of model.forms) {
    if (formNodeId(form.id) === command.nodeId) {
      Object.assign(form, value);
      return rebuild(document, model, command.nodeId);
    }
    if (formLayoutNodeId(form.id) === command.nodeId) {
      Object.assign(form.layout, value);
      return rebuild(document, model, command.nodeId);
    }
    for (const binding of form.entityBindings) {
      if (formEntityBindingNodeId(form.id, binding.id) === command.nodeId) {
        Object.assign(binding, value);
        return rebuild(document, model, command.nodeId);
      }
    }
    for (const region of form.layout.regions) {
      if (regionNodeId(form.id, region.id) === command.nodeId) {
        Object.assign(region, value);
        return rebuild(document, model, command.nodeId);
      }
    }
    for (const element of form.elements) {
      if (elementNodeId(form.id, element.id) === command.nodeId) {
        Object.assign(element, value);
        return rebuild(document, model, command.nodeId);
      }
    }
    for (const state of form.formStates) {
      if (formStateNodeId(form.id, state.id) === command.nodeId) {
        Object.assign(state, value);
        return rebuild(document, model, command.nodeId);
      }
    }
  }

  for (const entity of model.metadata.entities) {
    if (entityNodeId(entity.id) === command.nodeId) {
      Object.assign(entity, value);
      return rebuild(document, model, command.nodeId);
    }
    for (const field of entity.fields) {
      if (fieldNodeId(entity.id, field.id) === command.nodeId) {
        Object.assign(field, value);
        return rebuild(document, model, command.nodeId);
      }
    }
  }

  for (const relationship of model.metadata.relationships) {
    if (relationshipNodeId(relationship.id) === command.nodeId) {
      Object.assign(relationship, value);
      return rebuild(document, model, command.nodeId);
    }
  }
  for (const rule of model.rules) {
    if (ruleNodeId(rule.id) === command.nodeId) {
      Object.assign(rule, value);
      return rebuild(document, model, command.nodeId);
    }
  }
  for (const artifact of model.artifacts) {
    if (artifactNodeId(artifact.id) === command.nodeId) {
      Object.assign(artifact, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  throw new Error(`Unsupported update target '${command.nodeId}'.`);
}

export function removeNode(document: DesignerDocument, command: RemoveNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);

  const processIndex = model.processPortfolio.processes.findIndex((process) => processNodeId(process.id) === command.nodeId);
  if (processIndex >= 0) {
    const [process] = model.processPortfolio.processes.splice(processIndex, 1);
    model.processPortfolio.processes.forEach((candidate) => {
      candidate.stages.forEach((stage) => {
        stage.childProcessRefs = stage.childProcessRefs.filter((ref) => ref.processId !== process.id);
      });
    });
    if (model.processPortfolio.mainProcessId === process.id) {
      model.processPortfolio.mainProcessId = model.processPortfolio.processes.find((entry) => entry.role === 'main')?.id ?? model.processPortfolio.processes[0]?.id ?? '';
    }
    return rebuild(document, model, PROCESS_PORTFOLIO_PROCESSES_NODE_ID);
  }

  for (const process of model.processPortfolio.processes) {
    if (removeById(process.actors, command.nodeId, (id) => actorNodeId(process.id, id))) return rebuild(document, model, processActorsNodeId(process.id));
    if (removeById(process.variables, command.nodeId, (id) => variableNodeId(process.id, id))) return rebuild(document, model, processVariablesNodeId(process.id));
    if (removeById(process.statuses, command.nodeId, (id) => statusNodeId(process.id, id))) return rebuild(document, model, processStatusesNodeId(process.id));
    if (removeById(process.tasks, command.nodeId, (id) => taskNodeId(process.id, id))) return rebuild(document, model, processTasksNodeId(process.id));
    if (removeById(process.notifications, command.nodeId, (id) => notificationNodeId(process.id, id))) return rebuild(document, model, processNotificationsNodeId(process.id));
    if (removeById(process.transitions, command.nodeId, (id) => transitionNodeId(process.id, id))) return rebuild(document, model, processTransitionsNodeId(process.id));
    if (removeById(process.stepTransitions, command.nodeId, (id) => stepTransitionNodeId(process.id, id))) return rebuild(document, model, processStepTransitionsNodeId(process.id));
    if (removeById(process.outcomes, command.nodeId, (id) => outcomeNodeId(process.id, id))) return rebuild(document, model, processOutcomesNodeId(process.id));

    const stage = process.stages.find((candidate) => stageNodeId(process.id, candidate.id) === command.nodeId);
    if (stage) {
      const removedStepIds = new Set(stage.stepIds);
      process.stages = process.stages.filter((candidate) => candidate.id !== stage.id);
      process.steps = process.steps.filter((step) => !removedStepIds.has(step.id) && step.stageId !== stage.id);
      process.transitions = process.transitions.filter((transition) => transition.fromStageId !== stage.id && transition.toStageId !== stage.id);
      process.stepTransitions = process.stepTransitions.filter((transition) => !removedStepIds.has(transition.fromStepId));
      return rebuild(document, model, processStagesNodeId(process.id));
    }

    const step = process.steps.find((candidate) => stepNodeId(process.id, candidate.id) === command.nodeId);
    if (step) {
      process.steps = process.steps.filter((candidate) => candidate.id !== step.id);
      detachStepFromStages(process, step.id);
      return rebuild(document, model, stageStepsNodeId(process.id, step.stageId));
    }
  }

  if (removeById(model.forms, command.nodeId, formNodeId)) return rebuild(document, model, 'section:forms');
  if (removeById(model.metadata.entities, command.nodeId, entityNodeId)) return rebuild(document, model, 'collection:metadata:entities');
  if (removeById(model.metadata.relationships, command.nodeId, relationshipNodeId)) return rebuild(document, model, 'collection:metadata:relationships');
  if (removeById(model.rules, command.nodeId, ruleNodeId)) return rebuild(document, model, 'section:rules');
  if (removeById(model.artifacts, command.nodeId, artifactNodeId)) return rebuild(document, model, ARTIFACTS_NODE_ID);

  throw new Error(`Unsupported remove target '${command.nodeId}'.`);
}

export function moveNode(document: DesignerDocument, command: MoveNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);

  if (moveById(model.processPortfolio.processes, command.nodeId, command.targetIndex, processNodeId)) {
    model.processPortfolio.processes.forEach((process, index) => {
      if (process.role === 'sub-process') {
        process.renderOrder = index;
      }
    });
    return rebuild(document, model, PROCESS_PORTFOLIO_PROCESSES_NODE_ID);
  }

  for (const process of model.processPortfolio.processes) {
    if (moveById(process.actors, command.nodeId, command.targetIndex, (id) => actorNodeId(process.id, id))) return rebuild(document, model, processActorsNodeId(process.id));
    if (moveById(process.variables, command.nodeId, command.targetIndex, (id) => variableNodeId(process.id, id))) return rebuild(document, model, processVariablesNodeId(process.id));
    if (moveById(process.statuses, command.nodeId, command.targetIndex, (id) => statusNodeId(process.id, id))) return rebuild(document, model, processStatusesNodeId(process.id));
    if (moveById(process.tasks, command.nodeId, command.targetIndex, (id) => taskNodeId(process.id, id))) return rebuild(document, model, processTasksNodeId(process.id));
    if (moveById(process.notifications, command.nodeId, command.targetIndex, (id) => notificationNodeId(process.id, id))) return rebuild(document, model, processNotificationsNodeId(process.id));
    const stageSelection = parseProcessScopedNodeId(command.nodeId, 'stage');
    if (stageSelection?.processId === process.id) {
      const currentIndex = process.stages.findIndex((stage) => stage.id === stageSelection.id);
      if (currentIndex >= 0) {
        const targetProcess = command.targetParentId ? processFromParentId(model, command.targetParentId) : process;
        if (!targetProcess || targetProcess.id === process.id) {
          moveWithin(process.stages, currentIndex, command.targetIndex);
          return rebuild(document, model, processStagesNodeId(process.id));
        }

        const [stage] = process.stages.splice(currentIndex, 1);
        const movingStepIds = new Set([
          ...stage.stepIds,
          ...process.steps.filter((step) => step.stageId === stage.id).map((step) => step.id)
        ]);
        const movingSteps = process.steps.filter((step) => movingStepIds.has(step.id));
        process.steps = process.steps.filter((step) => !movingStepIds.has(step.id));
        removeInvalidReferencesToStage(process, stage, movingStepIds);
        rebindStageForProcess(targetProcess, stage, movingSteps);
        insertAt(targetProcess.stages, stage, command.targetIndex);
        targetProcess.steps.push(...movingSteps);
        return rebuild(document, model, processStagesNodeId(targetProcess.id));
      }
    }

    if (moveById(process.transitions, command.nodeId, command.targetIndex, (id) => transitionNodeId(process.id, id))) return rebuild(document, model, processTransitionsNodeId(process.id));
    if (moveById(process.stepTransitions, command.nodeId, command.targetIndex, (id) => stepTransitionNodeId(process.id, id))) return rebuild(document, model, processStepTransitionsNodeId(process.id));
    if (moveById(process.outcomes, command.nodeId, command.targetIndex, (id) => outcomeNodeId(process.id, id))) return rebuild(document, model, processOutcomesNodeId(process.id));

    const movingStep = process.steps.find((step) => stepNodeId(process.id, step.id) === command.nodeId);
    if (movingStep) {
      const targetParent = command.targetParentId ? findStageByParentId(model, command.targetParentId) : null;
      if (targetParent && targetParent.process.id === process.id && targetParent.stage.id !== movingStep.stageId) {
        detachStepFromStages(process, movingStep.id);
        movingStep.stageId = targetParent.stage.id;
        attachStepToStage(targetParent.stage, movingStep.id, command.targetIndex);
        return rebuild(document, model, stageStepsNodeId(process.id, targetParent.stage.id));
      }

      const currentStage = process.stages.find((stage) => stage.id === movingStep.stageId);
      if (currentStage) {
        const currentIndex = currentStage.stepIds.findIndex((stepId) => stepId === movingStep.id);
        moveWithin(currentStage.stepIds, currentIndex, command.targetIndex);
        return rebuild(document, model, stageStepsNodeId(process.id, currentStage.id));
      }
    }
  }

  if (moveById(model.forms, command.nodeId, command.targetIndex, formNodeId)) return rebuild(document, model, 'section:forms');
  for (const form of model.forms) {
    if (moveById(form.entityBindings, command.nodeId, command.targetIndex, (id) => formEntityBindingNodeId(form.id, id))) return rebuild(document, model, formEntityBindingsNodeId(form.id));
    if (moveById(form.layout.regions, command.nodeId, command.targetIndex, (id) => regionNodeId(form.id, id))) {
      form.layout.regions.forEach((region, index) => { region.order = index + 1; });
      return rebuild(document, model, formLayoutNodeId(form.id));
    }
    if (moveById(form.elements, command.nodeId, command.targetIndex, (id) => elementNodeId(form.id, id))) return rebuild(document, model, formElementsNodeId(form.id));
    if (moveById(form.formStates, command.nodeId, command.targetIndex, (id) => formStateNodeId(form.id, id))) return rebuild(document, model, formStatesNodeId(form.id));
  }

  for (const entity of model.metadata.entities) {
    if (moveById(entity.fields, command.nodeId, command.targetIndex, (id) => fieldNodeId(entity.id, id))) return rebuild(document, model, entityFieldsNodeId(entity.id));
  }
  if (moveById(model.metadata.entities, command.nodeId, command.targetIndex, entityNodeId)) return rebuild(document, model, 'collection:metadata:entities');
  if (moveById(model.metadata.relationships, command.nodeId, command.targetIndex, relationshipNodeId)) return rebuild(document, model, 'collection:metadata:relationships');
  if (moveById(model.rules, command.nodeId, command.targetIndex, ruleNodeId)) return rebuild(document, model, 'section:rules');
  if (moveById(model.artifacts, command.nodeId, command.targetIndex, artifactNodeId)) return rebuild(document, model, ARTIFACTS_NODE_ID);

  throw new Error(`Unsupported move target '${command.nodeId}'.`);
}
