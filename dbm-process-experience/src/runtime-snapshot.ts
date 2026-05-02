import type {
  DbmActorV1,
  DbmProcessExperienceActorRefV1,
  DbmProcessExperienceAudienceV1,
  DbmProcessExperienceBlockedParentStageV1,
  DbmProcessExperienceChildProcessRefV1,
  DbmProcessExperienceHierarchyProcessV1,
  DbmProcessExperienceHierarchyStageV1,
  DbmProcessExperienceOutcomeRefV1,
  DbmProcessExperienceParentLinkV1,
  DbmProcessExperienceSnapshotV1,
  DbmProcessExperienceStatusRefV1,
  DbmProcessExperienceVisibilityV1,
  DbmProcessV1,
  DbmModelV1,
  DbmStageCategoryV1,
  DbmStageTypeV1,
  DbmStepTypeV1,
  DbmWorkCategoryV1
} from 'dbm-contract';
import type {
  BuildRuntimeProcessExperienceSnapshotOptions,
  DbmProcessExperienceRuntimeActorV1,
  DbmProcessExperienceRuntimeModelV1,
  DbmProcessExperienceRuntimeOutcomeV1,
  DbmProcessExperienceRuntimeStageV1,
  DbmProcessExperienceRuntimeStateV1,
  DbmProcessExperienceRuntimeStatusV1,
  DbmProcessExperienceRuntimeStepV1
} from './types';

function toActorRef(actor: DbmProcessExperienceRuntimeActorV1 | undefined): DbmProcessExperienceActorRefV1 | null {
  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    displayName: actor.displayName,
    actorType: actor.actorType
  };
}

