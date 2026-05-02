import { describe, expect, it } from 'vitest';
import type { DbmModelV1 } from 'dbm-contract';
import { loadModel, serializeModel } from 'dbm-designer-core';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import { xyflowGraphAdapter } from './graphAdapter';

function loadDocument() {
  return loadModel(structuredClone(employeeOnboarding as DbmModelV1));
}

describe('xyflowGraphAdapter Timeline Studio mapping', () => {
  it('maps the generic process matrix into main timeline and sub-process lane nodes', () => {
    const document = loadDocument();
    const flowGraph = xyflowGraphAdapter.toLibraryGraph(document);

    expect(flowGraph.nodes.some((node) => node.data.kind === 'main-timeline' && node.data.processId === 'onboarding-main')).toBe(true);
    expect(flowGraph.nodes.some((node) => node.data.kind === 'sub-process-lane' && node.data.processId === 'it-readiness')).toBe(true);
    expect(flowGraph.nodes.some((node) => node.data.kind === 'stage-span' && node.data.processId === 'it-readiness' && node.data.stageId === 'prepare-access')).toBe(true);
  });

  it('keeps React Flow state out of the canonical model', () => {
    const document = loadDocument();
    const flowGraph = xyflowGraphAdapter.toLibraryGraph(document);
    const serialized = serializeModel(document) as DbmModelV1 & { xyflow?: unknown; nodes?: unknown; edges?: unknown };

    expect(flowGraph.nodes.length).toBeGreaterThan(0);
    expect(serialized.xyflow).toBeUndefined();
    expect(serialized.nodes).toBeUndefined();
    expect(serialized.edges).toBeUndefined();
    expect('process' in serialized).toBe(false);
  });
});
