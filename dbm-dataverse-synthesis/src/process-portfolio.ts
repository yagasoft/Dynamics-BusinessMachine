import type {
  DbmActorCategoryV1,
  DbmActorV1,
  DbmModelV1,
  DbmProcessV1,
  DbmStageCategoryV1,
  DbmStageTypeV1,
  DbmStepTypeV1,
  DbmWorkCategoryV1
} from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience' with { "resolution-mode": "import" };

type LegacyProcess = DbmProcessV1 & {
  scenarioType?: string;
  actors: Array<DbmActorV1 & { actorType?: 'requester' | 'approver' | 'system' }>;
  tasks: Array<{ id: string; displayName: string; taskType?: DbmStepTypeV1; instructions?: string | null }>;
  stages: Array<DbmProcessV1['stages'][number] & { stageType?: DbmStageTypeV1; childProcessRefs?: DbmProcessV1['stages'][number]['childProcessRefs'] }>;
  steps: Array<DbmProcessV1['steps'][number] & { stepType?: DbmStepTypeV1 }>;
};

type LegacyActor = LegacyProcess['actors'][number];
type LegacyStage = LegacyProcess['stages'][number];
type LegacyStep = LegacyProcess['steps'][number];

function legacyProcess(model: DbmModelV1): LegacyProcess | null {
  return ((model as unknown as { process?: LegacyProcess }).process ?? null);
}

export function getMainProcess(model: DbmModelV1): LegacyProcess {
  const portfolio = model.processPortfolio;
  const mainProcess = portfolio?.processes.find((process) => process.id === portfolio.mainProcessId) ?? portfolio?.processes[0];
  const process = mainProcess ?? legacyProcess(model);
  if (!process) {
    throw new Error('DbmModelV1 processPortfolio.mainProcessId must resolve before Dataverse synthesis can plan runtime output.');
  }

  return process as LegacyProcess;
}

export function hasProcessPortfolio(model: DbmModelV1): boolean {
  return Boolean(model.processPortfolio?.processes?.length);
}

export function getProcessStages(model: DbmModelV1): LegacyProcess['stages'] {
  return getMainProcess(model).stages;
}

export function getProcessSteps(model: DbmModelV1): LegacyProcess['steps'] {
  return getMainProcess(model).steps;
}

export function getProcessTransitions(model: DbmModelV1): LegacyProcess['transitions'] {
  return getMainProcess(model).transitions;
}

export function getProcessStepTransitions(model: DbmModelV1): LegacyProcess['stepTransitions'] {
  return getMainProcess(model).stepTransitions ?? [];
}

export function mapStageType(stageCategory: DbmStageCategoryV1 | undefined, stageType?: DbmStageTypeV1): DbmStageTypeV1 {
  if (stageType) {
    return stageType;
  }

  switch (stageCategory) {
    case 'start':
      return 'start';
    case 'decision':
      return 'approval';
    case 'system':
      return 'system';
    case 'end':
      return 'end';
    default:
      return 'task';
  }
}

export function getStageType(stage: LegacyStage): DbmStageTypeV1 {
  return mapStageType(stage.stageCategory, stage.stageType);
}

function mapStepType(workCategory: DbmWorkCategoryV1 | undefined, stepType?: DbmStepTypeV1): DbmStepTypeV1 {
  if (stepType) {
    return stepType;
  }

  switch (workCategory) {
    case 'data':
      return 'data-entry';
    case 'decision':
      return 'approval';
    case 'system':
      return 'system';
    default:
      return 'review';
  }
}

function mapActorType(actorCategory: DbmActorCategoryV1 | undefined, roleKey: string | undefined, actorType?: 'requester' | 'approver' | 'system') {
  if (actorType) {
    return actorType;
  }

  if (actorCategory === 'system') {
    return 'system';
  }

  if (actorCategory === 'external' || /requester|applicant|author|starter|customer|citizen/i.test(roleKey ?? '')) {
    return 'requester';
  }

  return 'approver';
}

export function buildProcessExperienceRuntimeModelFromModel(model: DbmModelV1): DbmProcessExperienceRuntimeModelV1 {
  const process = getMainProcess(model);

  return {
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: process.id,
    actors: process.actors.map((actor) => ({
      id: actor.id,
      displayName: actor.displayName,
      actorType: mapActorType(actor.actorCategory, actor.roleKey, (actor as LegacyActor).actorType)
    })),
    statuses: process.statuses.map((status) => ({
      id: status.id,
      displayName: status.displayName,
      audience: status.audience,
      kind: status.kind
    })),
    outcomes: process.outcomes.map((outcome) => ({
      id: outcome.id,
      displayName: outcome.displayName
    })),
    stages: process.stages.map((stage) => ({
      id: stage.id,
      displayName: stage.displayName,
      stageType: getStageType(stage),
      actorId: stage.actorId,
      formId: stage.formId,
      portalVisibility: stage.portalVisibility,
      stepIds: [...stage.stepIds],
      defaultStepId: stage.defaultStepId,
      allowedOutcomeIds: [...stage.allowedOutcomeIds]
    })),
    steps: process.steps.map((step) => ({
      id: step.id,
      stageId: step.stageId,
      displayName: step.displayName,
      stepType: mapStepType(step.workCategory, (step as LegacyStep).stepType),
      ownerActorId: step.ownerActorId,
      internalStatusId: step.internalStatusId,
      portalStatusId: step.portalStatusId,
      formStateId: step.formStateId
    })),
    transitions: process.transitions.map((transition) => ({
      id: transition.id,
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      outcomeId: transition.outcomeId
    }))
  };
}
