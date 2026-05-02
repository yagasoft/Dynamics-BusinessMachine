export type DbmSchemaVersionV1 = 'dbm.model/v1';
export type DbmDesignerWorkspaceSchemaVersionV1 = 'dbm.designer.workspace/v1';
export type DbmDesignerGraphDocumentSchemaVersionV1 = 'dbm.designer.graph-document/v1';
export type DbmProcessExperienceSnapshotSchemaVersionV1 = 'dbm.process-experience.snapshot/v1';
export type DbmProcessPortfolioProjectionSchemaVersionV1 = 'dbm.process-portfolio.projection/v1';
export type DbmRuntimeRequestSchemaVersionV1 = 'dbm.runtime.request/v1';
export type DbmRuntimeResultSchemaVersionV1 = 'dbm.runtime.result/v1';
export type DbmPortalRuntimeBootstrapSchemaVersionV1 = 'dbm.portal-runtime.bootstrap/v1';

export type DbmSupportedHostV1 = 'model-driven' | 'xrmtoolbox' | 'external-runtime';
export type DbmRuntimeEngineV1 = 'pcf' | 'dataverse' | 'azure';
export type DbmPortalIdentityModeV1 = 'generic-profile';
export type DbmPortalAllowedActionV1 = 'create-draft' | 'submit-request' | 'refresh-status';
export type DbmPortalRuntimeEntryFieldDataTypeV1 =
  | 'string'
  | 'multiline-string'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'date';

export type DbmActorTypeV1 = 'requester' | 'approver' | 'system';
export type DbmActorSourceV1 = 'current-user' | 'field-binding' | 'rule-derived' | 'system';
export type DbmVariableScopeV1 = 'process';
export type DbmVariablePersistenceV1 = 'runtime-only' | 'persisted';

export type DbmStageTypeV1 = 'start' | 'task' | 'approval' | 'system' | 'end';
export type DbmStagePortalVisibilityV1 = 'visible' | 'hidden';
export type DbmProcessRoleV1 = 'main' | 'sub-process';
export type DbmStageScopeV1 = 'portal' | 'back-office' | 'shared';
export type DbmProcessPortfolioProjectionAudienceV1 = 'form' | 'portal';
export type DbmMainProcessDisplayModeV1 = 'expanded' | 'collapsed';

export type DbmStepTypeV1 = 'data-entry' | 'review' | 'approval' | 'system';

export type DbmStatusAudienceV1 = 'internal' | 'portal' | 'shared';
export type DbmStatusKindV1 = 'progress' | 'decision' | 'terminal';

export type DbmTaskTypeV1 = 'data-entry' | 'review' | 'approval' | 'system';
export type DbmNotificationChannelV1 = 'in-app' | 'email' | 'both';

export type DbmElementTypeV1 =
  | 'text'
  | 'multiline-text'
  | 'number'
  | 'currency'
  | 'choice'
  | 'lookup'
  | 'date'
  | 'read-only-text';

export type DbmFieldDataTypeV1 =
  | 'string'
  | 'multiline-string'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'boolean'
  | 'choice'
  | 'lookup'
  | 'date'
  | 'datetime';

export type DbmRelationshipTypeV1 = 'one-to-many' | 'many-to-one';
export type DbmRuleTypeV1 = 'condition' | 'validation' | 'derivation' | 'action';
export type DbmRuleScopeV1 =
  | 'process'
  | 'stage'
  | 'step'
  | 'transition'
  | 'step-transition'
  | 'form'
  | 'form-state'
  | 'field';
export type DbmRuleLanguageV1 = 'dbm-expression-v1' | 'javascript-artifact-v1';

export type DbmRuntimeCapabilityV1 =
  | 'load-record'
  | 'render-form'
  | 'validate-input'
  | 'evaluate-rules'
  | 'persist-record'
  | 'advance-stage'
  | 'invoke-artifact'
  | 'emit-notification';

export type DbmRuntimeOperationV1 = 'initialize' | 'load-form' | 'validate' | 'submit' | 'transition';
export type DbmRuntimeStatusV1 = 'ok' | 'validation-failed' | 'blocked' | 'error';

export type DbmArtifactTypeV1 =
  | 'script'
  | 'template'
  | 'static-asset'
  | 'pcf-control'
  | 'plugin-assembly'
  | 'config';

