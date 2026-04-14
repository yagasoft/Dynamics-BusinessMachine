import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import type { ProcessExperienceSurfaceProps } from './types';

function statePalette(state: string): { background: string; border: string; shadow: string } {
  switch (state) {
    case 'completed':
      return { background: '#d8f5e5', border: '#72c692', shadow: 'rgba(114, 198, 146, 0.24)' };
    case 'current':
      return { background: '#fff0bf', border: '#f2b950', shadow: 'rgba(242, 185, 80, 0.24)' };
    case 'available':
      return { background: '#d9ebff', border: '#6fa9f6', shadow: 'rgba(111, 169, 246, 0.22)' };
    default:
      return { background: '#f4f4f5', border: '#d4d4d8', shadow: 'rgba(212, 212, 216, 0.16)' };
  }
}

function renderProjectionCallToAction(
  snapshot: DbmProcessExperienceSnapshotV1,
  props: ProcessExperienceSurfaceProps
) {
  if (!snapshot.projection.message) {
    return null;
  }

  return (
    <div style={projectionNoticeStyle}>
      <div>{snapshot.projection.message}</div>
      {props.navigationTarget && props.onNavigateToFormRegion ? (
        <button
          type="button"
          style={ctaButtonStyle}
          onClick={() => props.onNavigateToFormRegion?.(props.navigationTarget!)}
        >
          Focus {props.navigationTarget.label}
        </button>
      ) : null}
    </div>
  );
}

