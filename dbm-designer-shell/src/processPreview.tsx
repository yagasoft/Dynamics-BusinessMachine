import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';

interface ProcessPreviewProps {
  snapshot: DbmProcessExperienceSnapshotV1 | null;
}

function statePalette(state: string): { background: string; border: string } {
  switch (state) {
    case 'completed':
      return { background: '#d8f5e5', border: '#72c692' };
    case 'current':
      return { background: '#fff0bf', border: '#f2b950' };
    case 'available':
      return { background: '#d9ebff', border: '#6fa9f6' };
    default:
      return { background: '#f4f4f5', border: '#d4d4d8' };
  }
}

export function ProcessPreview({ snapshot }: ProcessPreviewProps) {
  if (!snapshot) {
    return <div style={emptyStateStyle}>Preview becomes available once the model and workspace parse cleanly.</div>;
  }

  return (
    <div style={previewShellStyle}>
      <div style={previewHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>Process Experience</div>
          <h2 style={headingStyle}>{snapshot.processId}</h2>
        </div>
        <div style={statusGroupStyle}>
          <span style={statusBadgeStyle}>Audience: {snapshot.audience}</span>
          {snapshot.portalStatus ? <span style={statusBadgeStyle}>Portal: {snapshot.portalStatus.displayName}</span> : null}
          {snapshot.internalStatus ? <span style={statusBadgeStyle}>Internal: {snapshot.internalStatus.displayName}</span> : null}
        </div>
      </div>

      {snapshot.projection.message ? <div style={projectionNoticeStyle}>{snapshot.projection.message}</div> : null}

      <div style={stageRailStyle}>
        {snapshot.stages.map((stage) => {
          const palette = statePalette(stage.state);
          const currentStep = stage.currentStepId
            ? snapshot.steps.find((step) => step.id === stage.currentStepId)
            : null;

          return (
            <div
              key={stage.id}
              style={{
                ...stageCardStyle,
                background: palette.background,
                borderColor: palette.border,
                opacity: stage.visibility === 'collapsed-hidden' ? 0.7 : 1
              }}
            >
              <div style={stageCardHeaderStyle}>
                <span style={stageStatePillStyle}>{stage.state}</span>
                <span style={stageIdStyle}>{stage.id}</span>
              </div>
              <div style={stageNameStyle}>{stage.displayName}</div>
              <div style={stageMetaStyle}>Type: {stage.stageType}</div>
              <div style={stageMetaStyle}>Owner: {stage.actor?.displayName ?? 'Unassigned'}</div>
              <div style={stageMetaStyle}>Form: {stage.formId ?? 'No form'}</div>
              <div style={stageMetaStyle}>Visibility: {stage.visibility}</div>
              <div style={stageMetaStyle}>Current step: {currentStep?.displayName ?? 'Not active'}</div>
              {stage.availableOutcomeIds.length > 0 ? (
                <div style={stageMetaStyle}>Outcomes: {stage.availableOutcomeIds.join(', ')}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={outcomeListStyle}>
        <div style={eyebrowStyle}>Available Outcomes</div>
        {snapshot.availableOutcomes.length > 0 ? (
          <div style={chipRowStyle}>
            {snapshot.availableOutcomes.map((outcome) => (
              <span key={outcome.id} style={statusBadgeStyle}>
                {outcome.displayName}
              </span>
            ))}
          </div>
        ) : (
          <div style={mutedCopyStyle}>No outcomes are currently available for the selected preview state.</div>
        )}
      </div>
    </div>
  );
}

const previewShellStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const previewHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;

const eyebrowStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6b7280'
} as const;

const headingStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.3rem'
} as const;

const statusGroupStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap'
} as const;

const statusBadgeStyle = {
  padding: '0.4rem 0.65rem',
  borderRadius: '999px',
  background: '#ffffff',
  border: '1px solid #d4d4d8',
  fontSize: '0.82rem'
} as const;

const projectionNoticeStyle = {
  padding: '0.85rem 1rem',
  borderRadius: '0.85rem',
  background: '#fff7df',
  border: '1px solid #f2d176'
} as const;

const stageRailStyle = {
  display: 'grid',
  gap: '0.9rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))'
} as const;

const stageCardStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d4d4d8',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.07)'
} as const;

const stageCardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'center'
} as const;

const stageStatePillStyle = {
  padding: '0.24rem 0.55rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.8)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
} as const;

const stageIdStyle = {
  fontSize: '0.74rem',
  color: '#4b5563'
} as const;

const stageNameStyle = {
  marginTop: '0.85rem',
  fontSize: '1rem',
  fontWeight: 700
} as const;

const stageMetaStyle = {
  marginTop: '0.35rem',
  fontSize: '0.86rem',
  color: '#334155'
} as const;

const outcomeListStyle = {
  display: 'grid',
  gap: '0.65rem'
} as const;

const chipRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap'
} as const;

const mutedCopyStyle = {
  color: '#6b7280',
  fontSize: '0.9rem'
} as const;

const emptyStateStyle = {
  padding: '1rem',
  borderRadius: '0.85rem',
  background: '#f4f4f5',
  color: '#52525b'
} as const;
