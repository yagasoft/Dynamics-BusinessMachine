import { useEffect, useMemo, useRef, useState } from 'react';
import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { buildGuidedWorkspaceViewModel, type GuidedWorkspaceTone } from './guidedWorkspace';
import type { DbmProcessExperiencePortalShellActionIdV1, ProcessExperienceSurfaceProps } from './types';

const DESIGNER_APP_UNIQUE_NAME = 'ys_YSCommon';
const DESIGNER_WEB_RESOURCE_NAME = 'ys_/dbm/apps/editor/index.html';

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
    <>
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
    </>
  );
}

const portalActionOrder: DbmProcessExperiencePortalShellActionIdV1[] = [
  'create-draft',
  'submit-request',
  'refresh-status'
];

function portalActionLabel(actionId: typeof portalActionOrder[number]): string {
  switch (actionId) {
    case 'create-draft':
      return 'Create draft';
    case 'submit-request':
      return 'Submit request';
    case 'refresh-status':
      return 'Refresh status';
    default:
      return actionId;
  }
}

function portalActionHelper(actionId: typeof portalActionOrder[number]): string | null {
  switch (actionId) {
    case 'create-draft':
      return 'Start a new request in this browser session.';
    case 'submit-request':
      return 'Send the request into the next internal review step.';
    case 'refresh-status':
      return 'Reload the latest portal-safe process status.';
    default:
      return null;
  }
}

