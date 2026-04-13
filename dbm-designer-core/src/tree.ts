import type { DbmEntityV1, DbmFormV1, DbmModelV1 } from 'dbm-contract';
import {
  actorNodeId,
  ARTIFACTS_NODE_ID,
  artifactNodeId,
  DOCUMENT_NODE_ID,
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
  RUNTIME_CAPABILITIES_NODE_ID,
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

function buildFormNode(form: DbmFormV1): DesignerNodeRef {
  const formId = formNodeId(form.id);
  const layoutNode = createNode(
    formLayoutNodeId(form.id),
    'layout',
    'Layout',
    `/forms/${form.id}/layout`,
    formId,
    form.id,
    form.layout.regions.map((region) =>
      createNode(
        regionNodeId(form.id, region.id),
        'region',
        region.displayName,
        `/forms/${form.id}/layout/regions/${region.id}`,
        formLayoutNodeId(form.id),
        region.id
      )
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
      createNode(
        elementNodeId(form.id, element.id),
        'element',
        element.displayName,
        `/forms/${form.id}/elements/${element.id}`,
        formElementsNodeId(form.id),
        element.id
      )
    )
  );

  return createNode(
    formId,
    'form',
    form.displayName,
    `/forms/${form.id}`,
    FORMS_NODE_ID,
    form.id,
    [layoutNode, elementsNode]
  );
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
    entity.fields.map((field) =>
      createNode(
        fieldNodeId(entity.id, field.id),
        'field',
        field.displayName,
        `/metadata/entities/${entity.id}/fields/${field.id}`,
        entityFieldsNodeId(entity.id),
        field.id
      )
    )
  );

  return createNode(
    entityId,
    'entity',
    entity.displayName,
    `/metadata/entities/${entity.id}`,
    METADATA_ENTITIES_NODE_ID,
    entity.id,
    [fieldsNode]
  );
}

export function buildTree(model: DbmModelV1): DesignerNodeRef[] {
  const packageNode = createNode(PACKAGE_NODE_ID, 'package', model.package.displayName, '/package', DOCUMENT_NODE_ID, model.package.id);

  const processNode = createNode(PROCESS_NODE_ID, 'process', model.process.displayName, '/process', DOCUMENT_NODE_ID, model.process.id, [
    createNode(PROCESS_ACTORS_NODE_ID, 'collection', 'Actors', '/process/actors', PROCESS_NODE_ID, null, model.process.actors.map((actor) => createNode(actorNodeId(actor.id), 'actor', actor.displayName, `/process/actors/${actor.id}`, PROCESS_ACTORS_NODE_ID, actor.id))),
    createNode(PROCESS_VARIABLES_NODE_ID, 'collection', 'Variables', '/process/variables', PROCESS_NODE_ID, null, model.process.variables.map((variable) => createNode(variableNodeId(variable.id), 'variable', variable.id, `/process/variables/${variable.id}`, PROCESS_VARIABLES_NODE_ID, variable.id))),
    createNode(PROCESS_STAGES_NODE_ID, 'collection', 'Stages', '/process/stages', PROCESS_NODE_ID, null, model.process.stages.map((stage) => createNode(stageNodeId(stage.id), 'stage', stage.displayName, `/process/stages/${stage.id}`, PROCESS_STAGES_NODE_ID, stage.id))),
    createNode(PROCESS_TRANSITIONS_NODE_ID, 'collection', 'Transitions', '/process/transitions', PROCESS_NODE_ID, null, model.process.transitions.map((transition) => createNode(transitionNodeId(transition.id), 'transition', transition.id, `/process/transitions/${transition.id}`, PROCESS_TRANSITIONS_NODE_ID, transition.id))),
    createNode(PROCESS_OUTCOMES_NODE_ID, 'collection', 'Outcomes', '/process/outcomes', PROCESS_NODE_ID, null, model.process.outcomes.map((outcome) => createNode(outcomeNodeId(outcome.id), 'outcome', outcome.displayName, `/process/outcomes/${outcome.id}`, PROCESS_OUTCOMES_NODE_ID, outcome.id)))
  ]);

  const formsNode = createNode(FORMS_NODE_ID, 'forms', 'Forms', '/forms', DOCUMENT_NODE_ID, null, model.forms.map((form) => buildFormNode(form)));

  const metadataNode = createNode(METADATA_NODE_ID, 'metadata', 'Metadata', '/metadata', DOCUMENT_NODE_ID, null, [
    createNode(METADATA_ENTITIES_NODE_ID, 'collection', 'Entities', '/metadata/entities', METADATA_NODE_ID, null, model.metadata.entities.map((entity) => buildEntityNode(entity))),
    createNode(METADATA_RELATIONSHIPS_NODE_ID, 'collection', 'Relationships', '/metadata/relationships', METADATA_NODE_ID, null, model.metadata.relationships.map((relationship) => createNode(relationshipNodeId(relationship.id), 'relationship', relationship.id, `/metadata/relationships/${relationship.id}`, METADATA_RELATIONSHIPS_NODE_ID, relationship.id)))
  ]);

  const rulesNode = createNode(RULES_NODE_ID, 'rules', 'Rules', '/rules', DOCUMENT_NODE_ID, null, model.rules.map((rule) => createNode(ruleNodeId(rule.id), 'rule', rule.displayName, `/rules/${rule.id}`, RULES_NODE_ID, rule.id)));

  const runtimeNode = createNode(RUNTIME_NODE_ID, 'runtime', 'Runtime', '/runtime', DOCUMENT_NODE_ID, null, [
    createNode(RUNTIME_CAPABILITIES_NODE_ID, 'collection', 'Capabilities', '/runtime/capabilities', RUNTIME_NODE_ID),
    createNode(RUNTIME_REQUEST_CONTRACT_NODE_ID, 'request-contract', 'Request Contract', '/runtime/requestContract', RUNTIME_NODE_ID),
    createNode(RUNTIME_RESULT_CONTRACT_NODE_ID, 'result-contract', 'Result Contract', '/runtime/resultContract', RUNTIME_NODE_ID),
    createNode(RUNTIME_OWNERSHIP_NODE_ID, 'ownership', 'Ownership', '/runtime/ownership', RUNTIME_NODE_ID)
  ]);

  const artifactsNode = createNode(ARTIFACTS_NODE_ID, 'artifacts', 'Artifacts', '/artifacts', DOCUMENT_NODE_ID, null, model.artifacts.map((artifact) => createNode(artifactNodeId(artifact.id), 'artifact', artifact.displayName, `/artifacts/${artifact.id}`, ARTIFACTS_NODE_ID, artifact.id)));

  return [createNode(DOCUMENT_NODE_ID, 'document', model.package.displayName, '/', null, model.package.id, [packageNode, processNode, formsNode, metadataNode, rulesNode, runtimeNode, artifactsNode])];
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
