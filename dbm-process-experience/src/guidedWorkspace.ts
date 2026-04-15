import type {
  DbmProcessExperienceAudienceV1,
  DbmProcessExperienceItemStateV1,
  DbmProcessExperienceSnapshotV1,
  DbmProcessExperienceStageV1,
  DbmProcessExperienceStepV1,
  DbmProcessExperienceTransitionV1
} from 'dbm-contract';

export type GuidedWorkspaceTone = DbmProcessExperienceItemStateV1 | 'hidden';

export interface GuidedWorkspaceTrackerItem {
  id: string;
  label: string;
  helperCopy: string;
  stateLabel: string;
  tone: GuidedWorkspaceTone;
  isCurrent: boolean;
  isHidden: boolean;
  actorLabel: string | null;
}

export interface GuidedWorkspaceStepItem {
  id: string;
  label: string;
  helperCopy: string;
  stateLabel: string;
  tone: GuidedWorkspaceTone;
  isCurrent: boolean;
}

export interface GuidedWorkspaceOutcomeAction {
  id: string;
  label: string;
  emphasis: 'primary' | 'secondary';
  nextCopy: string | null;
}

export interface GuidedWorkspaceFlowTransition {
  id: string;
  label: string;
  destinationLabel: string;
  tone: GuidedWorkspaceTone;
}

export interface GuidedWorkspaceFlowStage {
  id: string;
  label: string;
  helperCopy: string;
  stateLabel: string;
  tone: GuidedWorkspaceTone;
  isCurrent: boolean;
  isHidden: boolean;
  transitions: GuidedWorkspaceFlowTransition[];
}

export interface GuidedWorkspaceCurrentTask {
  stageTitle: string;
  stageLabel: string;
  stepTitle: string;
  stepSummary: string;
  helperCopy: string;
  nextCopy: string;
  statusLabel: string;
  actorLabel: string | null;
  tone: GuidedWorkspaceTone;
  isHidden: boolean;
  supportingLabel: string;
  supportingCopy: string;
  siblingSteps: GuidedWorkspaceStepItem[];
  actions: GuidedWorkspaceOutcomeAction[];
}

export interface GuidedWorkspaceViewModel {
  processTitle: string;
  introCopy: string;
  currentTask: GuidedWorkspaceCurrentTask;
  trackerItems: GuidedWorkspaceTrackerItem[];
  flowStages: GuidedWorkspaceFlowStage[];
}

