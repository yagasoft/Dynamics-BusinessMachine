export const DOCUMENT_NODE_ID = 'document:root';
export const PACKAGE_NODE_ID = 'section:package';
export const PROCESS_PORTFOLIO_NODE_ID = 'section:process-portfolio';
export const PROCESS_PORTFOLIO_PROCESSES_NODE_ID = 'collection:process-portfolio:processes';
export const FORMS_NODE_ID = 'section:forms';
export const METADATA_NODE_ID = 'section:metadata';
export const METADATA_ENTITIES_NODE_ID = 'collection:metadata:entities';
export const METADATA_RELATIONSHIPS_NODE_ID = 'collection:metadata:relationships';
export const RULES_NODE_ID = 'section:rules';
export const RUNTIME_NODE_ID = 'section:runtime';
export const RUNTIME_CAPABILITIES_NODE_ID = 'collection:runtime:capabilities';
export const RUNTIME_REQUEST_CONTRACT_NODE_ID = 'runtime:request-contract';
export const RUNTIME_RESULT_CONTRACT_NODE_ID = 'runtime:result-contract';
export const RUNTIME_OWNERSHIP_NODE_ID = 'runtime:ownership';
export const ARTIFACTS_NODE_ID = 'section:artifacts';

export const processNodeId = (processId: string): string => `process:${processId}`;
export const processActorsNodeId = (processId: string): string => `collection:process:${processId}:actors`;
export const processVariablesNodeId = (processId: string): string => `collection:process:${processId}:variables`;
export const processStatusesNodeId = (processId: string): string => `collection:process:${processId}:statuses`;
export const processTasksNodeId = (processId: string): string => `collection:process:${processId}:tasks`;
export const processNotificationsNodeId = (processId: string): string => `collection:process:${processId}:notifications`;
export const processStagesNodeId = (processId: string): string => `collection:process:${processId}:stages`;
export const processTransitionsNodeId = (processId: string): string => `collection:process:${processId}:transitions`;
export const processStepTransitionsNodeId = (processId: string): string => `collection:process:${processId}:step-transitions`;
export const processOutcomesNodeId = (processId: string): string => `collection:process:${processId}:outcomes`;

export const actorNodeId = (processId: string, id: string): string => `actor:${processId}:${id}`;
export const variableNodeId = (processId: string, id: string): string => `variable:${processId}:${id}`;
export const statusNodeId = (processId: string, id: string): string => `status:${processId}:${id}`;
export const taskNodeId = (processId: string, id: string): string => `task:${processId}:${id}`;
export const notificationNodeId = (processId: string, id: string): string => `notification:${processId}:${id}`;
export const stageNodeId = (processId: string, id: string): string => `stage:${processId}:${id}`;
export const stageStepsNodeId = (processId: string, stageId: string): string => `collection:stage:${processId}:${stageId}:steps`;
export const stepNodeId = (processId: string, id: string): string => `step:${processId}:${id}`;
export const transitionNodeId = (processId: string, id: string): string => `transition:${processId}:${id}`;
export const stepTransitionNodeId = (processId: string, id: string): string => `step-transition:${processId}:${id}`;
export const outcomeNodeId = (processId: string, id: string): string => `outcome:${processId}:${id}`;

export const formNodeId = (id: string): string => `form:${id}`;
export const formEntityBindingsNodeId = (formId: string): string => `collection:form:${formId}:entity-bindings`;
export const formEntityBindingNodeId = (formId: string, bindingId: string): string => `form-entity-binding:${formId}:${bindingId}`;
export const formLayoutNodeId = (formId: string): string => `layout:${formId}`;
export const formElementsNodeId = (formId: string): string => `collection:form:${formId}:elements`;
export const formStatesNodeId = (formId: string): string => `collection:form:${formId}:states`;
export const formStateNodeId = (formId: string, stateId: string): string => `form-state:${formId}:${stateId}`;
export const regionNodeId = (formId: string, regionId: string): string => `region:${formId}:${regionId}`;
export const elementNodeId = (formId: string, elementId: string): string => `element:${formId}:${elementId}`;
export const entityNodeId = (id: string): string => `entity:${id}`;
export const entityFieldsNodeId = (entityId: string): string => `collection:entity:${entityId}:fields`;
export const fieldNodeId = (entityId: string, fieldId: string): string => `field:${entityId}:${fieldId}`;
export const relationshipNodeId = (id: string): string => `relationship:${id}`;
export const ruleNodeId = (id: string): string => `rule:${id}`;
export const artifactNodeId = (id: string): string => `artifact:${id}`;

export function parseProcessScopedNodeId(nodeId: string, prefix: string): { processId: string; id: string } | null {
  const marker = `${prefix}:`;
  if (!nodeId.startsWith(marker)) {
    return null;
  }

  const remainder = nodeId.slice(marker.length);
  const separatorIndex = remainder.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    processId: remainder.slice(0, separatorIndex),
    id: remainder.slice(separatorIndex + 1)
  };
}

export function parseProcessIdFromCollectionNodeId(nodeId: string, collection: string): string | null {
  const prefix = 'collection:process:';
  const suffix = `:${collection}`;
  if (!nodeId.startsWith(prefix) || !nodeId.endsWith(suffix)) {
    return null;
  }

  return nodeId.slice(prefix.length, -suffix.length);
}
