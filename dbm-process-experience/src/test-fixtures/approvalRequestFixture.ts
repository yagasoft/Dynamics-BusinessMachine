import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { buildRuntimeProcessExperienceSnapshot } from '../runtime-snapshot';
import type { DbmProcessExperienceRuntimeModelV1 } from '../types';

export type ApprovalRequestFixtureScenario =
  | 'designer-preview-current-stage'
  | 'portal-hidden-stage-collapsed'
  | 'designer-cross-form-handoff';

export const approvalRequestRuntimeModel: DbmProcessExperienceRuntimeModelV1 = {
  packageId: 'dbm-package',
  packageVersion: '1.0.0',
  processId: 'approval-request',
  actors: [
    { id: 'requester', displayName: 'Requester', actorType: 'requester' },
    { id: 'approver', displayName: 'Manager Approver', actorType: 'approver' }
  ],
  statuses: [
    { id: 'draft', displayName: 'Draft', audience: 'shared', kind: 'progress' },
    { id: 'under-review', displayName: 'Under Review', audience: 'shared', kind: 'progress' }
  ],
  outcomes: [
    { id: 'submit', displayName: 'Submit' },
    { id: 'approve', displayName: 'Approve' }
  ],
  stages: [
    {
      id: 'draft-request',
      displayName: 'Draft Request',
      stageType: 'start',
      actorId: 'requester',
      formId: 'request-form',
      portalVisibility: 'visible',
      stepIds: ['capture-request'],
      defaultStepId: 'capture-request',
      allowedOutcomeIds: ['submit']
    },
    {
      id: 'manager-review',
      displayName: 'Manager Review',
      stageType: 'approval',
      actorId: 'approver',
      formId: 'review-form',
      portalVisibility: 'hidden',
      stepIds: ['review-request'],
      defaultStepId: 'review-request',
      allowedOutcomeIds: ['approve']
    }
  ],
  steps: [
    {
      id: 'capture-request',
      stageId: 'draft-request',
      displayName: 'Capture Request',
      stepType: 'data-entry',
      ownerActorId: 'requester',
      internalStatusId: 'draft',
      portalStatusId: 'draft',
      formStateId: 'request-basic-state'
    },
    {
      id: 'review-request',
      stageId: 'manager-review',
      displayName: 'Review Request',
      stepType: 'approval',
      ownerActorId: 'approver',
      internalStatusId: 'under-review',
      portalStatusId: 'under-review',
      formStateId: 'review-state'
    }
  ],
  transitions: [
    { id: 'submit-request', fromStageId: 'draft-request', toStageId: 'manager-review', outcomeId: 'submit' }
  ]
};

export function buildApprovalRequestSnapshot(
  scenario: ApprovalRequestFixtureScenario
): DbmProcessExperienceSnapshotV1 {
  switch (scenario) {
    case 'portal-hidden-stage-collapsed':
      return buildRuntimeProcessExperienceSnapshot(
        approvalRequestRuntimeModel,
        {
          stageId: 'manager-review',
          stepId: 'review-request',
          formStateId: 'review-state',
          internalStatusId: 'under-review',
          portalStatusId: 'under-review'
        },
        {
          audience: 'portal',
          currentFormId: 'request-form'
        }
      );
    case 'designer-cross-form-handoff':
      return buildRuntimeProcessExperienceSnapshot(
        approvalRequestRuntimeModel,
        {
          stageId: 'manager-review',
          stepId: 'review-request',
          formStateId: 'review-state',
          internalStatusId: 'under-review',
          portalStatusId: 'under-review'
        },
        {
          audience: 'internal',
          currentFormId: 'request-form'
        }
      );
    case 'designer-preview-current-stage':
    default:
      return buildRuntimeProcessExperienceSnapshot(
        approvalRequestRuntimeModel,
        {
          stageId: 'draft-request',
          stepId: 'capture-request',
          formStateId: 'request-basic-state',
          internalStatusId: 'draft',
          portalStatusId: 'draft'
        },
        {
          audience: 'internal',
          currentFormId: 'request-form'
        }
      );
  }
}