export type DbmPackagingTargetV1 = 'dataverse-webresource' | 'dataverse-plugin' | 'repo-only' | 'azure-app';
export type DbmLayoutTypeV1 = 'single-page';
export type DbmBreakingChangePolicyV1 = 'reject-newer-major';
export type DbmDesignerPreviewModeV1 = 'internal' | 'portal';
export type DbmDesignerGraphGroupKindV1 = 'actor-lane';
export type DbmDesignerGraphNodeKindV1 = 'stage' | 'step' | 'outcome';
export type DbmDesignerGraphEdgeKindV1 = 'stage-transition' | 'step-transition';
export type DbmDesignerGraphPortDirectionV1 = 'in' | 'out';
export type DbmDesignerGraphPortRoleV1 = 'primary-in' | 'primary-out' | 'outcome';
export type DbmProcessExperienceAudienceV1 = 'internal' | 'portal';
export type DbmProcessExperienceItemStateV1 = 'completed' | 'current' | 'available' | 'upcoming';
export type DbmProcessExperienceVisibilityV1 = 'visible' | 'collapsed-hidden';

export type DbmFormEntityBindingRoleV1 = 'primary' | 'related';
export type DbmSubjectRecordRoleV1 = 'primary' | 'related';
export type DbmSubjectResolutionStrategyV1 = 'reuse-current-primary' | 'select-existing-related' | 'create-related';

export type DbmScalarValueV1 = string | number | boolean | null;

export interface DbmPublisherV1 {
  name: string;
  website: string;
  prefix: string;
}

export interface DbmPackageCompatibilityV1 {
  minimumReaderSchemaVersion: DbmSchemaVersionV1;
  maximumReaderSchemaVersion: DbmSchemaVersionV1;
  breakingChangePolicy: DbmBreakingChangePolicyV1;
}

export interface DbmPackageDeploymentV1 {
  solutionName: string;
  releaseLine: string;
  artifactRoot: string;
}

export interface DbmPackageV1 {
  id: string;
  displayName: string;
  version: string;
  publisher: DbmPublisherV1;
  entryProcessId: string;
  supportedHosts: DbmSupportedHostV1[];
  supportedRuntimes: DbmRuntimeEngineV1[];
  processUiSurfaces: DbmSupportedHostV1[];
  exposesPortalState: boolean;
  ownsGeneratedDataverseArtifacts: boolean;
  compatibility: DbmPackageCompatibilityV1;
  deployment: DbmPackageDeploymentV1;
}

export interface DbmActorV1 {
  id: string;
  displayName: string;
  actorType: DbmActorTypeV1;
  source: DbmActorSourceV1;
}

export interface DbmVariableV1 {
  id: string;
  dataType: DbmFieldDataTypeV1;
  scope: DbmVariableScopeV1;
  defaultValue: DbmScalarValueV1;
  persistence: DbmVariablePersistenceV1;
}

export interface DbmStatusV1 {
  id: string;
  displayName: string;
  audience: DbmStatusAudienceV1;
  kind: DbmStatusKindV1;
}

export interface DbmTaskDefinitionV1 {
  id: string;
  displayName: string;
  taskType: DbmTaskTypeV1;
  instructions: string | null;
}

export interface DbmNotificationDefinitionV1 {
  id: string;
  displayName: string;
  channel: DbmNotificationChannelV1;
  templateRef: string;
}

export interface DbmStageSpanAnchorV1 {
  stageId: string;
  fraction: number;
}

export interface DbmStageSpanV1 {
  start: DbmStageSpanAnchorV1;
  end: DbmStageSpanAnchorV1;
}

export interface DbmStageV1 {
  id: string;
  displayName: string;
  stageType: DbmStageTypeV1;
  scope: DbmStageScopeV1;
  stageSpan: DbmStageSpanV1;
  actorId: string;
  formId: string | null;
  portalVisibility: DbmStagePortalVisibilityV1;
  statusId: string;
  portalStatusId: string | null;
  stepIds: string[];
  defaultStepId: string | null;
  entryRuleIds: string[];
  exitRuleIds: string[];
  allowedOutcomeIds: string[];
}

