import { describe, expect, it } from 'vitest';
import type { DbmModelV1 } from 'dbm-contract';
import { loadModel, serializeModel } from 'dbm-designer-core';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import { xyflowGraphAdapter } from './graphAdapter';

function loadDocument() {
  return loadModel(structuredClone(employeeOnboarding as DbmModelV1));
}

describe('xyflowGraphAdapter hierarchy studio mapping', () => {
  it('maps the generic process matrix into parent and child process hierarchy nodes', () => {
    const document = loadDocument();
    const flowGraph = xyflowGraphAdapter.toLibraryGraph(document);

    expect(flowGraph.nodes.some((node) => node.data.kind === 'parent-process' && node.data.processId === 'onboarding-main')).toBe(true);
    expect(flowGraph.nodes.some((node) => node.data.kind === 'child-process' && node.data.processId === 'it-readiness')).toBe(true);
    expect(flowGraph.nodes.some((node) => node.data.kind === 'child-process-stage' && node.data.processId === 'it-readiness' && node.data.stageId === 'prepare-access')).toBe(true);
    expect(flowGraph.edges.some((edge) => edge.data?.kind === 'child-process-link' && edge.data.childProcessId === 'access-review')).toBe(true);
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

  it('maps stage sequence edges as directional side-to-side authoring connectors', () => {
    const document = loadDocument();
    const flowGraph = xyflowGraphAdapter.toLibraryGraph(document);
    const sequenceEdge = flowGraph.edges.find((edge) => edge.id === 'stage-sequence:onboarding-main:offer-accepted:preparation');
    const offerStage = flowGraph.nodes.find((node) => node.id === 'stage:onboarding-main:offer-accepted');

    expect(sequenceEdge?.sourceHandle).toBe('stage:onboarding-main:offer-accepted:right');
    expect(sequenceEdge?.targetHandle).toBe('stage:onboarding-main:preparation:left');
    expect(sequenceEdge?.type).toBe('step');
    expect(sequenceEdge?.zIndex).toBeGreaterThan(900);
    expect(sequenceEdge?.markerEnd).toMatchObject({ type: 'arrowclosed' });
    expect(offerStage?.type).toBe('hierarchyStage');
    expect(offerStage?.dragHandle).toBe('.dbm-stage-drag-handle');
  });
});
