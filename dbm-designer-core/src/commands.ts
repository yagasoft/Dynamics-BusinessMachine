import type {
  DbmActorV1,
  DbmArtifactV1,
  DbmEntityV1,
  DbmFieldV1,
  DbmFormElementV1,
  DbmFormV1,
  DbmLayoutRegionV1,
  DbmOutcomeV1,
  DbmRelationshipV1,
  DbmRuleV1,
  DbmStageV1,
  DbmTransitionV1,
  DbmVariableV1
} from 'dbm-contract';
import {
  actorNodeId,
  ARTIFACTS_NODE_ID,
  artifactNodeId,
  elementNodeId,
  entityFieldsNodeId,
  entityNodeId,
  fieldNodeId,
  formElementsNodeId,
  formLayoutNodeId,
  formNodeId,
  FORMS_NODE_ID,
  METADATA_ENTITIES_NODE_ID,
  METADATA_NODE_ID,
  METADATA_RELATIONSHIPS_NODE_ID,
  outcomeNodeId,
  PACKAGE_NODE_ID,
  PROCESS_ACTORS_NODE_ID,
  PROCESS_NODE_ID,
  PROCESS_OUTCOMES_NODE_ID,
  PROCESS_STAGES_NODE_ID,
  PROCESS_TRANSITIONS_NODE_ID,
  PROCESS_VARIABLES_NODE_ID,
  regionNodeId,
  relationshipNodeId,
  RUNTIME_NODE_ID,
  RUNTIME_OWNERSHIP_NODE_ID,
  RUNTIME_REQUEST_CONTRACT_NODE_ID,
  RUNTIME_RESULT_CONTRACT_NODE_ID,
  RULES_NODE_ID,
  ruleNodeId,
  stageNodeId,
  transitionNodeId,
  variableNodeId
} from './node-ids';
import { createDocument } from './model';
import type {
  AddNodeCommand,
  DesignerCommandResult,
  DesignerDocument,
  MoveNodeCommand,
  RemoveNodeCommand,
  UpdateNodeCommand
} from './types';

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

function rebuild(document: DesignerDocument, model: DesignerDocument['model'], affectedNodeId: string | null): DesignerCommandResult {
  const nextDocument = createDocument(model, true, affectedNodeId ?? document.selectionId);
  return {
    document: nextDocument,
    affectedNodeId,
    issues: nextDocument.issues
  };
}

function cloneModel(document: DesignerDocument) {
  return structuredClone(document.model);
}

function defaultActor(model: DesignerDocument['model']): DbmActorV1 {
  const id = uniqueId(model.process.actors.map((actor) => actor.id), 'actor');
  return {
    id,
    displayName: 'New Actor',
    actorType: 'approver',
    source: 'current-user'
  };
}

function defaultVariable(model: DesignerDocument['model']): DbmVariableV1 {
  const id = uniqueId(model.process.variables.map((variable) => variable.id), 'variable');
  return {
    id,
    dataType: 'string',
    scope: 'process',
    defaultValue: null,
    persistence: 'runtime-only'
  };
}

function defaultStage(model: DesignerDocument['model']): DbmStageV1 {
  const id = uniqueId(model.process.stages.map((stage) => stage.id), 'stage');
  return {
    id,
    displayName: 'New Stage',
    stageType: 'task',
    actorId: model.process.actors[0]?.id ?? '',
    formId: model.forms[0]?.id ?? null,
    entryRuleIds: [],
    exitRuleIds: [],
    allowedOutcomeIds: []
  };
}

function defaultTransition(model: DesignerDocument['model']): DbmTransitionV1 {
  const id = uniqueId(model.process.transitions.map((transition) => transition.id), 'transition');
  return {
    id,
    fromStageId: model.process.stages[0]?.id ?? '',
    toStageId: model.process.stages[1]?.id ?? model.process.stages[0]?.id ?? '',
    outcomeId: 'submit',
    guardRuleId: model.rules[0]?.id ?? ''
  };
}

function defaultOutcome(model: DesignerDocument['model']): DbmOutcomeV1 {
  const id = uniqueId(model.process.outcomes.map((outcome) => outcome.id), 'outcome');
  return {
    id,
    displayName: 'New Outcome'
  };
}

function defaultForm(model: DesignerDocument['model']): DbmFormV1 {
  const id = uniqueId(model.forms.map((form) => form.id), 'form');
  return {
    id,
    displayName: 'New Form',
    entityId: model.metadata.entities[0]?.id ?? '',
    layout: {
      layoutType: 'single-page',
      regions: [
        {
          id: 'main',
          displayName: 'Main',
          order: 1
        }
      ]
    },
    elements: []
  };
}

function defaultRegion(form: DbmFormV1): DbmLayoutRegionV1 {
  const id = uniqueId(form.layout.regions.map((region) => region.id), 'region');
  return {
    id,
    displayName: 'New Region',
    order: form.layout.regions.length + 1
  };
}

function defaultElement(form: DbmFormV1, model: DesignerDocument['model']): DbmFormElementV1 {
  const id = uniqueId(form.elements.map((element) => element.id), 'element');
  const defaultFieldId =
    model.metadata.entities.find((entity) => entity.id === form.entityId)?.fields[0]?.id ??
    model.metadata.entities[0]?.fields[0]?.id ??
    '';

  return {
    id,
    elementType: 'text',
    regionId: form.layout.regions[0]?.id ?? 'main',
    displayName: 'New Element',
    binding: {
      fieldId: defaultFieldId
    },
    behavior: {
      requiredRuleIds: [],
      visibleRuleIds: [],
      editableRuleIds: []
    }
  };
}