export interface DbmStepV1 {
  id: string;
  stageId: string;
  displayName: string;
  stepType: DbmStepTypeV1;
  ownerActorId: string;
  notificationId: string | null;
  taskId: string | null;
  internalStatusId: string;
  portalStatusId: string | null;
  formStateId: string | null;
  entryRuleIds: string[];
  exitRuleIds: string[];
}

export interface DbmSubjectHandoffV1 {
  strategy: DbmSubjectResolutionStrategyV1;
  relationshipId: string | null;
}

export interface DbmTransitionV1 {
  id: string;
  fromStageId: string;
  toStageId: string;
  outcomeId: string;
  guardRuleId: string;
  subjectHandoff?: DbmSubjectHandoffV1 | null;
}

export type DbmStepTransitionTargetV1 = { stepId: string } | { stageId: string } | { outcomeId: string };

export interface DbmStepTransitionV1 {
  id: string;
  fromStepId: string;
  guardRuleId: string;
  target: DbmStepTransitionTargetV1;
  subjectHandoff?: DbmSubjectHandoffV1 | null;
}

export interface DbmOutcomeV1 {
  id: string;
  displayName: string;
}

export interface DbmSubProcessVisibilityRuleV1 {
  audience: DbmProcessPortfolioProjectionAudienceV1;
  ruleId: string | null;
  visibleWhen: boolean;
}

export interface DbmProcessV1 {
  id: string;
  displayName: string;
  role: DbmProcessRoleV1;
  scenarioType: string;
  mainDisplayMode: DbmMainProcessDisplayModeV1;
  statusId: string;
  portalStatusId: string | null;
  renderOrder?: number;
  subProcessVisibility?: DbmSubProcessVisibilityRuleV1[];
  actors: DbmActorV1[];
  variables: DbmVariableV1[];
  statuses: DbmStatusV1[];
  tasks: DbmTaskDefinitionV1[];
  notifications: DbmNotificationDefinitionV1[];
  stages: DbmStageV1[];
  steps: DbmStepV1[];
  transitions: DbmTransitionV1[];
  stepTransitions: DbmStepTransitionV1[];
  outcomes: DbmOutcomeV1[];
}

export interface DbmProcessPortfolioV1 {
  mainProcessId: string;
  processes: DbmProcessV1[];
}

export interface DbmLayoutRegionV1 {
  id: string;
  displayName: string;
  order: number;
  providerBindings?: DbmProviderBindingsV1;
}

export interface DbmFormLayoutV1 {
  layoutType: DbmLayoutTypeV1;
  regions: DbmLayoutRegionV1[];
}

export interface DbmFormEntityBindingV1 {
  id: string;
  displayName: string;
  entityId: string;
  relationshipId: string | null;
  role: DbmFormEntityBindingRoleV1;
}

export type DbmElementBindingV1 = { entityBindingId: string; fieldId: string } | { variableId: string };

export interface DbmElementBehaviorV1 {
  requiredRuleIds: string[];
  visibleRuleIds: string[];
  editableRuleIds: string[];
}

export interface DbmFormElementV1 {
  id: string;
  elementType: DbmElementTypeV1;
  regionId: string;
  displayName: string;
  binding: DbmElementBindingV1;
  behavior: DbmElementBehaviorV1;
  providerBindings?: DbmProviderBindingsV1;
}

export interface DbmFormStateElementBehaviorV1 {
  elementId: string;
  label: string | null;
  hint: string | null;
  requiredRuleIds: string[];
  visibleRuleIds: string[];
  editableRuleIds: string[];
}

export interface DbmFormStateV1 {
  id: string;
  displayName: string;
  activationRuleIds: string[];
  visibleEntityBindingIds: string[];
  elementBehaviors: DbmFormStateElementBehaviorV1[];
}

export interface DbmFormV1 {
  id: string;
  displayName: string;
  primaryEntityBindingId: string;
  entityBindings: DbmFormEntityBindingV1[];
  layout: DbmFormLayoutV1;
  elements: DbmFormElementV1[];
  formStates: DbmFormStateV1[];
  providerBindings?: DbmProviderBindingsV1;
}

export interface DbmDataverseBindingV1 {
  logicalName?: string;
  formId?: string;
  tabName?: string;
  sectionName?: string;
  controlName?: string;
}

export interface DbmProviderBindingsV1 {
  dataverse?: DbmDataverseBindingV1;
}

export interface DbmChoiceOptionV1 {
  id: string;
  displayName: string;
  value: number;
}

