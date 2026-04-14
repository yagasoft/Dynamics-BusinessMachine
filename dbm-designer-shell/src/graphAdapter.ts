import { MarkerType, type Edge, type Node, type XYPosition } from '@xyflow/react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';

export interface DesignerGraphAdapter<TGraph, TIntent> {
  name: string;
  toLibraryGraph(document: DesignerDocument): TGraph;
  fromLibraryIntent(intent: TIntent): DesignerGraphIntent;
}

export interface FlowLaneData {
  label: string;
}

export interface FlowStageData {
  kind: 'stage';
  label: string;
  stageType: string;
  actorLabel: string | null;
  inPortId: string;
  outcomes: Array<{
    portId: string;
    label: string | null;
  }>;
}

export interface FlowStepData {
  kind: 'step';
  label: string;
  stepType: string;
  stageLabel: string | null;
  inPortId: string;
  outPortId: string;
}

export interface FlowOutcomeData {
  kind: 'outcome';
  label: string;
  inPortId: string;
}

export type DesignerFlowNodeData = FlowLaneData | FlowStageData | FlowStepData | FlowOutcomeData;
export type DesignerFlowNode = Node<DesignerFlowNodeData, 'lane' | 'stage' | 'step' | 'outcome'>;
export type DesignerFlowEdge = Edge<{ kind: 'stage-transition' | 'step-transition' }>;

export interface DesignerFlowGraphDocument {
  nodes: DesignerFlowNode[];
  edges: DesignerFlowEdge[];
}

