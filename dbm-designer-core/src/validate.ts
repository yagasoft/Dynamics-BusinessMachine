import Ajv from 'ajv';
import type {
  DbmArtifactV1,
  DbmEntityV1,
  DbmFormEntityBindingV1,
  DbmModelV1,
  DbmRuleV1,
  DbmStatusV1,
  DbmStepTransitionV1
} from 'dbm-contract';
import modelSchema from '../../dbm-contract/schema/dbm-model-v1.schema.json';
import {
  actorNodeId,
  artifactNodeId,
  elementNodeId,
  entityNodeId,
  fieldNodeId,
  formEntityBindingNodeId,
  formNodeId,
  formStateNodeId,
  notificationNodeId,
  outcomeNodeId,
  PACKAGE_NODE_ID,
  PROCESS_NODE_ID,
  regionNodeId,
  relationshipNodeId,
  RUNTIME_NODE_ID,
  ruleNodeId,
  stageNodeId,
  statusNodeId,
  stepNodeId,
  stepTransitionNodeId,
  taskNodeId,
  transitionNodeId,
  variableNodeId
} from './node-ids';
import type { DesignerDocument, DesignerIssue } from './types';

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const validateSchema = ajv.compile(modelSchema as object);

function issue(level: DesignerIssue['level'], code: string, message: string, path: string, nodeId?: string): DesignerIssue {
  return {
    level,
    code,
    message,
    path,
    nodeId
  };
}

function addDuplicateIdIssues(
  issues: DesignerIssue[],
  ids: string[],
  code: string,
  pathPrefix: string,
  nodeIdFactory: (id: string) => string
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  ids.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
      return;
    }

    seen.add(id);
  });

  duplicates.forEach((duplicate) => {
    issues.push(issue('error', code, `Duplicate identifier '${duplicate}' is not allowed.`, `${pathPrefix}/${duplicate}`, nodeIdFactory(duplicate)));
  });
}

function addMissingRuleIssues(
  issues: DesignerIssue[],
  ruleIds: Set<string>,
  ids: string[],
  code: string,
  messagePrefix: string,
  path: string,
  nodeId: string
): void {
  ids.forEach((ruleId) => {
    if (!ruleIds.has(ruleId)) {
      issues.push(issue('error', code, `${messagePrefix} references missing rule '${ruleId}'.`, path, nodeId));
    }
  });
}

function findArtifact(artifacts: DbmArtifactV1[], artifactId: string): DbmArtifactV1 | undefined {
  return artifacts.find((artifact) => artifact.id === artifactId);
}

function findRule(rules: DbmRuleV1[], ruleId: string): DbmRuleV1 | undefined {
  return rules.find((rule) => rule.id === ruleId);
}

function findFieldEntity(entities: DbmEntityV1[], entityId: string, fieldId: string): DbmEntityV1 | undefined {
  return entities.find((entity) => entity.id === entityId && entity.fields.some((field) => field.id === fieldId));
}

function isPortalVisibleStatus(status: DbmStatusV1): boolean {
  return status.audience === 'portal' || status.audience === 'shared';
}

function isInternalStatus(status: DbmStatusV1): boolean {
  return status.audience === 'internal' || status.audience === 'shared';
}

function validateStepTransitionTarget(
  transition: DbmStepTransitionV1,
  stepIds: Set<string>,
  stageIds: Set<string>,
  outcomeIds: Set<string>
): { valid: boolean; message?: string } {
  if ('stepId' in transition.target) {
    return stepIds.has(transition.target.stepId)
      ? { valid: true }
      : { valid: false, message: `missing target step '${transition.target.stepId}'` };
  }

  if ('stageId' in transition.target) {
    return stageIds.has(transition.target.stageId)
      ? { valid: true }
      : { valid: false, message: `missing target stage '${transition.target.stageId}'` };
  }

  return outcomeIds.has(transition.target.outcomeId)
    ? { valid: true }
    : { valid: false, message: `missing target outcome '${transition.target.outcomeId}'` };
}

