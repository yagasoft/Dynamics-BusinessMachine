import type { DbmEntityV1, DbmFormV1, DbmModelV1, DbmProcessV1, DbmStageV1, DbmStepV1 } from 'dbm-contract';
import {
  ARTIFACTS_NODE_ID,
  DOCUMENT_NODE_ID,
  FORMS_NODE_ID,
  METADATA_ENTITIES_NODE_ID,
  METADATA_NODE_ID,
  METADATA_RELATIONSHIPS_NODE_ID,
  PACKAGE_NODE_ID,
  PROCESS_PORTFOLIO_NODE_ID,
  PROCESS_PORTFOLIO_PROCESSES_NODE_ID,
  RULES_NODE_ID,
  RUNTIME_CAPABILITIES_NODE_ID,
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
import { orderedProcesses } from './portfolio';
import type { DesignerNodeKind, DesignerNodeRef } from './types';

function createNode(
  id: string,
  kind: DesignerNodeKind,
  label: string,
  path: string,
  parentId: string | null,
  modelId: string | null = null,
  children: DesignerNodeRef[] = []
): DesignerNodeRef {
  return {
    id,
    kind,
    label,
    path,
    parentId,
    modelId,
    children
  };
}

function buildStageStepsNode(process: DbmProcessV1, stage: DbmStageV1, steps: DbmStepV1[]): DesignerNodeRef {
  return createNode(
    stageStepsNodeId(process.id, stage.id),
    'collection',
    'Steps',
    `/processPortfolio/processes/${process.id}/stages/${stage.id}/steps`,
    stageNodeId(process.id, stage.id),
    null,
    steps.map((step) =>
      createNode(
        stepNodeId(process.id, step.id),
        'step',
        step.displayName,
        `/processPortfolio/processes/${process.id}/steps/${step.id}`,
        stageStepsNodeId(process.id, stage.id),
        step.id
      )
    )
  );
}

function buildProcessNode(process: DbmProcessV1): DesignerNodeRef {
  const stepById = new Map(process.steps.map((step) => [step.id, step]));
  const id = processNodeId(process.id);

  return createNode(id, 'process', process.displayName, `/processPortfolio/processes/${process.id}`, PROCESS_PORTFOLIO_PROCESSES_NODE_ID, process.id, [
    createNode(
      processActorsNodeId(process.id),
      'collection',
      'Actors',
      `/processPortfolio/processes/${process.id}/actors`,
      id,
      null,
      process.actors.map((actor) => createNode(actorNodeId(process.id, actor.id), 'actor', actor.displayName, `/processPortfolio/processes/${process.id}/actors/${actor.id}`, processActorsNodeId(process.id), actor.id))
    ),
    createNode(
      processVariablesNodeId(process.id),
      'collection',
      'Variables',
      `/processPortfolio/processes/${process.id}/variables`,
      id,
      null,
      process.variables.map((variable) => createNode(variableNodeId(process.id, variable.id), 'variable', variable.id, `/processPortfolio/processes/${process.id}/variables/${variable.id}`, processVariablesNodeId(process.id), variable.id))
    ),
    createNode(
      processStatusesNodeId(process.id),
      'collection',
      'Statuses',
      `/processPortfolio/processes/${process.id}/statuses`,
      id,
      null,
      process.statuses.map((status) => createNode(statusNodeId(process.id, status.id), 'status', status.displayName, `/processPortfolio/processes/${process.id}/statuses/${status.id}`, processStatusesNodeId(process.id), status.id))
    ),
    createNode(
      processTasksNodeId(process.id),
      'collection',
      'Tasks',
      `/processPortfolio/processes/${process.id}/tasks`,
      id,
      null,
      process.tasks.map((task) => createNode(taskNodeId(process.id, task.id), 'task', task.displayName, `/processPortfolio/processes/${process.id}/tasks/${task.id}`, processTasksNodeId(process.id), task.id))
    ),
    createNode(
      processNotificationsNodeId(process.id),
      'collection',
      'Notifications',
      `/processPortfolio/processes/${process.id}/notifications`,
      id,
      null,
      process.notifications.map((notification) =>
        createNode(notificationNodeId(process.id, notification.id), 'notification', notification.displayName, `/processPortfolio/processes/${process.id}/notifications/${notification.id}`, processNotificationsNodeId(process.id), notification.id)
      )
    ),
    createNode(
      processStagesNodeId(process.id),
      'collection',
      'Stages',
      `/processPortfolio/processes/${process.id}/stages`,
      id,
      null,
      process.stages.map((stage) => {
        const stageSteps = stage.stepIds.map((stepId) => stepById.get(stepId)).filter((step): step is DbmStepV1 => !!step);
        return createNode(stageNodeId(process.id, stage.id), 'stage', stage.displayName, `/processPortfolio/processes/${process.id}/stages/${stage.id}`, processStagesNodeId(process.id), stage.id, [
          buildStageStepsNode(process, stage, stageSteps)
        ]);
      })
    ),
    createNode(
      processTransitionsNodeId(process.id),
      'collection',
      'Stage transitions',
      `/processPortfolio/processes/${process.id}/transitions`,
      id,
      null,
      process.transitions.map((transition) =>
        createNode(transitionNodeId(process.id, transition.id), 'transition', transition.id, `/processPortfolio/processes/${process.id}/transitions/${transition.id}`, processTransitionsNodeId(process.id), transition.id)
      )
    ),
    createNode(
      processStepTransitionsNodeId(process.id),
      'collection',
      'Step transitions',
      `/processPortfolio/processes/${process.id}/stepTransitions`,
      id,
      null,
      process.stepTransitions.map((transition) =>
        createNode(stepTransitionNodeId(process.id, transition.id), 'step-transition', transition.id, `/processPortfolio/processes/${process.id}/stepTransitions/${transition.id}`, processStepTransitionsNodeId(process.id), transition.id)
      )
    ),
    createNode(
      processOutcomesNodeId(process.id),
      'collection',
      'Outcomes',
      `/processPortfolio/processes/${process.id}/outcomes`,
      id,
      null,
      process.outcomes.map((outcome) => createNode(outcomeNodeId(process.id, outcome.id), 'outcome', outcome.displayName, `/processPortfolio/processes/${process.id}/outcomes/${outcome.id}`, processOutcomesNodeId(process.id), outcome.id))
    )
  ]);
}

function buildFormNode(form: DbmFormV1): DesignerNodeRef {
  const formId = formNodeId(form.id);
  const entityBindingsNode = createNode(
    formEntityBindingsNodeId(form.id),
    'collection',
    'Entity bindings',
    `/forms/${form.id}/entityBindings`,
    formId,
    null,
    form.entityBindings.map((binding) =>
      createNode(formEntityBindingNodeId(form.id, binding.id), 'form-entity-binding', binding.displayName, `/forms/${form.id}/entityBindings/${binding.id}`, formEntityBindingsNodeId(form.id), binding.id)
    )
  );

  const layoutNode = createNode(
    formLayoutNodeId(form.id),
    'layout',
    'Layout',
    `/forms/${form.id}/layout`,
    formId,
    form.id,
    form.layout.regions.map((region) =>
      createNode(regionNodeId(form.id, region.id), 'region', region.displayName, `/forms/${form.id}/layout/regions/${region.id}`, formLayoutNodeId(form.id), region.id)
    )
  );

  const elementsNode = createNode(
    formElementsNodeId(form.id),
    'collection',
    'Elements',
    `/forms/${form.id}/elements`,
    formId,
    null,
    form.elements.map((element) =>
      createNode(elementNodeId(form.id, element.id), 'element', element.displayName, `/forms/${form.id}/elements/${element.id}`, formElementsNodeId(form.id), element.id)
    )
  );

  const statesNode = createNode(
    formStatesNodeId(form.id),
    'collection',
    'Form states',
    `/forms/${form.id}/formStates`,
    formId,
    null,
    form.formStates.map((state) =>
      createNode(formStateNodeId(form.id, state.id), 'form-state', state.displayName, `/forms/${form.id}/formStates/${state.id}`, formStatesNodeId(form.id), state.id)
    )
  );

  return createNode(formId, 'form', form.displayName, `/forms/${form.id}`, FORMS_NODE_ID, form.id, [
    entityBindingsNode,
    layoutNode,
    elementsNode,
    statesNode
  ]);
}

function buildEntityNode(entity: DbmEntityV1): DesignerNodeRef {
  const entityId = entityNodeId(entity.id);
  const fieldsNode = createNode(
    entityFieldsNodeId(entity.id),
    'collection',
    'Fields',
    `/metadata/entities/${entity.id}/fields`,
    entityId,
    null,
    entity.fields.map((field) => createNode(fieldNodeId(entity.id, field.id), 'field', field.displayName, `/metadata/entities/${entity.id}/fields/${field.id}`, entityFieldsNodeId(entity.id), field.id))
  );

  return createNode(entityId, 'entity', entity.displayName, `/metadata/entities/${entity.id}`, METADATA_ENTITIES_NODE_ID, entity.id, [fieldsNode]);
}

export function buildTree(model: DbmModelV1): DesignerNodeRef[] {
  const packageNode = createNode(PACKAGE_NODE_ID, 'package', model.package.displayName, '/package', DOCUMENT_NODE_ID, model.package.id);
  const processPortfolioNode = createNode(PROCESS_PORTFOLIO_NODE_ID, 'process-portfolio', 'Process portfolio', '/processPortfolio', DOCUMENT_NODE_ID, model.processPortfolio.mainProcessId, [
    createNode(
      PROCESS_PORTFOLIO_PROCESSES_NODE_ID,
      'collection',
      'Processes',
      '/processPortfolio/processes',
      PROCESS_PORTFOLIO_NODE_ID,
      null,
      orderedProcesses(model).map((process) => buildProcessNode(process))
    )
  ]);

  const formsNode = createNode(FORMS_NODE_ID, 'forms', 'Forms', '/forms', DOCUMENT_NODE_ID, null, model.forms.map((form) => buildFormNode(form)));
  const metadataNode = createNode(METADATA_NODE_ID, 'metadata', 'Metadata', '/metadata', DOCUMENT_NODE_ID, null, [
    createNode(METADATA_ENTITIES_NODE_ID, 'collection', 'Entities', '/metadata/entities', METADATA_NODE_ID, null, model.metadata.entities.map((entity) => buildEntityNode(entity))),
    createNode(
      METADATA_RELATIONSHIPS_NODE_ID,
      'collection',
      'Relationships',
      '/metadata/relationships',
      METADATA_NODE_ID,
      null,
      model.metadata.relationships.map((relationship) => createNode(relationshipNodeId(relationship.id), 'relationship', relationship.id, `/metadata/relationships/${relationship.id}`, METADATA_RELATIONSHIPS_NODE_ID, relationship.id))
    )
  ]);
  const rulesNode = createNode(RULES_NODE_ID, 'rules', 'Rules', '/rules', DOCUMENT_NODE_ID, null, model.rules.map((rule) => createNode(ruleNodeId(rule.id), 'rule', rule.displayName, `/rules/${rule.id}`, RULES_NODE_ID, rule.id)));
  const runtimeNode = createNode(RUNTIME_NODE_ID, 'runtime', 'Runtime', '/runtime', DOCUMENT_NODE_ID, null, [
    createNode(RUNTIME_CAPABILITIES_NODE_ID, 'collection', 'Capabilities', '/runtime/capabilities', RUNTIME_NODE_ID),
    createNode(RUNTIME_REQUEST_CONTRACT_NODE_ID, 'request-contract', 'Request contract', '/runtime/requestContract', RUNTIME_NODE_ID),
    createNode(RUNTIME_RESULT_CONTRACT_NODE_ID, 'result-contract', 'Result contract', '/runtime/resultContract', RUNTIME_NODE_ID),
    createNode(RUNTIME_OWNERSHIP_NODE_ID, 'ownership', 'Ownership', '/runtime/ownership', RUNTIME_NODE_ID)
  ]);
  const artifactsNode = createNode(ARTIFACTS_NODE_ID, 'artifacts', 'Artifacts', '/artifacts', DOCUMENT_NODE_ID, null, model.artifacts.map((artifact) => createNode(artifactNodeId(artifact.id), 'artifact', artifact.displayName, `/artifacts/${artifact.id}`, ARTIFACTS_NODE_ID, artifact.id)));

  return [createNode(DOCUMENT_NODE_ID, 'document', model.package.displayName, '/', null, model.package.id, [packageNode, processPortfolioNode, formsNode, metadataNode, rulesNode, runtimeNode, artifactsNode])];
}

export function indexTree(tree: DesignerNodeRef[]): Record<string, DesignerNodeRef> {
  const index: Record<string, DesignerNodeRef> = {};

  function visit(node: DesignerNodeRef): void {
    index[node.id] = node;
    node.children.forEach(visit);
  }

  tree.forEach(visit);
  return index;
}
