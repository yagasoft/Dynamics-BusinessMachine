import { useMemo, useState } from 'react';
import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { buildGuidedWorkspaceViewModel, type GuidedWorkspaceTone } from './guidedWorkspace';
import type { ProcessExperienceSurfaceProps } from './types';

function tonePalette(tone: GuidedWorkspaceTone): { background: string; border: string; text: string; chip: string; shadow: string } {
  switch (tone) {
    case 'completed':
      return {
        background: 'linear-gradient(180deg, #ecfdf3 0%, #ddf7e6 100%)',
        border: '#8fd0ab',
        text: '#14532d',
        chip: '#ffffff',
        shadow: 'rgba(44, 127, 82, 0.16)'
      };
    case 'current':
      return {
        background: 'linear-gradient(180deg, #fff7d9 0%, #ffefbd 100%)',
        border: '#f2bb55',
        text: '#7c3f00',
        chip: '#fffdf7',
        shadow: 'rgba(206, 136, 20, 0.18)'
      };
    case 'available':
      return {
        background: 'linear-gradient(180deg, #eff6ff 0%, #dfedff 100%)',
        border: '#81acef',
        text: '#1d4d8f',
        chip: '#ffffff',
        shadow: 'rgba(59, 106, 185, 0.16)'
      };
    case 'hidden':
      return {
        background: 'linear-gradient(180deg, #eef2ff 0%, #e6ebff 100%)',
        border: '#a6b6ea',
        text: '#3730a3',
        chip: '#ffffff',
        shadow: 'rgba(91, 85, 194, 0.16)'
      };
    default:
      return {
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        border: '#d7dee8',
        text: '#334155',
        chip: '#ffffff',
        shadow: 'rgba(148, 163, 184, 0.12)'
      };
  }
}

function formatTechnicalTitle(snapshot: DbmProcessExperienceSnapshotV1): string {
  return `${snapshot.processId} (${snapshot.packageVersion})`;
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
      <div style={projectionCopyStyle}>
        <span style={projectionLabelStyle}>Heads up</span>
        <div>{snapshot.projection.message}</div>
      </div>
      {props.navigationTarget && props.onNavigateToFormRegion ? (
        <button
          type="button"
          style={secondaryActionButtonStyle}
          onClick={() => props.onNavigateToFormRegion?.(props.navigationTarget!)}
        >
          Open {props.navigationTarget.label}
        </button>
      ) : null}
    </div>
  );
}

