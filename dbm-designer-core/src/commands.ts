
import type {
  DbmActorV1, DbmArtifactV1, DbmEntityV1, DbmFieldV1, DbmFormElementV1, DbmFormEntityBindingV1,
  DbmFormStateV1, DbmFormV1, DbmLayoutRegionV1, DbmNotificationDefinitionV1, DbmOutcomeV1,
  DbmRelationshipV1, DbmRuleV1, DbmStageV1, DbmStatusV1, DbmStepTransitionV1, DbmStepV1,
  DbmTaskDefinitionV1, DbmTransitionV1, DbmVariableV1
} from 'dbm-contract';
import {
  actorNodeId, ARTIFACTS_NODE_ID, artifactNodeId, elementNodeId, entityFieldsNodeId, entityNodeId,
  fieldNodeId, formElementsNodeId, formEntityBindingNodeId, formEntityBindingsNodeId, formLayoutNodeId,
  formNodeId, FORMS_NODE_ID, formStateNodeId, formStatesNodeId, METADATA_ENTITIES_NODE_ID,
  METADATA_NODE_ID, METADATA_RELATIONSHIPS_NODE_ID, notificationNodeId, outcomeNodeId, PACKAGE_NODE_ID,
  PROCESS_ACTORS_NODE_ID, PROCESS_NODE_ID, PROCESS_NOTIFICATIONS_NODE_ID, PROCESS_OUTCOMES_NODE_ID,
  PROCESS_STATUSES_NODE_ID, PROCESS_STAGES_NODE_ID, PROCESS_STEP_TRANSITIONS_NODE_ID, PROCESS_TASKS_NODE_ID,
  PROCESS_TRANSITIONS_NODE_ID, PROCESS_VARIABLES_NODE_ID, regionNodeId, relationshipNodeId,
  RUNTIME_NODE_ID, RUNTIME_OWNERSHIP_NODE_ID, RUNTIME_REQUEST_CONTRACT_NODE_ID,
  RUNTIME_RESULT_CONTRACT_NODE_ID, RULES_NODE_ID, ruleNodeId, stageNodeId, stageStepsNodeId,
  statusNodeId, stepNodeId, stepTransitionNodeId, taskNodeId, transitionNodeId, variableNodeId
} from './node-ids';
import { createDocument } from './model';
import type { AddNodeCommand, DesignerCommandResult, DesignerDocument, MoveNodeCommand, RemoveNodeCommand, UpdateNodeCommand } from './types';