export interface DbmFieldV1 {
  id: string;
  displayName: string;
  dataType: DbmFieldDataTypeV1;
  providerBindings: DbmProviderBindingsV1;
  isRequired: boolean;
  isReadOnly: boolean;
  choiceOptions?: DbmChoiceOptionV1[];
  lookupTargetEntityId?: string | null;
}

export interface DbmEntityV1 {
  id: string;
  displayName: string;
  providerBindings: DbmProviderBindingsV1;
  primaryKeyFieldId: string;
  fields: DbmFieldV1[];
}

export interface DbmRelationshipV1 {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: DbmRelationshipTypeV1;
  providerBindings: DbmProviderBindingsV1;
  referencingFieldId?: string | null;
}

export interface DbmMetadataV1 {
  entities: DbmEntityV1[];
  relationships: DbmRelationshipV1[];
}

export interface DbmRuleV1 {
  id: string;
  displayName: string;
  ruleType: DbmRuleTypeV1;
  scope: DbmRuleScopeV1;
  language: DbmRuleLanguageV1;
  body: string;
}

export interface DbmRuntimeContractDefinitionV1 {
  schemaVersion: DbmRuntimeRequestSchemaVersionV1;
  operations: DbmRuntimeOperationV1[];
}

export interface DbmRuntimeResultContractDefinitionV1 {
  schemaVersion: DbmRuntimeResultSchemaVersionV1;
  statuses: DbmRuntimeStatusV1[];
}

export type DbmPcfResponsibilityV1 = 'form-rendering' | 'local-interaction' | 'responsive-validation';
export type DbmDataverseResponsibilityV1 = 'authoritative-persistence' | 'stage-transition' | 'artifact-execution';
export type DbmAzureResponsibilityV1 = 'support-services-only';

export interface DbmRuntimeOwnershipSliceV1<TResponsibility extends string> {
  responsibilities: TResponsibility[];
}

export interface DbmRuntimeOwnershipV1 {
  pcf: DbmRuntimeOwnershipSliceV1<DbmPcfResponsibilityV1>;
  dataverse: DbmRuntimeOwnershipSliceV1<DbmDataverseResponsibilityV1>;
  azure: DbmRuntimeOwnershipSliceV1<DbmAzureResponsibilityV1>;
}

export interface DbmRuntimeModelV1 {
  capabilities: DbmRuntimeCapabilityV1[];
  requestContract: DbmRuntimeContractDefinitionV1;
  resultContract: DbmRuntimeResultContractDefinitionV1;
  ownership: DbmRuntimeOwnershipV1;
}

export interface DbmArtifactV1 {
  id: string;
  artifactType: DbmArtifactTypeV1;
  displayName: string;
  runtimeTargets: DbmRuntimeEngineV1[];
  packagingTarget: DbmPackagingTargetV1;
  sourceRef: string;
  required: boolean;
}

export interface DbmModelV1 {
  schemaVersion: DbmSchemaVersionV1;
  package: DbmPackageV1;
  processPortfolio: DbmProcessPortfolioV1;
  forms: DbmFormV1[];
  metadata: DbmMetadataV1;
  rules: DbmRuleV1[];
  runtime: DbmRuntimeModelV1;
  artifacts: DbmArtifactV1[];
}

export type DbmProcessPortfolioValidationIssueCodeV1 =
  | 'main-process-not-found'
  | 'main-process-role-invalid'
  | 'main-process-duplicate'
  | 'sub-process-role-invalid'
  | 'stage-span-anchor-not-found'
  | 'stage-span-fraction-out-of-range'
  | 'stage-span-reversed';

export interface DbmProcessPortfolioValidationIssueV1 {
  code: DbmProcessPortfolioValidationIssueCodeV1;
  path: string;
  message: string;
}

export interface DbmProcessPortfolioProjectionContextV1 {
  audience: DbmProcessPortfolioProjectionAudienceV1;
  mainDisplayMode?: DbmMainProcessDisplayModeV1;
  ruleResults?: Record<string, boolean>;
}

export interface DbmProcessPortfolioProjectionStageV1 {
  id: string;
  displayName: string;
  stageType: DbmStageTypeV1;
  scope: DbmStageScopeV1;
  stageSpan: DbmStageSpanV1;
  portalVisibility: DbmStagePortalVisibilityV1;
  statusId: string;
  portalStatusId: string | null;
}

