"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainProcess = getMainProcess;
exports.hasProcessPortfolio = hasProcessPortfolio;
exports.getProcessStages = getProcessStages;
exports.getProcessSteps = getProcessSteps;
exports.getProcessTransitions = getProcessTransitions;
exports.getProcessStepTransitions = getProcessStepTransitions;
exports.mapStageType = mapStageType;
exports.getStageType = getStageType;
exports.buildProcessExperienceRuntimeModelFromModel = buildProcessExperienceRuntimeModelFromModel;
function legacyProcess(model) {
    return (model.process ?? null);
}
function getMainProcess(model) {
    const portfolio = model.processPortfolio;
    const mainProcess = portfolio?.processes.find((process) => process.id === portfolio.mainProcessId) ?? portfolio?.processes[0];
    const process = mainProcess ?? legacyProcess(model);
    if (!process) {
        throw new Error('DbmModelV1 processPortfolio.mainProcessId must resolve before Dataverse synthesis can plan runtime output.');
    }
    return process;
}
function hasProcessPortfolio(model) {
    return Boolean(model.processPortfolio?.processes?.length);
}
function getProcessStages(model) {
    return getMainProcess(model).stages;
}
function getProcessSteps(model) {
    return getMainProcess(model).steps;
}
function getProcessTransitions(model) {
    return getMainProcess(model).transitions;
}
function getProcessStepTransitions(model) {
    return getMainProcess(model).stepTransitions ?? [];
}
function mapStageType(stageCategory, stageType) {
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
function getStageType(stage) {
    return mapStageType(stage.stageCategory, stage.stageType);
}
function mapStepType(workCategory, stepType) {
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
function mapActorType(actorCategory, roleKey, actorType) {
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
function buildProcessExperienceRuntimeModelFromModel(model) {
    const process = getMainProcess(model);
    return {
        packageId: model.package.id,
        packageVersion: model.package.version,
        processId: process.id,
        actors: process.actors.map((actor) => ({
            id: actor.id,
            displayName: actor.displayName,
            actorType: mapActorType(actor.actorCategory, actor.roleKey, actor.actorType)
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
            stepType: mapStepType(step.workCategory, step.stepType),
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
