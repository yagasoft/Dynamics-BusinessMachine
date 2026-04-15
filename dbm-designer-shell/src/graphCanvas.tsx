import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  type Connection,
  type EdgeProps,
  type NodeProps
} from '@xyflow/react';
import { useDndMonitor, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { isStableDesignerGraphNodeId } from 'dbm-designer-core';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import { type DesignerFlowEdgeData, type FlowLaneData, type FlowOutcomeData, type FlowStageData, type FlowStepData, xyflowGraphAdapter } from './graphAdapter';
import type { IssueDecorationSummary } from './issueTargets';

interface GraphCanvasProps {
  document: DesignerDocument | null;
  onSelectionChange(selectionId: string | null): void;
  onGraphIntent(intent: DesignerGraphIntent): void;
  onNodePositionCommit(nodeId: string, position: { x: number; y: number }): void;
  onToggleStageCollapse(stageId: string): void;
  onPaletteStageDrop(position: { x: number; y: number }): void;
  focusTargetId: string | null;
  focusRequestToken: number;
}

const FLOW_STYLE_ELEMENT_ID = 'dbm-xyflow-base-styles';

type StageNodePayload = FlowStageData & {
  onToggleCollapse(stageId: string): void;
};

function issueTone(summary: IssueDecorationSummary | null | undefined) {
  switch (summary?.level) {
    case 'error':
      return {
        borderColor: '#dc2626',
        background: '#fef2f2',
        color: '#991b1b'
      };
    case 'warning':
      return {
        borderColor: '#f59e0b',
        background: '#fffbeb',
        color: '#b45309'
      };
    case 'info':
      return {
        borderColor: '#2563eb',
        background: '#eff6ff',
        color: '#1d4ed8'
      };
    default:
      return null;
  }
}

function IssueBadge({ summary }: { summary: IssueDecorationSummary | null | undefined }) {
  if (!summary) {
    return null;
  }

  const tone = issueTone(summary);
  return (
    <span
      style={{
        ...issueBadgeStyle,
        borderColor: tone?.borderColor,
        background: tone?.background,
        color: tone?.color
      }}
      title={summary.issues.map((issue) => `${issue.level}: ${issue.message}`).join('\n')}
    >
      {summary.level}
      {' · '}
      {summary.count}
    </span>
  );
}

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

function LaneNode({ data }: NodeProps<FlowLaneData>) {
  return (
    <div style={laneNodeStyle}>
      <div style={laneTitleStyle}>{data.label}</div>
    </div>
  );
}

function StageNode({ data, selected }: NodeProps<StageNodePayload>) {
  const tone = issueTone(data.issueSummary);
  return (
    <div
      style={{
        ...stageCardStyle,
        ...(tone ? { borderColor: tone.borderColor } : {}),
        ...(selected ? selectedStageCardStyle : {})
      }}
    >
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <div style={stageHeaderStyle}>
        <div>
          <div style={nodeEyebrowStyle}>{data.stageType}</div>
          <div style={stageTitleStyle}>{data.label}</div>
          <div style={nodeMetaStyle}>{data.actorLabel ?? 'No actor'}</div>
        </div>
        <div style={stageHeaderActionsStyle}>
          <IssueBadge summary={data.issueSummary} />
          <button
            type="button"
            style={chipButtonStyle}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleCollapse(data.stageId);
            }}
          >
            {data.collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      <div style={stageSummaryRowStyle}>
        <span style={summaryChipStyle}>{data.stepCount} step(s)</span>
        {data.currentStepLabel ? <span style={summaryChipStyle}>Current: {data.currentStepLabel}</span> : null}
        {!data.currentStepLabel && data.defaultStepLabel ? <span style={summaryChipStyle}>Default: {data.defaultStepLabel}</span> : null}
      </div>

      <div style={outcomeChipsStyle}>
        {data.outcomes.map((outcome) => (
          <div key={outcome.portId} style={outcomeChipStyle}>
            <span style={outcomeHandleLabelStyle}>{outcome.label ?? 'Outcome'}</span>
            <Handle type="source" position={Position.Right} id={outcome.portId} style={handleStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepNode({ data, selected }: NodeProps<FlowStepData>) {
  const tone = issueTone(data.issueSummary);
  return (
    <div
      style={{
        ...stepCardStyle,
        ...(tone ? { borderColor: tone.borderColor } : {}),
        ...(selected ? selectedStepCardStyle : {})
      }}
    >
      <div style={floatingIssueBadgeRowStyle}>
        <IssueBadge summary={data.issueSummary} />
      </div>
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <div style={nodeEyebrowStyle}>{data.stepType}</div>
      <div style={stepTitleStyle}>{data.label}</div>
      <div style={nodeMetaStyle}>{data.ownerLabel ?? data.stageLabel ?? 'No owner'}</div>
      <Handle type="source" position={Position.Right} id={data.outPortId} style={handleStyle} />
    </div>
  );
}

function OutcomeNode({ data, selected }: NodeProps<FlowOutcomeData>) {
  const tone = issueTone(data.issueSummary);
  return (
    <div
      style={{
        ...outcomeNodeStyle,
        ...(tone ? { borderColor: tone.borderColor } : {}),
        ...(selected ? selectedOutcomeStyle : {})
      }}
    >
      <div style={floatingIssueBadgeRowStyle}>
        <IssueBadge summary={data.issueSummary} />
      </div>
      <Handle type="target" position={Position.Left} id={data.inPortId} style={handleStyle} />
      <span style={outcomeNodeLabelStyle}>{data.label}</span>
    </div>
  );
}

function SelectableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  selected,
  data
}: EdgeProps<DesignerFlowEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset: data?.mode === 'detail' ? 26 : 18,
    borderRadius: data?.mode === 'detail' ? 18 : 24
  });
  const stroke = selected
    ? '#c2410c'
    : data?.kind === 'step-transition'
      ? '#2563eb'
      : '#b45309';
  const opacity = data?.emphasis === 'muted' ? 0.22 : 1;
  const issueToneValue = issueTone(data?.issueSummary);

  return (
    <>
      <BaseEdge id={`${id}-hit`} path={edgePath} style={{ stroke: 'transparent', strokeWidth: 24 }} interactionWidth={32} />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: selected ? 3.25 : 2.2,
          strokeDasharray: data?.mode === 'detail' ? '10 5' : undefined,
          opacity
        }}
        interactionWidth={26}
      />
      {label || data?.issueSummary ? (
        <EdgeLabelRenderer>
          <div
            style={{
              ...edgeLabelStyle,
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: stroke,
              color: stroke,
              opacity
            }}
          >
            {label ? <span>{label}</span> : null}
            {data?.issueSummary ? (
              <span
                style={{
                  ...edgeIssueBadgeStyle,
                  borderColor: issueToneValue?.borderColor,
                  background: issueToneValue?.background,
                  color: issueToneValue?.color
                }}
                title={data.issueSummary.issues.map((issue) => `${issue.level}: ${issue.message}`).join('\n')}
              >
                {data.issueSummary.level}
                {' · '}
                {data.issueSummary.count}
              </span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = {
  lane: memo(LaneNode),
  stage: memo(StageNode),
  step: memo(StepNode),
  outcome: memo(OutcomeNode)
};

const edgeTypes = {
  'dbm-edge': memo(SelectableEdge)
};

function resolveDragEndClientPosition(event: DragEndEvent): { x: number; y: number } | null {
  const translated = event.active.rect.current.translated;
  if (translated) {
    return {
      x: translated.left + translated.width / 2,
      y: translated.top + translated.height / 2
    };
  }

  const initial = event.active.rect.current.initial;
  if (!initial) {
    return null;
  }

  return {
    x: initial.left + initial.width / 2 + event.delta.x,
    y: initial.top + initial.height / 2 + event.delta.y
  };
}

function isPointInsideRect(
  point: { x: number; y: number },
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function GraphCanvasInner({ document, onSelectionChange, onGraphIntent, onNodePositionCommit, onToggleStageCollapse, onPaletteStageDrop, focusTargetId, focusRequestToken }: GraphCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'graph-canvas'
  });
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const reactFlow = useReactFlow();

  void focusTargetId;
  void focusRequestToken;

  function setCanvasHostRef(element: HTMLDivElement | null) {
    canvasHostRef.current = element;
    setNodeRef(element);
  }

  const flowDocument = useMemo(() => {
    if (!document) {
      return null;
    }

    const baseGraph = xyflowGraphAdapter.toLibraryGraph(document);
    return {
      nodes: baseGraph.nodes.map((node) => (
        node.type === 'stage'
          ? {
              ...node,
              data: {
                ...(node.data as FlowStageData),
                onToggleCollapse: onToggleStageCollapse
              }
            }
          : node
      )),
      edges: baseGraph.edges
    };
  }, [document, onToggleStageCollapse]);

  useDndMonitor({
    onDragEnd(event) {
      if (event.active.id !== 'palette-stage' || !document) {
        return;
      }

      const clientPosition = resolveDragEndClientPosition(event) ?? lastPointerClientRef.current;
      const canvasRect = canvasHostRef.current?.getBoundingClientRect();
      if (!clientPosition || !canvasRect || !isPointInsideRect(clientPosition, canvasRect)) {
        return;
      }

      onPaletteStageDrop(reactFlow.screenToFlowPosition(clientPosition));
    }
  });

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      lastPointerClientRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  if (!document || !flowDocument) {
    return <div style={emptyCanvasStyle}>Load or create a package to start graph authoring.</div>;
  }

  if (flowDocument.nodes.length === 0) {
    return (
      <div
        ref={setCanvasHostRef}
        style={{
          ...emptyCanvasStyle,
          borderStyle: 'solid',
          borderColor: isOver ? '#b45309' : '#d6d3d1',
          boxShadow: isOver ? '0 0 0 2px rgba(180,83,9,0.18)' : 'none'
        }}
        data-testid="graph-canvas"
      >
        The current process package produced no graph nodes. Open Diagnostics to inspect the derived graph document.
      </div>
    );
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
      ref={setCanvasHostRef}
      style={{
        ...canvasShellStyle,
        borderColor: isOver ? '#b45309' : '#d6d3d1',
        boxShadow: isOver ? '0 0 0 2px rgba(180,83,9,0.18)' : 'none'
      }}
      data-testid="graph-canvas"
    >
      <div style={flowViewportStyle}>
        <ReactFlow
          fitView
          fitViewOptions={{ padding: 0.14 }}
          nodes={flowDocument.nodes}
          edges={flowDocument.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
          minZoom={0.45}
          maxZoom={1.6}
        >
          <Background color="#e2e8f0" gap={28} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
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
  width: '100%',
  height: '78vh',
  minHeight: '640px',
  borderRadius: '1.35rem',
  border: '1px solid #d6d3d1',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
  position: 'relative'
} as const;

const emptyCanvasStyle = {
  width: '100%',
  height: '78vh',
  minHeight: '640px',
  borderRadius: '1.35rem',
  border: '1px dashed #d6d3d1',
  background: 'rgba(255,255,255,0.7)',
  display: 'grid',
  placeItems: 'center',
  color: '#64748b'
} as const;

const flowViewportStyle = {
  width: '100%',
  height: '100%'
} as const;

const handleStyle = {
  width: '10px',
  height: '10px',
  background: '#c2410c',
  border: '2px solid #fff'
} as const;

const laneNodeStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1.45rem',
  background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.12) 0%, rgba(148, 163, 184, 0.04) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.24)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)'
} as const;

const laneTitleStyle = {
  padding: '0.95rem 1rem',
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#475569'
} as const;

const stageCardStyle = {
  minHeight: '100%',
  borderRadius: '1.12rem',
  border: '1px solid #d97706',
  background: 'linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)',
  boxShadow: '0 16px 36px rgba(180, 83, 9, 0.16)',
  padding: '0.95rem 1rem',
  display: 'grid',
  gap: '0.65rem'
} as const;

const selectedStageCardStyle = {
  boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.2), 0 16px 36px rgba(180, 83, 9, 0.16)'
} as const;

const stageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.8rem',
  alignItems: 'flex-start'
} as const;
const stageHeaderActionsStyle = {
  display: 'grid',
  justifyItems: 'end',
  gap: '0.45rem'
} as const;

const nodeEyebrowStyle = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6b7280'
} as const;