function renderStepRail(snapshot: DbmProcessExperienceSnapshotV1, onRequestFocus?: (targetId: string) => void) {
  const currentStage = snapshot.stages.find((stage) => stage.id === snapshot.currentStageId);
  if (!currentStage) {
    return null;
  }

  const steps = snapshot.steps.filter((step) => step.stageId === currentStage.id);
  if (steps.length === 0) {
    return null;
  }

  return (
    <div style={stepRailWrapperStyle}>
      <div style={eyebrowStyle}>Current Stage Steps</div>
      <div style={stepRailStyle}>
        {steps.map((step) => {
          const palette = statePalette(step.state);
          return (
            <button
              key={step.id}
              type="button"
              style={{
                ...stepCardStyle,
                background: palette.background,
                borderColor: palette.border,
                boxShadow: `0 14px 30px ${palette.shadow}`
              }}
              onClick={() => onRequestFocus?.(`step:${step.id}`)}
            >
              <span style={stepStatePillStyle}>{step.state}</span>
              <strong style={stepTitleStyle}>{step.displayName}</strong>
              <span style={stepMetaStyle}>Type: {step.stepType}</span>
              <span style={stepMetaStyle}>Owner: {step.owner?.displayName ?? 'Unassigned'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProcessExperienceSurface(props: ProcessExperienceSurfaceProps) {
  const snapshot = props.snapshot;
  if (!snapshot) {
    return <div style={emptyStateStyle}>Process experience becomes available once the model and workspace parse cleanly.</div>;
  }

  return (
    <div style={surfaceShellStyle}>
      <div style={surfaceHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>DBM Process Experience</div>
          <h2 style={headingStyle}>{snapshot.processId}</h2>
        </div>
        <div style={badgeGroupStyle}>
          <span style={badgeStyle}>Mode: {props.mode}</span>
          <span style={badgeStyle}>Audience: {props.audience ?? snapshot.audience}</span>
          {snapshot.portalStatus ? <span style={badgeStyle}>Portal: {snapshot.portalStatus.displayName}</span> : null}
          {snapshot.internalStatus ? <span style={badgeStyle}>Internal: {snapshot.internalStatus.displayName}</span> : null}
        </div>
      </div>

      {renderProjectionCallToAction(snapshot, props)}

      <div style={stageRailStyle}>
        {snapshot.stages.map((stage) => {
          const palette = statePalette(stage.state);
          const currentStep = stage.currentStepId
            ? snapshot.steps.find((step) => step.id === stage.currentStepId)
            : null;
          const transitions = snapshot.transitions.filter((transition) => transition.fromStageId === stage.id);

          return (
            <button
              key={stage.id}
              type="button"
              style={{
                ...stageCardStyle,
                background: palette.background,
                borderColor: palette.border,
                boxShadow: `0 16px 34px ${palette.shadow}`,
                opacity: stage.visibility === 'collapsed-hidden' ? 0.72 : 1
              }}
              onClick={() => props.onRequestFocus?.(`stage:${stage.id}`)}
            >
              <div style={stageCardHeaderStyle}>
                <span style={stageStatePillStyle}>{stage.state}</span>
                <span style={stageIdStyle}>{stage.id}</span>
              </div>
              <div style={stageNameStyle}>{stage.displayName}</div>
              <div style={stageMetaStyle}>Type: {stage.stageType}</div>
              <div style={stageMetaStyle}>Owner: {stage.actor?.displayName ?? 'Unassigned'}</div>
              <div style={stageMetaStyle}>Form: {stage.formId ?? 'No form'}</div>
              <div style={stageMetaStyle}>Current step: {currentStep?.displayName ?? 'Not active'}</div>
              <div style={stageMetaStyle}>Visibility: {stage.visibility}</div>
              {transitions.length > 0 ? (
                <div style={transitionGroupStyle}>
                  {transitions.map((transition) => (
                    <span key={transition.id} style={transitionChipStyle}>
                      {transition.outcome?.displayName ?? 'Continue'} → {snapshot.stages.find((candidate) => candidate.id === transition.toStageId)?.displayName ?? transition.toStageId}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {renderStepRail(snapshot, props.onRequestFocus)}

      <div style={outcomeListStyle}>
        <div style={eyebrowStyle}>Available Outcomes</div>
        {snapshot.availableOutcomes.length > 0 ? (
          <div style={chipRowStyle}>
            {snapshot.availableOutcomes.map((outcome) => (
              <button
                key={outcome.id}
                type="button"
                style={outcomeButtonStyle}
                onClick={() => props.onInvokeOutcome?.(outcome.id)}
                disabled={!props.onInvokeOutcome}
              >
                {outcome.displayName}
              </button>
            ))}
          </div>
        ) : (
          <div style={mutedCopyStyle}>No outcomes are currently available for the selected process state.</div>
        )}
      </div>
    </div>
  );
}

const surfaceShellStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const surfaceHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;

const eyebrowStyle = {
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const headingStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.32rem'
} as const;

const badgeGroupStyle = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap'
} as const;

const badgeStyle = {
  padding: '0.4rem 0.65rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid #d6d3d1',
  fontSize: '0.8rem'
} as const;

const projectionNoticeStyle = {
  display: 'flex',
  gap: '0.85rem',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  padding: '0.9rem 1rem',
  borderRadius: '0.95rem',
  background: '#fff7df',
  border: '1px solid #f2d176'
} as const;

const ctaButtonStyle = {
  padding: '0.55rem 0.8rem',
  borderRadius: '0.85rem',
  border: '1px solid #d97706',
  background: '#fff',
  color: '#9a3412',
  cursor: 'pointer'
} as const;

const stageRailStyle = {
  display: 'grid',
  gap: '0.95rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
} as const;

const stageCardStyle = {
  display: 'grid',
  gap: '0.35rem',
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d4d4d8',
  textAlign: 'left',
  cursor: 'pointer'
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
  color: '#475569'
} as const;

const stageNameStyle = {
  marginTop: '0.25rem',
  fontSize: '1rem',
  fontWeight: 700
} as const;

const stageMetaStyle = {
  fontSize: '0.86rem',
  color: '#334155'
} as const;

const transitionGroupStyle = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap',
  marginTop: '0.3rem'
} as const;

const transitionChipStyle = {
  padding: '0.28rem 0.55rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  fontSize: '0.78rem'
} as const;

const stepRailWrapperStyle = {
  display: 'grid',
  gap: '0.75rem'
} as const;

const stepRailStyle = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
} as const;

const stepCardStyle = {
  display: 'grid',
  gap: '0.35rem',
  padding: '0.85rem',
  borderRadius: '0.95rem',
  border: '1px solid #d4d4d8',
  textAlign: 'left',
  cursor: 'pointer'
} as const;

const stepStatePillStyle = {
  width: 'fit-content',
  padding: '0.18rem 0.48rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.8)',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
} as const;

const stepTitleStyle = {
  fontSize: '0.92rem'
} as const;

const stepMetaStyle = {
  fontSize: '0.8rem',
  color: '#475569'
} as const;

const outcomeListStyle = {
  display: 'grid',
  gap: '0.65rem'
} as const;

const chipRowStyle = {
  display: 'flex',
  gap: '0.55rem',
  flexWrap: 'wrap'
} as const;

const outcomeButtonStyle = {
  padding: '0.55rem 0.8rem',
  borderRadius: '999px',
  background: '#fff',
  border: '1px solid #cbd5e1',
  cursor: 'pointer'
} as const;

const mutedCopyStyle = {
  color: '#6b7280',
  fontSize: '0.92rem'
} as const;

const emptyStateStyle = {
  padding: '1rem',
  borderRadius: '0.85rem',
  background: '#f4f4f5',
  color: '#52525b'
} as const;
