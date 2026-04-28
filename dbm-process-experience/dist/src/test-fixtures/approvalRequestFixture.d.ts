import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from '../types';
export type ApprovalRequestFixtureScenario = 'designer-preview-current-stage' | 'portal-hidden-stage-collapsed' | 'designer-cross-form-handoff' | 'portal-runtime-draft' | 'portal-runtime-under-review';
export declare const approvalRequestRuntimeModel: DbmProcessExperienceRuntimeModelV1;
export declare function buildApprovalRequestSnapshot(scenario: ApprovalRequestFixtureScenario): DbmProcessExperienceSnapshotV1;