const stageTitleStyle = {
  marginTop: '0.18rem',
  fontSize: '1.04rem',
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

const stageSummaryRowStyle = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap'
} as const;

const summaryChipStyle = {
  padding: '0.26rem 0.55rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(180, 83, 9, 0.18)',
  fontSize: '0.76rem',
  color: '#7c2d12'
} as const;

const outcomeChipsStyle = {
  display: 'grid',
  gap: '0.45rem'
} as const;

const outcomeChipStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.34rem 0.5rem',
  borderRadius: '0.82rem',
  background: 'rgba(255,255,255,0.66)',
  border: '1px solid rgba(180, 83, 9, 0.16)'
} as const;

const outcomeHandleLabelStyle = {
  fontSize: '0.78rem',
  color: '#7c2d12'
} as const;

const chipButtonStyle = {
  padding: '0.38rem 0.68rem',
  borderRadius: '999px',
  border: '1px solid #fdba74',
  background: '#fff',
  color: '#9a3412',
  cursor: 'pointer',
  fontSize: '0.76rem'
} as const;

const stepCardStyle = {
  minHeight: '100%',
  borderRadius: '1rem',
  border: '1px solid #2563eb',
  background: 'linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.14)',
  padding: '0.88rem 0.92rem',
  display: 'grid',
  gap: '0.45rem'
} as const;
const floatingIssueBadgeRowStyle = {
  minHeight: '1.4rem',
  display: 'flex',
  justifyContent: 'flex-end'
} as const;

const selectedStepCardStyle = {
  boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.22), 0 14px 30px rgba(37, 99, 235, 0.14)'
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

const selectedOutcomeStyle = {
  boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.18), 0 10px 22px rgba(15, 118, 110, 0.14)'
} as const;

const outcomeNodeLabelStyle = {
  display: 'inline-block',
  paddingLeft: '0.5rem',
  fontWeight: 700,
  color: '#134e4a'
} as const;

const edgeLabelStyle = {
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  gap: '0.35rem',
  alignItems: 'center',
  padding: '0.22rem 0.45rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: 'rgba(255,255,255,0.92)',
  fontSize: '0.72rem',
  fontWeight: 600,
  whiteSpace: 'nowrap'
} as const;
const issueBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  padding: '0.22rem 0.46rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
} as const;
const edgeIssueBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  padding: '0.15rem 0.38rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  fontSize: '0.66rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
} as const;
