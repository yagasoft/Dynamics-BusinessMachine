import type { Edge, Node } from '@xyflow/react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { orderedProcesses, resolveMainProcess } from 'dbm-designer-core';

export interface DesignerGraphAdapter<TGraph, TIntent> {
  name: string;
  toLibraryGraph(document: DesignerDocument): TGraph;
  fromLibraryIntent(intent: TIntent): DesignerGraphIntent;
}

export type HierarchyNodeKind = 'parent-process' | 'child-process' | 'parent-stage' | 'child-process-stage';

export interface HierarchyNodeData extends Record<string, unknown> {
  kind: HierarchyNodeKind;
  processId: string;
  label: string;
  role: 'main' | 'sub-process';
  stageId?: string;
  stageCategory?: string;
  stageKindId?: string;
  depth: number;
  blockedByChild?: boolean;
}

export interface HierarchyEdgeData extends Record<string, unknown> {
  kind: 'stage-sequence' | 'child-process-link';
  processId: string;
  childProcessId?: string;
}

export type HierarchyFlowNode = Node<HierarchyNodeData>;
export type HierarchyFlowEdge = Edge<HierarchyEdgeData>;

export interface HierarchyFlowGraphDocument {
  nodes: HierarchyFlowNode[];
  edges: HierarchyFlowEdge[];
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

const processGapY = 168;
const stageGapX = 190;
const stageStartX = 260;

function childProcessIds(document: DesignerDocument): Set<string> {
  return new Set(document.model.processPortfolio.processes.flatMap((process) =>
    process.stages.flatMap((stage) => stage.childProcessRefs.map((ref) => ref.processId))
  ));
}

function processWidth(stageCount: number): number {
  return Math.max(700, stageCount * stageGapX + 310);
}

function buildHierarchyGraph(document: DesignerDocument): HierarchyFlowGraphDocument {
  const mainProcess = resolveMainProcess(document);
  const processMap = new Map(orderedProcesses(document.model).map((process) => [process.id, process]));
  const linkedChildProcessIds = childProcessIds(document);
  const rendered = new Set<string>();
  const nodes: HierarchyFlowNode[] = [];
  const edges: HierarchyFlowEdge[] = [];
  let row = 0;

  function renderProcess(processId: string, depth: number): void {
    const process = processMap.get(processId);
    if (!process || rendered.has(process.id)) {
      return;
    }

    rendered.add(process.id);
    const y = 28 + row * processGapY;
    row += 1;
    const processNodeId = `hierarchy:${process.id}`;
    const isParent = process.id === mainProcess.id || depth === 0;

    nodes.push({
      id: processNodeId,
      type: 'default',
      position: { x: 28 + depth * 72, y },
      data: {
        kind: isParent ? 'parent-process' : 'child-process',
        processId: process.id,
        label: process.displayName,
        role: process.role,
        depth
      },
      draggable: false,
      selectable: true,
      style: {
        width: processWidth(process.stages.length),
        minHeight: 112,
        border: isParent ? '1px solid #0f172a' : '1px solid #64748b',
        background: isParent ? '#f8fafc' : '#ffffff',
        borderRadius: 8,
        padding: 12,
        fontWeight: 800
      }
    });

    process.stages.forEach((stage, index) => {
      const nodeId = `stage:${process.id}:${stage.id}`;
      const blocksChild = stage.childProcessRefs.some((ref) => ref.blocksParent);
      nodes.push({
        id: nodeId,
        type: 'default',
        position: { x: 28 + depth * 72 + stageStartX + index * stageGapX, y: y + 36 },
        data: {
          kind: isParent ? 'parent-stage' : 'child-process-stage',
          processId: process.id,
          stageId: stage.id,
          label: stage.displayName,
          role: process.role,
          stageCategory: stage.stageCategory,
          stageKindId: stage.stageKindId,
          depth,
          blockedByChild: blocksChild
        },
        style: {
          width: 160,
          minHeight: 54,
          border: blocksChild ? '1px solid #b45309' : isParent ? '1px solid #2563eb' : '1px solid #16a34a',
          background: blocksChild ? '#fffbeb' : isParent ? '#eff6ff' : '#f0fdf4',
          borderRadius: 6,
          fontSize: 12,
          zIndex: 2
        }
      });

      const nextStage = process.stages[index + 1];
      if (nextStage) {
        edges.push({
          id: `stage-sequence:${process.id}:${stage.id}:${nextStage.id}`,
          source: nodeId,
          target: `stage:${process.id}:${nextStage.id}`,
          type: 'step',
          zIndex: 1000,
          data: {
            kind: 'stage-sequence',
            processId: process.id
          }
        });
      }

      stage.childProcessRefs.forEach((ref) => {
        const child = processMap.get(ref.processId);
        if (!child) {
          return;
        }

        renderProcess(child.id, depth + 1);
        edges.push({
          id: `child-process:${process.id}:${stage.id}:${ref.id}`,
          source: nodeId,
          target: `hierarchy:${child.id}`,
          type: 'step',
          zIndex: 1000,
          data: {
            kind: 'child-process-link',
            processId: process.id,
            childProcessId: child.id
          },
          style: {
            stroke: ref.blocksParent ? '#b45309' : '#64748b',
            strokeWidth: 2
          },
          label: ref.blocksParent ? 'blocks parent stage' : 'child process'
        });
      });
    });
  }

  renderProcess(mainProcess.id, 0);

  orderedProcesses(document.model)
    .filter((process) => process.id !== mainProcess.id && !linkedChildProcessIds.has(process.id))
    .forEach((process) => renderProcess(process.id, 1));

  return { nodes, edges };
}

export const xyflowGraphAdapter: DesignerGraphAdapter<HierarchyFlowGraphDocument, XyFlowLibraryIntent> = {
  name: 'xyflow-hierarchy-studio',
  toLibraryGraph(document) {
    return buildHierarchyGraph(document);
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
