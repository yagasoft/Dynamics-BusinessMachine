import { MarkerType, type Edge, type Node, type XYPosition } from '@xyflow/react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { buildIssueDecorationMap, type IssueDecorationSummary } from './issueTargets';

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
  stageId: string;
  label: string;
  stageType: string;
  actorLabel: string | null;
  inPortId: string;
  outcomes: Array<{
    portId: string;
    label: string | null;
  }>;
  collapsed: boolean;
  stepCount: number;
  defaultStepLabel: string | null;
  currentStepLabel: string | null;
  issueSummary: IssueDecorationSummary | null;
}

export interface FlowStepData {
  kind: 'step';
  stepId: string;
  label: string;
  stepType: string;
  stageLabel: string | null;
  ownerLabel: string | null;
  inPortId: string;
  outPortId: string;
  issueSummary: IssueDecorationSummary | null;
}

export interface FlowOutcomeData {
  kind: 'outcome';
  label: string;
  inPortId: string;
  issueSummary: IssueDecorationSummary | null;
}

export interface DesignerFlowEdgeData {
  kind: 'stage-transition' | 'step-transition';
  mode: 'overview' | 'detail';
  emphasis: 'normal' | 'muted';
  issueSummary: IssueDecorationSummary | null;
  onSelectEdge?: (edgeId: string) => void;
}

export type DesignerFlowNodeData = FlowLaneData | FlowStageData | FlowStepData | FlowOutcomeData;
export type DesignerFlowNode = Node<DesignerFlowNodeData, 'lane' | 'stage' | 'step' | 'outcome'>;
export type DesignerFlowEdge = Edge<DesignerFlowEdgeData>;

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
const laneHeight = 460;
const laneGap = 28;
const stageStartX = 170;
const stageGapX = 360;
const stageOffsetY = 62;
const expandedStepOffsetY = 204;
const expandedStepGapX = 212;
const outcomeStartX = 220;
const outcomeGapX = 260;
const outcomeHeightOffset = 120;
const stageWidth = 280;
const stageHeight = 168;
const stepWidth = 188;
const stepHeight = 96;

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

function isStageCollapsed(document: DesignerDocument, stageId: string): boolean {
  return document.workspace.collapsedNodeIds.includes(`stage:${stageId}`);
}

function stageForNode(document: DesignerDocument, nodeId: string) {
  return document.model.process.stages.find((stage) => `stage:${stage.id}` === nodeId) ?? null;
}

