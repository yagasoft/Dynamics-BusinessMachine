import type {
  DbmActorV1,
  DbmModelV1,
  DbmOutcomeV1,
  DbmProcessExperienceActorRefV1,
  DbmProcessExperienceOutcomeRefV1,
  DbmProcessExperienceSnapshotV1,
  DbmProcessExperienceStatusRefV1,
  DbmRuntimeStateV1,
  DbmStageV1,
  DbmStatusV1,
  DbmStepV1
} from 'dbm-contract';
import { resolveMainProcess } from './portfolio';
import type { ProcessExperienceSnapshotBuildOptions } from './types';

function toActorRef(actor: DbmActorV1 | undefined): DbmProcessExperienceActorRefV1 | null {
  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    displayName: actor.displayName,
    actorType: actor.actorCategory === 'system' ? 'system' : actor.actorCategory === 'person' ? 'requester' : 'approver'
  };
}

function toStatusRef(status: DbmStatusV1 | undefined): DbmProcessExperienceStatusRefV1 | null {
  if (!status) {
    return null;
  }

  return {
    id: status.id,
    displayName: status.displayName,
    audience: status.audience,
    kind: status.kind
  };
}

function createOutcomeRef(outcome: DbmOutcomeV1 | undefined, isAvailable: boolean): DbmProcessExperienceOutcomeRefV1 | null {
  if (!outcome) {
    return null;
  }

  return {
    id: outcome.id,
    displayName: outcome.displayName,
    isAvailable
  };
}

function findStartStage(stages: DbmStageV1[]): DbmStageV1 | undefined {
  return stages.find((stage) => stage.stageCategory === 'start') ?? stages[0];
}

function resolveCurrentStage(stages: DbmStageV1[], runtimeState: DbmRuntimeStateV1): DbmStageV1 | undefined {
  return stages.find((stage) => stage.id === runtimeState.stageId) ?? findStartStage(stages);
}

function resolveCurrentStep(steps: DbmStepV1[], runtimeState: DbmRuntimeStateV1, currentStage: DbmStageV1 | undefined): DbmStepV1 | undefined {
  if (!currentStage) {
    return undefined;
  }

  return steps.find((step) => step.id === runtimeState.stepId && step.stageId === currentStage.id)
    ?? steps.find((step) => step.id === currentStage.defaultStepId)
    ?? steps.find((step) => step.stageId === currentStage.id);
}

function allowsMissingCurrentStep(currentStage: DbmStageV1, currentStep: DbmStepV1 | undefined): boolean {
  return !currentStep && currentStage.stageCategory === 'end' && currentStage.stepIds.length === 0 && currentStage.defaultStepId == null;
}

function createStageVisibility(stage: DbmStageV1, audience: 'internal' | 'portal'): 'visible' | 'collapsed-hidden' {
  return audience === 'portal' && stage.portalVisibility === 'hidden' ? 'collapsed-hidden' : 'visible';
}

function toLegacyStageType(stage: DbmStageV1): 'start' | 'task' | 'approval' | 'system' | 'end' {
  if (stage.stageCategory === 'start' || stage.stageCategory === 'end') {
    return stage.stageCategory;
  }
  if (stage.scope === 'back-office') {
    return 'task';
  }
  return 'system';
}

function toLegacyStepType(step: DbmStepV1): 'data-entry' | 'review' | 'approval' | 'system' {
  if (step.workKindId.includes('approval')) {
    return 'approval';
  }
  if (step.workKindId.includes('data') || step.workKindId.includes('capture')) {
    return 'data-entry';
  }
  if (step.workCategory === 'system') {
    return 'system';
  }
  return 'review';
}

