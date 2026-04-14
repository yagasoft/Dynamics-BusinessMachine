export type DbmSchemaVersionV1 = 'dbm.model/v1';
export type DbmDesignerWorkspaceSchemaVersionV1 = 'dbm.designer.workspace/v1';
export type DbmDesignerGraphDocumentSchemaVersionV1 = 'dbm.designer.graph-document/v1';
export type DbmProcessExperienceSnapshotSchemaVersionV1 = 'dbm.process-experience.snapshot/v1';
export type DbmRuntimeRequestSchemaVersionV1 = 'dbm.runtime.request/v1';
export type DbmRuntimeResultSchemaVersionV1 = 'dbm.runtime.result/v1';

export type DbmSupportedHostV1 = 'model-driven' | 'xrmtoolbox';
export type DbmRuntimeEngineV1 = 'pcf' | 'dataverse' | 'azure';

export type DbmActorTypeV1 = 'requester' | 'approver' | 'system';
export type DbmActorSourceV1 = 'current-user' | 'field-binding' | 'rule-derived' | 'system';
export type DbmVariableScopeV1 = 'process';
export type DbmVariablePersistenceV1 = 'runtime-only' | 'persisted';

export type DbmStageTypeV1 = 'start' | 'task' | 'approval' | 'system' | 'end';
export type DbmStagePortalVisibilityV1 = 'visible' | 'hidden';

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

export interface DbmStageV1 {
  id: string;
  displayName: string;
  stageType: DbmStageTypeV1;
  actorId: string;
  formId: string | null;
  portalVisibility: DbmStagePortalVisibilityV1;
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

export interface DbmTransitionV1 {
  id: string;
  fromStageId: string;
  toStageId: string;
  outcomeId: string;
  guardRuleId: string;
}

export type DbmStepTransitionTargetV1 = { stepId: string } | { stageId: string } | { outcomeId: string };

export interface DbmStepTransitionV1 {
  id: string;
  fromStepId: string;
  guardRuleId: string;
  target: DbmStepTransitionTargetV1;
}

export interface DbmOutcomeV1 {
  id: string;
  displayName: string;
}

export interface DbmProcessV1 {
  id: string;
  displayName: string;
  scenarioType: 'approval-request';
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
  process: DbmProcessV1;
  forms: DbmFormV1[];
  metadata: DbmMetadataV1;
  rules: DbmRuleV1[];
  runtime: DbmRuntimeModelV1;
  artifacts: DbmArtifactV1[];
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
  currentStepId: string;
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