function buildFlowGraph(document: DesignerDocument): DesignerFlowGraphDocument {
  const issueDecorationMap = buildIssueDecorationMap(document);
  const laneIndexById = new Map(document.graph.groups.map((group, index) => [group.id, index]));
  const stageIndexById = new Map(document.model.process.stages.map((stage, index) => [stage.id, index]));
  const actorLabelById = new Map(document.model.process.actors.map((actor) => [actor.id, actor.displayName]));
  const stepById = new Map(document.model.process.steps.map((step) => [step.id, step]));
  const stageById = new Map(document.model.process.stages.map((stage) => [stage.id, stage]));
  const expandedStageIds = new Set(
    document.model.process.stages
      .filter((stage) => !isStageCollapsed(document, stage.id))
      .map((stage) => stage.id)
  );
  const stageNodesWidth = Math.max(1120, document.model.process.stages.length * stageGapX + 240);

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
      width: stageNodesWidth,
      height: laneHeight,
      zIndex: 0,
      pointerEvents: 'none'
    }
  }));

  const stageNodes: DesignerFlowNode[] = document.graph.nodes
    .filter((node) => node.kind === 'stage')
    .map((node) => {
      const stage = stageById.get(node.semanticRef.stageId ?? '');
      const stageIndex = stageIndexById.get(node.semanticRef.stageId ?? '') ?? 0;
      const laneIndex = node.groupId ? (laneIndexById.get(node.groupId) ?? 0) : 0;
      const collapsed = isStageCollapsed(document, node.semanticRef.stageId ?? '');
      const fallbackPosition = {
        x: stageStartX + stageIndex * stageGapX,
        y: laneTop + laneIndex * (laneHeight + laneGap) + stageOffsetY
      };
      const position = resolveFlowPosition(document, node.id, fallbackPosition);
      const currentStep = stage?.id === document.workspace.preview.stageId
        ? document.model.process.steps.find((step) => step.id === document.workspace.preview.stepId)
        : null;
      const defaultStep = stage?.defaultStepId
        ? stepById.get(stage.defaultStepId)
        : null;

      return {
        id: node.id,
        type: 'stage',
        position,
        data: {
          kind: 'stage',
          stageId: stage?.id ?? node.semanticRef.stageId ?? node.id,
          label: node.label,
          stageType: stage?.stageType ?? 'task',
          actorLabel: stage?.actorId ? actorLabelById.get(stage.actorId) ?? null : null,
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`,
          outcomes: node.ports
            .filter((port) => port.role === 'outcome')
            .map((port) => ({
              portId: port.id,
              label: port.label
            })),
          collapsed,
          stepCount: stage?.stepIds.length ?? 0,
          defaultStepLabel: defaultStep?.displayName ?? null,
          currentStepLabel: currentStep?.displayName ?? null,
          issueSummary: issueDecorationMap[node.id] ?? null
        },
        selected: document.selectionId === node.id,
        draggable: true,
        style: {
          width: stageWidth,
          minHeight: stageHeight,
          zIndex: 2
        }
      };
    });

  const stagePositionById = new Map(stageNodes.map((node) => [node.id, node.position]));

  const stepNodes: DesignerFlowNode[] = document.graph.nodes
    .filter((node) => node.kind === 'step' && expandedStageIds.has(node.semanticRef.stageId ?? ''))
    .map((node) => {
      const step = document.model.process.steps.find((entry) => entry.id === node.semanticRef.stepId);
      const stage = stageById.get(node.semanticRef.stageId ?? '');
      const stepIndex = stage?.stepIds.findIndex((stepId) => stepId === step?.id) ?? 0;
      const stagePosition = stagePositionById.get(`stage:${node.semanticRef.stageId ?? ''}`) ?? { x: stageStartX, y: laneTop };
      const fallbackPosition = {
        x: stagePosition.x + stepIndex * expandedStepGapX,
        y: stagePosition.y + expandedStepOffsetY
      };
      const position = resolveFlowPosition(document, node.id, fallbackPosition);

      return {
        id: node.id,
        type: 'step',
        position,
        data: {
          kind: 'step',
          stepId: step?.id ?? node.semanticRef.stepId ?? node.id,
          label: node.label,
          stepType: step?.stepType ?? 'review',
          stageLabel: stage?.displayName ?? null,
          ownerLabel: step?.ownerActorId ? actorLabelById.get(step.ownerActorId) ?? null : null,
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`,
          outPortId: node.ports.find((port) => port.role === 'primary-out')?.id ?? `${node.id}:out`,
          issueSummary: issueDecorationMap[node.id] ?? null
        },
        selected: document.selectionId === node.id,
        draggable: false,
        style: {
          width: stepWidth,
          minHeight: stepHeight,
          zIndex: 3
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
          inPortId: node.ports.find((port) => port.role === 'primary-in')?.id ?? `${node.id}:in`,
          issueSummary: issueDecorationMap[node.id] ?? null
        },
        selected: document.selectionId === node.id,
        draggable: false,
        style: {
          width: 190,
          minHeight: 64,
          zIndex: 1
        }
      };
    });

  const stageEdges: DesignerFlowEdge[] = document.graph.edges
    .filter((edge) => edge.kind === 'stage-transition')
    .map((edge) => {
      const sourceStage = stageForNode(document, edge.sourceNodeId);
      return {
        id: edge.id,
        source: edge.sourceNodeId,
        sourceHandle: edge.sourcePortId,
        target: edge.targetNodeId,
        targetHandle: edge.targetPortId,
        label: edge.label ?? undefined,
        selected: document.selectionId === edge.id,
        selectable: true,
        focusable: true,
        deletable: true,
        type: 'dbm-edge',
        markerEnd: {
          type: MarkerType.ArrowClosed
        },
        data: {
          kind: edge.kind,
          mode: 'overview',
          emphasis: sourceStage && expandedStageIds.has(sourceStage.id) ? 'muted' : 'normal',
          issueSummary: issueDecorationMap[edge.id] ?? null
        }
      };
    });

  const stepEdges: DesignerFlowEdge[] = document.graph.edges
    .filter((edge) => edge.kind === 'step-transition')
    .filter((edge) => {
      const sourceStep = edge.sourceNodeId.startsWith('step:')
        ? document.model.process.steps.find((step) => `step:${step.id}` === edge.sourceNodeId)
        : null;
      return !!sourceStep && expandedStageIds.has(sourceStep.stageId);
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourcePortId,
      target: edge.targetNodeId,
      targetHandle: edge.targetPortId,
      label: edge.label ?? undefined,
      selected: document.selectionId === edge.id,
      selectable: true,
      focusable: true,
      deletable: true,
      type: 'dbm-edge',
      markerEnd: {
        type: MarkerType.ArrowClosed
      },
      data: {
        kind: edge.kind,
        mode: 'detail',
        emphasis: 'normal',
        issueSummary: issueDecorationMap[edge.id] ?? null
      }
    }));

  return {
    nodes: [...laneNodes, ...stageNodes, ...stepNodes, ...outcomeNodes],
    edges: [...stageEdges, ...stepEdges]
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
