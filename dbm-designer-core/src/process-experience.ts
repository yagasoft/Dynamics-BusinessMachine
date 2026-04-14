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
import type { ProcessExperienceSnapshotBuildOptions } from './types';

function toActorRef(actor: DbmActorV1 | undefined): DbmProcessExperienceActorRefV1 | null {
  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    displayName: actor.displayName,
    actorType: actor.actorType
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

function findStartStage(model: DbmModelV1): DbmStageV1 | undefined {
  return model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
}

function findShortestStagePath(model: DbmModelV1, targetStageId: string): string[] {
  const startStage = findStartStage(model);
  if (!startStage) {
    return targetStageId ? [targetStageId] : [];
  }

  if (startStage.id === targetStageId) {
    return [startStage.id];
  }

  const queue: string[][] = [[startStage.id]];
  const visited = new Set<string>([startStage.id]);
  const transitionsBySource = new Map<string, string[]>();

  model.process.transitions.forEach((transition) => {
    const next = transitionsBySource.get(transition.fromStageId) ?? [];
    next.push(transition.toStageId);
    transitionsBySource.set(transition.fromStageId, next);
  });

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath) {
      continue;
    }

    const currentStageId = currentPath[currentPath.length - 1];
    const nextStageIds = transitionsBySource.get(currentStageId) ?? [];
    for (const nextStageId of nextStageIds) {
      if (visited.has(nextStageId)) {
        continue;
      }

      const nextPath = [...currentPath, nextStageId];
      if (nextStageId === targetStageId) {
        return nextPath;
      }

      visited.add(nextStageId);
      queue.push(nextPath);
    }
  }

  return [targetStageId];
}

function resolveCurrentStage(model: DbmModelV1, runtimeState: DbmRuntimeStateV1): DbmStageV1 | undefined {
  return model.process.stages.find((stage) => stage.id === runtimeState.stageId) ?? findStartStage(model);
}

function resolveCurrentStep(model: DbmModelV1, runtimeState: DbmRuntimeStateV1, currentStage: DbmStageV1 | undefined): DbmStepV1 | undefined {
  if (!currentStage) {
    return undefined;
  }

  return model.process.steps.find((step) => step.id === runtimeState.stepId && step.stageId === currentStage.id)
    ?? model.process.steps.find((step) => step.id === currentStage.defaultStepId)
    ?? model.process.steps.find((step) => step.stageId === currentStage.id);
}

function allowsMissingCurrentStep(currentStage: DbmStageV1, currentStep: DbmStepV1 | undefined): boolean {
  return !currentStep && currentStage.stageType === 'end' && currentStage.stepIds.length === 0 && currentStage.defaultStepId == null;
}

function createStageVisibility(stage: DbmStageV1, audience: 'internal' | 'portal'): 'visible' | 'collapsed-hidden' {
  return audience === 'portal' && stage.portalVisibility === 'hidden' ? 'collapsed-hidden' : 'visible';
}

export function buildProcessExperienceSnapshot(
  model: DbmModelV1,
  runtimeState: DbmRuntimeStateV1,
  options: ProcessExperienceSnapshotBuildOptions = {}
): DbmProcessExperienceSnapshotV1 {
  const audience = options.audience ?? 'internal';
  const actorMap = new Map(model.process.actors.map((actor) => [actor.id, actor]));
  const statusMap = new Map(model.process.statuses.map((status) => [status.id, status]));
  const outcomeMap = new Map(model.process.outcomes.map((outcome) => [outcome.id, outcome]));
  const currentStage = resolveCurrentStage(model, runtimeState);

  if (!currentStage) {
    throw new Error('Cannot build process snapshot without at least one stage.');
  }

  const currentStep = resolveCurrentStep(model, runtimeState, currentStage);
  const stepLessTerminalStage = allowsMissingCurrentStep(currentStage, currentStep);
  if (!currentStep && !stepLessTerminalStage) {
    throw new Error(`Cannot build process snapshot for stage '${currentStage.id}' without a current step.`);
  }

  const stagePath = findShortestStagePath(model, currentStage.id);
  const pathSet = new Set(stagePath);
  const completedStageIds = new Set(options.completedStageIds ?? stagePath.slice(0, -1));
  const availableOutcomeIds = new Set(options.availableOutcomeIds ?? currentStage.allowedOutcomeIds);
  const currentStageStepIds = currentStage.stepIds;
  const currentStepIndex = currentStep ? currentStageStepIds.indexOf(currentStep.id) : -1;
  const derivedCompletedStepIds = model.process.steps
    .filter((step) => completedStageIds.has(step.stageId))
    .map((step) => step.id);

  if (currentStepIndex > 0) {
    derivedCompletedStepIds.push(...currentStageStepIds.slice(0, currentStepIndex));
  }

  const completedStepIds = new Set(options.completedStepIds ?? derivedCompletedStepIds);
  const directSuccessorStageIds = new Set(
    model.process.transitions
      .filter((transition) => transition.fromStageId === currentStage.id)
      .map((transition) => transition.toStageId)
  );

  const stages = model.process.stages.map((stage) => {
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
      stageType: stage.stageType,
      state,
      visibility: createStageVisibility(stage, audience),
      actor: toActorRef(actorMap.get(stage.actorId)),
      formId: stage.formId,
      currentStepId: stage.id === currentStage.id ? currentStep?.id ?? null : null,
      stepIds: [...stage.stepIds],
      availableOutcomeIds: stage.id === currentStage.id ? [...availableOutcomeIds] : []
    };
  });

  const steps = model.process.steps.map((step) => {
    let state: 'completed' | 'current' | 'available' | 'upcoming' = 'upcoming';
    if (currentStep && step.id === currentStep.id) {
      state = 'current';
    } else if (completedStepIds.has(step.id)) {
      state = 'completed';
    } else if (step.stageId === currentStage.id) {
      const stepIndex = currentStageStepIds.indexOf(step.id);
      if (stepIndex > currentStepIndex) {
        state = 'available';
      }
    } else if (directSuccessorStageIds.has(step.stageId)) {
      const successorStage = model.process.stages.find((stage) => stage.id === step.stageId);
      if (successorStage?.defaultStepId === step.id || (!successorStage?.defaultStepId && successorStage?.stepIds[0] === step.id)) {
        state = 'available';
      }
    }

    const stepStage = model.process.stages.find((stage) => stage.id === step.stageId);
    return {
      id: step.id,
      stageId: step.stageId,
      displayName: step.displayName,
      stepType: step.stepType,
      state,
      visibility: stepStage ? createStageVisibility(stepStage, audience) : 'visible',
      owner: toActorRef(actorMap.get(step.ownerActorId)),
      formStateId: step.formStateId,
      internalStatus: toStatusRef(statusMap.get(step.internalStatusId)),
      portalStatus: toStatusRef(step.portalStatusId ? statusMap.get(step.portalStatusId) : undefined)
    };
  });

  const transitions = model.process.transitions.map((transition) => {
    let state: 'completed' | 'current' | 'available' | 'upcoming' = 'upcoming';
    if (completedStageIds.has(transition.fromStageId) && pathSet.has(transition.toStageId)) {
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
  const currentInternalStatus = currentStep
    ? statusMap.get(currentStep.internalStatusId)
    : statusMap.get(runtimeState.internalStatusId);
  const currentPortalStatus = currentStep?.portalStatusId
    ? statusMap.get(currentStep.portalStatusId)
    : runtimeState.portalStatusId
      ? statusMap.get(runtimeState.portalStatusId)
      : undefined;

  return {
    schemaVersion: 'dbm.process-experience.snapshot/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: model.process.id,
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
