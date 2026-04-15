import { describe, expect, it } from 'vitest';
import { createApprovalRequestTemplate, loadModelPackage } from 'dbm-designer-core';
import {
  alternatePreviewGraphAdapter,
  xyflowGraphAdapter
} from './graphAdapter';

describe('designer graph adapters', () => {
  it('maps the DBM-owned graph document into multiple library projections without changing the saved package format', () => {
    const document = loadModelPackage(createApprovalRequestTemplate());
    const flowGraph = xyflowGraphAdapter.toLibraryGraph(document);
    const alternateGraph = alternatePreviewGraphAdapter.toLibraryGraph(document);

    expect(flowGraph.nodes).toHaveLength(
      document.model.process.stages.length
      + document.model.process.outcomes.length
      + document.graph.groups.length
    );
    expect(flowGraph.edges).toHaveLength(document.model.process.transitions.length);
    expect(alternateGraph.vertices).toHaveLength(document.graph.nodes.length);
    expect(alternateGraph.links).toHaveLength(document.graph.edges.length);
    expect(flowGraph.nodes.find((node) => node.id === 'stage:draft-request')).toMatchObject({
      type: 'stage',
      data: {
        label: 'Draft Request',
        kind: 'stage',
        inPortId: 'port:stage:draft-request:in',
        collapsed: true
      }
    });
    expect(alternateGraph.vertices.find((node) => node.vertexId === 'stage:draft-request')).toMatchObject({
      caption: 'Draft Request',
      category: 'stage'
    });
    expect(flowGraph.edges).not.toHaveLength(0);
    expect(flowGraph.edges[0]).toMatchObject({
      selectable: true,
      focusable: true,
      deletable: true,
      type: 'dbm-edge'
    });
  });

  it('translates library intents back into DBM-owned graph intents', () => {
    expect(
      xyflowGraphAdapter.fromLibraryIntent({
        kind: 'connect',
        sourceNodeId: 'stage:manager-review',
        sourceHandleId: 'port:stage:manager-review:outcome:approve',
        targetNodeId: 'stage:completed',
        targetHandleId: 'port:stage:completed:in'
      })
    ).toEqual({
      kind: 'create-stage-transition',
      fromStageId: 'manager-review',
      toStageId: 'completed',
      outcomeId: 'approve'
    });

    expect(
      alternatePreviewGraphAdapter.fromLibraryIntent({
        action: 'relocate-step',
        stepId: 'record-approval',
        stageId: 'manager-review',
        ordinal: 0
      })
    ).toEqual({
      kind: 'move-step',
      stepId: 'record-approval',
      targetStageId: 'manager-review',
      targetIndex: 0
    });
  });
});