export interface DbmProcessPortfolioProjectionProcessV1 {
  id: string;
  displayName: string;
  role: DbmProcessRoleV1;
  displayMode: DbmMainProcessDisplayModeV1;
  statusId: string;
  portalStatusId: string | null;
  stages: DbmProcessPortfolioProjectionStageV1[];
}

export interface DbmProcessPortfolioProjectionV1 {
  schemaVersion: DbmProcessPortfolioProjectionSchemaVersionV1;
  packageId: string;
  packageVersion: string;
  audience: DbmProcessPortfolioProjectionAudienceV1;
  processIdAuthority: 'processPortfolio.mainProcessId';
  portalRuntimeInvoked: boolean;
  mainProcess: DbmProcessPortfolioProjectionProcessV1;
  subProcesses: DbmProcessPortfolioProjectionProcessV1[];
}

function createValidationIssue(
  code: DbmProcessPortfolioValidationIssueCodeV1,
  path: string,
  message: string
): DbmProcessPortfolioValidationIssueV1 {
  return { code, path, message };
}

function findMainProcess(model: DbmModelV1): DbmProcessV1 | undefined {
  return model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);
}

function resolveTimelinePosition(
  anchor: DbmStageSpanAnchorV1,
  mainStageIndex: Map<string, number>
): number | null {
  const stageIndex = mainStageIndex.get(anchor.stageId);
  if (stageIndex === undefined) {
    return null;
  }

  return stageIndex + anchor.fraction;
}

export function validateProcessPortfolioModelV1(model: DbmModelV1): DbmProcessPortfolioValidationIssueV1[] {
  const issues: DbmProcessPortfolioValidationIssueV1[] = [];
  const mainProcess = findMainProcess(model);

  if (!mainProcess) {
    issues.push(createValidationIssue(
      'main-process-not-found',
      '/processPortfolio/mainProcessId',
      'processPortfolio.mainProcessId must resolve to a process in processPortfolio.processes.'
    ));
    return issues;
  }

  if (mainProcess.role !== 'main') {
    issues.push(createValidationIssue(
      'main-process-role-invalid',
      `/processPortfolio/processes/${model.processPortfolio.processes.indexOf(mainProcess)}/role`,
      'The process identified by processPortfolio.mainProcessId must have role main.'
    ));
  }

  const mainRoleProcesses = model.processPortfolio.processes.filter((process) => process.role === 'main');
  if (mainRoleProcesses.length !== 1) {
    issues.push(createValidationIssue(
      'main-process-duplicate',
      '/processPortfolio/processes',
      'Exactly one process must have role main.'
    ));
  }

  const mainStageIndex = new Map(mainProcess.stages.map((stage, index) => [stage.id, index]));

  model.processPortfolio.processes.forEach((process, processIndex) => {
    if (process.id !== mainProcess.id && process.role !== 'sub-process') {
      issues.push(createValidationIssue(
        'sub-process-role-invalid',
        `/processPortfolio/processes/${processIndex}/role`,
        'Every non-main process in the portfolio must have role sub-process.'
      ));
    }

    process.stages.forEach((stage, stageIndex) => {
      const spanPath = `/processPortfolio/processes/${processIndex}/stages/${stageIndex}/stageSpan`;
      const anchors: Array<[string, DbmStageSpanAnchorV1]> = [
        ['start', stage.stageSpan.start],
        ['end', stage.stageSpan.end]
      ];

      for (const [anchorName, anchor] of anchors) {
        if (anchor.fraction < 0 || anchor.fraction > 1) {
          issues.push(createValidationIssue(
            'stage-span-fraction-out-of-range',
            `${spanPath}/${anchorName}/fraction`,
            'stageSpan anchor fraction must be between 0 and 1.'
          ));
        }

        if (!mainStageIndex.has(anchor.stageId)) {
          issues.push(createValidationIssue(
            'stage-span-anchor-not-found',
            `${spanPath}/${anchorName}/stageId`,
            'stageSpan anchor stageId must resolve to a stage in the main process timeline.'
          ));
        }
      }

      const startPosition = resolveTimelinePosition(stage.stageSpan.start, mainStageIndex);
      const endPosition = resolveTimelinePosition(stage.stageSpan.end, mainStageIndex);
      if (startPosition !== null && endPosition !== null && startPosition > endPosition) {
        issues.push(createValidationIssue(
          'stage-span-reversed',
          spanPath,
          'stageSpan start anchor must not appear after the end anchor on the main process timeline.'
        ));
      }
    });
  });

  return issues;
}

