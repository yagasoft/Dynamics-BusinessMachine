import { describe, expect, it } from 'vitest';
import { buildDesignerGraphDocument, createApprovalRequestTemplate } from 'dbm-designer-core';
import {
  alternatePreviewGraphAdapter,
  previewGraphAdapter
} from './graphAdapter';

describe('designer graph adapters', () => {
  it('maps the DBM-owned graph document into multiple library projections without changing the saved package format', () => {
    const graph = buildDesignerGraphDocument(createApprovalRequestTemplate());
    const previewGraph = previewGraphAdapter.toLibraryGraph(graph);
    const alternateGraph = alternatePreviewGraphAdapter.toLibraryGraph(graph);

    expect(previewGraph.nodes).toHaveLength(graph.nodes.length);
    expect(previewGraph.edges).toHaveLength(graph.edges.length);
    expect(alternateGraph.vertices).toHaveLength(graph.nodes.length);
    expect(alternateGraph.links).toHaveLength(graph.edges.length);
    expect(previewGraph.nodes.find((node) => node.id === 'stage:draft-request')).toMatchObject({
      label: 'Draft Request',
      kind: 'stage'
    });
    expect(alternateGraph.vertices.find((node) => node.vertexId === 'stage:draft-request')).toMatchObject({
      caption: 'Draft Request',
      category: 'stage'
    });
  });

  it('translates library intents back into DBM-owned graph intents', () => {
    expect(
      previewGraphAdapter.fromLibraryIntent({
        kind: 'rename-node',
        nodeId: 'stage:manager-review',
        label: 'Manager Resolution'
      })
    ).toEqual({
      kind: 'rename-node',
      nodeId: 'stage:manager-review',
      label: 'Manager Resolution'
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
