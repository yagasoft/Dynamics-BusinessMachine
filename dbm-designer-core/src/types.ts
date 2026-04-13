import type { DbmModelV1 } from 'dbm-contract';

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
  tree: DesignerNodeRef[];
  index: Record<string, DesignerNodeRef>;
  selectionId: string | null;
  dirty: boolean;
  issues: DesignerIssue[];
}

export interface DesignerCommandResult {
  document: DesignerDocument;
  affectedNodeId: string | null;
  issues: DesignerIssue[];
}

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
