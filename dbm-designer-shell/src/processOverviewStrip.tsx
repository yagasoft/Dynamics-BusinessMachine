import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';

interface ProcessOverviewStripProps {
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  selectedStageId: string | null;
  onSelectStage(stageId: string): void;
}

function resolveStageTone(state: DbmProcessExperienceSnapshotV1['stages'][number]['state']) {
  switch (state) {
    case 'completed':
      return {
        border: '#16a34a',
        background: '#f0fdf4',
        text: '#166534'
      };
    case 'current':
      return {
        border: '#c2410c',
        background: '#fff7ed',
        text: '#9a3412'
      };
    case 'available':
      return {
        border: '#2563eb',
        background: '#eff6ff',
        text: '#1d4ed8'
      };
    default:
      return {
        border: '#cbd5e1',
        background: '#ffffff',
        text: '#475569'
      };
  }
}

export function ProcessOverviewStrip({ snapshot, selectedStageId, onSelectStage }: ProcessOverviewStripProps) {
  if (!snapshot) {
    return null;
  }

  return (
    <div style={stripStyle}>
      <div style={eyebrowStyle}>Process Flow Overview</div>
      <div style={itemsRowStyle}>
        {snapshot.stages.map((stage) => {
          const tone = resolveStageTone(stage.state);
          const isSelected = selectedStageId === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              style={{
                ...stageChipStyle,
                borderColor: tone.border,
                background: tone.background,
                color: tone.text,
                boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.18)' : 'none'
              }}
              onClick={() => onSelectStage(stage.id)}
            >
              <span style={stageNameStyle}>{stage.displayName}</span>
              <span style={stageMetaStyle}>
                {stage.state}
                {stage.currentStepId ? ` • ${stage.currentStepId}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const stripStyle = {
  display: 'grid',
  gap: '0.75rem',
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  border: '1px solid rgba(214, 211, 209, 0.92)',
  background: 'rgba(255,255,255,0.84)',
  backdropFilter: 'blur(12px)'
} as const;

const eyebrowStyle = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const itemsRowStyle = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(180px, 220px)',
  gap: '0.75rem',
  overflowX: 'auto',
  paddingBottom: '0.25rem'
} as const;

const stageChipStyle = {
  display: 'grid',
  gap: '0.2rem',
  textAlign: 'left',
  padding: '0.82rem 0.95rem',
  borderRadius: '0.95rem',
  border: '1px solid #cbd5e1',
  cursor: 'pointer'
} as const;

const stageNameStyle = {
  fontWeight: 700
} as const;

const stageMetaStyle = {
  fontSize: '0.78rem',
  opacity: 0.9
} as const;