function isSubProcessVisible(
  process: DbmProcessV1,
  context: DbmProcessPortfolioProjectionContextV1
): boolean {
  const visibilityRules = process.subProcessVisibility?.filter((rule) => rule.audience === context.audience) ?? [];
  if (visibilityRules.length === 0) {
    return false;
  }

  return visibilityRules.some((rule) => {
    if (rule.ruleId === null) {
      return rule.visibleWhen;
    }

    return (context.ruleResults?.[rule.ruleId] ?? false) === rule.visibleWhen;
  });
}

function projectProcess(
  process: DbmProcessV1,
  displayMode: DbmMainProcessDisplayModeV1
): DbmProcessPortfolioProjectionProcessV1 {
  return {
    id: process.id,
    displayName: process.displayName,
    role: process.role,
    displayMode,
    statusId: process.statusId,
    portalStatusId: process.portalStatusId,
    stages: process.stages.map((stage) => ({
      id: stage.id,
      displayName: stage.displayName,
      stageType: stage.stageType,
      scope: stage.scope,
      stageSpan: stage.stageSpan,
      portalVisibility: stage.portalVisibility,
      statusId: stage.statusId,
      portalStatusId: stage.portalStatusId
    }))
  };
}

export function createProcessPortfolioProjectionV1(
  model: DbmModelV1,
  context: DbmProcessPortfolioProjectionContextV1
): DbmProcessPortfolioProjectionV1 {
  const mainProcess = findMainProcess(model);
  if (!mainProcess) {
    throw new Error('processPortfolio.mainProcessId must resolve before a projection can be created.');
  }

  const displayMode = context.mainDisplayMode ?? mainProcess.mainDisplayMode;
  const visibleSubProcesses = model.processPortfolio.processes
    .filter((process) => process.id !== mainProcess.id && process.role === 'sub-process' && isSubProcessVisible(process, context))
    .sort((left, right) => (left.renderOrder ?? 0) - (right.renderOrder ?? 0));

  return {
    schemaVersion: 'dbm.process-portfolio.projection/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    audience: context.audience,
    processIdAuthority: 'processPortfolio.mainProcessId',
    portalRuntimeInvoked: false,
    mainProcess: projectProcess(mainProcess, displayMode),
    subProcesses: visibleSubProcesses.map((process) => projectProcess(process, process.mainDisplayMode))
  };
}

export interface DbmDesignerViewportV1 {
  x: number;
  y: number;
  zoom: number;
}

export interface DbmDesignerNodeCanvasStateV1 {
  x: number;
  y: number;
}

export interface DbmDesignerPanelStateV1 {
  open: boolean;
  size: number;
}

export interface DbmDesignerPanelsV1 {
  catalog: DbmDesignerPanelStateV1;
  inspector: DbmDesignerPanelStateV1;
  preview: DbmDesignerPanelStateV1;
  diagnostics: DbmDesignerPanelStateV1;
}

export interface DbmDesignerPreviewStateV1 {
  mode: DbmDesignerPreviewModeV1;
  stageId: string | null;
  stepId: string | null;
}

export interface DbmDesignerGraphSemanticRefV1 {
  actorId?: string;
  stageId?: string;
  stepId?: string;
  outcomeId?: string;
  transitionId?: string;
  stepTransitionId?: string;
}

export interface DbmDesignerGraphPortV1 {
  id: string;
  label: string | null;
  direction: DbmDesignerGraphPortDirectionV1;
  role: DbmDesignerGraphPortRoleV1;
}

export interface DbmDesignerGraphGroupV1 {
  id: string;
  kind: DbmDesignerGraphGroupKindV1;
  label: string;
  parentGroupId: string | null;
  semanticRef: DbmDesignerGraphSemanticRefV1;
}

export interface DbmDesignerGraphNodeV1 {
  id: string;
  kind: DbmDesignerGraphNodeKindV1;
  label: string;
  parentNodeId: string | null;
  groupId: string | null;
  semanticRef: DbmDesignerGraphSemanticRefV1;
  ports: DbmDesignerGraphPortV1[];
}

