import { useMemo, useState } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, ViewportPortal, type NodeProps } from '@xyflow/react';
import type { DesignerDocument } from 'dbm-designer-core';
import type { DesignerGraphIntent } from 'dbm-designer-core';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import {
  processHandleId,
  processNodeType,
  stageDragHandleSelector,
  stageHandleId,
  stageNodeType,
  xyflowGraphAdapter,
  type HierarchyFlowNode
} from './graphAdapter';
import { buildVisibleStageDropZones, resolveStageDropZone, toStageMoveIntent } from './graphDropZones';

interface GraphCanvasProps {
  document: DesignerDocument | null;
  onSelectionChange?(selectionId: string | null): void;
  onGraphIntent?(intent: DesignerGraphIntent): void;
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

function ProcessNode({ data, id }: NodeProps<HierarchyFlowNode>) {
  return (
    <div style={processNodeStyle}>
      <Handle type="target" id={processHandleId(id, 'parent-in')} position={Position.Top} style={hiddenHandleStyle} />
      <strong style={processLabelStyle}>{data.label}</strong>
    </div>
  );
}

function StageNode({ data, id }: NodeProps<HierarchyFlowNode>) {
  const borderColour = data.blockedByChild ? '#b45309' : data.role === 'main' ? '#2563eb' : '#16a34a';
  return (
    <div style={stageNodeInnerStyle}>
      <Handle type="target" id={stageHandleId(id, 'left')} position={Position.Left} style={{ ...sideHandleStyle, borderColor: borderColour }} />
      <div
        aria-label={`Drag stage ${data.label}`}
        className={stageDragHandleSelector.slice(1)}
        data-testid="stage-drag-handle"
        role="button"
        style={stageDragHandleStyle}
        tabIndex={0}
        title="Drag stage"
      />
      <span style={stageLabelStyle}>{data.label}</span>
      <Handle type="source" id={stageHandleId(id, 'right')} position={Position.Right} style={{ ...sideHandleStyle, borderColor: borderColour }} />
      <Handle type="source" id={stageHandleId(id, 'child-out')} position={Position.Bottom} style={hiddenHandleStyle} />
    </div>
  );
}

const nodeTypes = {
  [processNodeType]: ProcessNode,
  [stageNodeType]: StageNode
};

function HierarchyFlow({ document, onSelectionChange, onGraphIntent }: GraphCanvasProps) {
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  const graph = useMemo(() => {
    return document ? xyflowGraphAdapter.toLibraryGraph(document) : { nodes: [], edges: [] };
  }, [document]);
  const visibleDropZones = activeDragNodeId ? buildVisibleStageDropZones(graph, activeDragNodeId) : [];

  return (
    <div data-testid="hierarchy-graph-canvas" style={canvasShellStyle}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        nodeTypes={nodeTypes}
        minZoom={0.5}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'step', zIndex: 1000 }}
        onNodeClick={(_, node) => onSelectionChange?.(node.id)}
        onNodeDragStart={(_, node) => {
          if (node.id.startsWith('stage:')) {
            setActiveDragNodeId(node.id);
          }
        }}
        onNodeDragStop={(_, node) => {
          if (!node.id.startsWith('stage:')) {
            return;
          }
          const dropZone = resolveStageDropZone(
            graph,
            { x: node.position.x + 80, y: node.position.y + 27 },
            node.id
          );
          const intent = toStageMoveIntent(node.id, dropZone);
          if (intent) {
            onGraphIntent?.(intent);
          }
          setActiveDragNodeId(null);
        }}
        onPaneClick={() => onSelectionChange?.(null)}
      >
        <Background color="#cbd5e1" gap={22} />
        <ViewportPortal>
          {visibleDropZones.map((zone) => (
            <div
              key={zone.id}
              data-testid="stage-drop-zone"
              style={{
                ...dropZoneStyle,
                transform: `translate(${zone.x}px, ${zone.y}px)`,
                width: zone.width,
                height: zone.height
              }}
              title={`${zone.placement} stage`}
            />
          ))}
        </ViewportPortal>
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

const processNodeStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  pointerEvents: 'none'
} as const;

const processLabelStyle = {
  marginTop: -2,
  padding: '0 8px',
  background: 'inherit',
  color: '#020617',
  fontSize: 12,
  lineHeight: 1.2
} as const;

const stageNodeInnerStyle = {
  position: 'relative',
  display: 'grid',
  alignItems: 'center',
  justifyItems: 'center',
  minHeight: 54,
  height: '100%',
  padding: '7px 12px 8px',
  boxSizing: 'border-box'
} as const;

const stageLabelStyle = {
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textAlign: 'center',
  lineHeight: 1.25
} as const;

const stageDragHandleStyle = {
  position: 'absolute',
  top: 5,
  right: 6,
  width: 18,
  height: 18,
  border: '1px solid #94a3b8',
  borderRadius: 4,
  background: 'repeating-linear-gradient(90deg, #64748b 0 2px, transparent 2px 5px)',
  cursor: 'grab'
} as const;

const sideHandleStyle = {
  width: 9,
  height: 9,
  background: '#ffffff',
  border: '2px solid #2563eb'
} as const;

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none'
} as const;

const dropZoneStyle = {
  position: 'absolute',
  border: '2px solid #0ea5e9',
  borderRadius: 6,
  background: 'rgba(14, 165, 233, 0.12)',
  pointerEvents: 'none',
  zIndex: 2000
} as const;
