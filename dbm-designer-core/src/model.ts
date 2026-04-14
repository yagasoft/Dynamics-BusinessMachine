import type { DbmDesignerWorkspaceV1, DbmModelV1 } from 'dbm-contract';
import { DOCUMENT_NODE_ID } from './node-ids';
import { buildDesignerGraphDocument } from './graph-document';
import { buildTree, indexTree } from './tree';
import type { DesignerDocument, DesignerModelPackage } from './types';
import { validateDocument } from './validate';

function resolveDefaultPreviewStageId(model: DbmModelV1): string | null {
  return model.process.stages.find((stage) => stage.stageType === 'start')?.id ?? model.process.stages[0]?.id ?? null;
}

function resolveDefaultPreviewStepId(model: DbmModelV1, stageId: string | null): string | null {
  if (!stageId) {
    return model.process.steps[0]?.id ?? null;
  }

  const stage = model.process.stages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    return model.process.steps[0]?.id ?? null;
  }

  return stage.defaultStepId
    ?? stage.stepIds[0]
    ?? model.process.steps.find((step) => step.stageId === stageId)?.id
    ?? model.process.steps[0]?.id
    ?? null;
}

export function createDefaultWorkspace(model: DbmModelV1): DbmDesignerWorkspaceV1 {
  const stageId = resolveDefaultPreviewStageId(model);

  return {
    schemaVersion: 'dbm.designer.workspace/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    nodePositions: {},
    collapsedNodeIds: [],
    selectionNodeId: DOCUMENT_NODE_ID,
    panels: {
      catalog: { open: true, size: 280 },
      inspector: { open: true, size: 360 },
      preview: { open: true, size: 420 },
      diagnostics: { open: false, size: 260 }
    },
    preview: {
      mode: 'internal',
      stageId,
      stepId: resolveDefaultPreviewStepId(model, stageId)
    }
  };
}

function normalizeWorkspace(
  model: DbmModelV1,
  workspace: DbmDesignerWorkspaceV1 | null | undefined,
  selectionId: string | null,
  index: Record<string, unknown>
): DbmDesignerWorkspaceV1 {
  const baseWorkspace = workspace ? structuredClone(workspace) : createDefaultWorkspace(model);
  const previewStageId = model.process.stages.some((stage) => stage.id === baseWorkspace.preview?.stageId)
    ? baseWorkspace.preview.stageId
    : resolveDefaultPreviewStageId(model);
  const previewStepId = model.process.steps.some((step) => step.id === baseWorkspace.preview?.stepId && step.stageId === previewStageId)
    ? baseWorkspace.preview.stepId
    : resolveDefaultPreviewStepId(model, previewStageId);
  const effectiveSelectionId = selectionId && index[selectionId] ? selectionId : baseWorkspace.selectionNodeId;

  return {
    schemaVersion: 'dbm.designer.workspace/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    viewport: {
      x: baseWorkspace.viewport?.x ?? 0,
      y: baseWorkspace.viewport?.y ?? 0,
      zoom: baseWorkspace.viewport?.zoom ?? 1
    },
    nodePositions: baseWorkspace.nodePositions ?? {},
    collapsedNodeIds: Array.isArray(baseWorkspace.collapsedNodeIds) ? baseWorkspace.collapsedNodeIds : [],
    selectionNodeId: effectiveSelectionId && index[effectiveSelectionId] ? effectiveSelectionId : DOCUMENT_NODE_ID,
    panels: {
      catalog: {
        open: baseWorkspace.panels?.catalog?.open ?? true,
        size: baseWorkspace.panels?.catalog?.size ?? 280
      },
      inspector: {
        open: baseWorkspace.panels?.inspector?.open ?? true,
        size: baseWorkspace.panels?.inspector?.size ?? 360
      },
      preview: {
        open: baseWorkspace.panels?.preview?.open ?? true,
        size: baseWorkspace.panels?.preview?.size ?? 420
      },
      diagnostics: {
        open: baseWorkspace.panels?.diagnostics?.open ?? false,
        size: baseWorkspace.panels?.diagnostics?.size ?? 260
      }
    },
    preview: {
      mode: baseWorkspace.preview?.mode ?? 'internal',
      stageId: previewStageId,
      stepId: previewStepId
    }
  };
}

export function createDocument(
  model: DbmModelV1,
  dirty = false,
  selectionId: string | null = DOCUMENT_NODE_ID,
  workspace?: DbmDesignerWorkspaceV1 | null
): DesignerDocument {
  const clonedModel = structuredClone(model);
  const tree = buildTree(clonedModel);
  const index = indexTree(tree);
  const graph = buildDesignerGraphDocument(clonedModel);
  const normalizedWorkspace = normalizeWorkspace(clonedModel, workspace, selectionId, index);
  const nextDocument: DesignerDocument = {
    model: clonedModel,
    workspace: normalizedWorkspace,
    graph,
    tree,
    index,
    selectionId: normalizedWorkspace.selectionNodeId,
    dirty,
    issues: []
  };
  const issues = validateDocument(nextDocument);

  return {
    ...nextDocument,
    issues
  };
}

export function loadModel(model: DbmModelV1): DesignerDocument {
  return createDocument(model, false);
}

export function loadModelPackage(model: DbmModelV1, workspace?: DbmDesignerWorkspaceV1 | null): DesignerDocument {
  return createDocument(model, false, workspace?.selectionNodeId ?? DOCUMENT_NODE_ID, workspace);
}

export function serializeModel(document: DesignerDocument): DbmModelV1 {
  return structuredClone(document.model);
}

export function serializeWorkspace(document: DesignerDocument): DbmDesignerWorkspaceV1 {
  const workspace = structuredClone(document.workspace);
  workspace.packageId = document.model.package.id;
  workspace.packageVersion = document.model.package.version;
  workspace.selectionNodeId = document.selectionId;
  return workspace;
}

export function serializeModelPackage(document: DesignerDocument): DesignerModelPackage {
  return {
    model: serializeModel(document),
    workspace: serializeWorkspace(document)
  };
}
