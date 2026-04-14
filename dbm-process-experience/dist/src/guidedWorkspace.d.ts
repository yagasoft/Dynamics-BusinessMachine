import type { DbmProcessExperienceAudienceV1, DbmProcessExperienceItemStateV1, DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
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
export declare function buildGuidedWorkspaceViewModel(snapshot: DbmProcessExperienceSnapshotV1, audience?: DbmProcessExperienceAudienceV1): GuidedWorkspaceViewModel;
