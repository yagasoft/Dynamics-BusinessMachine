import { memo, useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection
} from '@xyflow/react';
import { useDroppable } from '@dnd-kit/core';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { isStableDesignerGraphNodeId } from 'dbm-designer-core';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import { xyflowGraphAdapter } from './graphAdapter';

interface GraphCanvasProps {
  document: DesignerDocument | null;
  onSelectionChange(selectionId: string | null): void;
  onGraphIntent(intent: DesignerGraphIntent): void;
  onNodePositionCommit(nodeId: string, position: { x: number; y: number }): void;
}

const FLOW_STYLE_ELEMENT_ID = 'dbm-xyflow-base-styles';

function ensureFlowStyles() {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(FLOW_STYLE_ELEMENT_ID)) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = FLOW_STYLE_ELEMENT_ID;
  styleElement.textContent = flowStyles;
  document.head.appendChild(styleElement);
}

const laneNodeStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1.35rem',
  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.14) 0%, rgba(148, 163, 184, 0.05) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
} as const;

const laneTitleStyle = {
  padding: '0.85rem 1rem',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#475569'
} as const;

function LaneNode({ data }: { data: { label: string } }) {
  return (
    <div style={laneNodeStyle}>
      <div style={laneTitleStyle}>{data.label}</div>
    </div>
  );
}

function StageNode({
  data
}: {
  data: {
    label: string;
    stageType: string;
    actorLabel: string | null;
    inPortId: string;
    outcomes: Array<{ portId: string; label: string | null }>;
  };
}) {
  return (
    <div style={stageCardStyle}>
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <div style={nodeEyebrowStyle}>{data.stageType}</div>
      <div style={stageTitleStyle}>{data.label}</div>
      <div style={nodeMetaStyle}>{data.actorLabel ?? 'No actor'}</div>
      <div style={outcomeHandleStackStyle}>
        {data.outcomes.map((outcome) => (
          <div key={outcome.portId} style={outcomeHandleRowStyle}>
            <span style={outcomeHandleLabelStyle}>{outcome.label ?? 'Outcome'}</span>
            <Handle type="source" position={Position.Right} id={outcome.portId} style={handleStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepNode({
  data
}: {
  data: {
    label: string;
    stepType: string;
    stageLabel: string | null;
    inPortId: string;
    outPortId: string;
  };
}) {
  return (
    <div style={stepCardStyle}>
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <div style={nodeEyebrowStyle}>{data.stepType}</div>
      <div style={stepTitleStyle}>{data.label}</div>
      <div style={nodeMetaStyle}>{data.stageLabel ?? 'No stage'}</div>
      <Handle type="source" position={Position.Right} id={data.outPortId} style={handleStyle} />
    </div>
  );
}

function OutcomeNode({
  data
}: {
  data: {
    label: string;
    inPortId: string;
  };
}) {
  return (
    <div style={outcomeNodeStyle}>
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <span style={outcomeNodeLabelStyle}>{data.label}</span>
    </div>
  );
}

const nodeTypes = {
  lane: memo(LaneNode),
  stage: memo(StageNode),
  step: memo(StepNode),
  outcome: memo(OutcomeNode)
};

function GraphCanvasInner({ document, onSelectionChange, onGraphIntent, onNodePositionCommit }: GraphCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'graph-canvas'
  });
  const flowDocument = useMemo(
    () => (document ? xyflowGraphAdapter.toLibraryGraph(document) : null),
    [document]
  );

  if (!document || !flowDocument) {
    return <div style={emptyCanvasStyle}>Load or create a package to start graph authoring.</div>;
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.sourceHandle || !connection.target || !connection.targetHandle) {
      return;
    }

    onGraphIntent(
      xyflowGraphAdapter.fromLibraryIntent({
        kind: 'connect',
        sourceNodeId: connection.source,
        sourceHandleId: connection.sourceHandle,
        targetNodeId: connection.target,
        targetHandleId: connection.targetHandle
      })
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...canvasShellStyle,
        borderColor: isOver ? '#b45309' : '#d6d3d1',
        boxShadow: isOver ? '0 0 0 2px rgba(180,83,9,0.18)' : 'none'
      }}
      data-testid="graph-canvas"
    >
      <ReactFlow
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodes={flowDocument.nodes}
        edges={flowDocument.edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectionChange(node.id)}
        onEdgeClick={(_, edge) => onSelectionChange(edge.id)}
        onPaneClick={() => onSelectionChange('document:root')}
        onNodeDragStop={(_, node) => {
          if (isStableDesignerGraphNodeId(node.id)) {
            onNodePositionCommit(node.id, node.position);
          }
        }}
        onConnect={handleConnect}
        deleteKeyCode={null}
        selectionOnDrag={false}
        nodesDraggable
      >
        <Background color="#e2e8f0" gap={28} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  ensureFlowStyles();

  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

const canvasShellStyle = {
  minHeight: '72vh',
  height: '100%',
  borderRadius: '1.25rem',
  border: '1px solid #d6d3d1',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #fafaf9 0%, #ffffff 100%)'
} as const;

const emptyCanvasStyle = {
  minHeight: '72vh',
  borderRadius: '1.25rem',
  border: '1px dashed #d6d3d1',
  background: 'rgba(255,255,255,0.7)',
  display: 'grid',
  placeItems: 'center',
  color: '#64748b'
} as const;

const handleStyle = {
  width: '10px',
  height: '10px',
  background: '#c2410c',
  border: '2px solid #fff'
} as const;

const stageCardStyle = {
  minHeight: '100%',
  borderRadius: '1rem',
  border: '1px solid #d97706',
  background: 'linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)',
  boxShadow: '0 16px 36px rgba(180, 83, 9, 0.18)',
  padding: '0.9rem 1rem',
  display: 'grid',
  gap: '0.5rem'
} as const;

const stepCardStyle = {
  minHeight: '100%',
  borderRadius: '0.95rem',
  border: '1px solid #2563eb',
  background: 'linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.14)',
  padding: '0.8rem 0.9rem',
  display: 'grid',
  gap: '0.45rem'
} as const;

const outcomeNodeStyle = {
  minHeight: '100%',
  borderRadius: '999px',
  border: '1px solid #0f766e',
  background: 'linear-gradient(180deg, #ecfeff 0%, #f0fdfa 100%)',
  boxShadow: '0 10px 22px rgba(15, 118, 110, 0.14)',
  padding: '0.8rem 1rem',
  display: 'grid',
  alignItems: 'center'
} as const;

const nodeEyebrowStyle = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6b7280'
} as const;

const stageTitleStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827'
} as const;

const stepTitleStyle = {
  fontSize: '0.94rem',
  fontWeight: 700,
  color: '#111827'
} as const;

const nodeMetaStyle = {
  fontSize: '0.82rem',
  color: '#475569'
} as const;

const outcomeHandleStackStyle = {
  display: 'grid',
  gap: '0.4rem',
  marginTop: '0.25rem'
} as const;

const outcomeHandleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  paddingRight: '0.4rem'
} as const;

const outcomeHandleLabelStyle = {
  fontSize: '0.78rem',
  color: '#7c2d12'
} as const;

const outcomeNodeLabelStyle = {
  display: 'inline-block',
  paddingLeft: '0.5rem',
  fontWeight: 700,
  color: '#134e4a'
} as const;
