import type { Edge, Node } from '@xyflow/react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { orderedProcesses, resolveMainProcess } from 'dbm-designer-core';

export interface DesignerGraphAdapter<TGraph, TIntent> {
  name: string;
  toLibraryGraph(document: DesignerDocument): TGraph;
  fromLibraryIntent(intent: TIntent): DesignerGraphIntent;
}

export type TimelineNodeKind = 'main-timeline' | 'sub-process-lane' | 'stage-span';

export interface TimelineNodeData extends Record<string, unknown> {
  kind: TimelineNodeKind;
  processId: string;
  label: string;
  role: 'main' | 'sub-process';
  stageId?: string;
  stageCategory?: string;
  stageKindId?: string;
  spanLabel?: string;
}

export interface TimelineEdgeData extends Record<string, unknown> {
  kind: 'stage-sequence' | 'span-reference';
  processId: string;
}

export type TimelineFlowNode = Node<TimelineNodeData>;
export type TimelineFlowEdge = Edge<TimelineEdgeData>;

export interface TimelineFlowGraphDocument {
  nodes: TimelineFlowNode[];
  edges: TimelineFlowEdge[];
}

export type XyFlowLibraryIntent =
  | {
      kind: 'select-process';
      processId: string;
    }
  | {
      kind: 'select-stage';
      processId: string;
      stageId: string;
    };

const laneGapY = 138;
const mainY = 48;
const laneStartY = 188;
const stageGapX = 190;
const stageStartX = 240;

function stageSpanLabel(stageSpan: { start: { stageId: string; fraction: number }; end: { stageId: string; fraction: number } }): string {
  return `${stageSpan.start.stageId} ${stageSpan.start.fraction} -> ${stageSpan.end.stageId} ${stageSpan.end.fraction}`;
}

function buildTimelineGraph(document: DesignerDocument): TimelineFlowGraphDocument {
  const mainProcess = resolveMainProcess(document);
  const processes = orderedProcesses(document.model);
  const nodes: TimelineFlowNode[] = [];
  const edges: TimelineFlowEdge[] = [];

  nodes.push({
    id: `timeline:${mainProcess.id}`,
    type: 'default',
    position: { x: 32, y: mainY },
    data: {
      kind: 'main-timeline',
      processId: mainProcess.id,
      label: mainProcess.displayName,
      role: 'main'
    },
    draggable: false,
    selectable: true,
    style: {
      width: Math.max(620, mainProcess.stages.length * stageGapX + 260),
      minHeight: 84,
      border: '1px solid #94a3b8',
      background: '#f8fafc',
      borderRadius: 8,
      padding: 12
    }
  });

  mainProcess.stages.forEach((stage, index) => {
    const nodeId = `stage:${mainProcess.id}:${stage.id}`;
    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: stageStartX + index * stageGapX, y: mainY + 18 },
      data: {
        kind: 'stage-span',
        processId: mainProcess.id,
        stageId: stage.id,
        label: stage.displayName,
        role: 'main',
        stageCategory: stage.stageCategory,
        stageKindId: stage.stageKindId,
        spanLabel: stageSpanLabel(stage.stageSpan)
      },
      style: {
        width: 150,
        minHeight: 50,
        border: '1px solid #2563eb',
        background: '#eff6ff',
        borderRadius: 6,
        fontSize: 12
      }
    });

    const nextStage = mainProcess.stages[index + 1];
    if (nextStage) {
      edges.push({
        id: `stage-sequence:${mainProcess.id}:${stage.id}:${nextStage.id}`,
        source: nodeId,
        target: `stage:${mainProcess.id}:${nextStage.id}`,
        data: {
          kind: 'stage-sequence',
          processId: mainProcess.id
        }
      });
    }
  });

  processes
    .filter((process) => process.id !== mainProcess.id)
    .forEach((process, processIndex) => {
      const y = laneStartY + processIndex * laneGapY;
      nodes.push({
        id: `timeline:${process.id}`,
        type: 'default',
        position: { x: 32, y },
        data: {
          kind: 'sub-process-lane',
          processId: process.id,
          label: process.displayName,
          role: 'sub-process'
        },
        draggable: false,
        selectable: true,
        style: {
          width: Math.max(620, mainProcess.stages.length * stageGapX + 260),
          minHeight: 90,
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          borderRadius: 8,
          padding: 12
        }
      });

      process.stages.forEach((stage, stageIndex) => {
        const nodeId = `stage:${process.id}:${stage.id}`;
        nodes.push({
          id: nodeId,
          type: 'default',
          position: { x: stageStartX + stageIndex * stageGapX, y: y + 22 },
          data: {
            kind: 'stage-span',
            processId: process.id,
            stageId: stage.id,
            label: stage.displayName,
            role: 'sub-process',
            stageCategory: stage.stageCategory,
            stageKindId: stage.stageKindId,
            spanLabel: stageSpanLabel(stage.stageSpan)
          },
          style: {
            width: 170,
            minHeight: 52,
            border: '1px solid #16a34a',
            background: '#f0fdf4',
            borderRadius: 6,
            fontSize: 12
          }
        });

        edges.push({
          id: `span-reference:${process.id}:${stage.id}`,
          source: nodeId,
          target: `stage:${mainProcess.id}:${stage.stageSpan.start.stageId}`,
          data: {
            kind: 'span-reference',
            processId: process.id
          },
          style: {
            strokeDasharray: '6 5',
            opacity: 0.55
          }
        });
      });
    });

  return { nodes, edges };
}

export const xyflowGraphAdapter: DesignerGraphAdapter<TimelineFlowGraphDocument, XyFlowLibraryIntent> = {
  name: 'xyflow-timeline-studio',
  toLibraryGraph(document) {
    return buildTimelineGraph(document);
  },
  fromLibraryIntent(intent) {
    switch (intent.kind) {
      case 'select-process':
        return {
          kind: 'update-process',
          processId: intent.processId,
          value: {}
        };
      case 'select-stage':
        return {
          kind: 'update-stage',
          processId: intent.processId,
          stageId: intent.stageId,
          value: {}
        };
    }
  }
};