export function ProcessExperienceSurface(props: ProcessExperienceSurfaceProps) {
  const snapshot = props.snapshot;
  const [isFlowOpen, setFlowOpen] = useState(false);

  const viewModel = useMemo(
    () => (snapshot ? buildGuidedWorkspaceViewModel(snapshot, props.audience ?? snapshot.audience) : null),
    [props.audience, snapshot]
  );

  if (!snapshot || !viewModel) {
    return <div style={emptyStateStyle}>Process experience becomes available once the model and workspace parse cleanly.</div>;
  }

  const resolvedAudience = props.audience ?? snapshot.audience;
  const currentTone = tonePalette(viewModel.currentTask.tone);

  return (
    <div style={surfaceShellStyle}>
      <div style={headerShellStyle}>
        <div>
          <div style={eyebrowStyle}>DBM Process</div>
          <h2 style={headingStyle}>{viewModel.processTitle}</h2>
          <p style={introCopyStyle}>{viewModel.introCopy}</p>
        </div>
        <div style={statusClusterStyle}>
          <span style={{ ...statusPillStyle, color: currentTone.text, borderColor: currentTone.border, background: currentTone.chip }}>
            {viewModel.currentTask.statusLabel}
          </span>
          <button
            type="button"
            style={flowToggleButtonStyle}
            aria-expanded={isFlowOpen}
            onClick={() => setFlowOpen((current) => !current)}
          >
            {isFlowOpen ? 'Hide flow' : 'View flow'}
          </button>
        </div>
      </div>

      {renderProjectionCallToAction(snapshot, props)}

      <div style={journeyTrackerShellStyle}>
        {viewModel.trackerItems.map((item) => {
          const palette = tonePalette(item.tone);
          return (
            <button
              key={item.id}
              type="button"
              style={{
                ...trackerItemStyle,
                background: palette.background,
                borderColor: item.isCurrent ? palette.border : '#d7dee8',
                boxShadow: item.isCurrent ? `0 18px 40px ${palette.shadow}` : 'none'
              }}
              onClick={() => props.onRequestFocus?.(`stage:${item.id}`)}
            >
              <div style={trackerHeaderStyle}>
                <span style={{ ...trackerStatePillStyle, color: palette.text, background: palette.chip }}>{item.stateLabel}</span>
                {item.actorLabel ? <span style={trackerActorStyle}>{item.actorLabel}</span> : null}
              </div>
              <strong style={trackerLabelStyle}>{item.label}</strong>
              <span style={trackerHelperStyle}>{item.helperCopy}</span>
            </button>
          );
        })}
      </div>

      <div style={workspaceGridStyle}>
        <section
          style={{
            ...currentTaskCardStyle,
            background: currentTone.background,
            borderColor: currentTone.border,
            boxShadow: `0 22px 44px ${currentTone.shadow}`
          }}
        >
          <div style={currentTaskHeaderStyle}>
            <div>
              <div style={currentTaskLabelStyle}>{viewModel.currentTask.stageLabel}</div>
              <h3 style={currentStageTitleStyle}>{viewModel.currentTask.stageTitle}</h3>
            </div>
            {viewModel.currentTask.actorLabel ? (
              <div style={actorBadgeStyle}>{viewModel.currentTask.actorLabel}</div>
            ) : null}
          </div>

          <div style={currentTaskBodyStyle}>
            <div style={currentTaskMainColumnStyle}>
              <div style={currentStepCardStyle}>
                <div style={currentStepEyebrowStyle}>What to do now</div>
                <div style={currentStepTitleStyle}>{viewModel.currentTask.stepTitle}</div>
                <p style={currentStepSummaryStyle}>{viewModel.currentTask.stepSummary}</p>
                <p style={currentStepHelperStyle}>{viewModel.currentTask.helperCopy}</p>

                {viewModel.currentTask.actions.length > 0 ? (
                  <div style={actionGroupStyle}>
                    {viewModel.currentTask.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        style={action.emphasis === 'primary' ? primaryActionButtonStyle : secondaryActionButtonStyle}
                        onClick={() => props.onInvokeOutcome?.(action.id)}
                        disabled={!props.onInvokeOutcome}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={readOnlyNoticeStyle}>No action is needed from this surface right now.</div>
                )}

                {viewModel.currentTask.actions.some((action) => action.nextCopy) ? (
                  <div style={nextActionHintsStyle}>
                    {viewModel.currentTask.actions.map((action) =>
                      action.nextCopy ? (
                        <div key={action.id} style={nextActionHintStyle}>
                          <strong>{action.label}:</strong> {action.nextCopy}
                        </div>
                      ) : null
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <aside style={supportingColumnStyle}>
              {viewModel.currentTask.siblingSteps.length > 0 ? (
                <div style={supportCardStyle}>
                  <div style={supportCardLabelStyle}>Step sequence</div>
                  <div style={stepChecklistStyle}>
                    {viewModel.currentTask.siblingSteps.map((step) => {
                      const palette = tonePalette(step.tone);
                      return (
                        <button
                          key={step.id}
                          type="button"
                          style={{
                            ...stepChecklistItemStyle,
                            borderColor: step.isCurrent ? palette.border : '#d8dee8',
                            background: step.isCurrent ? palette.background : '#ffffff'
                          }}
                          onClick={() => props.onRequestFocus?.(`step:${step.id}`)}
                        >
                          <span style={{ ...stepChecklistStateStyle, color: palette.text }}>{step.stateLabel}</span>
                          <strong style={stepChecklistTitleStyle}>{step.label}</strong>
                          <span style={stepChecklistHelperStyle}>{step.helperCopy}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={supportCardStyle}>
                  <div style={supportCardLabelStyle}>{viewModel.currentTask.supportingLabel}</div>
                  <p style={supportParagraphStyle}>{viewModel.currentTask.supportingCopy}</p>
                </div>
              )}

              <div style={supportCardStyle}>
                <div style={supportCardLabelStyle}>What happens next</div>
                <p style={supportParagraphStyle}>{viewModel.currentTask.nextCopy}</p>
              </div>
            </aside>
          </div>
        </section>

        {isFlowOpen ? (
          <aside style={flowDrawerStyle}>
            <div style={flowDrawerHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Process flow</div>
                <h3 style={flowHeadingStyle}>How this request can move</h3>
              </div>
            </div>
            <div style={flowStageListStyle}>
              {viewModel.flowStages.map((stage) => {
                const palette = tonePalette(stage.tone);
                return (
                  <div
                    key={stage.id}
                    style={{
                      ...flowStageCardStyle,
                      borderColor: stage.isCurrent ? palette.border : '#d7dee8',
                      background: stage.isCurrent ? palette.background : '#ffffff'
                    }}
                  >
                    <div style={flowStageHeaderStyle}>
                      <strong style={flowStageTitleStyle}>{stage.label}</strong>
                      <span style={{ ...flowStatePillStyle, color: palette.text, background: palette.chip }}>{stage.stateLabel}</span>
                    </div>
                    <div style={flowStageHelperStyle}>{stage.helperCopy}</div>
                    {stage.transitions.length > 0 ? (
                      <div style={flowTransitionListStyle}>
                        {stage.transitions.map((transition) => {
                          const transitionPalette = tonePalette(transition.tone);
                          return (
                            <div key={transition.id} style={flowTransitionRowStyle}>
                              <span style={{ ...transitionOutcomeChipStyle, color: transitionPalette.text, borderColor: transitionPalette.border }}>
                                {transition.label}
                              </span>
                              <span style={flowArrowStyle}>to</span>
                              <span style={flowDestinationStyle}>{transition.destinationLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={flowTerminalCopyStyle}>This stage currently has no configured next stage.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>

      {props.mode === 'designer-preview' ? (
        <details style={technicalDetailsStyle}>
          <summary style={technicalSummaryStyle}>Technical details</summary>
          <div style={technicalGridStyle}>
            <span>Process: {formatTechnicalTitle(snapshot)}</span>
            <span>Mode: {props.mode}</span>
            <span>Audience: {resolvedAudience}</span>
            <span>Current form: {snapshot.activeFormId ?? 'none'}</span>
            <span>Current form state: {snapshot.activeFormStateId ?? 'none'}</span>
          </div>
        </details>
      ) : null}
    </div>
  );
}

const surfaceShellStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.2rem',
  borderRadius: '1.4rem',
  background: 'linear-gradient(180deg, #fffdfa 0%, #f5efe6 100%)',
  border: '1px solid #ece2d2',
  color: '#10233f'
} as const;

const headerShellStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;

const eyebrowStyle = {
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#7b6a57'
} as const;

const headingStyle = {
  margin: '0.35rem 0 0.2rem',
  fontSize: '1.65rem',
  lineHeight: 1.1
} as const;

const introCopyStyle = {
  margin: 0,
  color: '#5b6470',
  fontSize: '0.98rem'
} as const;

const statusClusterStyle = {
  display: 'flex',
  gap: '0.65rem',
  alignItems: 'center',
  flexWrap: 'wrap'
} as const;

const statusPillStyle = {
  padding: '0.5rem 0.82rem',
  borderRadius: '999px',
  border: '1px solid #d7dee8',
  fontSize: '0.84rem',
  fontWeight: 700
} as const;

const flowToggleButtonStyle = {
  padding: '0.7rem 1rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#10233f',
  cursor: 'pointer',
  fontWeight: 600
} as const;

const projectionNoticeStyle = {
  display: 'flex',
  gap: '0.85rem',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  background: '#fff6e4',
  border: '1px solid #f0d08a'
} as const;

const projectionCopyStyle = {
  display: 'grid',
  gap: '0.3rem'
} as const;

const projectionLabelStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#955f00',
  fontWeight: 700
} as const;

const journeyTrackerShellStyle = {
  display: 'grid',
  gap: '0.8rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
} as const;

const trackerItemStyle = {
  display: 'grid',
  gap: '0.45rem',
  padding: '0.95rem',
  borderRadius: '1rem',
  border: '1px solid #d7dee8',
  textAlign: 'left',
  cursor: 'pointer'
} as const;

const trackerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.6rem'
} as const;

const trackerStatePillStyle = {
  padding: '0.26rem 0.55rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
} as const;

const trackerActorStyle = {
  fontSize: '0.76rem',
  color: '#576273'
} as const;

const trackerLabelStyle = {
  fontSize: '0.98rem',
  lineHeight: 1.2
} as const;

const trackerHelperStyle = {
  fontSize: '0.86rem',
  color: '#516071'
} as const;

const workspaceGridStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const currentTaskCardStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.2rem',
  borderRadius: '1.25rem',
  border: '1px solid #d7dee8'
} as const;

const currentTaskHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.85rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;

const currentTaskLabelStyle = {
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#6b7280',
  fontWeight: 700
} as const;

const currentStageTitleStyle = {
  margin: '0.3rem 0 0',
  fontSize: '1.45rem',
  lineHeight: 1.15
} as const;

const actorBadgeStyle = {
  padding: '0.45rem 0.75rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  fontSize: '0.84rem',
  fontWeight: 600
} as const;

const currentTaskBodyStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  alignItems: 'start'
} as const;

const currentTaskMainColumnStyle = {
  display: 'grid'
} as const;

const currentStepCardStyle = {
  display: 'grid',
  gap: '0.8rem',
  padding: '1.1rem',
  borderRadius: '1.15rem',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.8)'
} as const;

const currentStepEyebrowStyle = {
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6b7280',
  fontWeight: 700
} as const;

const currentStepTitleStyle = {
  fontSize: '1.8rem',
  lineHeight: 1.05,
  fontWeight: 800
} as const;

const currentStepSummaryStyle = {
  margin: 0,
  fontSize: '1rem',
  lineHeight: 1.55,
  color: '#243247'
} as const;

const currentStepHelperStyle = {
  margin: 0,
  fontSize: '0.94rem',
  lineHeight: 1.5,
  color: '#5d6675'
} as const;

const actionGroupStyle = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  alignItems: 'center'
} as const;

const primaryActionButtonStyle = {
  padding: '0.85rem 1.2rem',
  borderRadius: '0.95rem',
  border: '1px solid #b45309',
  background: '#c96500',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.96rem'
} as const;

const secondaryActionButtonStyle = {
  padding: '0.82rem 1.08rem',
  borderRadius: '0.95rem',
  border: '1px solid #d3dbe6',
  background: '#ffffff',
  color: '#10233f',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.94rem'
} as const;

const readOnlyNoticeStyle = {
  padding: '0.85rem 0.95rem',
  borderRadius: '0.95rem',
  background: '#f5f3ff',
  border: '1px solid #d7cffc',
  color: '#5b4ec8',
  fontWeight: 600
} as const;

const nextActionHintsStyle = {
  display: 'grid',
  gap: '0.55rem'
} as const;

const nextActionHintStyle = {
  fontSize: '0.86rem',
  color: '#546173'
} as const;

const supportingColumnStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const supportCardStyle = {
  display: 'grid',
  gap: '0.7rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.8)'
} as const;

const supportCardLabelStyle = {
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6b7280',
  fontWeight: 700
} as const;

const stepChecklistStyle = {
  display: 'grid',
  gap: '0.7rem'
} as const;

const stepChecklistItemStyle = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.8rem',
  borderRadius: '0.95rem',
  border: '1px solid #d8dee8',
  textAlign: 'left',
  background: '#ffffff',
  cursor: 'pointer'
} as const;

const stepChecklistStateStyle = {
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700
} as const;

const stepChecklistTitleStyle = {
  fontSize: '0.94rem'
} as const;

const stepChecklistHelperStyle = {
  fontSize: '0.82rem',
  color: '#5d6675'
} as const;

const supportParagraphStyle = {
  margin: 0,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  color: '#546173'
} as const;

const flowDrawerStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.1rem',
  borderRadius: '1.2rem',
  background: '#ffffff',
  border: '1px solid #e0e7f0'
} as const;

const flowDrawerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem'
} as const;

const flowHeadingStyle = {
  margin: '0.3rem 0 0',
  fontSize: '1.2rem'
} as const;

const flowStageListStyle = {
  display: 'grid',
  gap: '0.8rem'
} as const;

const flowStageCardStyle = {
  display: 'grid',
  gap: '0.65rem',
  padding: '0.95rem',
  borderRadius: '1rem',
  border: '1px solid #d7dee8'
} as const;

const flowStageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '0.75rem',
  flexWrap: 'wrap'
} as const;

const flowStageTitleStyle = {
  fontSize: '1rem'
} as const;

const flowStatePillStyle = {
  padding: '0.24rem 0.55rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700
} as const;

const flowStageHelperStyle = {
  fontSize: '0.88rem',
  color: '#576273'
} as const;

const flowTransitionListStyle = {
  display: 'grid',
  gap: '0.55rem'
} as const;

const flowTransitionRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap'
} as const;

const transitionOutcomeChipStyle = {
  padding: '0.25rem 0.55rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '0.78rem',
  fontWeight: 700
} as const;

const flowArrowStyle = {
  fontSize: '0.82rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
} as const;

const flowDestinationStyle = {
  fontSize: '0.9rem',
  color: '#10233f',
  fontWeight: 600
} as const;

const flowTerminalCopyStyle = {
  fontSize: '0.86rem',
  color: '#6b7280'
} as const;

const technicalDetailsStyle = {
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  background: '#fbfaf7',
  border: '1px solid #e7ddcf'
} as const;

const technicalSummaryStyle = {
  cursor: 'pointer',
  fontWeight: 700,
  color: '#5d6675'
} as const;

const technicalGridStyle = {
  display: 'grid',
  gap: '0.45rem',
  marginTop: '0.85rem',
  fontSize: '0.84rem',
  color: '#5d6675'
} as const;

const emptyStateStyle = {
  padding: '1rem',
  borderRadius: '0.85rem',
  background: '#f4f4f5',
  color: '#52525b'
} as const;
