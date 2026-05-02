import { describe, expect, it } from 'vitest';
import type { DbmModelV1 } from 'dbm-contract';
import { loadModel } from 'dbm-designer-core';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import { buildVisibleStageDropZones, resolveStageDropZone, toStageMoveIntent } from './graphDropZones';
import { xyflowGraphAdapter } from './graphAdapter';

function loadGraph() {
  const document = loadModel(structuredClone(employeeOnboarding as DbmModelV1));
  return xyflowGraphAdapter.toLibraryGraph(document);
}

describe('graphDropZones', () => {
  it('resolves drop zones before, between, and after stages across process rows', () => {
    const graph = loadGraph();
    const beforeFirst = resolveStageDropZone(graph, { x: 246, y: 88 });
    const betweenChildStages = resolveStageDropZone(graph, { x: 610, y: 424 });
    const afterLast = resolveStageDropZone(graph, { x: 1060, y: 88 });

    expect(beforeFirst).toMatchObject({ processId: 'onboarding-main', targetIndex: 0, placement: 'before' });
    expect(betweenChildStages).toMatchObject({ processId: 'access-review', targetIndex: 1, placement: 'between' });
    expect(afterLast).toMatchObject({ processId: 'onboarding-main', targetIndex: 4, placement: 'after' });
  });

  it('creates a cross-process move-stage intent from a dragged stage and a resolved drop zone', () => {
    const intent = toStageMoveIntent('stage:onboarding-main:first-day', {
      processId: 'access-review',
      targetIndex: 1,
      placement: 'between'
    });

    expect(intent).toEqual({
      kind: 'move-stage',
      sourceProcessId: 'onboarding-main',
      stageId: 'first-day',
      targetProcessId: 'access-review',
      targetIndex: 1
    });
  });

  it('builds visible drop-zone geometry across compatible process rows while a stage is dragged', () => {
    const graph = loadGraph();
    const zones = buildVisibleStageDropZones(graph, 'stage:onboarding-main:first-day');

    expect(zones.some((zone) => zone.processId === 'onboarding-main' && zone.targetIndex === 0)).toBe(true);
    expect(zones.some((zone) => zone.processId === 'access-review' && zone.targetIndex === 1 && zone.placement === 'between')).toBe(true);
    expect(zones.every((zone) => zone.width > 0 && zone.height > 0)).toBe(true);
  });
});
