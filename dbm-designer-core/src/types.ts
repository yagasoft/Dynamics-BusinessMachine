import type {
  DbmDesignerGraphDocumentV1,
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessExperienceAudienceV1,
  DbmProcessV1,
  DbmStageV1,
  DbmSubjectHandoffV1,
  DbmStepV1
} from 'dbm-contract';

export type DesignerNodeKind =
  | 'document'
  | 'package'
  | 'process-portfolio'
  | 'process'
  | 'collection'
  | 'actor'
  | 'variable'
  | 'status'
  | 'task'
  | 'notification'
  | 'stage'
  | 'step'
  | 'transition'
  | 'step-transition'
  | 'outcome'
  | 'forms'
  | 'form'
  | 'form-entity-binding'
  | 'layout'
  | 'region'
  | 'element'
  | 'form-state'
  | 'metadata'
  | 'entity'
  | 'field'
  | 'relationship'
  | 'rules'
  | 'rule'
  | 'runtime'
  | 'request-contract'
  | 'result-contract'
  | 'ownership'
  | 'artifacts'
  | 'artifact';

export type DesignerIssueLevel = 'error' | 'warning' | 'info';

export interface DesignerIssue {
  level: DesignerIssueLevel;
  code: string;
  message: string;
  path: string;
  nodeId?: string;
}

export interface DesignerNodeRef {
  id: string;
  modelId: string | null;
  kind: DesignerNodeKind;
  label: string;
  path: string;
  parentId: string | null;
  children: DesignerNodeRef[];
}

export interface DesignerDocument {
  model: DbmModelV1;
  workspace: DbmDesignerWorkspaceV1;
  graph: DbmDesignerGraphDocumentV1;
  tree: DesignerNodeRef[];
  index: Record<string, DesignerNodeRef>;
  selectionId: string | null;
  dirty: boolean;
  issues: DesignerIssue[];
}

export interface DesignerModelPackage {
  model: DbmModelV1;
  workspace: DbmDesignerWorkspaceV1;
}

export interface ProcessExperienceSnapshotBuildOptions {
  audience?: DbmProcessExperienceAudienceV1;
  completedStageIds?: string[];
  completedStepIds?: string[];
  availableOutcomeIds?: string[];
}

export interface DesignerCommandResult {
  document: DesignerDocument;
  affectedNodeId: string | null;
  issues: DesignerIssue[];
}

export type DesignerClipboardPayload =
  | {
      kind: 'stage';
      processId: string;
      stage: DbmStageV1;
      steps: DbmStepV1[];
    }
  | {
      kind: 'step';
      processId: string;
      step: DbmStepV1;
    };

export interface AddNodeCommand {
  kind:
    | 'process'
    | 'actor'
    | 'variable'
    | 'status'
    | 'task'
    | 'notification'
    | 'stage'
    | 'step'
    | 'transition'
    | 'step-transition'
    | 'outcome'
    | 'form'
    | 'form-entity-binding'
    | 'region'
    | 'element'
    | 'form-state'
    | 'entity'
    | 'field'
    | 'relationship'
    | 'rule'
    | 'artifact';
  parentId: string;
  index?: number;
  value?: unknown;
}

export interface UpdateNodeCommand {
  nodeId: string;
  value: unknown;
}

export interface RemoveNodeCommand {
  nodeId: string;
}

export interface MoveNodeCommand {
  nodeId: string;
  targetIndex: number;
  targetParentId?: string;
}

export type DesignerCommand = AddNodeCommand | UpdateNodeCommand | RemoveNodeCommand | MoveNodeCommand;

export type DesignerGraphConnectionTarget =
  | { stepId: string }
  | { stageId: string }
  | { outcomeId: string };

export type DesignerGraphIntent =
  | {
      kind: 'add-process';
      targetIndex?: number;
      process?: DbmProcessV1;
    }
  | {
      kind: 'add-child-process';
      parentProcessId: string;
      parentStageId: string;
      targetIndex?: number;
      process?: DbmProcessV1;
    }
  | {
      kind: 'add-stage';
      processId: string;
      targetIndex?: number;
      actorId?: string;
      preferredPosition?: { x: number; y: number };
    }
  | {
      kind: 'add-outcome';
      processId: string;
      targetIndex?: number;
    }
  | {
      kind: 'add-step';
      processId: string;
      stageId: string;
      targetIndex?: number;
    }
  | {
      kind: 'rename-node';
      nodeId: string;
      label: string;
    }
  | {
      kind: 'update-process';
      processId: string;
      value: Partial<Pick<DbmProcessV1, 'displayName' | 'processTypeId' | 'mainDisplayMode' | 'statusId' | 'portalStatusId' | 'renderOrder' | 'subProcessVisibility'>>;
    }
  | {
      kind: 'update-stage';
      processId: string;
      stageId: string;
      value: Partial<Pick<DbmStageV1, 'displayName' | 'stageCategory' | 'stageKindId' | 'scope' | 'childProcessRefs' | 'actorId' | 'formId' | 'portalVisibility' | 'statusId' | 'portalStatusId'>>;
    }
  | {
      kind: 'rebind-stage-form';
      processId: string;
      stageId: string;
      formId: string | null;
    }
  | {
      kind: 'update-stage-outcomes';
      processId: string;
      stageId: string;
      outcomeIds: string[];
    }
  | {
      kind: 'update-step';
      processId: string;
      stepId: string;
      value: Partial<Pick<DbmStepV1, 'displayName' | 'workCategory' | 'workKindId' | 'ownerActorId' | 'internalStatusId' | 'portalStatusId' | 'formStateId'>>;
    }
  | {
      kind: 'update-transition-handoff';
      processId: string;
      transitionId: string;
      subjectHandoff: DbmSubjectHandoffV1 | null;
    }
  | {
      kind: 'update-step-transition-handoff';
      processId: string;
      stepTransitionId: string;
      subjectHandoff: DbmSubjectHandoffV1 | null;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
    }
  | {
      kind: 'move-process';
      processId: string;
      targetIndex: number;
    }
  | {
      kind: 'move-stage';
      processId?: string;
      sourceProcessId?: string;
      stageId: string;
      targetProcessId?: string;
      targetIndex: number;
    }
  | {
      kind: 'attach-child-process-ref';
      parentProcessId: string;
      parentStageId: string;
      childProcessId: string;
    }
  | {
      kind: 'detach-child-process-ref';
      parentProcessId: string;
      parentStageId: string;
      refId: string;
    }
  | {
      kind: 'move-child-process-ref';
      sourceProcessId: string;
      sourceStageId: string;
      refId: string;
      targetProcessId: string;
      targetStageId: string;
    }
  | {
      kind: 'move-step';
      processId: string;
      stepId: string;
      targetStageId: string;
      targetIndex: number;
    }
  | {
      kind: 'create-stage-transition';
      processId: string;
      fromStageId: string;
      toStageId: string;
      outcomeId: string;
    }
  | {
      kind: 'create-step-transition';
      processId: string;
      fromStepId: string;
      target: DesignerGraphConnectionTarget;
    }
  | {
      kind: 'remove-edge';
      edgeId: string;
    };
