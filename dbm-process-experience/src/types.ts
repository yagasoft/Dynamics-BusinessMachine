import type {
  DbmActorTypeV1,
  DbmProcessExperienceAudienceV1,
  DbmProcessExperienceSnapshotV1,
  DbmStagePortalVisibilityV1,
  DbmStageTypeV1,
  DbmStatusAudienceV1,
  DbmStatusKindV1,
  DbmStepTypeV1
} from 'dbm-contract';

export type DbmProcessExperienceModeV1 =
  | 'designer-preview'
  | 'model-driven-section'
  | 'model-driven-overlay'
  | 'portal-fixture';

export interface DbmProcessExperienceNavigationTargetV1 {
  label: string;
  tabName: string | null;
  sectionName: string | null;
  controlName: string | null;
}

export interface ProcessExperienceSurfaceProps {
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  audience?: DbmProcessExperienceAudienceV1;
  mode: DbmProcessExperienceModeV1;
  navigationTarget?: DbmProcessExperienceNavigationTargetV1 | null;
  onNavigateToFormRegion?(target: DbmProcessExperienceNavigationTargetV1): void;
  onInvokeOutcome?(outcomeId: string): void;
  onRequestFocus?(targetId: string): void;
}

export interface DbmProcessExperienceRuntimeActorV1 {
  id: string;
  displayName: string;
  actorType: DbmActorTypeV1;
}

export interface DbmProcessExperienceRuntimeStatusV1 {
  id: string;
  displayName: string;
  audience: DbmStatusAudienceV1;
  kind: DbmStatusKindV1;
}

export interface DbmProcessExperienceRuntimeOutcomeV1 {
  id: string;
  displayName: string;
}

export interface DbmProcessExperienceRuntimeStageV1 {
  id: string;
  displayName: string;
  stageType: DbmStageTypeV1;
  actorId: string;
  formId: string | null;
  portalVisibility: DbmStagePortalVisibilityV1;
  stepIds: string[];
  defaultStepId: string | null;
  allowedOutcomeIds: string[];
}

export interface DbmProcessExperienceRuntimeStepV1 {
  id: string;
  stageId: string;
  displayName: string;
  stepType: DbmStepTypeV1;
  ownerActorId: string;
  internalStatusId: string;
  portalStatusId: string | null;
  formStateId: string | null;
}

export interface DbmProcessExperienceRuntimeTransitionV1 {
  id: string;
  fromStageId: string;
  toStageId: string;
  outcomeId: string;
}

export interface DbmProcessExperienceRuntimeStateV1 {
  stageId: string;
  stepId: string;
  formStateId: string | null;
  internalStatusId: string;
  portalStatusId: string | null;
}

export interface DbmProcessExperienceRuntimeModelV1 {
  packageId: string;
  packageVersion: string;
  processId: string;
  actors: DbmProcessExperienceRuntimeActorV1[];
  statuses: DbmProcessExperienceRuntimeStatusV1[];
  outcomes: DbmProcessExperienceRuntimeOutcomeV1[];
  stages: DbmProcessExperienceRuntimeStageV1[];
  steps: DbmProcessExperienceRuntimeStepV1[];
  transitions: DbmProcessExperienceRuntimeTransitionV1[];
}

export interface BuildRuntimeProcessExperienceSnapshotOptions {
  audience?: DbmProcessExperienceAudienceV1;
  currentFormId?: string | null;
  availableOutcomeIds?: string[];
}

export interface DbmProcessExperienceSectionHostConfigV1 {
  placementMode: 'section';
  label: string;
  tabName: string;
  sectionName: string;
  sectionId: string;
  cellId: string;
  controlName: string;
  webResourceName: string;
  webResourceId: string;
  frameBridgeName: string;
  data: string;
}

export interface DbmProcessExperienceOverlayHostConfigV1 {
  placementMode: 'overlay';
  enabled: boolean;
  containerId: string;
  capabilityGuard: 'best-effort-dom';
}

export interface DbmProcessExperienceHostConfigV1 {
  packageId: string;
  processId: string;
  currentFormId: string;
  supported: DbmProcessExperienceSectionHostConfigV1;
  overlay: DbmProcessExperienceOverlayHostConfigV1;
  jumpTargetsByFormStateId: Record<string, DbmProcessExperienceNavigationTargetV1>;
}
