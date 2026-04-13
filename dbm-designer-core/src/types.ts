import type { DbmModelV1 } from 'dbm-contract';

export type DesignerNodeKind =
  | 'document'
  | 'package'
  | 'process'
  | 'collection'
  | 'actor'
  | 'variable'
  | 'stage'
  | 'transition'
  | 'outcome'
  | 'forms'
  | 'form'
  | 'layout'
  | 'region'
  | 'element'
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
    | 'stage'
    | 'transition'
    | 'outcome'
    | 'form'
    | 'region'
    | 'element'
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
