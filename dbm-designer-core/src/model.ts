import type { DbmModelV1 } from 'dbm-contract';
import { DOCUMENT_NODE_ID } from './node-ids';
import { buildTree, indexTree } from './tree';
import type { DesignerDocument } from './types';
import { validateModel } from './validate';

export function createDocument(model: DbmModelV1, dirty = false, selectionId: string | null = DOCUMENT_NODE_ID): DesignerDocument {
  const clonedModel = structuredClone(model);
  const tree = buildTree(clonedModel);
  const index = indexTree(tree);
  const issues = validateModel(clonedModel);

  return {
    model: clonedModel,
    tree,
    index,
    selectionId: selectionId && index[selectionId] ? selectionId : DOCUMENT_NODE_ID,
    dirty,
    issues
  };
}

export function loadModel(model: DbmModelV1): DesignerDocument {
  return createDocument(model, false);
}

export function serializeModel(document: DesignerDocument): DbmModelV1 {
  return structuredClone(document.model);
}
