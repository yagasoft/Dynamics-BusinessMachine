import type { DbmActorV1, DbmModelV1, DbmProcessV1, DbmStageCategoryV1, DbmStageTypeV1, DbmStepTypeV1 } from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience' with { "resolution-mode": "import" };
type LegacyProcess = DbmProcessV1 & {
    scenarioType?: string;
    actors: Array<DbmActorV1 & {
        actorType?: 'requester' | 'approver' | 'system';
    }>;
    tasks: Array<{
        id: string;
        displayName: string;
        taskType?: DbmStepTypeV1;
        instructions?: string | null;
    }>;
    stages: Array<DbmProcessV1['stages'][number] & {
        stageType?: DbmStageTypeV1;
        childProcessRefs?: DbmProcessV1['stages'][number]['childProcessRefs'];
    }>;
    steps: Array<DbmProcessV1['steps'][number] & {
        stepType?: DbmStepTypeV1;
    }>;
};
type LegacyStage = LegacyProcess['stages'][number];
export declare function getMainProcess(model: DbmModelV1): LegacyProcess;
export declare function hasProcessPortfolio(model: DbmModelV1): boolean;
export declare function getProcessStages(model: DbmModelV1): LegacyProcess['stages'];
export declare function getProcessSteps(model: DbmModelV1): LegacyProcess['steps'];
export declare function getProcessTransitions(model: DbmModelV1): LegacyProcess['transitions'];
export declare function getProcessStepTransitions(model: DbmModelV1): LegacyProcess['stepTransitions'];
export declare function mapStageType(stageCategory: DbmStageCategoryV1 | undefined, stageType?: DbmStageTypeV1): DbmStageTypeV1;
export declare function getStageType(stage: LegacyStage): DbmStageTypeV1;
export declare function buildProcessExperienceRuntimeModelFromModel(model: DbmModelV1): DbmProcessExperienceRuntimeModelV1;
export {};
