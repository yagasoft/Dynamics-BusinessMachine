import { useMemo } from 'react';
import { Background, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { DesignerDocument } from 'dbm-designer-core';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import { xyflowGraphAdapter } from './graphAdapter';

interface GraphCanvasProps {
  document: DesignerDocument | null;
  onSelectionChange?(selectionId: string | null): void;
}

const FLOW_STYLE_ELEMENT_ID = 'dbm-xyflow-hierarchy-styles';

function ensureFlowRuntime() {
  if (typeof document !== 'undefined' && !document.getElementById(FLOW_STYLE_ELEMENT_ID)) {
    const styleElement = document.createElement('style');
    styleElement.id = FLOW_STYLE_ELEMENT_ID;
    styleElement.textContent = flowStyles;
    document.head.appendChild(styleElement);
  }

  const runtime = globalThis as typeof globalThis & {
    ResizeObserver?: new (callback: ResizeObserverCallback) => ResizeObserver;
  };
  if (typeof runtime.ResizeObserver === 'undefined') {
    runtime.ResizeObserver = class {
      observe() {
        return undefined;
      }

      unobserve() {
        return undefined;
      }

      disconnect() {
        return undefined;
      }
    } as new (callback: ResizeObserverCallback) => ResizeObserver;
  }
}

function HierarchyFlow({ document, onSelectionChange }: GraphCanvasProps) {
  const graph = useMemo(() => {
    return document ? xyflowGraphAdapter.toLibraryGraph(document) : { nodes: [], edges: [] };
  }, [document]);

  return (
    <div data-testid="hierarchy-graph-canvas" style={canvasShellStyle}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.5}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'step', zIndex: 1000 }}
        onNodeClick={(_, node) => onSelectionChange?.(node.id)}
        onPaneClick={() => onSelectionChange?.(null)}
      >
        <Background color="#cbd5e1" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  ensureFlowRuntime();

  return (
    <ReactFlowProvider>
      <HierarchyFlow {...props} />
    </ReactFlowProvider>
  );
}

const canvasShellStyle = {
  width: '100%',
  minHeight: '420px',
  height: 'min(58vh, 640px)',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#f8fafc'
} as const;