function defaultEntity(model: DesignerDocument['model']): DbmEntityV1 {
  const id = uniqueId(model.metadata.entities.map((entity) => entity.id), 'entity');
  const primaryFieldId = `${id}-id`;
  return {
    id,
    displayName: 'New Entity',
    providerBindings: {},
    primaryKeyFieldId: primaryFieldId,
    fields: [
      {
        id: primaryFieldId,
        displayName: 'Primary Key',
        dataType: 'string',
        providerBindings: {},
        isRequired: true,
        isReadOnly: true
      }
    ]
  };
}

function defaultField(entity: DbmEntityV1): DbmFieldV1 {
  const id = uniqueId(entity.fields.map((field) => field.id), 'field');
  return {
    id,
    displayName: 'New Field',
    dataType: 'string',
    providerBindings: {},
    isRequired: false,
    isReadOnly: false
  };
}

function defaultRelationship(model: DesignerDocument['model']): DbmRelationshipV1 {
  const id = uniqueId(model.metadata.relationships.map((relationship) => relationship.id), 'relationship');
  return {
    id,
    fromEntityId: model.metadata.entities[0]?.id ?? '',
    toEntityId: model.metadata.entities[1]?.id ?? model.metadata.entities[0]?.id ?? '',
    relationshipType: 'one-to-many',
    providerBindings: {}
  };
}

function defaultRule(model: DesignerDocument['model']): DbmRuleV1 {
  const id = uniqueId(model.rules.map((rule) => rule.id), 'rule');
  return {
    id,
    displayName: 'New Rule',
    ruleType: 'condition',
    scope: 'process',
    language: 'dbm-expression-v1',
    body: 'true'
  };
}

function defaultArtifact(model: DesignerDocument['model']): DbmArtifactV1 {
  const id = uniqueId(model.artifacts.map((artifact) => artifact.id), 'artifact');
  return {
    id,
    artifactType: 'script',
    displayName: 'New Artifact',
    runtimeTargets: [model.package.supportedRuntimes[0] ?? 'dataverse'],
    packagingTarget: 'repo-only',
    sourceRef: `artifacts/${id}.txt`,
    required: false
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
    case 'stage': {
      const stage = (command.value as DbmStageV1 | undefined) ?? defaultStage(model);
      insertAt(model.process.stages, stage, command.index);
      return rebuild(document, model, stageNodeId(stage.id));
    }
    case 'transition': {
      const transition = (command.value as DbmTransitionV1 | undefined) ?? defaultTransition(model);
      insertAt(model.process.transitions, transition, command.index);
      return rebuild(document, model, transitionNodeId(transition.id));
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
    case 'region': {
      const form = model.forms.find((candidate) => formNodeId(candidate.id) === command.parentId || formLayoutNodeId(candidate.id) === command.parentId);
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
      const form = model.forms.find((candidate) => formNodeId(candidate.id) === command.parentId || formElementsNodeId(candidate.id) === command.parentId);
      if (!form) {
        throw new Error(`Unable to add element. Unsupported parent '${command.parentId}'.`);
      }

      const element = (command.value as DbmFormElementV1 | undefined) ?? defaultElement(form, model);
      insertAt(form.elements, element, command.index);
      return rebuild(document, model, elementNodeId(form.id, element.id));
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

  for (const stage of model.process.stages) {
    if (stageNodeId(stage.id) === command.nodeId) {
      Object.assign(stage, value);
      return rebuild(document, model, command.nodeId);
    }
  }

  for (const transition of model.process.transitions) {
    if (transitionNodeId(transition.id) === command.nodeId) {
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

  if (removeById(model.process.stages, command.nodeId, stageNodeId)) {
    return rebuild(document, model, PROCESS_STAGES_NODE_ID);
  }

  if (removeById(model.process.transitions, command.nodeId, transitionNodeId)) {
    return rebuild(document, model, PROCESS_TRANSITIONS_NODE_ID);
  }

  if (removeById(model.process.outcomes, command.nodeId, outcomeNodeId)) {
    return rebuild(document, model, PROCESS_OUTCOMES_NODE_ID);
  }

  if (removeById(model.forms, command.nodeId, formNodeId)) {
    return rebuild(document, model, FORMS_NODE_ID);
  }

  for (const form of model.forms) {
    if (removeById(form.layout.regions, command.nodeId, (id) => regionNodeId(form.id, id))) {
      form.layout.regions.forEach((region, index) => {
        region.order = index + 1;
      });
      return rebuild(document, model, formLayoutNodeId(form.id));
    }

    if (removeById(form.elements, command.nodeId, (id) => elementNodeId(form.id, id))) {
      return rebuild(document, model, formElementsNodeId(form.id));
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

  if (moveById(model.process.stages, command.nodeId, command.targetIndex, stageNodeId)) {
    return rebuild(document, model, PROCESS_STAGES_NODE_ID);
  }

  if (moveById(model.process.transitions, command.nodeId, command.targetIndex, transitionNodeId)) {
    return rebuild(document, model, PROCESS_TRANSITIONS_NODE_ID);
  }

  if (moveById(model.process.outcomes, command.nodeId, command.targetIndex, outcomeNodeId)) {
    return rebuild(document, model, PROCESS_OUTCOMES_NODE_ID);
  }

  if (moveById(model.forms, command.nodeId, command.targetIndex, formNodeId)) {
    return rebuild(document, model, FORMS_NODE_ID);
  }

  for (const form of model.forms) {
    if (moveById(form.layout.regions, command.nodeId, command.targetIndex, (id) => regionNodeId(form.id, id))) {
      form.layout.regions.forEach((region, index) => {
        region.order = index + 1;
      });
      return rebuild(document, model, formLayoutNodeId(form.id));
    }

    if (moveById(form.elements, command.nodeId, command.targetIndex, (id) => elementNodeId(form.id, id))) {
      return rebuild(document, model, formElementsNodeId(form.id));
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
