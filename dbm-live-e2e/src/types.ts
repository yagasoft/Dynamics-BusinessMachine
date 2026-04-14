export type LiveE2ERole = 'requester' | 'finance-reviewer' | 'manager-approver' | 'support-admin';
export type LiveE2ERunMode = 'full' | 'promotion';
export type LiveE2EAuthenticationMode = 'persisted-user-session';
export type LiveE2EIdentityModel = 'single-user-simulation';
export type LiveE2ESessionScope = 'environment';
export type LiveE2ESessionHealthStatus = 'ready' | 'healthy' | 'expired' | 'invalidated' | 'bootstrap-required';

export interface LiveE2EAuthenticationConfig {
  mode: LiveE2EAuthenticationMode;
  sessionScope: LiveE2ESessionScope;
  identityModel: LiveE2EIdentityModel;
  sessionUserDisplayName: string;
}

export interface LiveE2EEntityStateFieldsConfig {
  stageIdField: string;
  stepIdField: string;
  internalStatusField: string;
  portalStatusField: string;
}

export interface LiveE2EEntityConfig {
  logicalName: string;
  entitySetName: string;
  primaryIdField: string;
  primaryNameField?: string;
  stateFields?: LiveE2EEntityStateFieldsConfig;
}

export interface LiveE2ELockConfig {
  webResourceName: string;
  staleAfterMinutes: number;
}

export interface LiveE2ECleanupConfig {
  namePrefix: string;
  orphanAgeHours: number;
  deleteCreatedRecords: boolean;
}

export interface LiveE2ECaseSetsConfig {
  full: string[];
  promotion: string[];
}

export interface LiveE2EEnvironmentConfig {
  environment: 'Dev' | 'UAT' | 'Prod';
  dataverseUrl: string;
  modelDrivenAppUrl: string;
  liveE2E: {
    enabledModes: string[];
    lock: LiveE2ELockConfig;
    cleanup: LiveE2ECleanupConfig;
    authentication: LiveE2EAuthenticationConfig;
    caseSets: LiveE2ECaseSetsConfig;
    entities: Record<string, LiveE2EEntityConfig>;
  };
}

export interface LiveE2ESeedRecordOperation {
  kind: 'seed-record';
  entityAlias: string;
  recordAlias: string;
  fields: Record<string, unknown>;
}

export interface LiveE2EDeleteRecordTarget {
  kind: 'delete-record';
  entityAlias: string;
  recordAlias: string;
  ignoreMissing?: boolean;
}

export type LiveE2ESetupOperation = LiveE2ESeedRecordOperation;
export type LiveE2ECleanupTarget = LiveE2EDeleteRecordTarget;

export interface LiveE2EActionBase {
  kind: string;
  role?: LiveE2ERole;
}

export interface LiveE2EOpenModelDrivenUrlAction extends LiveE2EActionBase {
  kind: 'open-model-driven-url';
  relativeUrlTemplate?: string;
}

export interface LiveE2EOpenNewRecordFormAction extends LiveE2EActionBase {
  kind: 'open-new-record-form';
  entityAlias: string;
}

export interface LiveE2EOpenRecordFormAction extends LiveE2EActionBase {
  kind: 'open-record-form';
  entityAlias: string;
  recordAlias: string;
}

export interface LiveE2EFillFieldAction extends LiveE2EActionBase {
  kind: 'fill-field';
  label: string;
  value: string;
}

export interface LiveE2ESetLookupFieldAction extends LiveE2EActionBase {
  kind: 'set-lookup-field';
  label: string;
  value: string;
}

export interface LiveE2EClickButtonAction extends LiveE2EActionBase {
  kind: 'click-button';
  label: string;
}

export interface LiveE2EWaitForTextAction extends LiveE2EActionBase {
  kind: 'wait-for-text';
  text: string;
  timeoutMs?: number;
}

export interface LiveE2EAssertTextNotVisibleAction extends LiveE2EActionBase {
  kind: 'assert-text-not-visible';
  text: string;
  timeoutMs?: number;
}

export interface LiveE2ECaptureCurrentRecordIdAction extends LiveE2EActionBase {
  kind: 'capture-current-record-id';
  entityAlias?: string;
  recordAlias: string;
}

export interface LiveE2ECaptureRelatedRecordAction extends LiveE2EActionBase {
  kind: 'capture-related-record';
  entityAlias: string;
  recordAlias: string;
  fieldLogicalName: string;
  equals: string;
  timeoutMs?: number;
}

