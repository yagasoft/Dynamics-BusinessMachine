import type { DbmEntityV1, DbmFormV1, DbmModelV1, DbmRelationshipV1 } from 'dbm-contract';
import approvalRequestTemplate from '../../docs/architecture/examples/approval-request-v1.model.json';

export interface BlankExistingFormStarterOptions {
  packageId: string;
  displayName: string;
  primaryEntity: DbmEntityV1;
  primaryForm: DbmFormV1;
  relationships?: DbmRelationshipV1[];
  currentUserActorDisplayName?: string;
  systemActorDisplayName?: string;
  draftStatusDisplayName?: string;
  inProgressStatusDisplayName?: string;
  completeStatusDisplayName?: string;
}

export function createApprovalRequestTemplate(): DbmModelV1 {
  return structuredClone(approvalRequestTemplate as DbmModelV1);
}

export function createBlankExistingFormTemplate(options: BlankExistingFormStarterOptions): DbmModelV1 {
  const primaryStateId = options.primaryForm.formStates[0]?.id ?? null;
  const model: DbmModelV1 = {
    schemaVersion: 'dbm.model/v1',
    package: {
      id: options.packageId,
      displayName: options.displayName,
      version: '1.0.0',
      publisher: {
        name: 'Dynamics Business Machine',
        website: 'https://example.invalid/dbm',
        prefix: 'dbm'
      },
      entryProcessId: `${options.packageId}-process`,
      supportedHosts: ['model-driven', 'xrmtoolbox'],
      supportedRuntimes: ['pcf', 'dataverse'],
      processUiSurfaces: ['model-driven'],
      exposesPortalState: true,
      ownsGeneratedDataverseArtifacts: true,
      compatibility: {
        minimumReaderSchemaVersion: 'dbm.model/v1',
        maximumReaderSchemaVersion: 'dbm.model/v1',
        breakingChangePolicy: 'reject-newer-major'
      },
      deployment: {
        solutionName: options.displayName,
        releaseLine: 'R2.5',
        artifactRoot: `artifacts/${options.packageId}`
      }
    },
    process: {
      id: `${options.packageId}-process`,
      displayName: options.displayName,
      scenarioType: 'custom',
      actors: [
        {
          id: 'requester',
          displayName: options.currentUserActorDisplayName?.trim() || 'Current User',
          actorType: 'requester',
          source: 'current-user'
        },
        {
          id: 'platform',
          displayName: options.systemActorDisplayName?.trim() || 'Platform',
          actorType: 'system',
          source: 'system'
        }
      ],
      variables: [],
      statuses: [
        {
          id: 'draft',
          displayName: options.draftStatusDisplayName?.trim() || 'Draft',
          audience: 'shared',
          kind: 'progress'
        },
        {
          id: 'in-progress',
          displayName: options.inProgressStatusDisplayName?.trim() || 'In Progress',
          audience: 'shared',
          kind: 'progress'
        },
        {
          id: 'complete',
          displayName: options.completeStatusDisplayName?.trim() || 'Complete',
          audience: 'shared',
          kind: 'terminal'
        }
      ],
      tasks: [
        { id: 'capture-data', displayName: 'Capture Data', taskType: 'data-entry', instructions: 'Complete the required form information.' }
      ],
      notifications: [],
      stages: [
        {
          id: 'start-stage',
          displayName: 'Start',
          stageType: 'start',
          actorId: 'requester',
          formId: options.primaryForm.id,
          portalVisibility: 'visible',
          stepIds: ['capture-data'],
          defaultStepId: 'capture-data',
          entryRuleIds: [],
          exitRuleIds: [],
          allowedOutcomeIds: ['submit']
        },
        {
          id: 'complete-stage',
          displayName: 'Complete',
          stageType: 'end',
          actorId: 'platform',
          formId: null,
          portalVisibility: 'visible',
          stepIds: [],
          defaultStepId: null,
          entryRuleIds: [],
          exitRuleIds: [],
          allowedOutcomeIds: ['submit']
        }
      ],
      steps: [
        {
          id: 'capture-data',
          stageId: 'start-stage',
          displayName: 'Capture Data',
          stepType: 'data-entry',
          ownerActorId: 'requester',
          notificationId: null,
          taskId: 'capture-data',
          internalStatusId: 'draft',
          portalStatusId: 'draft',
          formStateId: primaryStateId,
          entryRuleIds: [],
          exitRuleIds: []
        }
      ],
      transitions: [
        {
          id: 'submit-transition',
          fromStageId: 'start-stage',
          toStageId: 'complete-stage',
          outcomeId: 'submit',
          guardRuleId: 'always-true'
        }
      ],
      stepTransitions: [],
      outcomes: [
        { id: 'submit', displayName: 'Submit' }
      ]
    },
    forms: [structuredClone(options.primaryForm)],
    metadata: {
      entities: [structuredClone(options.primaryEntity)],
      relationships: structuredClone(options.relationships ?? [])
    },
    rules: [
      {
        id: 'always-true',
        displayName: 'Always True',
        ruleType: 'condition',
        scope: 'transition',
        language: 'dbm-expression-v1',
        body: 'true'
      }
    ],
    runtime: {
      capabilities: ['load-record', 'render-form', 'validate-input', 'evaluate-rules', 'persist-record', 'advance-stage'],
      requestContract: {
        schemaVersion: 'dbm.runtime.request/v1',
        operations: ['initialize', 'load-form', 'validate', 'submit', 'transition']
      },
      resultContract: {
        schemaVersion: 'dbm.runtime.result/v1',
        statuses: ['ok', 'validation-failed', 'blocked', 'error']
      },
      ownership: {
        pcf: { responsibilities: ['form-rendering', 'local-interaction', 'responsive-validation'] },
        dataverse: { responsibilities: ['authoritative-persistence', 'stage-transition'] },
        azure: { responsibilities: ['support-services-only'] }
      }
    },
    artifacts: []
  };

  return model;
}