function titleCaseIdentifier(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compactLabel(value: string): string {
  if (value.length <= 28) {
    return value;
  }

  const words = value.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function stateLabel(state: DbmProcessExperienceItemStateV1): string {
  switch (state) {
    case 'completed':
      return 'Done';
    case 'current':
      return 'Now';
    case 'available':
      return 'Next';
    default:
      return 'Later';
  }
}

function toneForStage(
  stage: DbmProcessExperienceStageV1,
  audience: DbmProcessExperienceAudienceV1
): GuidedWorkspaceTone {
  return audience === 'portal' && stage.visibility === 'collapsed-hidden' ? 'hidden' : stage.state;
}

function hiddenStageLabel(stage: DbmProcessExperienceStageV1): string {
  return stage.stageType === 'end' ? 'Internal completion' : 'Internal review';
}

function stageDisplayLabel(
  stage: DbmProcessExperienceStageV1,
  audience: DbmProcessExperienceAudienceV1
): string {
  return toneForStage(stage, audience) === 'hidden' ? hiddenStageLabel(stage) : stage.displayName;
}

function stageActorLabel(
  stage: DbmProcessExperienceStageV1,
  audience: DbmProcessExperienceAudienceV1
): string | null {
  return toneForStage(stage, audience) === 'hidden' ? null : stage.actor?.displayName ?? null;
}

function primaryStatusLabel(
  snapshot: DbmProcessExperienceSnapshotV1,
  audience: DbmProcessExperienceAudienceV1
): string {
  const preferred = audience === 'portal' ? snapshot.portalStatus : snapshot.internalStatus;
  return preferred?.displayName ?? snapshot.internalStatus?.displayName ?? snapshot.portalStatus?.displayName ?? 'In progress';
}

function stepSummary(stepType: DbmProcessExperienceStepV1['stepType']): string {
  switch (stepType) {
    case 'data-entry':
      return 'Fill in the details needed to keep this request moving.';
    case 'review':
      return 'Check the details and confirm everything is ready to proceed.';
    case 'approval':
      return 'Review the request and record the decision that unlocks the next stage.';
    default:
      return 'This step runs automatically once the required conditions are met.';
  }
}

function terminalStepSummary(stage: DbmProcessExperienceStageV1): string {
  return stage.stageType === 'end'
    ? 'This request has reached its end state. You can review the completed journey below if needed.'
    : 'There is no active task for this stage right now.';
}

function stageHelper(stage: DbmProcessExperienceStageV1, step: DbmProcessExperienceStepV1 | undefined): string {
  if (stage.visibility === 'collapsed-hidden') {
    return 'Internal work is in progress.';
  }

  if (stage.state === 'completed') {
    return 'This milestone has been completed.';
  }

  if (stage.state === 'current' && step) {
    return step.displayName;
  }

  if (stage.state === 'available') {
    return 'This is the next milestone in the journey.';
  }

  return 'This milestone will become available later.';
}

function buildNextCopy(
  transitions: DbmProcessExperienceTransitionV1[],
  stagesById: Map<string, DbmProcessExperienceStageV1>,
  actions: GuidedWorkspaceOutcomeAction[],
  isHidden: boolean,
  audience: DbmProcessExperienceAudienceV1
): string {
  if (isHidden) {
    return 'No action is needed from the requester right now. The next visible step will appear here when it is ready.';
  }

  if (transitions.length === 0) {
    return 'This stage is currently at its end state.';
  }

  if (actions.length === 1 && transitions.length === 1) {
    const target = stagesById.get(transitions[0].toStageId);
    return `Next, this moves to ${target ? stageDisplayLabel(target, audience) : titleCaseIdentifier(transitions[0].toStageId)}.`;
  }

  if (actions.length > 1) {
    return 'Your next choice decides where the request goes from here.';
  }

  return 'Complete the highlighted action to keep the request moving.';
}

function actionNextCopy(
  transition: DbmProcessExperienceTransitionV1 | undefined,
  stagesById: Map<string, DbmProcessExperienceStageV1>,
  audience: DbmProcessExperienceAudienceV1
): string | null {
  if (!transition) {
    return null;
  }

  const destination = stagesById.get(transition.toStageId);
  return `Moves to ${destination ? stageDisplayLabel(destination, audience) : titleCaseIdentifier(transition.toStageId)}.`;
}

export function buildGuidedWorkspaceViewModel(
  snapshot: DbmProcessExperienceSnapshotV1,
  audience: DbmProcessExperienceAudienceV1 = snapshot.audience
): GuidedWorkspaceViewModel {
  const stagesById = new Map(snapshot.stages.map((stage) => [stage.id, stage]));
  const stepsById = new Map(snapshot.steps.map((step) => [step.id, step]));
  const stepsByStageId = new Map<string, DbmProcessExperienceStepV1[]>();
  snapshot.steps.forEach((step) => {
    const stageSteps = stepsByStageId.get(step.stageId) ?? [];
    stageSteps.push(step);
    stepsByStageId.set(step.stageId, stageSteps);
  });

  const currentStage = stagesById.get(snapshot.currentStageId) ?? snapshot.stages[0];
  const currentStep = (snapshot.currentStepId ? stepsById.get(snapshot.currentStepId) : undefined)
    ?? stepsByStageId.get(currentStage.id)?.find((step) => step.state === 'current')
    ?? stepsByStageId.get(currentStage.id)?.[0];

  if (!currentStage) {
    throw new Error('Guided workspace requires a current stage.');
  }

  const currentStageTransitions = snapshot.transitions.filter((transition) => transition.fromStageId === currentStage.id);
  const currentStageTone = toneForStage(currentStage, audience);
  const isHiddenCurrentStage = currentStageTone === 'hidden';
  const isTerminalCurrentStage = !currentStep && currentStage.stageType === 'end';

  const actions: GuidedWorkspaceOutcomeAction[] = isHiddenCurrentStage
    ? []
    : snapshot.availableOutcomes.map((outcome, index) => ({
      id: outcome.id,
      label: outcome.displayName,
      emphasis: index === 0 ? 'primary' : 'secondary',
      nextCopy: actionNextCopy(
        currentStageTransitions.find((transition) => transition.outcome?.id === outcome.id),
        stagesById,
        audience
      )
    }));

  const siblingSteps: GuidedWorkspaceStepItem[] = (isHiddenCurrentStage || isTerminalCurrentStage)
    ? []
    : (stepsByStageId.get(currentStage.id) ?? []).map((step) => ({
      id: step.id,
      label: step.displayName,
      helperCopy: step.owner?.displayName ?? stepSummary(step.stepType),
      stateLabel: stateLabel(step.state),
      tone: step.state,
      isCurrent: step.id === currentStep?.id
    }));

  return {
    processTitle: titleCaseIdentifier(snapshot.processId),
    introCopy: 'Follow the highlighted step to keep this request moving.',
    currentTask: {
      stageTitle: isHiddenCurrentStage ? hiddenStageLabel(currentStage) : currentStage.displayName,
      stageLabel: currentStage.state === 'current' ? 'Current milestone' : 'Current focus',
      stepTitle: isHiddenCurrentStage
        ? 'Under internal review'
        : isTerminalCurrentStage
          ? 'Process complete'
          : currentStep?.displayName ?? 'Current task',
      stepSummary: isHiddenCurrentStage
        ? 'The request is moving through an internal stage. You can monitor progress here while the team completes the next review.'
        : isTerminalCurrentStage
          ? terminalStepSummary(currentStage)
          : stepSummary(currentStep?.stepType ?? 'system'),
      helperCopy: buildNextCopy(currentStageTransitions, stagesById, actions, isHiddenCurrentStage, audience),
      nextCopy: isHiddenCurrentStage
        ? 'We will surface the next requester-facing step here as soon as it becomes available.'
        : isTerminalCurrentStage
          ? 'This workflow has finished. No further action is required from this surface.'
          : buildNextCopy(currentStageTransitions, stagesById, actions, false, audience),
      statusLabel: primaryStatusLabel(snapshot, audience),
      actorLabel: isHiddenCurrentStage ? null : currentStage.actor?.displayName ?? currentStep?.owner?.displayName ?? null,
      tone: currentStageTone,
      isHidden: isHiddenCurrentStage,
      supportingLabel: isHiddenCurrentStage
        ? 'Current visibility'
        : isTerminalCurrentStage
          ? 'Current state'
          : 'Current visibility',
      supportingCopy: isHiddenCurrentStage
        ? 'This step is currently progressing in an internal-only part of the workflow. We will bring the next requester-facing task back here automatically.'
        : isTerminalCurrentStage
          ? 'This workflow has reached its terminal state. No additional steps are active.'
          : 'No additional steps are active for this stage right now.',
      siblingSteps,
      actions
    },
    trackerItems: snapshot.stages.map((stage) => {
      const activeStep = stage.currentStepId ? stepsById.get(stage.currentStepId) : undefined;
      const tone = toneForStage(stage, audience);
      return {
        id: stage.id,
        label: compactLabel(stageDisplayLabel(stage, audience)),
        helperCopy: stageHelper(stage, activeStep),
        stateLabel: tone === 'hidden' ? 'Internal' : stateLabel(stage.state),
        tone,
        isCurrent: stage.id === currentStage.id,
        isHidden: tone === 'hidden',
        actorLabel: stageActorLabel(stage, audience)
      };
    }),
    flowStages: snapshot.stages.map((stage) => ({
      id: stage.id,
      label: stageDisplayLabel(stage, audience),
      helperCopy: stageHelper(stage, stage.currentStepId ? stepsById.get(stage.currentStepId) : undefined),
      stateLabel: toneForStage(stage, audience) === 'hidden' ? 'Internal' : stateLabel(stage.state),
      tone: toneForStage(stage, audience),
      isCurrent: stage.id === currentStage.id,
      isHidden: toneForStage(stage, audience) === 'hidden',
      transitions: snapshot.transitions
        .filter((transition) => transition.fromStageId === stage.id)
        .map((transition) => {
          const destinationStage = stagesById.get(transition.toStageId);
          return {
            id: transition.id,
            label: transition.outcome?.displayName ?? 'Continue',
            destinationLabel: destinationStage
              ? stageDisplayLabel(destinationStage, audience)
              : titleCaseIdentifier(transition.toStageId),
            tone: transition.state
          };
        })
    }))
  };
}