export interface DbmDesignerGraphEdgeV1 {
  id: string;
  kind: DbmDesignerGraphEdgeKindV1;
  label: string | null;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  semanticRef: DbmDesignerGraphSemanticRefV1;
}

export interface DbmDesignerGraphDocumentV1 {
  schemaVersion: DbmDesignerGraphDocumentSchemaVersionV1;
  packageId: string;
  packageVersion: string;
  processId: string;
  groups: DbmDesignerGraphGroupV1[];
  nodes: DbmDesignerGraphNodeV1[];
  edges: DbmDesignerGraphEdgeV1[];
}

export interface DbmDesignerWorkspaceV1 {
  schemaVersion: DbmDesignerWorkspaceSchemaVersionV1;
  packageId: string;
  packageVersion: string;
  viewport: DbmDesignerViewportV1;
  nodePositions: Record<string, DbmDesignerNodeCanvasStateV1>;
  collapsedNodeIds: string[];
  selectionNodeId: string | null;
  panels: DbmDesignerPanelsV1;
  preview: DbmDesignerPreviewStateV1;
}

export interface DbmRuntimeModelReferenceV1 {
  packageId: string;
  packageVersion: string;
  processId: string;
}

export interface DbmRuntimeContextV1 {
  host: DbmSupportedHostV1;
  engine: DbmRuntimeEngineV1;
  capabilities: DbmRuntimeCapabilityV1[];
}

export interface DbmRuntimeActorContextV1 {
  actorId: string;
  userId: string;
  roleIds: string[];
}

export interface DbmRuntimeSubjectRecordV1 {
  id: string;
  entityId: string;
  recordId: string;
  relationshipId: string | null;
  role: DbmSubjectRecordRoleV1;
}

export interface DbmRuntimeSubjectV1 {
  records: DbmRuntimeSubjectRecordV1[];
}

export interface DbmRuntimeRecordStateV1 {
  entityId: string;
  recordId: string;
  fieldValues: Record<string, DbmScalarValueV1>;
}

export interface DbmRuntimeStateV1 {
  stageId: string;
  stepId: string;
  formStateId: string | null;
  internalStatusId: string;
  portalStatusId: string | null;
  records: DbmRuntimeRecordStateV1[];
  variables: Record<string, DbmScalarValueV1>;
}

export interface DbmRuntimeCommandV1 {
  requestedOutcomeId: string | null;
}

export interface DbmRuntimeRequestV1 {
  schemaVersion: DbmRuntimeRequestSchemaVersionV1;
  operation: DbmRuntimeOperationV1;
  model: DbmRuntimeModelReferenceV1;
  runtime: DbmRuntimeContextV1;
  actor: DbmRuntimeActorContextV1;
  subject: DbmRuntimeSubjectV1;
  state: DbmRuntimeStateV1;
  command: DbmRuntimeCommandV1;
  correlationId: string;
}

export interface DbmRuntimePersistEffectV1 {
  entityId: string;
  recordId: string;
  fields: Record<string, DbmScalarValueV1>;
}

export interface DbmRuntimeNotificationEffectV1 {
  channel: string;
  targetActorId: string;
  message: string;
}

export type DbmArtifactCallStatusV1 = 'requested' | 'completed' | 'failed';

export interface DbmRuntimeArtifactCallEffectV1 {
  artifactId: string;
  runtimeTarget: DbmRuntimeEngineV1;
  status: DbmArtifactCallStatusV1;
}

export interface DbmRuntimeEffectsV1 {
  persist: DbmRuntimePersistEffectV1[];
  notifications: DbmRuntimeNotificationEffectV1[];
  artifactCalls: DbmRuntimeArtifactCallEffectV1[];
}

export type DbmMessageLevelV1 = 'info' | 'warning' | 'error';

export interface DbmRuntimeMessageV1 {
  level: DbmMessageLevelV1;
  code: string;
  text: string;
}

export interface DbmRuntimeErrorV1 {
  code: string;
  message: string;
  detail?: string | null;
}

export interface DbmRuntimeResultV1 {
  schemaVersion: DbmRuntimeResultSchemaVersionV1;
  status: DbmRuntimeStatusV1;
  state: DbmRuntimeStateV1;
  effects: DbmRuntimeEffectsV1;
  messages: DbmRuntimeMessageV1[];
  errors: DbmRuntimeErrorV1[];
  correlationId: string;
}

