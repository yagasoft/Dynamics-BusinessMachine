import type { DbmProcessExperienceSnapshotV1, DbmModelV1 } from 'dbm-contract';
import type { BuildRuntimeProcessExperienceSnapshotOptions, DbmProcessExperienceRuntimeModelV1, DbmProcessExperienceRuntimeStateV1 } from './types';
export declare function buildRuntimeProcessExperienceSnapshot(runtime: DbmProcessExperienceRuntimeModelV1, runtimeState: DbmProcessExperienceRuntimeStateV1, options?: BuildRuntimeProcessExperienceSnapshotOptions): DbmProcessExperienceSnapshotV1;
export declare function buildProcessPortfolioExperienceSnapshot(model: DbmModelV1, runtimeState: DbmProcessExperienceRuntimeStateV1, options?: BuildRuntimeProcessExperienceSnapshotOptions & {
    processId?: string | null;
}): DbmProcessExperienceSnapshotV1;
