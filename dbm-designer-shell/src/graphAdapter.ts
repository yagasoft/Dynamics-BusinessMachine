import type { DbmDesignerGraphDocumentV1 } from 'dbm-contract';
import type { DesignerGraphIntent } from 'dbm-designer-core';

export interface DesignerGraphAdapter<TGraph, TIntent> {
  name: string;
  toLibraryGraph(graph: DbmDesignerGraphDocumentV1): TGraph;
  fromLibraryIntent(intent: TIntent): DesignerGraphIntent;
}

export interface PreviewGraphGroup {
  id: string;
  label: string;
}

export interface PreviewGraphNode {
  id: string;
  label: string;
  kind: string;
  parentId: string | null;
  groupId: string | null;
  portCount: number;
}

export interface PreviewGraphEdge {
  id: string;
  label: string | null;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface PreviewGraphDocument {
  groups: PreviewGraphGroup[];
  nodes: PreviewGraphNode[];
  edges: PreviewGraphEdge[];
}

export type PreviewLibraryIntent =
  | {
      kind: 'rename-node';
      nodeId: string;
      label: string;
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
    };

export const previewGraphAdapter: DesignerGraphAdapter<PreviewGraphDocument, PreviewLibraryIntent> = {
  name: 'preview-list',
  toLibraryGraph(graph) {
    return {
      groups: graph.groups.map((group) => ({
        id: group.id,
        label: group.label
      })),
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        kind: node.kind,
        parentId: node.parentNodeId,
        groupId: node.groupId,
        portCount: node.ports.length
      })),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        label: edge.label,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId
      }))
    };
  },
  fromLibraryIntent(intent) {
    return intent;
  }
};

export interface AlternatePreviewLane {
  laneId: string;
  title: string;
}

export interface AlternatePreviewVertex {
  vertexId: string;
  caption: string;
  category: string;
  ownerLaneId: string | null;
  parentVertexId: string | null;
}

export interface AlternatePreviewLink {
  linkId: string;
  caption: string | null;
  from: string;
  to: string;
}

export interface AlternatePreviewGraphDocument {
  lanes: AlternatePreviewLane[];
  vertices: AlternatePreviewVertex[];
  links: AlternatePreviewLink[];
}

export type AlternatePreviewLibraryIntent =
  | {
      action: 'retitle';
      targetId: string;
      text: string;
    }
  | {
      action: 'relocate-stage';
      stageId: string;
      ordinal: number;
    }
  | {
      action: 'relocate-step';
      stepId: string;
      stageId: string;
      ordinal: number;
    };

export const alternatePreviewGraphAdapter: DesignerGraphAdapter<AlternatePreviewGraphDocument, AlternatePreviewLibraryIntent> = {
  name: 'alternate-preview-list',
  toLibraryGraph(graph) {
    return {
      lanes: graph.groups.map((group) => ({
        laneId: group.id,
        title: group.label
      })),
      vertices: graph.nodes.map((node) => ({
        vertexId: node.id,
        caption: node.label,
        category: node.kind,
        ownerLaneId: node.groupId,
        parentVertexId: node.parentNodeId
      })),
      links: graph.edges.map((edge) => ({
        linkId: edge.id,
        caption: edge.label,
        from: edge.sourceNodeId,
        to: edge.targetNodeId
      }))
    };
  },
  fromLibraryIntent(intent) {
    switch (intent.action) {
      case 'retitle':
        return {
          kind: 'rename-node',
          nodeId: intent.targetId,
          label: intent.text
        };

      case 'relocate-stage':
        return {
          kind: 'move-stage',
          stageId: intent.stageId,
          targetIndex: intent.ordinal
        };

      case 'relocate-step':
        return {
          kind: 'move-step',
          stepId: intent.stepId,
          targetStageId: intent.stageId,
          targetIndex: intent.ordinal
        };
    }
  }
};