export function buildProcessExperienceSnapshot(
  model: DbmModelV1,
  runtimeState: DbmRuntimeStateV1,
  options: ProcessExperienceSnapshotBuildOptions = {}
): DbmProcessExperienceSnapshotV1 {
  const audience = options.audience ?? 'internal';
  const process = resolveMainProcess(model);
  const actorMap = new Map(process.actors.map((actor) => [actor.id, actor]));
  const statusMap = new Map(process.statuses.map((status) => [status.id, status]));
  const outcomeMap = new Map(process.outcomes.map((outcome) => [outcome.id, outcome]));
  const currentStage = resolveCurrentStage(process.stages, runtimeState);

  if (!currentStage) {
    throw new Error('Cannot build process snapshot without at least one stage.');
  }

  const currentStep = resolveCurrentStep(process.steps, runtimeState, currentStage);
  const stepLessTerminalStage = allowsMissingCurrentStep(currentStage, currentStep);
  if (!currentStep && !stepLessTerminalStage) {
    throw new Error(`Cannot build process snapshot for stage '${currentStage.id}' without a current step.`);
  }

  const completedStageIds = new Set(options.completedStageIds ?? []);
  const completedStepIds = new Set(options.completedStepIds ?? []);
  const availableOutcomeIds = new Set(options.availableOutcomeIds ?? currentStage.allowedOutcomeIds);
  const directSuccessorStageIds = new Set(
    process.transitions
      .filter((transition) => transition.fromStageId === currentStage.id)
      .map((transition) => transition.toStageId)
  );

  const stages = process.stages.map((stage) => {
    let state: 'completed' | 'current' | 'available' | 'upcoming' = 'upcoming';
    if (stage.id === currentStage.id) {
      state = 'current';
    } else if (completedStageIds.has(stage.id)) {
      state = 'completed';
    } else if (directSuccessorStageIds.has(stage.id)) {
      state = 'available';
    }

    return {
      id: stage.id,
      displayName: stage.displayName,
      stageType: toLegacyStageType(stage),
      state,
      visibility: createStageVisibility(stage, audience),
      actor: toActorRef(actorMap.get(stage.actorId)),
      formId: stage.formId,
      currentStepId: stage.id === currentStage.id ? currentStep?.id ?? null : null,
      stepIds: [...stage.stepIds],
      availableOutcomeIds: stage.id === currentStage.id ? [...availableOutcomeIds] : []
    };
  });

  const steps = process.steps.map((step) => {
    let state: 'completed' | 'current' | 'available' | 'upcoming' = 'upcoming';
    if (currentStep && step.id === currentStep.id) {
      state = 'current';
    } else if (completedStepIds.has(step.id)) {
      state = 'completed';
    } else if (step.stageId === currentStage.id) {
      state = 'available';
    }

    const stepStage = process.stages.find((stage) => stage.id === step.stageId);
    return {
      id: step.id,
      stageId: step.stageId,
      displayName: step.displayName,
      stepType: toLegacyStepType(step),
      state,
      visibility: stepStage ? createStageVisibility(stepStage, audience) : 'visible',
      owner: toActorRef(actorMap.get(step.ownerActorId)),
      formStateId: step.formStateId,
      internalStatus: toStatusRef(statusMap.get(step.internalStatusId)),
      portalStatus: toStatusRef(step.portalStatusId ? statusMap.get(step.portalStatusId) : undefined)
    };
  });

  const transitions = process.transitions.map((transition) => {
    let state: 'completed' | 'current' | 'available' | 'upcoming' = 'upcoming';
    if (completedStageIds.has(transition.fromStageId)) {
      state = 'completed';
    } else if (transition.fromStageId === currentStage.id && availableOutcomeIds.has(transition.outcomeId)) {
      state = 'available';
    }

    return {
      id: transition.id,
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      outcome: createOutcomeRef(outcomeMap.get(transition.outcomeId), availableOutcomeIds.has(transition.outcomeId)),
      state
    };
  });

  const currentStageVisibility = createStageVisibility(currentStage, audience);
  const currentInternalStatus = currentStep ? statusMap.get(currentStep.internalStatusId) : statusMap.get(runtimeState.internalStatusId);
  const currentPortalStatus = currentStep?.portalStatusId ? statusMap.get(currentStep.portalStatusId) : runtimeState.portalStatusId ? statusMap.get(runtimeState.portalStatusId) : undefined;

  return {
    schemaVersion: 'dbm.process-experience.snapshot/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: process.id,
    audience,
    currentStageId: currentStage.id,
    currentStepId: currentStep?.id ?? null,
    activeFormId: currentStage.formId,
    activeFormStateId: currentStep?.formStateId ?? null,
    internalStatus: toStatusRef(currentInternalStatus),
    portalStatus: toStatusRef(currentPortalStatus),
    availableOutcomes: [...availableOutcomeIds].map((outcomeId) => createOutcomeRef(outcomeMap.get(outcomeId), true)).filter((entry): entry is DbmProcessExperienceOutcomeRefV1 => !!entry),
    stages,
    steps,
    transitions,
    projection: {
      projectedStageId: currentStageVisibility === 'visible' ? currentStage.id : null,
      projectedStepId: currentStageVisibility === 'visible' ? currentStep?.id ?? null : null,
      message: currentStageVisibility === 'collapsed-hidden' ? 'Current work is progressing in an internal stage.' : null
    }
  };
}