function uniqueId(existingIds: string[], prefix: string): string {
  let counter = 1;
  let candidate = prefix;
  while (existingIds.includes(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }
  return candidate;
}

function insertAt<T>(items: T[], value: T, index?: number): void {
  if (typeof index !== 'number' || index < 0 || index >= items.length) {
    items.push(value);
    return;
  }
  items.splice(index, 0, value);
}

function moveWithin<T>(items: T[], currentIndex: number, targetIndex: number): void {
  const boundedTarget = Math.max(0, Math.min(targetIndex, items.length - 1));
  const [item] = items.splice(currentIndex, 1);
  items.splice(boundedTarget, 0, item);
}

function cloneModel(document: DesignerDocument) {
  return structuredClone(document.model);
}

function findStageByParentId(model: DesignerDocument['model'], parentId: string): DbmStageV1 | undefined {
  return model.process.stages.find((stage) => stageNodeId(stage.id) === parentId || stageStepsNodeId(stage.id) === parentId);
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

function normalizeStepMembership(model: DesignerDocument['model']): void {
  const stepsById = new Map(model.process.steps.map((step) => [step.id, step]));
  model.process.stages.forEach((stage) => {
    stage.stepIds = stage.stepIds.filter((stepId) => {
      const step = stepsById.get(stepId);
      return !!step && step.stageId === stage.id;
    });
    model.process.steps.filter((step) => step.stageId === stage.id && !stage.stepIds.includes(step.id)).forEach((step) => {
      stage.stepIds.push(step.id);
    });
    if (stage.defaultStepId && !stage.stepIds.includes(stage.defaultStepId)) {
      stage.defaultStepId = stage.stepIds[0] ?? null;
    }
    if (!stage.defaultStepId && stage.stepIds.length > 0) {
      stage.defaultStepId = stage.stepIds[0];
    }
  });
  const orderedStepIds = model.process.stages.flatMap((stage) => stage.stepIds);
  const orderedSteps = orderedStepIds.map((stepId) => stepsById.get(stepId)).filter((step): step is DbmStepV1 => !!step);
  const orphanSteps = model.process.steps.filter((step) => !orderedStepIds.includes(step.id));
  model.process.steps = [...orderedSteps, ...orphanSteps];
}

function rebuild(document: DesignerDocument, model: DesignerDocument['model'], affectedNodeId: string | null): DesignerCommandResult {
  normalizeStepMembership(model);
  const nextDocument = createDocument(model, true, affectedNodeId ?? document.selectionId);
  return { document: nextDocument, affectedNodeId, issues: nextDocument.issues };
}

function defaultActor(model: DesignerDocument['model']): DbmActorV1 {
  const id = uniqueId(model.process.actors.map((actor) => actor.id), 'actor');
  return { id, displayName: 'New Actor', actorType: 'approver', source: 'current-user' };
}
function defaultVariable(model: DesignerDocument['model']): DbmVariableV1 {
  const id = uniqueId(model.process.variables.map((variable) => variable.id), 'variable');
  return { id, dataType: 'string', scope: 'process', defaultValue: null, persistence: 'runtime-only' };
}
function defaultStatus(model: DesignerDocument['model']): DbmStatusV1 {
  const id = uniqueId(model.process.statuses.map((status) => status.id), 'status');
  return { id, displayName: 'New Status', audience: 'shared', kind: 'progress' };
}
function defaultTask(model: DesignerDocument['model']): DbmTaskDefinitionV1 {
  const id = uniqueId(model.process.tasks.map((task) => task.id), 'task');
  return { id, displayName: 'New Task', taskType: 'review', instructions: null };
}
function defaultNotification(model: DesignerDocument['model']): DbmNotificationDefinitionV1 {
  const id = uniqueId(model.process.notifications.map((notification) => notification.id), 'notification');
  return { id, displayName: 'New Notification', channel: 'email', templateRef: `notifications/${id}` };
}
function defaultStage(model: DesignerDocument['model']): DbmStageV1 {
  const id = uniqueId(model.process.stages.map((stage) => stage.id), 'stage');
  return {
    id, displayName: 'New Stage', stageType: 'task', actorId: model.process.actors[0]?.id ?? '', formId: model.forms[0]?.id ?? null,
    portalVisibility: 'visible', stepIds: [], defaultStepId: null, entryRuleIds: [], exitRuleIds: [], allowedOutcomeIds: []
  };
}
function defaultStep(model: DesignerDocument['model'], stage: DbmStageV1): DbmStepV1 {
  const id = uniqueId(model.process.steps.map((step) => step.id), 'step');
  const form = stage.formId ? model.forms.find((candidate) => candidate.id === stage.formId) : null;
  return {
    id, stageId: stage.id, displayName: 'New Step', stepType: 'review', ownerActorId: stage.actorId || model.process.actors[0]?.id || '',
    notificationId: model.process.notifications[0]?.id ?? null, taskId: model.process.tasks[0]?.id ?? null,
    internalStatusId: model.process.statuses.find((status) => status.audience !== 'portal')?.id ?? model.process.statuses[0]?.id ?? '',
    portalStatusId: model.process.statuses.find((status) => status.audience !== 'internal')?.id ?? null,
    formStateId: form?.formStates[0]?.id ?? null, entryRuleIds: [], exitRuleIds: []
  };
}
function defaultTransition(model: DesignerDocument['model']): DbmTransitionV1 {
  const id = uniqueId(model.process.transitions.map((transition) => transition.id), 'transition');
  return {
    id, fromStageId: model.process.stages[0]?.id ?? '', toStageId: model.process.stages[1]?.id ?? model.process.stages[0]?.id ?? '',
    outcomeId: model.process.outcomes[0]?.id ?? '', guardRuleId: model.rules[0]?.id ?? ''
  };
}
function defaultStepTransition(model: DesignerDocument['model']): DbmStepTransitionV1 {
  const id = uniqueId(model.process.stepTransitions.map((transition) => transition.id), 'step-transition');
  return {
    id, fromStepId: model.process.steps[0]?.id ?? '', guardRuleId: model.rules[0]?.id ?? '',
    target: model.process.steps[1] ? { stepId: model.process.steps[1].id } : model.process.stages[0] ? { stageId: model.process.stages[0].id } : { outcomeId: model.process.outcomes[0]?.id ?? '' }
  };
}
function defaultOutcome(model: DesignerDocument['model']): DbmOutcomeV1 {
  const id = uniqueId(model.process.outcomes.map((outcome) => outcome.id), 'outcome');
  return { id, displayName: 'New Outcome' };
}
function defaultForm(model: DesignerDocument['model']): DbmFormV1 {
  const id = uniqueId(model.forms.map((form) => form.id), 'form');
  const entityId = model.metadata.entities[0]?.id ?? '';
  return {
    id,
    displayName: 'New Form',
    primaryEntityBindingId: 'primary',
    entityBindings: [{ id: 'primary', displayName: 'Primary', entityId, relationshipId: null, role: 'primary' }],
    layout: { layoutType: 'single-page', regions: [{ id: 'main', displayName: 'Main', order: 1 }] },
    elements: [],
    formStates: []
  };
}
function defaultFormEntityBinding(form: DbmFormV1, model: DesignerDocument['model']): DbmFormEntityBindingV1 {
  const id = uniqueId(form.entityBindings.map((binding) => binding.id), 'binding');
  return {
    id, displayName: 'New Binding', entityId: model.metadata.entities[0]?.id ?? '', relationshipId: null,
    role: form.entityBindings.some((binding) => binding.role === 'primary') ? 'related' : 'primary'
  };
}
function defaultRegion(form: DbmFormV1): DbmLayoutRegionV1 {
  const id = uniqueId(form.layout.regions.map((region) => region.id), 'region');
  return { id, displayName: 'New Region', order: form.layout.regions.length + 1 };
}
function defaultElement(form: DbmFormV1, model: DesignerDocument['model']): DbmFormElementV1 {
  const id = uniqueId(form.elements.map((element) => element.id), 'element');
  const binding = form.entityBindings[0];
  const defaultFieldId = binding ? model.metadata.entities.find((entity) => entity.id === binding.entityId)?.fields[0]?.id ?? '' : '';
  return {
    id, elementType: 'text', regionId: form.layout.regions[0]?.id ?? 'main', displayName: 'New Element',
    binding: binding ? { entityBindingId: binding.id, fieldId: defaultFieldId } : { variableId: model.process.variables[0]?.id ?? '' },
    behavior: { requiredRuleIds: [], visibleRuleIds: [], editableRuleIds: [] }
  };
}
function defaultFormState(form: DbmFormV1): DbmFormStateV1 {
  const id = uniqueId(form.formStates.map((state) => state.id), 'state');
  return { id, displayName: 'New Form State', activationRuleIds: [], visibleEntityBindingIds: form.entityBindings.map((binding) => binding.id), elementBehaviors: [] };
}
function defaultEntity(model: DesignerDocument['model']): DbmEntityV1 {
  const id = uniqueId(model.metadata.entities.map((entity) => entity.id), 'entity');
  const primaryFieldId = `${id}-id`;
  return {
    id, displayName: 'New Entity', providerBindings: {}, primaryKeyFieldId: primaryFieldId,
    fields: [{ id: primaryFieldId, displayName: 'Primary Key', dataType: 'string', providerBindings: {}, isRequired: true, isReadOnly: true }]
  };
}
function defaultField(entity: DbmEntityV1): DbmFieldV1 {
  const id = uniqueId(entity.fields.map((field) => field.id), 'field');
  return { id, displayName: 'New Field', dataType: 'string', providerBindings: {}, isRequired: false, isReadOnly: false };
}
function defaultRelationship(model: DesignerDocument['model']): DbmRelationshipV1 {
  const id = uniqueId(model.metadata.relationships.map((relationship) => relationship.id), 'relationship');
  return { id, fromEntityId: model.metadata.entities[0]?.id ?? '', toEntityId: model.metadata.entities[1]?.id ?? model.metadata.entities[0]?.id ?? '', relationshipType: 'one-to-many', providerBindings: {} };
}
function defaultRule(model: DesignerDocument['model']): DbmRuleV1 {
  const id = uniqueId(model.rules.map((rule) => rule.id), 'rule');
  return { id, displayName: 'New Rule', ruleType: 'condition', scope: 'process', language: 'dbm-expression-v1', body: 'true' };
}
function defaultArtifact(model: DesignerDocument['model']): DbmArtifactV1 {
  const id = uniqueId(model.artifacts.map((artifact) => artifact.id), 'artifact');
  return { id, artifactType: 'script', displayName: 'New Artifact', runtimeTargets: [model.package.supportedRuntimes[0] ?? 'dataverse'], packagingTarget: 'repo-only', sourceRef: `artifacts/${id}.txt`, required: false };
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
function detachStepFromStages(model: DesignerDocument['model'], stepId: string): void {
  model.process.stages.forEach((stage) => {
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

export function addNode(document: DesignerDocument, command: AddNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);

  switch (command.kind) {
    case 'actor': {
      const actor = (command.value as DbmActorV1 | undefined) ?? defaultActor(model);
      insertAt(model.process.actors, actor, command.index);
      return rebuild(document, model, actorNodeId(actor.id));
    }
    case 'variable': {
      const variable = (command.value as DbmVariableV1 | undefined) ?? defaultVariable(model);
      insertAt(model.process.variables, variable, command.index);
      return rebuild(document, model, variableNodeId(variable.id));
    }
    case 'status': {
      const status = (command.value as DbmStatusV1 | undefined) ?? defaultStatus(model);
      insertAt(model.process.statuses, status, command.index);
      return rebuild(document, model, statusNodeId(status.id));
    }
    case 'task': {
      const task = (command.value as DbmTaskDefinitionV1 | undefined) ?? defaultTask(model);
      insertAt(model.process.tasks, task, command.index);
      return rebuild(document, model, taskNodeId(task.id));
    }
    case 'notification': {
      const notification = (command.value as DbmNotificationDefinitionV1 | undefined) ?? defaultNotification(model);
      insertAt(model.process.notifications, notification, command.index);
      return rebuild(document, model, notificationNodeId(notification.id));
    }
    case 'stage': {
      const stage = (command.value as DbmStageV1 | undefined) ?? defaultStage(model);
      insertAt(model.process.stages, stage, command.index);
      return rebuild(document, model, stageNodeId(stage.id));
    }
    case 'step': {
      const stage = findStageByParentId(model, command.parentId);
      if (!stage) {
        throw new Error(`Unable to add step. Unsupported parent '${command.parentId}'.`);
      }

      const step = (command.value as DbmStepV1 | undefined) ?? defaultStep(model, stage);
      insertAt(model.process.steps, step, command.index);
      attachStepToStage(stage, step.id, command.index);
      return rebuild(document, model, stepNodeId(step.id));
    }
    case 'transition': {
      const transition = (command.value as DbmTransitionV1 | undefined) ?? defaultTransition(model);
      insertAt(model.process.transitions, transition, command.index);
      return rebuild(document, model, transitionNodeId(transition.id));
    }
    case 'step-transition': {
      const transition = (command.value as DbmStepTransitionV1 | undefined) ?? defaultStepTransition(model);
      insertAt(model.process.stepTransitions, transition, command.index);
      return rebuild(document, model, stepTransitionNodeId(transition.id));
    }
    case 'outcome': {
      const outcome = (command.value as DbmOutcomeV1 | undefined) ?? defaultOutcome(model);
      insertAt(model.process.outcomes, outcome, command.index);
      return rebuild(document, model, outcomeNodeId(outcome.id));
    }
    case 'form': {
      const form = (command.value as DbmFormV1 | undefined) ?? defaultForm(model);
      insertAt(model.forms, form, command.index);
      return rebuild(document, model, formNodeId(form.id));
    }
    case 'form-entity-binding': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) {
        throw new Error(`Unable to add form entity binding. Unsupported parent '${command.parentId}'.`);
      }

      const binding = (command.value as DbmFormEntityBindingV1 | undefined) ?? defaultFormEntityBinding(form, model);
      insertAt(form.entityBindings, binding, command.index);
      if (!form.primaryEntityBindingId) {
        form.primaryEntityBindingId = binding.id;
      }
      return rebuild(document, model, formEntityBindingNodeId(form.id, binding.id));
    }
    case 'region': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) {
        throw new Error(`Unable to add region. Unsupported parent '${command.parentId}'.`);
      }

      const region = (command.value as DbmLayoutRegionV1 | undefined) ?? defaultRegion(form);
      insertAt(form.layout.regions, region, command.index);
      form.layout.regions.forEach((entry, index) => {
        entry.order = index + 1;
      });
      return rebuild(document, model, regionNodeId(form.id, region.id));
    }
    case 'element': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) {
        throw new Error(`Unable to add element. Unsupported parent '${command.parentId}'.`);
      }

      const element = (command.value as DbmFormElementV1 | undefined) ?? defaultElement(form, model);
      insertAt(form.elements, element, command.index);
      return rebuild(document, model, elementNodeId(form.id, element.id));
    }
    case 'form-state': {
      const form = findFormByParentId(model, command.parentId);
      if (!form) {
        throw new Error(`Unable to add form state. Unsupported parent '${command.parentId}'.`);
      }

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
      if (!entity) {
        throw new Error(`Unable to add field. Unsupported parent '${command.parentId}'.`);
      }

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

  if (command.nodeId === PACKAGE_NODE_ID) {
    Object.assign(model.package, value);
    return rebuild(document, model, PACKAGE_NODE_ID);
  }

  if (command.nodeId === PROCESS_NODE_ID) {
    Object.assign(model.process, value);
    return rebuild(document, model, PROCESS_NODE_ID);
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

  for (const actor of model.process.actors) {
    if (actorNodeId(actor.id) === command.nodeId) {
      Object.assign(actor, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const variable of model.process.variables) {
    if (variableNodeId(variable.id) === command.nodeId) {
      Object.assign(variable, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const status of model.process.statuses) {
    if (statusNodeId(status.id) === command.nodeId) {
      Object.assign(status, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const task of model.process.tasks) {
    if (taskNodeId(task.id) === command.nodeId) {
      Object.assign(task, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const notification of model.process.notifications) {
    if (notificationNodeId(notification.id) === command.nodeId) {
      Object.assign(notification, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const stage of model.process.stages) {
    if (stageNodeId(stage.id) === command.nodeId) {
      Object.assign(stage, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const step of model.process.steps) {
    if (stepNodeId(step.id) === command.nodeId) {
      const previousStageId = step.stageId;
      Object.assign(step, value);
      if (value['stageId'] && typeof value['stageId'] === 'string' && value['stageId'] !== previousStageId) {
        detachStepFromStages(model, step.id);
        const targetStage = model.process.stages.find((stage) => stage.id === step.stageId);
        if (targetStage) {
          attachStepToStage(targetStage, step.id);
        }
      }
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const transition of model.process.transitions) {
    if (transitionNodeId(transition.id) === command.nodeId) {
      Object.assign(transition, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const transition of model.process.stepTransitions) {
    if (stepTransitionNodeId(transition.id) === command.nodeId) {
      Object.assign(transition, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const outcome of model.process.outcomes) {
    if (outcomeNodeId(outcome.id) === command.nodeId) {
      Object.assign(outcome, value);
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

  if (removeById(model.process.actors, command.nodeId, actorNodeId)) {
    return rebuild(document, model, PROCESS_ACTORS_NODE_ID);
  }

  if (removeById(model.process.variables, command.nodeId, variableNodeId)) {
    return rebuild(document, model, PROCESS_VARIABLES_NODE_ID);
  }

  if (removeById(model.process.statuses, command.nodeId, statusNodeId)) {
    return rebuild(document, model, PROCESS_STATUSES_NODE_ID);
  }

  if (removeById(model.process.tasks, command.nodeId, taskNodeId)) {
    return rebuild(document, model, PROCESS_TASKS_NODE_ID);
  }

  if (removeById(model.process.notifications, command.nodeId, notificationNodeId)) {
    return rebuild(document, model, PROCESS_NOTIFICATIONS_NODE_ID);
  }

  const stage = model.process.stages.find((candidate) => stageNodeId(candidate.id) === command.nodeId);
  if (stage) {
    const removedStepIds = new Set(stage.stepIds);
    model.process.stages = model.process.stages.filter((candidate) => candidate.id !== stage.id);
    model.process.steps = model.process.steps.filter((step) => !removedStepIds.has(step.id) && step.stageId !== stage.id);
    model.process.transitions = model.process.transitions.filter((transition) => transition.fromStageId !== stage.id && transition.toStageId !== stage.id);
    model.process.stepTransitions = model.process.stepTransitions.filter((transition) => {
      if (removedStepIds.has(transition.fromStepId)) {
        return false;
      }
      if ('stepId' in transition.target) {
        return !removedStepIds.has(transition.target.stepId);
      }
      if ('stageId' in transition.target) {
        return transition.target.stageId !== stage.id;
      }
      return true;
    });
    return rebuild(document, model, PROCESS_STAGES_NODE_ID);
  }

  const step = model.process.steps.find((candidate) => stepNodeId(candidate.id) === command.nodeId);
  if (step) {
    model.process.steps = model.process.steps.filter((candidate) => candidate.id !== step.id);
    detachStepFromStages(model, step.id);
    model.process.stepTransitions = model.process.stepTransitions.filter((transition) => {
      if (transition.fromStepId === step.id) {
        return false;
      }
      return !('stepId' in transition.target) || transition.target.stepId !== step.id;
    });
    return rebuild(document, model, stageStepsNodeId(step.stageId));
  }

  if (removeById(model.process.transitions, command.nodeId, transitionNodeId)) {
    return rebuild(document, model, PROCESS_TRANSITIONS_NODE_ID);
  }

  if (removeById(model.process.stepTransitions, command.nodeId, stepTransitionNodeId)) {
    return rebuild(document, model, PROCESS_STEP_TRANSITIONS_NODE_ID);
  }

  const removedOutcome = model.process.outcomes.find((candidate) => outcomeNodeId(candidate.id) === command.nodeId);
  if (removedOutcome) {
    model.process.outcomes = model.process.outcomes.filter((candidate) => candidate.id !== removedOutcome.id);
    model.process.transitions = model.process.transitions.filter((transition) => transition.outcomeId !== removedOutcome.id);
    model.process.stepTransitions = model.process.stepTransitions.filter((transition) => !('outcomeId' in transition.target) || transition.target.outcomeId !== removedOutcome.id);
    model.process.stages.forEach((candidate) => {
      candidate.allowedOutcomeIds = candidate.allowedOutcomeIds.filter((outcomeId) => outcomeId !== removedOutcome.id);
    });
    return rebuild(document, model, PROCESS_OUTCOMES_NODE_ID);
  }

  if (removeById(model.forms, command.nodeId, formNodeId)) {
    return rebuild(document, model, FORMS_NODE_ID);
  }

  for (const form of model.forms) {
    if (removeById(form.entityBindings, command.nodeId, (id) => formEntityBindingNodeId(form.id, id))) {
      if (form.primaryEntityBindingId && !form.entityBindings.some((binding) => binding.id === form.primaryEntityBindingId)) {
        form.primaryEntityBindingId = form.entityBindings[0]?.id ?? '';
      }
      form.formStates.forEach((state) => {
        state.visibleEntityBindingIds = state.visibleEntityBindingIds.filter((bindingId) => form.entityBindings.some((binding) => binding.id === bindingId));
      });
      return rebuild(document, model, formEntityBindingsNodeId(form.id));
    }

    if (removeById(form.layout.regions, command.nodeId, (id) => regionNodeId(form.id, id))) {
      form.layout.regions.forEach((region, index) => {
        region.order = index + 1;
      });
      return rebuild(document, model, formLayoutNodeId(form.id));
    }

    if (removeById(form.elements, command.nodeId, (id) => elementNodeId(form.id, id))) {
      form.formStates.forEach((state) => {
        state.elementBehaviors = state.elementBehaviors.filter((behavior) => form.elements.some((element) => element.id === behavior.elementId));
      });
      return rebuild(document, model, formElementsNodeId(form.id));
    }

    if (removeById(form.formStates, command.nodeId, (id) => formStateNodeId(form.id, id))) {
      return rebuild(document, model, formStatesNodeId(form.id));
    }
  }

  if (removeById(model.metadata.entities, command.nodeId, entityNodeId)) {
    return rebuild(document, model, METADATA_ENTITIES_NODE_ID);
  }

  for (const entity of model.metadata.entities) {
    if (removeById(entity.fields, command.nodeId, (id) => fieldNodeId(entity.id, id))) {
      return rebuild(document, model, entityFieldsNodeId(entity.id));
    }
  }

  if (removeById(model.metadata.relationships, command.nodeId, relationshipNodeId)) {
    return rebuild(document, model, METADATA_RELATIONSHIPS_NODE_ID);
  }

  if (removeById(model.rules, command.nodeId, ruleNodeId)) {
    return rebuild(document, model, RULES_NODE_ID);
  }

  if (removeById(model.artifacts, command.nodeId, artifactNodeId)) {
    return rebuild(document, model, ARTIFACTS_NODE_ID);
  }

  throw new Error(`Unsupported remove target '${command.nodeId}'.`);
}

export function moveNode(document: DesignerDocument, command: MoveNodeCommand): DesignerCommandResult {
  const model = cloneModel(document);

  if (moveById(model.process.actors, command.nodeId, command.targetIndex, actorNodeId)) {
    return rebuild(document, model, PROCESS_ACTORS_NODE_ID);
  }

  if (moveById(model.process.variables, command.nodeId, command.targetIndex, variableNodeId)) {
    return rebuild(document, model, PROCESS_VARIABLES_NODE_ID);
  }

  if (moveById(model.process.statuses, command.nodeId, command.targetIndex, statusNodeId)) {
    return rebuild(document, model, PROCESS_STATUSES_NODE_ID);
  }

  if (moveById(model.process.tasks, command.nodeId, command.targetIndex, taskNodeId)) {
    return rebuild(document, model, PROCESS_TASKS_NODE_ID);
  }

  if (moveById(model.process.notifications, command.nodeId, command.targetIndex, notificationNodeId)) {
    return rebuild(document, model, PROCESS_NOTIFICATIONS_NODE_ID);
  }

  if (moveById(model.process.stages, command.nodeId, command.targetIndex, stageNodeId)) {
    return rebuild(document, model, PROCESS_STAGES_NODE_ID);
  }

  const movingStep = model.process.steps.find((step) => stepNodeId(step.id) === command.nodeId);
  if (movingStep) {
    if (command.targetParentId) {
      const targetStage = findStageByParentId(model, command.targetParentId);
      if (targetStage && targetStage.id !== movingStep.stageId) {
        detachStepFromStages(model, movingStep.id);
        movingStep.stageId = targetStage.id;
        attachStepToStage(targetStage, movingStep.id, command.targetIndex);
        return rebuild(document, model, stageStepsNodeId(targetStage.id));
      }
    }

    const currentStage = model.process.stages.find((stage) => stage.id === movingStep.stageId);
    if (currentStage) {
      const currentIndex = currentStage.stepIds.findIndex((stepId) => stepId === movingStep.id);
      if (currentIndex >= 0) {
        moveWithin(currentStage.stepIds, currentIndex, command.targetIndex);
      }
      return rebuild(document, model, stageStepsNodeId(currentStage.id));
    }
  }

  if (moveById(model.process.transitions, command.nodeId, command.targetIndex, transitionNodeId)) {
    return rebuild(document, model, PROCESS_TRANSITIONS_NODE_ID);
  }

  if (moveById(model.process.stepTransitions, command.nodeId, command.targetIndex, stepTransitionNodeId)) {
    return rebuild(document, model, PROCESS_STEP_TRANSITIONS_NODE_ID);
  }

  if (moveById(model.process.outcomes, command.nodeId, command.targetIndex, outcomeNodeId)) {
    return rebuild(document, model, PROCESS_OUTCOMES_NODE_ID);
  }

  if (moveById(model.forms, command.nodeId, command.targetIndex, formNodeId)) {
    return rebuild(document, model, FORMS_NODE_ID);
  }

  for (const form of model.forms) {
    if (moveById(form.entityBindings, command.nodeId, command.targetIndex, (id) => formEntityBindingNodeId(form.id, id))) {
      return rebuild(document, model, formEntityBindingsNodeId(form.id));
    }

    if (moveById(form.layout.regions, command.nodeId, command.targetIndex, (id) => regionNodeId(form.id, id))) {
      form.layout.regions.forEach((region, index) => {
        region.order = index + 1;
      });
      return rebuild(document, model, formLayoutNodeId(form.id));
    }

    if (moveById(form.elements, command.nodeId, command.targetIndex, (id) => elementNodeId(form.id, id))) {
      return rebuild(document, model, formElementsNodeId(form.id));
    }

    if (moveById(form.formStates, command.nodeId, command.targetIndex, (id) => formStateNodeId(form.id, id))) {
      return rebuild(document, model, formStatesNodeId(form.id));
    }
  }

  for (const entity of model.metadata.entities) {
    if (moveById(entity.fields, command.nodeId, command.targetIndex, (id) => fieldNodeId(entity.id, id))) {
      return rebuild(document, model, entityFieldsNodeId(entity.id));
    }
  }

  if (moveById(model.metadata.entities, command.nodeId, command.targetIndex, entityNodeId)) {
    return rebuild(document, model, METADATA_ENTITIES_NODE_ID);
  }

  if (moveById(model.metadata.relationships, command.nodeId, command.targetIndex, relationshipNodeId)) {
    return rebuild(document, model, METADATA_RELATIONSHIPS_NODE_ID);
  }

  if (moveById(model.rules, command.nodeId, command.targetIndex, ruleNodeId)) {
    return rebuild(document, model, RULES_NODE_ID);
  }

  if (moveById(model.artifacts, command.nodeId, command.targetIndex, artifactNodeId)) {
    return rebuild(document, model, ARTIFACTS_NODE_ID);
  }

  throw new Error(`Unsupported move target '${command.nodeId}'.`);
}