export type XyFlowLibraryIntent =
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
    }
  | {
      kind: 'connect';
      sourceNodeId: string;
      sourceHandleId: string;
      targetNodeId: string;
      targetHandleId: string;
    }
  | {
      kind: 'remove-edge';
      edgeId: string;
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

const laneTop = 40;
const laneHeight = 340;
const laneGap = 24;
const stageStartX = 160;
const stageGapX = 340;
const stageOffsetY = 72;
const stepOffsetX = 24;
const stepOffsetY = 150;
const stepGapY = 110;
const outcomeStartX = 220;
const outcomeGapX = 250;
const outcomeHeightOffset = 120;
const stageWidth = 228;
const stageHeight = 120;
const stepWidth = 176;
const stepHeight = 84;

function parseOutcomePort(handleId: string): { stageId: string; outcomeId: string } | null {
  const match = /^port:stage:(.+):outcome:(.+)$/.exec(handleId);
  if (!match) {
    return null;
  }

  return {
    stageId: match[1],
    outcomeId: match[2]
  };
}

function resolveFlowPosition(document: DesignerDocument, nodeId: string, fallback: XYPosition): XYPosition {
  const stored = document.workspace.nodePositions[nodeId];
  if (!stored) {
    return fallback;
  }

  return {
    x: stored.x,
    y: stored.y
  };
}

function buildFlowGraph(document: DesignerDocument): DesignerFlowGraphDocument {
  const laneIndexById = new Map(document.graph.groups.map((group, index) => [group.id, index]));
  const stageIndexById = new Map(document.model.process.stages.map((stage, index) => [stage.id, index]));
  const stageLabelById = new Map(document.model.process.stages.map((stage) => [stage.id, stage.displayName]));
  const stageById = new Map(document.model.process.stages.map((stage) => [stage.id, stage]));

  const laneNodes: DesignerFlowNode[] = document.graph.groups.map((group, index) => ({
    id: group.id,
    type: 'lane',
    position: {
      x: 40,
      y: laneTop + index * (laneHeight + laneGap)
    },
    data: {
      label: group.label
    },
    draggable: false,
    selectable: false,
    focusable: false,
    style: {
      width: Math.max(960, document.model.process.stages.length * stageGapX + 120),
      height: laneHeight,
      zIndex: 0
    }
  }));

  const stageNodes: DesignerFlowNode[] = document.graph.nodes
    .filter((node) => node.kind === 'stage')
    .map((node) => {
      const stage = stageById.get(node.semanticRef.stageId ?? '');
      const stageIndex = stageIndexById.get(node.semanticRef.stageId ?? '') ?? 0;
      const laneIndex = node.groupId ? (laneIndexById.get(node.groupId) ?? 0) : 0;
      const fallbackPosition = {
        x: stageStartX + stageIndex * stageGapX,
        y: laneTop + laneIndex * (laneHeight + laneGap) + stageOffsetY
      };
      const position = resolveFlowPosition(document, node.id, fallbackPosition);

      return {
        id: node.id,
        type: 'stage',
        position,
        data: {
          kind: 'stage',
          label: node.label,
          stageType: stage?.stageType ?? 'task',
          actorLabel: stage?.actorId
            ? document.model.process.actors.find((actor) => actor.id === stage.actorId)?.displayName ?? null
            : null,
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`,
          outcomes: node.ports
            .filter((port) => port.role === 'outcome')
            .map((port) => ({
              portId: port.id,
              label: port.label
            }))
        },
        selected: document.selectionId === node.id,
        style: {
          width: stageWidth,
          minHeight: stageHeight
        }
      };
    });

  const stagePositionById = new Map(stageNodes.map((node) => [node.id, node.position]));

  const stepNodes: DesignerFlowNode[] = document.graph.nodes
    .filter((node) => node.kind === 'step')
    .map((node) => {
      const step = document.model.process.steps.find((entry) => entry.id === node.semanticRef.stepId);
      const stage = stageById.get(node.semanticRef.stageId ?? '');
      const stepIndex = stage?.stepIds.findIndex((stepId) => stepId === step?.id) ?? 0;
      const stagePosition = stagePositionById.get(`stage:${node.semanticRef.stageId ?? ''}`) ?? { x: stageStartX, y: laneTop };
      const fallbackPosition = {
        x: stagePosition.x + stepOffsetX,
        y: stagePosition.y + stepOffsetY + Math.max(0, stepIndex) * stepGapY
      };
      const position = resolveFlowPosition(document, node.id, fallbackPosition);

      return {
        id: node.id,
        type: 'step',
        position,
        data: {
          kind: 'step',
          label: node.label,
          stepType: step?.stepType ?? 'review',
          stageLabel: stageLabelById.get(node.semanticRef.stageId ?? '') ?? null,
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`,
          outPortId: node.ports.find((port) => port.role === 'primary-out')?.id ?? `${node.id}:out`
        },
        selected: document.selectionId === node.id,
        style: {
          width: stepWidth,
          minHeight: stepHeight
        }
      };
    });

  const outcomeBaseY = laneTop + document.graph.groups.length * (laneHeight + laneGap) + outcomeHeightOffset;
  const outcomeNodes: DesignerFlowNode[] = document.graph.nodes
    .filter((node) => node.kind === 'outcome')
    .map((node, index) => {
      const fallbackPosition = {
        x: outcomeStartX + index * outcomeGapX,
        y: outcomeBaseY
      };
      const position = resolveFlowPosition(document, node.id, fallbackPosition);

      return {
        id: node.id,
        type: 'outcome',
        position,
        data: {
          kind: 'outcome',
          label: node.label,
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`
        },
        selected: document.selectionId === node.id,
        style: {
          width: 180,
          minHeight: 60
        }
      };
    });

  const edges: DesignerFlowEdge[] = document.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePortId,
    target: edge.targetNodeId,
    targetHandle: edge.targetPortId,
    label: edge.label ?? undefined,
    selected: document.selectionId === edge.id,
    animated: edge.id === document.selectionId,
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed
    },
    data: {
      kind: edge.kind
    }
  }));

  return {
    nodes: [...laneNodes, ...stageNodes, ...stepNodes, ...outcomeNodes],
    edges
  };
}

export const xyflowGraphAdapter: DesignerGraphAdapter<DesignerFlowGraphDocument, XyFlowLibraryIntent> = {
  name: 'xyflow',
  toLibraryGraph(document) {
    return buildFlowGraph(document);
  },
  fromLibraryIntent(intent) {
    switch (intent.kind) {
      case 'rename-node':
      case 'move-stage':
      case 'move-step':
      case 'remove-edge':
        return intent;

      case 'connect': {
        const outcome = parseOutcomePort(intent.sourceHandleId);
        if (outcome && intent.targetNodeId.startsWith('stage:')) {
          return {
            kind: 'create-stage-transition',
            fromStageId: outcome.stageId,
            toStageId: intent.targetNodeId.slice('stage:'.length),
            outcomeId: outcome.outcomeId
          };
        }

        if (intent.sourceNodeId.startsWith('step:')) {
          const fromStepId = intent.sourceNodeId.slice('step:'.length);
          if (intent.targetNodeId.startsWith('stage:')) {
            return {
              kind: 'create-step-transition',
              fromStepId,
              target: {
                stageId: intent.targetNodeId.slice('stage:'.length)
              }
            };
          }

          if (intent.targetNodeId.startsWith('step:')) {
            return {
              kind: 'create-step-transition',
              fromStepId,
              target: {
                stepId: intent.targetNodeId.slice('step:'.length)
              }
            };
          }

          if (intent.targetNodeId.startsWith('outcome:')) {
            return {
              kind: 'create-step-transition',
              fromStepId,
              target: {
                outcomeId: intent.targetNodeId.slice('outcome:'.length)
              }
            };
          }
        }

        throw new Error(`Unsupported XYFlow connection from '${intent.sourceNodeId}' to '${intent.targetNodeId}'.`);
      }
    }
  }
};

export const alternatePreviewGraphAdapter: DesignerGraphAdapter<AlternatePreviewGraphDocument, AlternatePreviewLibraryIntent> = {
  name: 'alternate-preview-list',
  toLibraryGraph(document) {
    return {
      lanes: document.graph.groups.map((group) => ({
        laneId: group.id,
        title: group.label
      })),
      vertices: document.graph.nodes.map((node) => ({
        vertexId: node.id,
        caption: node.label,
        category: node.kind,
        ownerLaneId: node.groupId,
        parentVertexId: node.parentNodeId
      })),
      links: document.graph.edges.map((edge) => ({
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