export function validateModel(model: DbmModelV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  const schemaValid = validateSchema(model);

  if (!schemaValid) {
    (validateSchema.errors ?? []).forEach((error) => {
      issues.push(issue('error', 'schema-invalid', `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`.trim(), error.instancePath || '/'));
    });
  }

  if (model.package.entryProcessId !== model.process.id) {
    issues.push(issue('error', 'package-entry-process-mismatch', 'package.entryProcessId must match process.id.', '/package/entryProcessId', PACKAGE_NODE_ID));
  }

  if (model.process.scenarioType !== 'approval-request') {
    issues.push(issue('error', 'unsupported-scenario-type', 'R1.2.1 only supports approval-request scenarios.', '/process/scenarioType', PROCESS_NODE_ID));
  }

  model.package.processUiSurfaces.forEach((surface) => {
    if (!model.package.supportedHosts.includes(surface)) {
      issues.push(issue('error', 'invalid-process-ui-surface', `package.processUiSurfaces contains '${surface}', which is not listed in package.supportedHosts.`, '/package/processUiSurfaces', PACKAGE_NODE_ID));
    }
  });

  addDuplicateIdIssues(issues, model.process.actors.map((actor) => actor.id), 'duplicate-actor-id', '/process/actors', actorNodeId);
  addDuplicateIdIssues(issues, model.process.variables.map((variable) => variable.id), 'duplicate-variable-id', '/process/variables', variableNodeId);
  addDuplicateIdIssues(issues, model.process.statuses.map((status) => status.id), 'duplicate-status-id', '/process/statuses', statusNodeId);
  addDuplicateIdIssues(issues, model.process.tasks.map((task) => task.id), 'duplicate-task-id', '/process/tasks', taskNodeId);
  addDuplicateIdIssues(issues, model.process.notifications.map((notification) => notification.id), 'duplicate-notification-id', '/process/notifications', notificationNodeId);
  addDuplicateIdIssues(issues, model.process.stages.map((stage) => stage.id), 'duplicate-stage-id', '/process/stages', stageNodeId);
  addDuplicateIdIssues(issues, model.process.steps.map((step) => step.id), 'duplicate-step-id', '/process/steps', stepNodeId);
  addDuplicateIdIssues(issues, model.process.transitions.map((transition) => transition.id), 'duplicate-transition-id', '/process/transitions', transitionNodeId);
  addDuplicateIdIssues(issues, model.process.stepTransitions.map((transition) => transition.id), 'duplicate-step-transition-id', '/process/stepTransitions', stepTransitionNodeId);
  addDuplicateIdIssues(issues, model.process.outcomes.map((outcome) => outcome.id), 'duplicate-outcome-id', '/process/outcomes', outcomeNodeId);
  addDuplicateIdIssues(issues, model.forms.map((form) => form.id), 'duplicate-form-id', '/forms', formNodeId);
  addDuplicateIdIssues(issues, model.rules.map((rule) => rule.id), 'duplicate-rule-id', '/rules', ruleNodeId);
  addDuplicateIdIssues(issues, model.artifacts.map((artifact) => artifact.id), 'duplicate-artifact-id', '/artifacts', artifactNodeId);
  addDuplicateIdIssues(issues, model.metadata.entities.map((entity) => entity.id), 'duplicate-entity-id', '/metadata/entities', entityNodeId);
  addDuplicateIdIssues(issues, model.metadata.relationships.map((relationship) => relationship.id), 'duplicate-relationship-id', '/metadata/relationships', relationshipNodeId);

  const actorIds = new Set(model.process.actors.map((actor) => actor.id));
  const variableIds = new Set(model.process.variables.map((variable) => variable.id));
  const statusMap = new Map(model.process.statuses.map((status) => [status.id, status]));
  const taskIds = new Set(model.process.tasks.map((task) => task.id));
  const notificationIds = new Set(model.process.notifications.map((notification) => notification.id));
  const stageMap = new Map(model.process.stages.map((stage) => [stage.id, stage]));
  const stepMap = new Map(model.process.steps.map((step) => [step.id, step]));
  const stageIds = new Set(stageMap.keys());
  const stepIds = new Set(stepMap.keys());
  const formMap = new Map(model.forms.map((form) => [form.id, form]));
  const formIds = new Set(formMap.keys());
  const entityMap = new Map(model.metadata.entities.map((entity) => [entity.id, entity]));
  const entityIds = new Set(entityMap.keys());
  const relationshipMap = new Map(model.metadata.relationships.map((relationship) => [relationship.id, relationship]));
  const ruleIds = new Set(model.rules.map((rule) => rule.id));
  const outcomeIds = new Set(model.process.outcomes.map((outcome) => outcome.id));
  const startStages = model.process.stages.filter((stage) => stage.stageType === 'start');
  const formStateOwners = new Map<string, string>();
  const formStateNodeIds = new Map<string, string>();

  if (startStages.length !== 1) {
    issues.push(issue('error', 'invalid-start-stage-count', 'Exactly one start stage is required.', '/process/stages', PROCESS_NODE_ID));
  }

  model.metadata.entities.forEach((entity) => {
    addDuplicateIdIssues(issues, entity.fields.map((field) => field.id), 'duplicate-field-id', `/metadata/entities/${entity.id}/fields`, (fieldId) => fieldNodeId(entity.id, fieldId));

    if (!entity.fields.some((field) => field.id === entity.primaryKeyFieldId)) {
      issues.push(issue('error', 'missing-primary-key-field', `Entity '${entity.id}' primary key '${entity.primaryKeyFieldId}' was not found in its fields.`, `/metadata/entities/${entity.id}/primaryKeyFieldId`, entityNodeId(entity.id)));
    }
  });

  model.forms.forEach((form) => {
    addDuplicateIdIssues(issues, form.entityBindings.map((binding) => binding.id), 'duplicate-form-entity-binding-id', `/forms/${form.id}/entityBindings`, (bindingId) => formEntityBindingNodeId(form.id, bindingId));
    addDuplicateIdIssues(issues, form.layout.regions.map((region) => region.id), 'duplicate-region-id', `/forms/${form.id}/layout/regions`, (regionId) => regionNodeId(form.id, regionId));
    addDuplicateIdIssues(issues, form.elements.map((element) => element.id), 'duplicate-element-id', `/forms/${form.id}/elements`, (elementId) => elementNodeId(form.id, elementId));
    addDuplicateIdIssues(issues, form.formStates.map((state) => state.id), 'duplicate-form-state-id', `/forms/${form.id}/formStates`, (stateId) => formStateNodeId(form.id, stateId));

    if (!form.entityBindings.some((binding) => binding.id === form.primaryEntityBindingId)) {
      issues.push(issue('error', 'missing-primary-entity-binding', `Form '${form.id}' primaryEntityBindingId '${form.primaryEntityBindingId}' was not found.`, `/forms/${form.id}/primaryEntityBindingId`, formNodeId(form.id)));
    }

    const primaryBinding = form.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
    if (primaryBinding && primaryBinding.role !== 'primary') {
      issues.push(issue('error', 'invalid-primary-entity-binding-role', `Form '${form.id}' primaryEntityBindingId must reference a binding with role 'primary'.`, `/forms/${form.id}/primaryEntityBindingId`, formNodeId(form.id)));
    }

    form.formStates.forEach((state) => {
      if (formStateOwners.has(state.id)) {
        issues.push(issue('error', 'duplicate-global-form-state-id', `Form state '${state.id}' must be globally unique across forms.`, `/forms/${form.id}/formStates/${state.id}`, formStateNodeId(form.id, state.id)));
      } else {
        formStateOwners.set(state.id, form.id);
        formStateNodeIds.set(state.id, formStateNodeId(form.id, state.id));
      }
    });
  });

  model.process.stages.forEach((stage) => {
    if (!actorIds.has(stage.actorId)) {
      issues.push(issue('error', 'missing-stage-actor', `Stage '${stage.id}' references missing actor '${stage.actorId}'.`, `/process/stages/${stage.id}/actorId`, stageNodeId(stage.id)));
    }

    if (stage.stageType !== 'end' && stage.stepIds.length === 0) {
      issues.push(issue('error', 'missing-stage-steps', `Stage '${stage.id}' must include at least one step.`, `/process/stages/${stage.id}/stepIds`, stageNodeId(stage.id)));
    }

    if (stage.stageType !== 'end' && !stage.defaultStepId) {
      issues.push(issue('error', 'missing-stage-default-step', `Stage '${stage.id}' must define defaultStepId.`, `/process/stages/${stage.id}/defaultStepId`, stageNodeId(stage.id)));
    }

    if (stage.defaultStepId && !stage.stepIds.includes(stage.defaultStepId)) {
      issues.push(issue('error', 'invalid-stage-default-step', `Stage '${stage.id}' defaultStepId '${stage.defaultStepId}' is not listed in stepIds.`, `/process/stages/${stage.id}/defaultStepId`, stageNodeId(stage.id)));
    }

    if ((stage.stageType === 'start' || stage.stageType === 'task' || stage.stageType === 'approval' || stage.stepIds.length > 0) && !stage.formId && stage.stageType !== 'end') {
      issues.push(issue('error', 'missing-stage-form', `Stage '${stage.id}' requires a formId.`, `/process/stages/${stage.id}/formId`, stageNodeId(stage.id)));
    }

    if (stage.formId && !formIds.has(stage.formId)) {
      issues.push(issue('error', 'missing-stage-form-reference', `Stage '${stage.id}' references missing form '${stage.formId}'.`, `/process/stages/${stage.id}/formId`, stageNodeId(stage.id)));
    }

    const stageStepIds = new Set<string>();
    stage.stepIds.forEach((stepId) => {
      if (stageStepIds.has(stepId)) {
        issues.push(issue('error', 'duplicate-stage-step-membership', `Stage '${stage.id}' references step '${stepId}' more than once.`, `/process/stages/${stage.id}/stepIds`, stageNodeId(stage.id)));
        return;
      }

      stageStepIds.add(stepId);
      const step = stepMap.get(stepId);
      if (!step) {
        issues.push(issue('error', 'missing-stage-step-reference', `Stage '${stage.id}' references missing step '${stepId}'.`, `/process/stages/${stage.id}/stepIds`, stageNodeId(stage.id)));
        return;
      }

      if (step.stageId !== stage.id) {
        issues.push(issue('error', 'step-stage-mismatch', `Step '${step.id}' is listed under stage '${stage.id}' but belongs to stage '${step.stageId}'.`, `/process/stages/${stage.id}/stepIds`, stageNodeId(stage.id)));
      }
    });

    stage.allowedOutcomeIds.forEach((outcomeId) => {
      if (!outcomeIds.has(outcomeId)) {
        issues.push(issue('error', 'missing-stage-outcome-reference', `Stage '${stage.id}' references missing outcome '${outcomeId}'.`, `/process/stages/${stage.id}/allowedOutcomeIds`, stageNodeId(stage.id)));
      }
    });

    addMissingRuleIssues(issues, ruleIds, stage.entryRuleIds, 'missing-stage-rule-reference', `Stage '${stage.id}'`, `/process/stages/${stage.id}/entryRuleIds`, stageNodeId(stage.id));
    addMissingRuleIssues(issues, ruleIds, stage.exitRuleIds, 'missing-stage-rule-reference', `Stage '${stage.id}'`, `/process/stages/${stage.id}/exitRuleIds`, stageNodeId(stage.id));
  });

  model.process.steps.forEach((step) => {
    const stage = stageMap.get(step.stageId);
    if (!stage) {
      issues.push(issue('error', 'missing-step-stage', `Step '${step.id}' references missing stage '${step.stageId}'.`, `/process/steps/${step.id}/stageId`, stepNodeId(step.id)));
    } else if (!stage.stepIds.includes(step.id)) {
      issues.push(issue('error', 'step-not-linked-from-stage', `Step '${step.id}' belongs to stage '${stage.id}' but is not listed in stage.stepIds.`, `/process/steps/${step.id}/stageId`, stepNodeId(step.id)));
    }

    if (!actorIds.has(step.ownerActorId)) {
      issues.push(issue('error', 'missing-step-owner', `Step '${step.id}' references missing owner actor '${step.ownerActorId}'.`, `/process/steps/${step.id}/ownerActorId`, stepNodeId(step.id)));
    }

    if (step.taskId && !taskIds.has(step.taskId)) {
      issues.push(issue('error', 'missing-step-task', `Step '${step.id}' references missing task '${step.taskId}'.`, `/process/steps/${step.id}/taskId`, stepNodeId(step.id)));
    }

    if (step.notificationId && !notificationIds.has(step.notificationId)) {
      issues.push(issue('error', 'missing-step-notification', `Step '${step.id}' references missing notification '${step.notificationId}'.`, `/process/steps/${step.id}/notificationId`, stepNodeId(step.id)));
    }

    const internalStatus = statusMap.get(step.internalStatusId);
    if (!internalStatus) {
      issues.push(issue('error', 'missing-step-internal-status', `Step '${step.id}' references missing internal status '${step.internalStatusId}'.`, `/process/steps/${step.id}/internalStatusId`, stepNodeId(step.id)));
    } else if (!isInternalStatus(internalStatus)) {
      issues.push(issue('error', 'invalid-step-internal-status', `Step '${step.id}' internalStatusId must reference an internal or shared status.`, `/process/steps/${step.id}/internalStatusId`, stepNodeId(step.id)));
    }

    if (step.portalStatusId) {
      const portalStatus = statusMap.get(step.portalStatusId);
      if (!portalStatus) {
        issues.push(issue('error', 'missing-step-portal-status', `Step '${step.id}' references missing portal status '${step.portalStatusId}'.`, `/process/steps/${step.id}/portalStatusId`, stepNodeId(step.id)));
      } else if (!isPortalVisibleStatus(portalStatus)) {
        issues.push(issue('error', 'invalid-step-portal-status', `Step '${step.id}' portalStatusId must reference a portal or shared status.`, `/process/steps/${step.id}/portalStatusId`, stepNodeId(step.id)));
      }
    }

    if (step.formStateId) {
      const owningFormId = formStateOwners.get(step.formStateId);
      if (!owningFormId) {
        issues.push(issue('error', 'missing-step-form-state', `Step '${step.id}' references missing form state '${step.formStateId}'.`, `/process/steps/${step.id}/formStateId`, stepNodeId(step.id)));
      } else if (stage?.formId !== owningFormId) {
        issues.push(issue('error', 'step-form-state-form-mismatch', `Step '${step.id}' formStateId '${step.formStateId}' must belong to stage form '${stage?.formId ?? '(none)'}'.`, `/process/steps/${step.id}/formStateId`, stepNodeId(step.id)));
      }
    }

    addMissingRuleIssues(issues, ruleIds, step.entryRuleIds, 'missing-step-rule-reference', `Step '${step.id}'`, `/process/steps/${step.id}/entryRuleIds`, stepNodeId(step.id));
    addMissingRuleIssues(issues, ruleIds, step.exitRuleIds, 'missing-step-rule-reference', `Step '${step.id}'`, `/process/steps/${step.id}/exitRuleIds`, stepNodeId(step.id));
  });

  model.process.transitions.forEach((transition) => {
    if (!stageIds.has(transition.fromStageId)) {
      issues.push(issue('error', 'missing-transition-source', `Transition '${transition.id}' references missing source stage '${transition.fromStageId}'.`, `/process/transitions/${transition.id}/fromStageId`, transitionNodeId(transition.id)));
    }

    if (!stageIds.has(transition.toStageId)) {
      issues.push(issue('error', 'missing-transition-target', `Transition '${transition.id}' references missing target stage '${transition.toStageId}'.`, `/process/transitions/${transition.id}/toStageId`, transitionNodeId(transition.id)));
    }

    if (!outcomeIds.has(transition.outcomeId)) {
      issues.push(issue('error', 'missing-transition-outcome', `Transition '${transition.id}' references missing outcome '${transition.outcomeId}'.`, `/process/transitions/${transition.id}/outcomeId`, transitionNodeId(transition.id)));
    }

    const guardRule = findRule(model.rules, transition.guardRuleId);
    if (!guardRule) {
      issues.push(issue('error', 'missing-transition-guard', `Transition '${transition.id}' references missing guard rule '${transition.guardRuleId}'.`, `/process/transitions/${transition.id}/guardRuleId`, transitionNodeId(transition.id)));
    } else if (guardRule.ruleType !== 'condition' && guardRule.ruleType !== 'validation') {
      issues.push(issue('warning', 'non-condition-transition-guard', `Transition '${transition.id}' uses '${guardRule.ruleType}' as its guard rule. Condition or validation rules are preferred.`, `/process/transitions/${transition.id}/guardRuleId`, transitionNodeId(transition.id)));
    }
  });

  model.process.stepTransitions.forEach((transition) => {
    if (!stepIds.has(transition.fromStepId)) {
      issues.push(issue('error', 'missing-step-transition-source', `Step transition '${transition.id}' references missing step '${transition.fromStepId}'.`, `/process/stepTransitions/${transition.id}/fromStepId`, stepTransitionNodeId(transition.id)));
    }

    const targetCheck = validateStepTransitionTarget(transition, stepIds, stageIds, outcomeIds);
    if (!targetCheck.valid) {
      issues.push(issue('error', 'missing-step-transition-target', `Step transition '${transition.id}' references ${targetCheck.message}.`, `/process/stepTransitions/${transition.id}/target`, stepTransitionNodeId(transition.id)));
    }

    const guardRule = findRule(model.rules, transition.guardRuleId);
    if (!guardRule) {
      issues.push(issue('error', 'missing-step-transition-guard', `Step transition '${transition.id}' references missing guard rule '${transition.guardRuleId}'.`, `/process/stepTransitions/${transition.id}/guardRuleId`, stepTransitionNodeId(transition.id)));
    } else if (guardRule.ruleType !== 'condition' && guardRule.ruleType !== 'validation') {
      issues.push(issue('warning', 'non-condition-step-transition-guard', `Step transition '${transition.id}' uses '${guardRule.ruleType}' as its guard rule. Condition or validation rules are preferred.`, `/process/stepTransitions/${transition.id}/guardRuleId`, stepTransitionNodeId(transition.id)));
    }
  });

  model.forms.forEach((form) => {
    const regionIds = new Set(form.layout.regions.map((region) => region.id));
    const bindingMap = new Map(form.entityBindings.map((binding) => [binding.id, binding]));

    form.entityBindings.forEach((binding) => {
      if (!entityIds.has(binding.entityId)) {
        issues.push(issue('error', 'missing-form-entity-binding-entity', `Form '${form.id}' binding '${binding.id}' references missing entity '${binding.entityId}'.`, `/forms/${form.id}/entityBindings/${binding.id}/entityId`, formEntityBindingNodeId(form.id, binding.id)));
      }

      if (binding.role === 'primary' && binding.relationshipId) {
        issues.push(issue('error', 'invalid-primary-form-binding-relationship', `Form '${form.id}' primary binding '${binding.id}' must not specify relationshipId.`, `/forms/${form.id}/entityBindings/${binding.id}/relationshipId`, formEntityBindingNodeId(form.id, binding.id)));
      }

      if (binding.role === 'related') {
        if (!binding.relationshipId) {
          issues.push(issue('error', 'missing-related-form-binding-relationship', `Form '${form.id}' related binding '${binding.id}' requires relationshipId.`, `/forms/${form.id}/entityBindings/${binding.id}/relationshipId`, formEntityBindingNodeId(form.id, binding.id)));
        } else {
          const relationship = relationshipMap.get(binding.relationshipId);
          if (!relationship) {
            issues.push(issue('error', 'missing-form-binding-relationship', `Form '${form.id}' binding '${binding.id}' references missing relationship '${binding.relationshipId}'.`, `/forms/${form.id}/entityBindings/${binding.id}/relationshipId`, formEntityBindingNodeId(form.id, binding.id)));
          } else if (relationship.fromEntityId !== binding.entityId && relationship.toEntityId !== binding.entityId) {
            issues.push(issue('error', 'form-binding-relationship-entity-mismatch', `Form '${form.id}' binding '${binding.id}' uses relationship '${binding.relationshipId}' that does not include entity '${binding.entityId}'.`, `/forms/${form.id}/entityBindings/${binding.id}/relationshipId`, formEntityBindingNodeId(form.id, binding.id)));
          }
        }
      }
    });

    form.elements.forEach((element) => {
      if (!regionIds.has(element.regionId)) {
        issues.push(issue('error', 'missing-element-region', `Element '${element.id}' references missing region '${element.regionId}'.`, `/forms/${form.id}/elements/${element.id}/regionId`, elementNodeId(form.id, element.id)));
      }

      if ('entityBindingId' in element.binding) {
        const entityBinding = bindingMap.get(element.binding.entityBindingId);
        if (!entityBinding) {
          issues.push(issue('error', 'missing-element-entity-binding', `Element '${element.id}' references missing entity binding '${element.binding.entityBindingId}'.`, `/forms/${form.id}/elements/${element.id}/binding/entityBindingId`, elementNodeId(form.id, element.id)));
        } else if (!findFieldEntity(model.metadata.entities, entityBinding.entityId, element.binding.fieldId)) {
          issues.push(issue('error', 'missing-element-field-binding', `Element '${element.id}' references missing field '${element.binding.fieldId}' on entity '${entityBinding.entityId}'.`, `/forms/${form.id}/elements/${element.id}/binding/fieldId`, elementNodeId(form.id, element.id)));
        }
      }

      if ('variableId' in element.binding && !variableIds.has(element.binding.variableId)) {
        issues.push(issue('error', 'missing-element-variable-binding', `Element '${element.id}' references missing variable '${element.binding.variableId}'.`, `/forms/${form.id}/elements/${element.id}/binding/variableId`, elementNodeId(form.id, element.id)));
      }

      addMissingRuleIssues(issues, ruleIds, element.behavior.requiredRuleIds, 'missing-element-rule-reference', `Element '${element.id}'`, `/forms/${form.id}/elements/${element.id}/behavior/requiredRuleIds`, elementNodeId(form.id, element.id));
      addMissingRuleIssues(issues, ruleIds, element.behavior.visibleRuleIds, 'missing-element-rule-reference', `Element '${element.id}'`, `/forms/${form.id}/elements/${element.id}/behavior/visibleRuleIds`, elementNodeId(form.id, element.id));
      addMissingRuleIssues(issues, ruleIds, element.behavior.editableRuleIds, 'missing-element-rule-reference', `Element '${element.id}'`, `/forms/${form.id}/elements/${element.id}/behavior/editableRuleIds`, elementNodeId(form.id, element.id));
    });

    form.formStates.forEach((state) => {
      addMissingRuleIssues(issues, ruleIds, state.activationRuleIds, 'missing-form-state-rule-reference', `Form state '${state.id}'`, `/forms/${form.id}/formStates/${state.id}/activationRuleIds`, formStateNodeId(form.id, state.id));

      state.visibleEntityBindingIds.forEach((bindingId) => {
        if (!bindingMap.has(bindingId)) {
          issues.push(issue('error', 'missing-form-state-entity-binding', `Form state '${state.id}' references missing entity binding '${bindingId}'.`, `/forms/${form.id}/formStates/${state.id}/visibleEntityBindingIds`, formStateNodeId(form.id, state.id)));
        }
      });

      const behaviorIds = new Set<string>();
      state.elementBehaviors.forEach((behavior) => {
        if (behaviorIds.has(behavior.elementId)) {
          issues.push(issue('error', 'duplicate-form-state-element-behavior', `Form state '${state.id}' references element '${behavior.elementId}' more than once.`, `/forms/${form.id}/formStates/${state.id}/elementBehaviors`, formStateNodeId(form.id, state.id)));
          return;
        }
        behaviorIds.add(behavior.elementId);

        if (!form.elements.some((element) => element.id === behavior.elementId)) {
          issues.push(issue('error', 'missing-form-state-element', `Form state '${state.id}' references missing element '${behavior.elementId}'.`, `/forms/${form.id}/formStates/${state.id}/elementBehaviors`, formStateNodeId(form.id, state.id)));
        }

        addMissingRuleIssues(issues, ruleIds, behavior.requiredRuleIds, 'missing-form-state-rule-reference', `Form state '${state.id}'`, `/forms/${form.id}/formStates/${state.id}/elementBehaviors`, formStateNodeId(form.id, state.id));
        addMissingRuleIssues(issues, ruleIds, behavior.visibleRuleIds, 'missing-form-state-rule-reference', `Form state '${state.id}'`, `/forms/${form.id}/formStates/${state.id}/elementBehaviors`, formStateNodeId(form.id, state.id));
        addMissingRuleIssues(issues, ruleIds, behavior.editableRuleIds, 'missing-form-state-rule-reference', `Form state '${state.id}'`, `/forms/${form.id}/formStates/${state.id}/elementBehaviors`, formStateNodeId(form.id, state.id));
      });
    });
  });

  model.metadata.relationships.forEach((relationship) => {
    if (!entityIds.has(relationship.fromEntityId)) {
      issues.push(issue('error', 'missing-relationship-source', `Relationship '${relationship.id}' references missing entity '${relationship.fromEntityId}'.`, `/metadata/relationships/${relationship.id}/fromEntityId`, relationshipNodeId(relationship.id)));
    }

    if (!entityIds.has(relationship.toEntityId)) {
      issues.push(issue('error', 'missing-relationship-target', `Relationship '${relationship.id}' references missing entity '${relationship.toEntityId}'.`, `/metadata/relationships/${relationship.id}/toEntityId`, relationshipNodeId(relationship.id)));
    }
  });

  model.rules.forEach((rule) => {
    if (rule.language !== 'javascript-artifact-v1') {
      return;
    }

    const artifactMatch = /^artifact:(?<artifactId>[a-z0-9-]+)$/i.exec(rule.body.trim());
    if (!artifactMatch?.groups?.artifactId) {
      issues.push(issue('error', 'invalid-artifact-rule-body', `Rule '${rule.id}' must use 'artifact:<artifact-id>' syntax.`, `/rules/${rule.id}/body`, ruleNodeId(rule.id)));
      return;
    }

    if (!findArtifact(model.artifacts, artifactMatch.groups.artifactId)) {
      issues.push(issue('error', 'missing-rule-artifact', `Rule '${rule.id}' references missing artifact '${artifactMatch.groups.artifactId}'.`, `/rules/${rule.id}/body`, ruleNodeId(rule.id)));
    }
  });

  model.artifacts.forEach((artifact) => {
    artifact.runtimeTargets.forEach((target) => {
      if (!model.package.supportedRuntimes.includes(target)) {
        issues.push(issue('warning', 'artifact-runtime-outside-package', `Artifact '${artifact.id}' targets '${target}', which is not listed in package.supportedRuntimes.`, `/artifacts/${artifact.id}/runtimeTargets`, artifactNodeId(artifact.id)));
      }
    });
  });

  if (model.runtime.requestContract.schemaVersion !== 'dbm.runtime.request/v1') {
    issues.push(issue('error', 'invalid-runtime-request-version', 'runtime.requestContract.schemaVersion must remain dbm.runtime.request/v1.', '/runtime/requestContract/schemaVersion', RUNTIME_NODE_ID));
  }

  if (model.runtime.resultContract.schemaVersion !== 'dbm.runtime.result/v1') {
    issues.push(issue('error', 'invalid-runtime-result-version', 'runtime.resultContract.schemaVersion must remain dbm.runtime.result/v1.', '/runtime/resultContract/schemaVersion', RUNTIME_NODE_ID));
  }

  if (model.runtime.ownership.azure.responsibilities.length !== 1 || model.runtime.ownership.azure.responsibilities[0] !== 'support-services-only') {
    issues.push(issue('error', 'invalid-azure-ownership', 'Azure ownership must remain support-services-only in R1.2.1.', '/runtime/ownership/azure', RUNTIME_NODE_ID));
  }

  return issues;
}

export function validateDocument(document: DesignerDocument): DesignerIssue[] {
  return validateModel(document.model);
}
