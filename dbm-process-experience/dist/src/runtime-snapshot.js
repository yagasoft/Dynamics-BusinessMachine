function toActorRef(actor) {
    if (!actor) {
        return null;
    }
    return {
        id: actor.id,
        displayName: actor.displayName,
        actorType: actor.actorType
    };
}
function toStatusRef(status) {
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
function toOutcomeRef(outcome, isAvailable) {
    if (!outcome) {
        return null;
    }
    return {
        id: outcome.id,
        displayName: outcome.displayName,
        isAvailable
    };
}
function findStartStage(runtime) {
    return runtime.stages.find((stage) => stage.stageType === 'start') ?? runtime.stages[0];
}
function findShortestStagePath(runtime, targetStageId) {
    const startStage = findStartStage(runtime);
    if (!startStage) {
        return targetStageId ? [targetStageId] : [];
    }
    if (startStage.id === targetStageId) {
        return [startStage.id];
    }
    const queue = [[startStage.id]];
    const visited = new Set([startStage.id]);
    const transitionsBySource = new Map();
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
function resolveCurrentStage(runtime, runtimeState) {
    return runtime.stages.find((stage) => stage.id === runtimeState.stageId) ?? findStartStage(runtime);
}
function resolveCurrentStep(runtime, runtimeState, currentStage) {
    if (!currentStage) {
        return undefined;
    }
    return runtime.steps.find((step) => step.id === runtimeState.stepId && step.stageId === currentStage.id)
        ?? runtime.steps.find((step) => step.id === currentStage.defaultStepId)
        ?? runtime.steps.find((step) => step.stageId === currentStage.id);
}
function allowsMissingCurrentStep(currentStage, currentStep) {
    return !currentStep && currentStage.stageType === 'end' && currentStage.stepIds.length === 0 && currentStage.defaultStepId == null;
}
function createStageVisibility(stage, audience) {
    return audience === 'portal' && stage.portalVisibility === 'hidden' ? 'collapsed-hidden' : 'visible';
}
function buildProjectionMessage(currentFormId, currentStage, currentStageVisibility) {
    const messages = [];
    if (currentStageVisibility === 'collapsed-hidden') {
        messages.push('Current work is progressing in an internal stage.');
    }
    if (currentFormId && currentStage.formId && currentStage.formId !== currentFormId) {
        messages.push('This record has moved to a different DBM form. Open the active form to continue the process.');
    }
    return messages.length > 0 ? messages.join(' ') : null;
}
export function buildRuntimeProcessExperienceSnapshot(runtime, runtimeState, options = {}) {
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
    const directSuccessorStageIds = new Set(runtime.transitions
        .filter((transition) => transition.fromStageId === currentStage.id)
        .map((transition) => transition.toStageId));
    const stages = runtime.stages.map((stage) => {
        let state = 'upcoming';
        if (stage.id === currentStage.id) {
            state = 'current';
        }
        else if (completedStageIds.has(stage.id)) {
            state = 'completed';
        }
        else if (directSuccessorStageIds.has(stage.id)) {
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
        let state = 'upcoming';
        if (currentStep && step.id === currentStep.id) {
            state = 'current';
        }
        else if (completedStepIds.has(step.id)) {
            state = 'completed';
        }
        else if (step.stageId === currentStage.id) {
            const stepIndex = currentStageStepIds.indexOf(step.id);
            if (stepIndex > currentStepIndex) {
                state = 'available';
            }
        }
        else if (directSuccessorStageIds.has(step.stageId)) {
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
        let state = 'upcoming';
        if (completedStageIds.has(transition.fromStageId) && pathSet.has(transition.toStageId)) {
            state = 'completed';
        }
        else if (transition.fromStageId === currentStage.id && availableOutcomeIds.has(transition.outcomeId)) {
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
            .filter((entry) => !!entry),
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