function toStatusRef(status: DbmProcessExperienceRuntimeStatusV1 | undefined): DbmProcessExperienceStatusRefV1 | null {
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

function toOutcomeRef(outcome: DbmProcessExperienceRuntimeOutcomeV1 | undefined, isAvailable: boolean): DbmProcessExperienceOutcomeRefV1 | null {
  if (!outcome) {
    return null;
  }

  return {
    id: outcome.id,
    displayName: outcome.displayName,
    isAvailable
  };
}

function findStartStage(runtime: DbmProcessExperienceRuntimeModelV1): DbmProcessExperienceRuntimeStageV1 | undefined {
  return runtime.stages.find((stage) => stage.stageType === 'start') ?? runtime.stages[0];
}

function findShortestStagePath(runtime: DbmProcessExperienceRuntimeModelV1, targetStageId: string): string[] {
  const startStage = findStartStage(runtime);
  if (!startStage) {
    return targetStageId ? [targetStageId] : [];
  }

  if (startStage.id === targetStageId) {
    return [startStage.id];
  }

  const queue: string[][] = [[startStage.id]];
  const visited = new Set<string>([startStage.id]);
  const transitionsBySource = new Map<string, string[]>();

  runtime.transitions.forEach((transition) => {
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

function resolveCurrentStage(
  runtime: DbmProcessExperienceRuntimeModelV1,
  runtimeState: DbmProcessExperienceRuntimeStateV1
): DbmProcessExperienceRuntimeStageV1 | undefined {
  return runtime.stages.find((stage) => stage.id === runtimeState.stageId) ?? findStartStage(runtime);
}

function resolveCurrentStep(
  runtime: DbmProcessExperienceRuntimeModelV1,
  runtimeState: DbmProcessExperienceRuntimeStateV1,
  currentStage: DbmProcessExperienceRuntimeStageV1 | undefined
): DbmProcessExperienceRuntimeStepV1 | undefined {
  if (!currentStage) {
    return undefined;
  }

  return runtime.steps.find((step) => step.id === runtimeState.stepId && step.stageId === currentStage.id)
    ?? runtime.steps.find((step) => step.id === currentStage.defaultStepId)
    ?? runtime.steps.find((step) => step.stageId === currentStage.id);
}

function allowsMissingCurrentStep(currentStage: DbmProcessExperienceRuntimeStageV1, currentStep: DbmProcessExperienceRuntimeStepV1 | undefined): boolean {
  return !currentStep && currentStage.stepIds.length === 0 && currentStage.defaultStepId == null;
}

function createStageVisibility(
  stage: DbmProcessExperienceRuntimeStageV1,
  audience: DbmProcessExperienceAudienceV1
): DbmProcessExperienceVisibilityV1 {
  return audience === 'portal' && stage.portalVisibility === 'hidden' ? 'collapsed-hidden' : 'visible';
}

function buildProjectionMessage(
  currentFormId: string | null,
  currentStage: DbmProcessExperienceRuntimeStageV1,
  currentStageVisibility: DbmProcessExperienceVisibilityV1
): string | null {
  const messages: string[] = [];
  if (currentStageVisibility === 'collapsed-hidden') {
    messages.push('Current work is progressing in an internal stage.');
  }

  if (currentFormId && currentStage.formId && currentStage.formId !== currentFormId) {
    messages.push('This record has moved to a different DBM form. Open the active form to continue the process.');
  }

  return messages.length > 0 ? messages.join(' ') : null;
}

export function buildRuntimeProcessExperienceSnapshot(
  runtime: DbmProcessExperienceRuntimeModelV1,
  runtimeState: DbmProcessExperienceRuntimeStateV1,
  options: BuildRuntimeProcessExperienceSnapshotOptions = {}
): DbmProcessExperienceSnapshotV1 {
  const audience = options.audience ?? 'internal';
  const actorMap = new Map(runtime.actors.map((actor) => [actor.id, actor]));
  const statusMap = new Map(runtime.statuses.map((status) => [status.id, status]));
  const outcomeMap = new Map(runtime.outcomes.map((outcome) => [outcome.id, outcome]));
  const currentStage = resolveCurrentStage(runtime, runtimeState);

  if (!currentStage) {
    throw new Error('Cannot build process experience snapshot without at least one stage.');
  }

  const currentStep = resolveCurrentStep(runtime, runtimeState, currentStage);
  const stepLessTerminalStage = allowsMissingCurrentStep(currentStage, currentStep);
  if (!currentStep && !stepLessTerminalStage) {
    throw new Error(`Cannot build process experience snapshot for stage '${currentStage.id}' without a current step.`);
  }

  const stagePath = findShortestStagePath(runtime, currentStage.id);
  const pathSet = new Set(stagePath);
  const completedStageIds = new Set(stagePath.slice(0, -1));
  const availableOutcomeIds = new Set(options.availableOutcomeIds ?? currentStage.allowedOutcomeIds);
  const currentStageStepIds = currentStage.stepIds;
  const currentStepIndex = currentStep ? currentStageStepIds.indexOf(currentStep.id) : -1;
  const derivedCompletedStepIds = runtime.steps
    .filter((step) => completedStageIds.has(step.stageId))
    .map((step) => step.id);

  if (currentStepIndex > 0) {
    derivedCompletedStepIds.push(...currentStageStepIds.slice(0, currentStepIndex));
  }

  const completedStepIds = new Set(derivedCompletedStepIds);
  const directSuccessorStageIds = new Set(
    runtime.transitions
      .filter((transition) => transition.fromStageId === currentStage.id)
      .map((transition) => transition.toStageId)
  );

  const stages = runtime.stages.map((stage) => {
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

  const steps = runtime.steps.map((step) => {
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
      const successorStage = runtime.stages.find((stage) => stage.id === step.stageId);
      if (successorStage?.defaultStepId === step.id || (!successorStage?.defaultStepId && successorStage?.stepIds[0] === step.id)) {
        state = 'available';
      }
    }

    const stepStage = runtime.stages.find((stage) => stage.id === step.stageId);
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

  const transitions = runtime.transitions.map((transition) => {
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
      outcome: toOutcomeRef(outcomeMap.get(transition.outcomeId), availableOutcomeIds.has(transition.outcomeId)),
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
    packageId: runtime.packageId,
    packageVersion: runtime.packageVersion,
    processId: runtime.processId,
    audience,
    currentStageId: currentStage.id,
    currentStepId: currentStep?.id ?? null,
    activeFormId: currentStage.formId,
    activeFormStateId: currentStep?.formStateId ?? null,
    internalStatus: toStatusRef(currentInternalStatus),
    portalStatus: toStatusRef(currentPortalStatus),
    availableOutcomes: [...availableOutcomeIds]
      .map((outcomeId) => toOutcomeRef(outcomeMap.get(outcomeId), true))
      .filter((entry): entry is DbmProcessExperienceOutcomeRefV1 => !!entry),
    stages,
    steps,
    transitions,
    projection: {
      projectedStageId: currentStageVisibility === 'visible' ? currentStage.id : null,
      projectedStepId: currentStageVisibility === 'visible' ? currentStep?.id ?? null : null,
      message: buildProjectionMessage(options.currentFormId ?? null, currentStage, currentStageVisibility)
    }
  };
}

function mapActorType(actor: DbmActorV1): DbmProcessExperienceRuntimeActorV1['actorType'] {
  if (actor.actorCategory === 'system') {
    return 'system';
  }

  if (actor.actorCategory === 'external' || /requester|applicant|author|starter|customer|citizen/i.test(actor.roleKey)) {
    return 'requester';
  }

  return 'approver';
}

function mapStageType(stageCategory: DbmStageCategoryV1): DbmStageTypeV1 {
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

function mapStepType(workCategory: DbmWorkCategoryV1): DbmStepTypeV1 {
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

function buildRuntimeFromPortfolioProcess(
  model: DbmModelV1,
  process: DbmProcessV1
): DbmProcessExperienceRuntimeModelV1 {
  return {
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: process.id,
    actors: process.actors.map((actor) => ({
      id: actor.id,
      displayName: actor.displayName,
      actorType: mapActorType(actor)
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
      stageType: mapStageType(stage.stageCategory),
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
      stepType: mapStepType(step.workCategory),
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

function toChildProcessRefSummary(ref: DbmProcessV1['stages'][number]['childProcessRefs'][number]): DbmProcessExperienceChildProcessRefV1 {
  return {
    id: ref.id,
    processId: ref.processId,
    displayName: ref.displayName,
    activationRuleId: ref.activationRuleId,
    blocksParent: ref.blocksParent
  };
}

function toHierarchyStage(stage: DbmProcessV1['stages'][number]): DbmProcessExperienceHierarchyStageV1 {
  return {
    id: stage.id,
    displayName: stage.displayName,
    stageType: mapStageType(stage.stageCategory),
    stageCategory: stage.stageCategory,
    stageKindId: stage.stageKindId,
    childProcessRefs: stage.childProcessRefs.map(toChildProcessRefSummary)
  };
}

function toHierarchyProcess(process: DbmProcessV1): DbmProcessExperienceHierarchyProcessV1 {
  return {
    id: process.id,
    displayName: process.displayName,
    role: process.role,
    displayMode: process.mainDisplayMode,
    stages: process.stages.map(toHierarchyStage)
  };
}

function findStageProcess(model: DbmModelV1, stageId: string): DbmProcessV1 | undefined {
  return model.processPortfolio.processes.find((process) => process.stages.some((stage) => stage.id === stageId));
}

function findParentLinkForProcess(
  model: DbmModelV1,
  childProcessId: string
): { parentProcess: DbmProcessV1; parentStage: DbmProcessV1['stages'][number]; ref: DbmProcessV1['stages'][number]['childProcessRefs'][number] } | null {
  for (const parentProcess of model.processPortfolio.processes) {
    for (const parentStage of parentProcess.stages) {
      const ref = parentStage.childProcessRefs.find((candidate) => candidate.processId === childProcessId);
      if (ref) {
        return { parentProcess, parentStage, ref };
      }
    }
  }

  return null;
}

function createParentLink(
  parentProcess: DbmProcessV1,
  parentStage: DbmProcessV1['stages'][number],
  ref: DbmProcessV1['stages'][number]['childProcessRefs'][number]
): DbmProcessExperienceParentLinkV1 {
  return {
    parentProcessId: parentProcess.id,
    parentStageId: parentStage.id,
    childProcessRefId: ref.id,
    blocksParent: ref.blocksParent,
    displayName: ref.displayName,
    activationRuleId: ref.activationRuleId
  };
}

function createBlockedParentStage(
  parentProcess: DbmProcessV1,
  parentStage: DbmProcessV1['stages'][number],
  childProcess: DbmProcessV1,
  ref: DbmProcessV1['stages'][number]['childProcessRefs'][number]
): DbmProcessExperienceBlockedParentStageV1 {
  return {
    parentProcessId: parentProcess.id,
    parentStageId: parentStage.id,
    parentStageDisplayName: parentStage.displayName,
    childProcessId: childProcess.id,
    childProcessDisplayName: childProcess.displayName,
    childProcessRefId: ref.id,
    label: 'Parent stage awaiting child completion'
  };
}

function resolveRuntimeStateForProcess(
  process: DbmProcessV1,
  runtimeState: DbmProcessExperienceRuntimeStateV1
): DbmProcessExperienceRuntimeStateV1 {
  const stage = process.stages.find((candidate) => candidate.id === runtimeState.stageId) ?? process.stages[0];
  const step = stage
    ? process.steps.find((candidate) => candidate.id === runtimeState.stepId && candidate.stageId === stage.id)
      ?? process.steps.find((candidate) => candidate.id === stage.defaultStepId)
      ?? process.steps.find((candidate) => candidate.stageId === stage.id)
    : undefined;

  return {
    stageId: stage?.id ?? runtimeState.stageId,
    stepId: step?.id ?? '',
    formStateId: step?.formStateId ?? null,
    internalStatusId: step?.internalStatusId ?? runtimeState.internalStatusId,
    portalStatusId: step?.portalStatusId ?? runtimeState.portalStatusId
  };
}

export function buildProcessPortfolioExperienceSnapshot(
  model: DbmModelV1,
  runtimeState: DbmProcessExperienceRuntimeStateV1,
  options: BuildRuntimeProcessExperienceSnapshotOptions & { processId?: string | null } = {}
): DbmProcessExperienceSnapshotV1 {
  const rootProcess = model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);
  if (!rootProcess) {
    throw new Error('Cannot build process experience snapshot because processPortfolio.mainProcessId does not resolve.');
  }

  const requestedProcess = options.processId
    ? model.processPortfolio.processes.find((process) => process.id === options.processId)
    : findStageProcess(model, runtimeState.stageId);

  const parentStage = rootProcess.stages.find((stage) => stage.id === runtimeState.stageId)
    ?? (
      requestedProcess && requestedProcess.id !== rootProcess.id
        ? findParentLinkForProcess(model, requestedProcess.id)?.parentStage
        : undefined
    )
    ?? rootProcess.stages[0];

  if (!parentStage) {
    throw new Error('Cannot build process experience snapshot without at least one root process stage.');
  }

  const firstBlockingChildRef = parentStage.childProcessRefs.find((ref) => ref.blocksParent);
  const firstBlockingChildProcess = firstBlockingChildRef
    ? model.processPortfolio.processes.find((process) => process.id === firstBlockingChildRef.processId)
    : undefined;
  const activeProcess = firstBlockingChildProcess ?? requestedProcess ?? rootProcess;
  const activeRuntime = buildRuntimeFromPortfolioProcess(model, activeProcess);
  const activeRuntimeState = activeProcess.id === rootProcess.id
    ? resolveRuntimeStateForProcess(activeProcess, runtimeState)
    : resolveRuntimeStateForProcess(activeProcess, {
      ...runtimeState,
      stageId: activeProcess.stages[0]?.id ?? runtimeState.stageId,
      stepId: activeProcess.stages[0]?.defaultStepId ?? ''
    });
  const activeSnapshot = buildRuntimeProcessExperienceSnapshot(activeRuntime, activeRuntimeState, options);
  const parentLink = activeProcess.id === rootProcess.id
    ? null
    : firstBlockingChildRef && firstBlockingChildProcess
      ? createParentLink(rootProcess, parentStage, firstBlockingChildRef)
      : (() => {
        const link = findParentLinkForProcess(model, activeProcess.id);
        return link ? createParentLink(link.parentProcess, link.parentStage, link.ref) : null;
      })();
  const blockedParentStage = firstBlockingChildRef && firstBlockingChildProcess
    ? createBlockedParentStage(rootProcess, parentStage, firstBlockingChildProcess, firstBlockingChildRef)
    : null;

  return {
    ...activeSnapshot,
    rootProcess: {
      id: rootProcess.id,
      displayName: rootProcess.displayName,
      displayMode: rootProcess.mainDisplayMode,
      currentStageId: parentStage.id,
      stages: rootProcess.stages.map(toHierarchyStage)
    },
    activeProcess: {
      id: activeProcess.id,
      displayName: activeProcess.displayName,
      role: activeProcess.role,
      stages: activeSnapshot.stages,
      steps: activeSnapshot.steps,
      transitions: activeSnapshot.transitions,
      parentLink
    },
    blockedParentStage,
    hierarchy: {
      processes: model.processPortfolio.processes.map(toHierarchyProcess)
    }
  };
}