export interface LiveE2EWaitForIdleAction extends LiveE2EActionBase {
  kind: 'wait-for-idle';
  delayMs?: number;
}

export type LiveE2EAction =
  | LiveE2EOpenModelDrivenUrlAction
  | LiveE2EOpenNewRecordFormAction
  | LiveE2EOpenRecordFormAction
  | LiveE2EFillFieldAction
  | LiveE2ESetLookupFieldAction
  | LiveE2EClickButtonAction
  | LiveE2EWaitForTextAction
  | LiveE2EAssertTextNotVisibleAction
  | LiveE2ECaptureCurrentRecordIdAction
  | LiveE2ECaptureRelatedRecordAction
  | LiveE2EWaitForIdleAction;

export interface LiveE2ERecordExistsAssertion {
  kind: 'record-exists';
  entityAlias: string;
  recordAlias: string;
}

export interface LiveE2ERecordFieldAssertion {
  kind: 'record-field';
  entityAlias: string;
  recordAlias: string;
  fieldLogicalName: string;
  equals?: string | number | boolean;
  notEquals?: string | number | boolean;
}

export interface LiveE2EProcessStateAssertion {
  kind: 'process-state';
  entityAlias: string;
  recordAlias: string;
  expected: {
    stageId?: string;
    stepId?: string;
    internalStatus?: string;
    portalStatus?: string;
  };
}

export interface LiveE2ETextVisibleAssertion {
  kind: 'text-visible';
  text: string;
}

export interface LiveE2ETextNotVisibleAssertion {
  kind: 'text-not-visible';
  text: string;
}

export type LiveE2EAssertion =
  | LiveE2ERecordExistsAssertion
  | LiveE2ERecordFieldAssertion
  | LiveE2EProcessStateAssertion
  | LiveE2ETextVisibleAssertion
  | LiveE2ETextNotVisibleAssertion;

export interface LiveE2EEvidenceRequirements {
  captureScreenshotOnSuccess: boolean;
  captureTimeline: boolean;
}

export interface LiveE2ECaseDefinition {
  scenarioId: string;
  title: string;
  description: string;
  runModes: LiveE2ERunMode[];
  requiredRole: LiveE2ERole;
  setup: {
    operations: LiveE2ESetupOperation[];
  };
  actions: LiveE2EAction[];
  assertions: LiveE2EAssertion[];
  cleanup: {
    targets: LiveE2ECleanupTarget[];
  };
  evidence: LiveE2EEvidenceRequirements;
}

export interface LiveE2ESessionMetadata {
  targetEnvironment: 'Dev' | 'UAT';
  authenticationMode: LiveE2EAuthenticationMode;
  sessionScope: LiveE2ESessionScope;
  identityModel: LiveE2EIdentityModel;
  physicalUserMode: LiveE2EIdentityModel;
  physicalUserDisplayName: string;
  modelDrivenAppUrl: string;
  bootstrapUtc: string;
  lastSuccessfulUseUtc?: string;
  lastRefreshUtc?: string;
  lastHealthCheckUtc?: string;
  sessionHealthStatus: LiveE2ESessionHealthStatus;
  machineName?: string;
  windowsUser?: string;
}

export interface LiveE2ERunSessionContext {
  authenticationMode: LiveE2EAuthenticationMode;
  sessionScope: LiveE2ESessionScope;
  identityModel: LiveE2EIdentityModel;
  physicalUserMode: LiveE2EIdentityModel;
  userDisplayName: string;
  metadataPath?: string;
}

export interface LiveE2ERunContext {
  environmentName: 'Dev' | 'UAT' | 'Prod';
  caseSet: LiveE2ERunMode;
  runId: string;
  preserveOnFailure: boolean;
  dataverseUrl: string;
  modelDrivenAppUrl: string;
  evidenceRoot: string;
  environmentConfig: LiveE2EEnvironmentConfig;
  session: LiveE2ERunSessionContext;
  cases: LiveE2ECaseDefinition[];
}

export interface LiveE2ERecordReference {
  entityAlias: string;
  id: string;
}

export interface LiveE2ECaseResult {
  scenarioId: string;
  title: string;
  passed: boolean;
  startedUtc: string;
  completedUtc: string;
  physicalUserMode: LiveE2EIdentityModel;
  logicalRolesExercised: LiveE2ERole[];
  createdRecords: Array<{ entityAlias: string; id: string }>;
  observedProcessState: Array<Record<string, unknown>>;
  notes: string[];
  error?: string;
}