export function ProcessExperienceSurface(props: ProcessExperienceSurfaceProps) {
  const snapshot = props.snapshot;
  const portalShell = props.portalShell ?? null;
  const [isFlowOpen, setFlowOpen] = useState(false);
  const lastAutoOpenKeyRef = useRef<string | null>(null);
  const resolvedDesignerEntryUrlRef = useRef<{ source: string; value: string } | null>(null);

  const viewModel = useMemo(
    () => (snapshot ? buildGuidedWorkspaceViewModel(snapshot, props.audience ?? snapshot.audience) : null),
    [props.audience, snapshot]
  );
  const resolvedAudience = props.audience ?? snapshot?.audience ?? (props.mode === 'external-runtime' ? 'portal' : undefined);
  const isExternalRuntime = props.mode === 'external-runtime';
  const isModelDriven = props.mode === 'model-driven-section' || props.mode === 'model-driven-overlay';
  const currentStageOutgoingTransitions = snapshot
    ? snapshot.transitions.filter((transition) => transition.fromStageId === snapshot.currentStageId)
    : [];
  const shouldAutoOpenFlow = Boolean(snapshot && isModelDriven
    && (
      Boolean(snapshot.projection.message)
      || snapshot.availableOutcomes.length > 1
      || currentStageOutgoingTransitions.length > 1
    ));
  const autoOpenKey = snapshot
    ? `${props.mode}:${snapshot.currentStageId}:${snapshot.currentStepId ?? 'none'}:${snapshot.projection.message ?? 'none'}:${snapshot.availableOutcomes.map((outcome) => outcome.id).join(',')}:${currentStageOutgoingTransitions.map((transition) => transition.id).join(',')}`
    : `${props.mode}:empty`;
  const currentTone = tonePalette(viewModel?.currentTask.tone ?? 'upcoming');
  const resolvedSurfaceShellStyle = isModelDriven ? compactSurfaceShellStyle : surfaceShellStyle;
  const resolvedHeadingStyle = isModelDriven ? compactHeadingStyle : headingStyle;
  const resolvedIntroCopyStyle = isModelDriven ? compactIntroCopyStyle : introCopyStyle;
  const resolvedStatusPillStyle = isModelDriven ? compactStatusPillStyle : statusPillStyle;
  const resolvedFlowToggleButtonStyle = isModelDriven ? compactFlowToggleButtonStyle : flowToggleButtonStyle;
  const resolvedProjectionNoticeStyle = isModelDriven ? compactProjectionNoticeStyle : projectionNoticeStyle;
  const resolvedJourneyTrackerShellStyle = isModelDriven ? compactJourneyTrackerShellStyle : journeyTrackerShellStyle;
  const resolvedTrackerItemStyle = isModelDriven ? compactTrackerItemStyle : trackerItemStyle;
  const resolvedTrackerLabelStyle = isModelDriven ? compactTrackerLabelStyle : trackerLabelStyle;
  const resolvedTrackerHelperStyle = isModelDriven ? compactTrackerHelperStyle : trackerHelperStyle;
  const resolvedCurrentTaskCardStyle = isModelDriven ? compactCurrentTaskCardStyle : currentTaskCardStyle;
  const resolvedCurrentStageTitleStyle = isModelDriven ? compactCurrentStageTitleStyle : currentStageTitleStyle;
  const resolvedActorBadgeStyle = isModelDriven ? compactActorBadgeStyle : actorBadgeStyle;
  const resolvedCurrentTaskBodyStyle = isModelDriven ? compactCurrentTaskBodyStyle : currentTaskBodyStyle;
  const resolvedCurrentStepCardStyle = isModelDriven ? compactCurrentStepCardStyle : currentStepCardStyle;
  const resolvedCurrentStepTitleStyle = isModelDriven ? compactCurrentStepTitleStyle : currentStepTitleStyle;
  const resolvedCurrentStepSummaryStyle = isModelDriven ? compactCurrentStepSummaryStyle : currentStepSummaryStyle;
  const resolvedCurrentStepHelperStyle = isModelDriven ? compactCurrentStepHelperStyle : currentStepHelperStyle;
  const resolvedActionGroupStyle = isModelDriven ? compactActionGroupStyle : actionGroupStyle;
  const resolvedPrimaryActionButtonStyle = isModelDriven ? compactPrimaryActionButtonStyle : primaryActionButtonStyle;
  const resolvedSecondaryActionButtonStyle = isModelDriven ? compactSecondaryActionButtonStyle : secondaryActionButtonStyle;
  const resolvedSupportingColumnStyle = isModelDriven ? compactSupportingColumnStyle : supportingColumnStyle;
  const resolvedSupportCardStyle = isModelDriven ? compactSupportCardStyle : supportCardStyle;
  const resolvedSupportParagraphStyle = isModelDriven ? compactSupportParagraphStyle : supportParagraphStyle;
  const resolvedStepChecklistItemStyle = isModelDriven ? compactStepChecklistItemStyle : stepChecklistItemStyle;
  const resolvedStepChecklistTitleStyle = isModelDriven ? compactStepChecklistTitleStyle : stepChecklistTitleStyle;
  const resolvedStepChecklistHelperStyle = isModelDriven ? compactStepChecklistHelperStyle : stepChecklistHelperStyle;
  const resolvedFlowDrawerStyle = isModelDriven ? compactFlowDrawerStyle : flowDrawerStyle;
  const resolvedFlowHeadingStyle = isModelDriven ? compactFlowHeadingStyle : flowHeadingStyle;
  const resolvedFlowStageCardStyle = isModelDriven ? compactFlowStageCardStyle : flowStageCardStyle;
  const resolvedFlowStageHelperStyle = isModelDriven ? compactFlowStageHelperStyle : flowStageHelperStyle;
  const resolvedFlowDestinationStyle = isModelDriven ? compactFlowDestinationStyle : flowDestinationStyle;
  const portalActionEntries = portalActionOrder
    .map((actionId) => {
      const actionState = portalShell?.actions[actionId];
      if (!actionState) {
        return null;
      }

      return {
        id: actionId,
        label: actionState.label ?? portalActionLabel(actionId),
        helperText: actionState.helperText ?? portalActionHelper(actionId),
        emphasis: actionId === 'submit-request' || actionId === 'create-draft' ? 'primary' : 'secondary',
        enabled: actionState.enabled,
        pending: actionState.pending ?? false
      };
    })
    .filter(
      (
        entry
      ): entry is {
        id: typeof portalActionOrder[number];
        label: string;
        helperText: string | null;
        emphasis: 'primary' | 'secondary';
        enabled: boolean;
        pending: boolean;
      } => Boolean(entry)
    );

  useEffect(() => {
    if (lastAutoOpenKeyRef.current === autoOpenKey) {
      return;
    }

    lastAutoOpenKeyRef.current = autoOpenKey;
    setFlowOpen(shouldAutoOpenFlow);
  }, [autoOpenKey, shouldAutoOpenFlow]);

  if (!snapshot || !viewModel || !resolvedAudience) {
    if (isExternalRuntime && portalShell) {
      return (
        <div style={surfaceShellStyle}>
          <div style={headerShellStyle}>
            <div>
              <div style={eyebrowStyle}>DBM External Runtime</div>
              <h2 style={headingStyle}>{portalShell.entryTitle ?? 'Start your request'}</h2>
              <p style={introCopyStyle}>
                {portalShell.entrySummary ?? 'Create a draft request to begin the external entry flow.'}
              </p>
            </div>
            <div style={statusClusterStyle}>
              {portalShell.requestStateLabel ? <span style={statusPillStyle}>{portalShell.requestStateLabel}</span> : null}
              {portalShell.sameSessionEnabled ? <span style={statusPillStyle}>Same browser session</span> : null}
            </div>
          </div>

          <div style={supportCardStyle}>
            <div style={supportCardLabelStyle}>Portal entry</div>
            <p style={supportParagraphStyle}>
              The portal shell keeps request initiation and status refresh in one place while Dataverse remains the
              authority for runtime state changes.
            </p>
            {portalActionEntries.length > 0 ? (
              <div style={actionGroupStyle}>
                {portalActionEntries.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    style={action.emphasis === 'primary' ? primaryActionButtonStyle : secondaryActionButtonStyle}
                    onClick={() => props.onPortalAction?.(action.id)}
                    disabled={!props.onPortalAction || !action.enabled || action.pending}
                  >
                    {action.pending ? `${action.label}...` : action.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={readOnlyNoticeStyle}>Portal actions will appear here when the runtime is ready.</div>
            )}
          </div>
        </div>
      );
    }

    return <div style={emptyStateStyle}>Process experience becomes available once the model and workspace parse cleanly.</div>;
  }

  async function handleOpenDesigner() {
    if (!props.designerEntryUrl) {
      return;
    }

    const cached = resolvedDesignerEntryUrlRef.current;
    if (cached && cached.source === props.designerEntryUrl) {
      window.open(cached.value, '_blank', 'noopener');
      return;
    }

    const globalScope = window as typeof window & { Xrm?: { Utility?: { getGlobalContext?: () => { getClientUrl?: () => string } } } };
    const parentScope = window.parent as typeof window & { Xrm?: { Utility?: { getGlobalContext?: () => { getClientUrl?: () => string } } } };
    const globalContext =
      parentScope?.Xrm?.Utility?.getGlobalContext?.()
      ?? globalScope?.Xrm?.Utility?.getGlobalContext?.()
      ?? null;
    const clientUrl = (
      globalContext?.getClientUrl?.()
      ?? window.location.origin
      ?? ''
    ).replace(/\/$/, '');
    let resolvedUrl = props.designerEntryUrl;

    const designerPayload = (() => {
      try {
        const parsed = new URL(resolvedUrl, clientUrl || undefined);
        const dataValue = parsed.searchParams.get('data')?.trim();
        if (dataValue) {
          const payload = JSON.parse(dataValue) as { packageName?: unknown };
          if (payload && typeof payload.packageName === 'string' && payload.packageName.trim()) {
            return { packageName: payload.packageName.trim() };
          }
        }

        const packageName = parsed.searchParams.get('packageName')?.trim();
        return packageName ? { packageName } : null;
      } catch {
        return null;
      }
    })();

    if (clientUrl && designerPayload) {
      try {
        const filter = encodeURIComponent(`uniquename eq '${DESIGNER_APP_UNIQUE_NAME}'`);
        const response = await fetch(
          `${clientUrl}/api/data/v9.2/appmodules?$select=appmoduleid,uniquename&$filter=${filter}`,
          {
            headers: {
              Accept: 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          }
        );

        if (response.ok) {
          const payload = await response.json() as { value?: Array<{ appmoduleid?: string | null }> };
          const appId = payload.value?.[0]?.appmoduleid?.trim();
          if (appId) {
            const next = new URL('/main.aspx', clientUrl);
            next.searchParams.set('appid', appId);
            next.searchParams.set('pagetype', 'webresource');
            next.searchParams.set('webresourceName', DESIGNER_WEB_RESOURCE_NAME);
            next.searchParams.set('data', JSON.stringify(designerPayload));
            resolvedUrl = next.toString();
          }
        }
      } catch {
      }
    }

    if (clientUrl && resolvedUrl.startsWith('/')) {
      resolvedUrl = `${clientUrl}${resolvedUrl}`;
    }

    resolvedDesignerEntryUrlRef.current = {
      source: props.designerEntryUrl,
      value: resolvedUrl
    };
    window.open(resolvedUrl, '_blank', 'noopener');
  }

  return (
    <div style={resolvedSurfaceShellStyle}>
      <div style={headerShellStyle}>
        <div>
          <div style={eyebrowStyle}>DBM Process</div>
          <h2 style={resolvedHeadingStyle}>{viewModel.processTitle}</h2>
          <p style={resolvedIntroCopyStyle}>
            {isExternalRuntime && portalShell?.entrySummary ? portalShell.entrySummary : viewModel.introCopy}
          </p>
        </div>
        <div style={statusClusterStyle}>
          <span style={{ ...resolvedStatusPillStyle, color: currentTone.text, borderColor: currentTone.border, background: currentTone.chip }}>
            {viewModel.currentTask.statusLabel}
          </span>
          {isExternalRuntime && portalShell?.requestReference ? (
            <span style={resolvedStatusPillStyle}>{portalShell.requestReference}</span>
          ) : null}
          {isExternalRuntime && portalShell?.sameSessionEnabled ? (
            <span style={resolvedStatusPillStyle}>Same browser session</span>
          ) : null}
          {isModelDriven && props.designerEntryUrl ? (
            <button
              type="button"
              style={resolvedSecondaryActionButtonStyle}
              onClick={() => {
                void handleOpenDesigner();
              }}
            >
              Edit process
            </button>
          ) : null}
          <button
            type="button"
            style={resolvedFlowToggleButtonStyle}
            aria-expanded={isFlowOpen}
            onClick={() => setFlowOpen((current) => !current)}
          >
            {isFlowOpen ? 'Hide flow' : 'View flow'}
          </button>
        </div>
      </div>

      {isExternalRuntime && portalShell ? (
        <div style={resolvedSupportCardStyle}>
          <div style={supportCardLabelStyle}>{portalShell.entryTitle ?? 'Portal session'}</div>
          <p style={resolvedSupportParagraphStyle}>
            {portalShell.requestStateLabel
              ? `Current portal state: ${portalShell.requestStateLabel}.`
              : 'The portal shell is reading the canonical Dataverse runtime state for this request.'}
          </p>
          {portalActionEntries.length > 0 ? (
            <div style={resolvedActionGroupStyle}>
              {portalActionEntries.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  style={action.emphasis === 'primary' ? resolvedPrimaryActionButtonStyle : resolvedSecondaryActionButtonStyle}
                  onClick={() => props.onPortalAction?.(action.id)}
                  disabled={!props.onPortalAction || !action.enabled || action.pending}
                >
                  {action.pending ? `${action.label}...` : action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {snapshot.projection.message ? <div style={resolvedProjectionNoticeStyle}>{renderProjectionCallToAction(snapshot, props)}</div> : null}

      <div style={resolvedJourneyTrackerShellStyle}>
        {viewModel.trackerItems.map((item) => {
          const palette = tonePalette(item.tone);
          return (
            <button
              key={item.id}
              type="button"
              style={{
                ...resolvedTrackerItemStyle,
                background: palette.background,
                borderColor: item.isCurrent ? palette.border : '#d7dee8',
                boxShadow: item.isCurrent
                  ? (isModelDriven ? `0 8px 18px ${palette.shadow}` : `0 18px 40px ${palette.shadow}`)
                  : 'none'
              }}
              onClick={() => props.onRequestFocus?.(`stage:${item.id}`)}
            >
              <div style={trackerHeaderStyle}>
                <span style={{ ...trackerStatePillStyle, color: palette.text, background: palette.chip }}>{item.stateLabel}</span>
                {item.actorLabel ? <span style={trackerActorStyle}>{item.actorLabel}</span> : null}
              </div>
              <strong style={resolvedTrackerLabelStyle}>{item.label}</strong>
              <span style={resolvedTrackerHelperStyle}>{item.helperCopy}</span>
            </button>
          );
        })}
      </div>

      <div style={workspaceGridStyle}>
        <section
          style={{
            ...resolvedCurrentTaskCardStyle,
            background: currentTone.background,
            borderColor: currentTone.border,
            boxShadow: isModelDriven ? `0 10px 24px ${currentTone.shadow}` : `0 22px 44px ${currentTone.shadow}`
          }}
        >
          <div style={currentTaskHeaderStyle}>
            <div>
              <div style={currentTaskLabelStyle}>{viewModel.currentTask.stageLabel}</div>
              <h3 style={resolvedCurrentStageTitleStyle}>{viewModel.currentTask.stageTitle}</h3>
            </div>
            {viewModel.currentTask.actorLabel ? (
              <div style={resolvedActorBadgeStyle}>{viewModel.currentTask.actorLabel}</div>
            ) : null}
          </div>

          <div style={resolvedCurrentTaskBodyStyle}>
            <div style={currentTaskMainColumnStyle}>
              <div style={resolvedCurrentStepCardStyle}>
                <div style={currentStepEyebrowStyle}>What to do now</div>
                <div style={resolvedCurrentStepTitleStyle}>{viewModel.currentTask.stepTitle}</div>
                <p style={resolvedCurrentStepSummaryStyle}>{viewModel.currentTask.stepSummary}</p>
                <p style={resolvedCurrentStepHelperStyle}>{viewModel.currentTask.helperCopy}</p>

                {isExternalRuntime && portalActionEntries.length > 0 ? (
                  <div style={resolvedActionGroupStyle}>
                    {portalActionEntries.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        style={action.emphasis === 'primary' ? resolvedPrimaryActionButtonStyle : resolvedSecondaryActionButtonStyle}
                        onClick={() => props.onPortalAction?.(action.id)}
                        disabled={!props.onPortalAction || !action.enabled || action.pending}
                      >
                        {action.pending ? `${action.label}...` : action.label}
                      </button>
                    ))}
                  </div>
                ) : viewModel.currentTask.actions.length > 0 ? (
                  <div style={resolvedActionGroupStyle}>
                    {viewModel.currentTask.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        style={action.emphasis === 'primary' ? resolvedPrimaryActionButtonStyle : resolvedSecondaryActionButtonStyle}
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

                {isExternalRuntime && portalActionEntries.some((action) => action.helperText) ? (
                  <div style={nextActionHintsStyle}>
                    {portalActionEntries.map((action) =>
                      action.helperText ? (
                        <div key={action.id} style={nextActionHintStyle}>
                          <strong>{action.label}:</strong> {action.helperText}
                        </div>
                      ) : null
                    )}
                  </div>
                ) : viewModel.currentTask.actions.some((action) => action.nextCopy) ? (
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

            <aside style={resolvedSupportingColumnStyle}>
              {viewModel.currentTask.siblingSteps.length > 0 ? (
                <div style={resolvedSupportCardStyle}>
                  <div style={supportCardLabelStyle}>Step sequence</div>
                  <div style={stepChecklistStyle}>
                    {viewModel.currentTask.siblingSteps.map((step) => {
                      const palette = tonePalette(step.tone);
                      return (
                        <button
                          key={step.id}
                          type="button"
                          style={{
                            ...resolvedStepChecklistItemStyle,
                            borderColor: step.isCurrent ? palette.border : '#d8dee8',
                            background: step.isCurrent ? palette.background : '#ffffff'
                          }}
                          onClick={() => props.onRequestFocus?.(`step:${step.id}`)}
                        >
                          <span style={{ ...stepChecklistStateStyle, color: palette.text }}>{step.stateLabel}</span>
                          <strong style={resolvedStepChecklistTitleStyle}>{step.label}</strong>
                          <span style={resolvedStepChecklistHelperStyle}>{step.helperCopy}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={resolvedSupportCardStyle}>
                  <div style={supportCardLabelStyle}>{viewModel.currentTask.supportingLabel}</div>
                  <p style={resolvedSupportParagraphStyle}>{viewModel.currentTask.supportingCopy}</p>
                </div>
              )}

              <div style={resolvedSupportCardStyle}>
                <div style={supportCardLabelStyle}>What happens next</div>
                <p style={resolvedSupportParagraphStyle}>{viewModel.currentTask.nextCopy}</p>
              </div>
            </aside>
          </div>
        </section>

        {isFlowOpen ? (
          <aside style={resolvedFlowDrawerStyle}>
            <div style={flowDrawerHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Process flow</div>
                <h3 style={resolvedFlowHeadingStyle}>How this request can move</h3>
              </div>
            </div>
            <div style={flowStageListStyle}>
              {viewModel.flowStages.map((stage) => {
                const palette = tonePalette(stage.tone);
                return (
                  <div
                    key={stage.id}
                    style={{
                      ...resolvedFlowStageCardStyle,
                      borderColor: stage.isCurrent ? palette.border : '#d7dee8',
                      background: stage.isCurrent ? palette.background : '#ffffff'
                    }}
                  >
                    <div style={flowStageHeaderStyle}>
                      <strong style={flowStageTitleStyle}>{stage.label}</strong>
                      <span style={{ ...flowStatePillStyle, color: palette.text, background: palette.chip }}>{stage.stateLabel}</span>
                    </div>
                    <div style={resolvedFlowStageHelperStyle}>{stage.helperCopy}</div>
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
                              <span style={resolvedFlowDestinationStyle}>{transition.destinationLabel}</span>
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

const compactSurfaceShellStyle = {
  ...surfaceShellStyle,
  gap: '0.65rem',
  padding: '0.72rem 0.78rem',
  borderRadius: '0.92rem',
  background: '#fffdf8',
  overflowX: 'hidden'
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

const compactHeadingStyle = {
  ...headingStyle,
  fontSize: '1.08rem',
  margin: '0.2rem 0 0.05rem'
} as const;

const introCopyStyle = {
  margin: 0,
  color: '#5b6470',
  fontSize: '0.98rem'
} as const;

const compactIntroCopyStyle = {
  ...introCopyStyle,
  fontSize: '0.82rem',
  lineHeight: 1.35
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

const compactStatusPillStyle = {
  ...statusPillStyle,
  padding: '0.28rem 0.58rem',
  fontSize: '0.74rem'
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

const compactFlowToggleButtonStyle = {
  ...flowToggleButtonStyle,
  padding: '0.48rem 0.78rem',
  fontSize: '0.8rem'
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

const compactProjectionNoticeStyle = {
  ...projectionNoticeStyle,
  padding: '0.68rem 0.78rem',
  borderRadius: '0.8rem'
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

const compactJourneyTrackerShellStyle = {
  display: 'flex',
  gap: '0.5rem',
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: '0.1rem'
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

const compactTrackerItemStyle = {
  ...trackerItemStyle,
  gap: '0.22rem',
  padding: '0.58rem 0.62rem',
  borderRadius: '0.78rem',
  minWidth: '140px',
  maxWidth: '176px',
  flex: '0 0 140px'
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

const compactTrackerLabelStyle = {
  ...trackerLabelStyle,
  fontSize: '0.82rem',
  lineHeight: 1.15
} as const;

const trackerHelperStyle = {
  fontSize: '0.86rem',
  color: '#516071'
} as const;

const compactTrackerHelperStyle = {
  ...trackerHelperStyle,
  fontSize: '0.72rem',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
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

const compactCurrentTaskCardStyle = {
  ...currentTaskCardStyle,
  gap: '0.65rem',
  padding: '0.72rem',
  borderRadius: '0.9rem'
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

const compactCurrentStageTitleStyle = {
  ...currentStageTitleStyle,
  fontSize: '1rem',
  lineHeight: 1.12
} as const;

const actorBadgeStyle = {
  padding: '0.45rem 0.75rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  fontSize: '0.84rem',
  fontWeight: 600
} as const;

const compactActorBadgeStyle = {
  ...actorBadgeStyle,
  padding: '0.28rem 0.52rem',
  fontSize: '0.72rem'
} as const;

const currentTaskBodyStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  alignItems: 'start'
} as const;

const compactCurrentTaskBodyStyle = {
  display: 'grid',
  gap: '0.65rem',
  gridTemplateColumns: 'minmax(0, 1fr)',
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

const compactCurrentStepCardStyle = {
  ...currentStepCardStyle,
  gap: '0.55rem',
  padding: '0.72rem',
  borderRadius: '0.85rem'
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

const compactCurrentStepTitleStyle = {
  ...currentStepTitleStyle,
  fontSize: '1.08rem',
  lineHeight: 1.14
} as const;

const currentStepSummaryStyle = {
  margin: 0,
  fontSize: '1rem',
  lineHeight: 1.55,
  color: '#243247'
} as const;

const compactCurrentStepSummaryStyle = {
  ...currentStepSummaryStyle,
  fontSize: '0.84rem',
  lineHeight: 1.34
} as const;

const currentStepHelperStyle = {
  margin: 0,
  fontSize: '0.94rem',
  lineHeight: 1.5,
  color: '#5d6675'
} as const;

const compactCurrentStepHelperStyle = {
  ...currentStepHelperStyle,
  fontSize: '0.78rem',
  lineHeight: 1.3
} as const;

const actionGroupStyle = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  alignItems: 'center'
} as const;

const compactActionGroupStyle = {
  ...actionGroupStyle,
  gap: '0.45rem'
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

const compactPrimaryActionButtonStyle = {
  ...primaryActionButtonStyle,
  padding: '0.58rem 0.86rem',
  borderRadius: '0.72rem',
  fontSize: '0.8rem'
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

const compactSecondaryActionButtonStyle = {
  ...secondaryActionButtonStyle,
  padding: '0.54rem 0.78rem',
  borderRadius: '0.72rem',
  fontSize: '0.8rem'
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

const compactSupportingColumnStyle = {
  display: 'grid',
  gap: '0.6rem'
} as const;

const supportCardStyle = {
  display: 'grid',
  gap: '0.7rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.8)'
} as const;

const compactSupportCardStyle = {
  ...supportCardStyle,
  gap: '0.45rem',
  padding: '0.68rem',
  borderRadius: '0.82rem'
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

const compactStepChecklistItemStyle = {
  ...stepChecklistItemStyle,
  gap: '0.16rem',
  padding: '0.58rem',
  borderRadius: '0.72rem'
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

const compactStepChecklistTitleStyle = {
  ...stepChecklistTitleStyle,
  fontSize: '0.8rem'
} as const;

const stepChecklistHelperStyle = {
  fontSize: '0.82rem',
  color: '#5d6675'
} as const;

const compactStepChecklistHelperStyle = {
  ...stepChecklistHelperStyle,
  fontSize: '0.72rem'
} as const;

const supportParagraphStyle = {
  margin: 0,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  color: '#546173'
} as const;

const compactSupportParagraphStyle = {
  ...supportParagraphStyle,
  fontSize: '0.78rem',
  lineHeight: 1.3
} as const;

const flowDrawerStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.1rem',
  borderRadius: '1.2rem',
  background: '#ffffff',
  border: '1px solid #e0e7f0'
} as const;

const compactFlowDrawerStyle = {
  ...flowDrawerStyle,
  gap: '0.6rem',
  padding: '0.72rem',
  borderRadius: '0.85rem'
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

const compactFlowHeadingStyle = {
  ...flowHeadingStyle,
  fontSize: '0.92rem'
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

const compactFlowStageCardStyle = {
  ...flowStageCardStyle,
  gap: '0.42rem',
  padding: '0.64rem',
  borderRadius: '0.78rem'
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

const compactFlowStageHelperStyle = {
  ...flowStageHelperStyle,
  fontSize: '0.74rem',
  lineHeight: 1.26
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

const compactFlowDestinationStyle = {
  ...flowDestinationStyle,
  fontSize: '0.78rem'
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