export interface DbmPortalRuntimeRoutesV1 {
  entryPath: string;
  statusPath: string;
}

export interface DbmPortalRuntimeStateFieldLogicalNamesV1 {
  stageId: string;
  stepId: string;
  formStateId: string;
  internalStatusId: string;
  portalStatusId: string;
  portalProfileKey: string;
}

export interface DbmPortalRuntimeEntryFieldV1 {
  logicalName: string;
  displayName: string;
  dataType: DbmPortalRuntimeEntryFieldDataTypeV1;
  required: boolean;
  hint?: string | null;
}

export interface DbmPortalRuntimeDefaultStateV1 {
  stageId: string;
  stepId: string;
  formStateId: string | null;
  internalStatusId: string;
  portalStatusId: string | null;
}

export interface DbmPortalRuntimeBootstrapV1 {
  schemaVersion: DbmPortalRuntimeBootstrapSchemaVersionV1;
  packageId: string;
  packageVersion: string;
  processId: string;
  identityMode: DbmPortalIdentityModeV1;
  genericProfileKey: string;
  routes: DbmPortalRuntimeRoutesV1;
  requestEntityLogicalName: string;
  requestEntitySetName: string;
  startFormId: string;
  entryFields: DbmPortalRuntimeEntryFieldV1[];
  portalCommandFieldLogicalName: string;
  runtimeStateFieldLogicalNames: DbmPortalRuntimeStateFieldLogicalNamesV1;
  defaultState: DbmPortalRuntimeDefaultStateV1;
  allowedActions: DbmPortalAllowedActionV1[];
}

export interface DbmProcessExperienceActorRefV1 {
  id: string;
  displayName: string;
  actorType: DbmActorTypeV1;
}

export interface DbmProcessExperienceStatusRefV1 {
  id: string;
  displayName: string;
  audience: DbmStatusAudienceV1;
  kind: DbmStatusKindV1;
}

export interface DbmProcessExperienceOutcomeRefV1 {
  id: string;
  displayName: string;
  isAvailable: boolean;
}

export interface DbmProcessExperienceStageV1 {
  id: string;
  displayName: string;
  stageType: DbmStageTypeV1;
  state: DbmProcessExperienceItemStateV1;
  visibility: DbmProcessExperienceVisibilityV1;
  actor: DbmProcessExperienceActorRefV1 | null;
  formId: string | null;
  currentStepId: string | null;
  stepIds: string[];
  availableOutcomeIds: string[];
}

export interface DbmProcessExperienceStepV1 {
  id: string;
  stageId: string;
  displayName: string;
  stepType: DbmStepTypeV1;
  state: DbmProcessExperienceItemStateV1;
  visibility: DbmProcessExperienceVisibilityV1;
  owner: DbmProcessExperienceActorRefV1 | null;
  formStateId: string | null;
  internalStatus: DbmProcessExperienceStatusRefV1 | null;
  portalStatus: DbmProcessExperienceStatusRefV1 | null;
}

export interface DbmProcessExperienceTransitionV1 {
  id: string;
  fromStageId: string;
  toStageId: string;
  outcome: DbmProcessExperienceOutcomeRefV1 | null;
  state: DbmProcessExperienceItemStateV1;
}

export interface DbmProcessExperienceProjectionV1 {
  projectedStageId: string | null;
  projectedStepId: string | null;
  message: string | null;
}

export interface DbmProcessExperienceSnapshotV1 {
  schemaVersion: DbmProcessExperienceSnapshotSchemaVersionV1;
  packageId: string;
  packageVersion: string;
  processId: string;
  audience: DbmProcessExperienceAudienceV1;
  currentStageId: string;
  currentStepId: string | null;
  activeFormId: string | null;
  activeFormStateId: string | null;
  internalStatus: DbmProcessExperienceStatusRefV1 | null;
  portalStatus: DbmProcessExperienceStatusRefV1 | null;
  availableOutcomes: DbmProcessExperienceOutcomeRefV1[];
  stages: DbmProcessExperienceStageV1[];
  steps: DbmProcessExperienceStepV1[];
  transitions: DbmProcessExperienceTransitionV1[];
  projection: DbmProcessExperienceProjectionV1;
}
