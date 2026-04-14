import type {
  DbmDesignerGraphDocumentV1,
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessExperienceAudienceV1,
  DbmStageV1,
  DbmSubjectHandoffV1,
  DbmStepV1
} from 'dbm-contract';

export type DesignerNodeKind =
  | 'document'
  | 'package'
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
      stage: DbmStageV1;
      steps: DbmStepV1[];
    }
  | {
      kind: 'step';
      step: DbmStepV1;
    };

export interface AddNodeCommand {
  kind:
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
      kind: 'add-stage';
      targetIndex?: number;
      actorId?: string;
    }
  | {
      kind: 'add-outcome';
      targetIndex?: number;
    }
  | {
      kind: 'add-step';
      stageId: string;
      targetIndex?: number;
    }
  | {
      kind: 'rename-node';
      nodeId: string;
      label: string;
    }
  | {
      kind: 'update-stage';
      stageId: string;
      value: Partial<
        Pick<
          DbmStageV1,
          'displayName'
          | 'stageType'
          | 'actorId'
          | 'formId'
          | 'portalVisibility'
        >
      >;
    }
  | {
      kind: 'rebind-stage-form';
      stageId: string;
      formId: string | null;
    }
  | {
      kind: 'update-stage-outcomes';
      stageId: string;
      outcomeIds: string[];
    }
  | {
      kind: 'update-step';
      stepId: string;
      value: Partial<
        Pick<
          DbmStepV1,
          'displayName'
          | 'stepType'
          | 'ownerActorId'
          | 'internalStatusId'
          | 'portalStatusId'
          | 'formStateId'
        >
      >;
    }
  | {
      kind: 'update-transition-handoff';
      transitionId: string;
      subjectHandoff: DbmSubjectHandoffV1 | null;
    }
  | {
      kind: 'update-step-transition-handoff';
      stepTransitionId: string;
      subjectHandoff: DbmSubjectHandoffV1 | null;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
    }
  | {
      kind: 'move-stage';
      stageId: string;
      targetIndex: number;
    }
  | {
      kind: 'move-step';
      stepId: string;
      targetStageId: string;
      targetIndex: number;
    }
  | {
      kind: 'create-stage-transition';
      fromStageId: string;
      toStageId: string;
      outcomeId: string;
    }
  | {
      kind: 'create-step-transition';
      fromStepId: string;
      target: DesignerGraphConnectionTarget;
    }
  | {
      kind: 'remove-edge';
      edgeId: string;
    };
