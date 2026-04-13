import Ajv from 'ajv';
import type { DbmArtifactV1, DbmEntityV1, DbmModelV1, DbmRuleV1 } from 'dbm-contract';
import modelSchema from '../../dbm-contract/schema/dbm-model-v1.schema.json';
import {
  actorNodeId,
  artifactNodeId,
  elementNodeId,
  entityNodeId,
  fieldNodeId,
  formNodeId,
  outcomeNodeId,
  PACKAGE_NODE_ID,
  PROCESS_NODE_ID,
  regionNodeId,
  relationshipNodeId,
  ruleNodeId,
  RUNTIME_NODE_ID,
  stageNodeId,
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

function findFieldEntity(entities: DbmEntityV1[], fieldId: string): DbmEntityV1 | undefined {
  return entities.find((entity) => entity.fields.some((field) => field.id === fieldId));
}

function findRule(rules: DbmRuleV1[], ruleId: string): DbmRuleV1 | undefined {
  return rules.find((rule) => rule.id === ruleId);
}

function findArtifact(artifacts: DbmArtifactV1[], artifactId: string): DbmArtifactV1 | undefined {
  return artifacts.find((artifact) => artifact.id === artifactId);
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
    issues.push(issue('error', 'unsupported-scenario-type', 'R1.2 only supports approval-request scenarios.', '/process/scenarioType', PROCESS_NODE_ID));
  }

  addDuplicateIdIssues(issues, model.process.actors.map((actor) => actor.id), 'duplicate-actor-id', '/process/actors', actorNodeId);
  addDuplicateIdIssues(issues, model.process.variables.map((variable) => variable.id), 'duplicate-variable-id', '/process/variables', variableNodeId);
  addDuplicateIdIssues(issues, model.process.stages.map((stage) => stage.id), 'duplicate-stage-id', '/process/stages', stageNodeId);
  addDuplicateIdIssues(issues, model.process.transitions.map((transition) => transition.id), 'duplicate-transition-id', '/process/transitions', transitionNodeId);
  addDuplicateIdIssues(issues, model.process.outcomes.map((outcome) => outcome.id), 'duplicate-outcome-id', '/process/outcomes', outcomeNodeId);
  addDuplicateIdIssues(issues, model.forms.map((form) => form.id), 'duplicate-form-id', '/forms', formNodeId);
  addDuplicateIdIssues(issues, model.rules.map((rule) => rule.id), 'duplicate-rule-id', '/rules', ruleNodeId);
  addDuplicateIdIssues(issues, model.artifacts.map((artifact) => artifact.id), 'duplicate-artifact-id', '/artifacts', artifactNodeId);
  addDuplicateIdIssues(issues, model.metadata.entities.map((entity) => entity.id), 'duplicate-entity-id', '/metadata/entities', entityNodeId);
  addDuplicateIdIssues(issues, model.metadata.relationships.map((relationship) => relationship.id), 'duplicate-relationship-id', '/metadata/relationships', relationshipNodeId);

  const actorIds = new Set(model.process.actors.map((actor) => actor.id));
  const variableIds = new Set(model.process.variables.map((variable) => variable.id));
  const stageIds = new Set(model.process.stages.map((stage) => stage.id));
  const formIds = new Set(model.forms.map((form) => form.id));
  const entityIds = new Set(model.metadata.entities.map((entity) => entity.id));
  const ruleIds = new Set(model.rules.map((rule) => rule.id));
  const startStages = model.process.stages.filter((stage) => stage.stageType === 'start');

  if (startStages.length !== 1) {
    issues.push(issue('error', 'invalid-start-stage-count', 'Exactly one start stage is required.', '/process/stages', PROCESS_NODE_ID));
  }

  model.process.stages.forEach((stage) => {
    if (!actorIds.has(stage.actorId)) {
      issues.push(issue('error', 'missing-stage-actor', `Stage '${stage.id}' references missing actor '${stage.actorId}'.`, `/process/stages/${stage.id}/actorId`, stageNodeId(stage.id)));
    }

    if ((stage.stageType === 'task' || stage.stageType === 'approval') && !stage.formId) {
      issues.push(issue('error', 'missing-stage-form', `Stage '${stage.id}' requires a formId.`, `/process/stages/${stage.id}/formId`, stageNodeId(stage.id)));
    }

    if (stage.formId && !formIds.has(stage.formId)) {
      issues.push(issue('error', 'missing-stage-form-reference', `Stage '${stage.id}' references missing form '${stage.formId}'.`, `/process/stages/${stage.id}/formId`, stageNodeId(stage.id)));
    }

    [...stage.entryRuleIds, ...stage.exitRuleIds].forEach((ruleId) => {
      if (!ruleIds.has(ruleId)) {
        issues.push(issue('error', 'missing-stage-rule-reference', `Stage '${stage.id}' references missing rule '${ruleId}'.`, `/process/stages/${stage.id}`, stageNodeId(stage.id)));
      }
    });
  });

  model.process.transitions.forEach((transition) => {
    if (!stageIds.has(transition.fromStageId)) {
      issues.push(issue('error', 'missing-transition-source', `Transition '${transition.id}' references missing source stage '${transition.fromStageId}'.`, `/process/transitions/${transition.id}/fromStageId`, transitionNodeId(transition.id)));
    }

    if (!stageIds.has(transition.toStageId)) {
      issues.push(issue('error', 'missing-transition-target', `Transition '${transition.id}' references missing target stage '${transition.toStageId}'.`, `/process/transitions/${transition.id}/toStageId`, transitionNodeId(transition.id)));
    }

    const guardRule = findRule(model.rules, transition.guardRuleId);
    if (!guardRule) {
      issues.push(issue('error', 'missing-transition-guard', `Transition '${transition.id}' references missing guard rule '${transition.guardRuleId}'.`, `/process/transitions/${transition.id}/guardRuleId`, transitionNodeId(transition.id)));
    } else if (guardRule.ruleType !== 'condition') {
      issues.push(issue(guardRule.ruleType === 'validation' ? 'warning' : 'error', 'non-condition-transition-guard', `Transition '${transition.id}' uses '${guardRule.ruleType}' as its guard rule. Condition rules are preferred.`, `/process/transitions/${transition.id}/guardRuleId`, transitionNodeId(transition.id)));
    }
  });

  model.forms.forEach((form) => {
    if (!entityIds.has(form.entityId)) {
      issues.push(issue('error', 'missing-form-entity', `Form '${form.id}' references missing entity '${form.entityId}'.`, `/forms/${form.id}/entityId`, formNodeId(form.id)));
    }

    addDuplicateIdIssues(issues, form.layout.regions.map((region) => region.id), 'duplicate-region-id', `/forms/${form.id}/layout/regions`, (regionId) => regionNodeId(form.id, regionId));
    addDuplicateIdIssues(issues, form.elements.map((element) => element.id), 'duplicate-element-id', `/forms/${form.id}/elements`, (elementId) => elementNodeId(form.id, elementId));

    const regionIds = new Set(form.layout.regions.map((region) => region.id));
    form.elements.forEach((element) => {
      if (!regionIds.has(element.regionId)) {
        issues.push(issue('error', 'missing-element-region', `Element '${element.id}' references missing region '${element.regionId}'.`, `/forms/${form.id}/elements/${element.id}/regionId`, elementNodeId(form.id, element.id)));
      }

      if ('fieldId' in element.binding) {
        if (!findFieldEntity(model.metadata.entities, element.binding.fieldId)) {
          issues.push(issue('error', 'missing-element-field-binding', `Element '${element.id}' references missing field '${element.binding.fieldId}'.`, `/forms/${form.id}/elements/${element.id}/binding/fieldId`, elementNodeId(form.id, element.id)));
        }
      }

      if ('variableId' in element.binding && !variableIds.has(element.binding.variableId)) {
        issues.push(issue('error', 'missing-element-variable-binding', `Element '${element.id}' references missing variable '${element.binding.variableId}'.`, `/forms/${form.id}/elements/${element.id}/binding/variableId`, elementNodeId(form.id, element.id)));
      }

      [...element.behavior.requiredRuleIds, ...element.behavior.visibleRuleIds, ...element.behavior.editableRuleIds].forEach((ruleId) => {
        if (!ruleIds.has(ruleId)) {
          issues.push(issue('error', 'missing-element-rule-reference', `Element '${element.id}' references missing rule '${ruleId}'.`, `/forms/${form.id}/elements/${element.id}`, elementNodeId(form.id, element.id)));
        }
      });
    });
  });

  model.metadata.entities.forEach((entity) => {
    addDuplicateIdIssues(issues, entity.fields.map((field) => field.id), 'duplicate-field-id', `/metadata/entities/${entity.id}/fields`, (fieldId) => fieldNodeId(entity.id, fieldId));

    if (!entity.fields.some((field) => field.id === entity.primaryKeyFieldId)) {
      issues.push(issue('error', 'missing-primary-key-field', `Entity '${entity.id}' primary key '${entity.primaryKeyFieldId}' was not found in its fields.`, `/metadata/entities/${entity.id}/primaryKeyFieldId`, entityNodeId(entity.id)));
    }
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
    issues.push(issue('error', 'invalid-azure-ownership', 'Azure ownership must remain support-services-only in R1.2.', '/runtime/ownership/azure', RUNTIME_NODE_ID));
  }

  return issues;
}

export function validateDocument(document: DesignerDocument): DesignerIssue[] {
  return validateModel(document.model);
}
