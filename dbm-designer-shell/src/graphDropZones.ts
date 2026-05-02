import type { DesignerGraphIntent } from 'dbm-designer-core';
import type { HierarchyFlowGraphDocument, HierarchyFlowNode } from './graphAdapter';

export type StageDropPlacement = 'before' | 'between' | 'after';

export interface Point {
  x: number;
  y: number;
}

export interface StageDropZone {
  processId: string;
  targetIndex: number;
  placement: StageDropPlacement;
}

export interface VisibleStageDropZone extends StageDropZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const stageWidth = 160;
const stageHeight = 54;
const rowTolerance = 70;

function stageNodes(graph: HierarchyFlowGraphDocument, excludedNodeId?: string): HierarchyFlowNode[] {
  return graph.nodes
    .filter((node) => node.id !== excludedNodeId)
    .filter((node) => node.data.kind === 'parent-stage' || node.data.kind === 'child-process-stage');
}

function stageCentreY(node: HierarchyFlowNode): number {
  return node.position.y + stageHeight / 2;
}

function stagesForNearestRow(graph: HierarchyFlowGraphDocument, point: Point, excludedNodeId?: string): HierarchyFlowNode[] {
  const rows = new Map<string, HierarchyFlowNode[]>();
  stageNodes(graph, excludedNodeId).forEach((node) => {
    const row = rows.get(node.data.processId) ?? [];
    row.push(node);
    rows.set(node.data.processId, row);
  });

  let nearest: { distance: number; stages: HierarchyFlowNode[] } | null = null;
  rows.forEach((row) => {
    const sorted = row.sort((left, right) => left.position.x - right.position.x);
    const distance = Math.min(...sorted.map((node) => Math.abs(stageCentreY(node) - point.y)));
    if (distance <= rowTolerance && (!nearest || distance < nearest.distance)) {
      nearest = { distance, stages: sorted };
    }
  });

  return nearest?.stages ?? [];
}

export function resolveStageDropZone(graph: HierarchyFlowGraphDocument, point: Point, excludedNodeId?: string): StageDropZone | null {
  const row = stagesForNearestRow(graph, point, excludedNodeId);
  if (row.length === 0) {
    return null;
  }

  const processId = row[0].data.processId;
  const first = row[0];
  const last = row[row.length - 1];
  if (point.x < first.position.x + stageWidth / 3) {
    return { processId, targetIndex: 0, placement: 'before' };
  }
  if (point.x > last.position.x + stageWidth * 2 / 3) {
    return { processId, targetIndex: row.length, placement: 'after' };
  }

  for (let index = 0; index < row.length - 1; index += 1) {
    const left = row[index];
    const right = row[index + 1];
    if (point.x >= left.position.x + stageWidth / 2 && point.x <= right.position.x + stageWidth / 2) {
      return { processId, targetIndex: index + 1, placement: 'between' };
    }
  }

  const nearestIndex = row.reduce((bestIndex, node, index) => {
    const best = row[bestIndex];
    const distance = Math.abs(node.position.x + stageWidth / 2 - point.x);
    const bestDistance = Math.abs(best.position.x + stageWidth / 2 - point.x);
    return distance < bestDistance ? index : bestIndex;
  }, 0);
  const nearest = row[nearestIndex];
  const targetIndex = point.x < nearest.position.x + stageWidth / 2 ? nearestIndex : nearestIndex + 1;
  return {
    processId,
    targetIndex,
    placement: targetIndex === 0 ? 'before' : targetIndex === row.length ? 'after' : 'between'
  };
}

export function toStageMoveIntent(draggedNodeId: string, dropZone: StageDropZone | null): DesignerGraphIntent | null {
  const match = /^stage:(?<processId>[^:]+):(?<stageId>[^:]+)$/.exec(draggedNodeId);
  if (!match?.groups || !dropZone) {
    return null;
  }

  return {
    kind: 'move-stage',
    sourceProcessId: match.groups.processId,
    stageId: match.groups.stageId,
    targetProcessId: dropZone.processId,
    targetIndex: dropZone.targetIndex
  };
}

export function buildVisibleStageDropZones(graph: HierarchyFlowGraphDocument, draggedNodeId: string): VisibleStageDropZone[] {
  const rows = new Map<string, HierarchyFlowNode[]>();
  stageNodes(graph, draggedNodeId).forEach((node) => {
    const row = rows.get(node.data.processId) ?? [];
    row.push(node);
    rows.set(node.data.processId, row);
  });

  return [...rows.entries()].flatMap(([processId, row]) => {
    const sorted = row.sort((left, right) => left.position.x - right.position.x);
    if (sorted.length === 0) {
      return [];
    }

    const y = stageCentreY(sorted[0]) - 30;
    const base = {
      processId,
      y,
      width: 34,
      height: 60
    };
    const zones: VisibleStageDropZone[] = [
      {
        ...base,
        id: `drop:${processId}:0`,
        targetIndex: 0,
        placement: 'before',
        x: sorted[0].position.x - 42
      }
    ];

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      zones.push({
        ...base,
        id: `drop:${processId}:${index + 1}`,
        targetIndex: index + 1,
        placement: 'between',
        x: (left.position.x + stageWidth + right.position.x) / 2 - 17
      });
    }

    zones.push({
      ...base,
      id: `drop:${processId}:${sorted.length}`,
      targetIndex: sorted.length,
      placement: 'after',
      x: sorted[sorted.length - 1].position.x + stageWidth + 8
    });

    return zones;
  });
}
