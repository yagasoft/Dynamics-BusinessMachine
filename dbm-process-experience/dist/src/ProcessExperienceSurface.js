import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { buildGuidedWorkspaceViewModel } from './guidedWorkspace';
function tonePalette(tone) {
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
function formatTechnicalTitle(snapshot) {
    return `${snapshot.processId} (${snapshot.packageVersion})`;
}
function renderProjectionCallToAction(snapshot, props) {
    if (!snapshot.projection.message) {
        return null;
    }
    return (_jsxs("div", { style: projectionNoticeStyle, children: [_jsxs("div", { style: projectionCopyStyle, children: [_jsx("span", { style: projectionLabelStyle, children: "Heads up" }), _jsx("div", { children: snapshot.projection.message })] }), props.navigationTarget && props.onNavigateToFormRegion ? (_jsxs("button", { type: "button", style: secondaryActionButtonStyle, onClick: () => props.onNavigateToFormRegion?.(props.navigationTarget), children: ["Open ", props.navigationTarget.label] })) : null] }));
}
export function ProcessExperienceSurface(props) {
    const snapshot = props.snapshot;
    const [isFlowOpen, setFlowOpen] = useState(false);
    const viewModel = useMemo(() => (snapshot ? buildGuidedWorkspaceViewModel(snapshot, props.audience ?? snapshot.audience) : null), [props.audience, snapshot]);
    if (!snapshot || !viewModel) {
        return _jsx("div", { style: emptyStateStyle, children: "Process experience becomes available once the model and workspace parse cleanly." });
    }
    const resolvedAudience = props.audience ?? snapshot.audience;
    const currentTone = tonePalette(viewModel.currentTask.tone);
    return (_jsxs("div", { style: surfaceShellStyle, children: [_jsxs("div", { style: headerShellStyle, children: [_jsxs("div", { children: [_jsx("div", { style: eyebrowStyle, children: "DBM Process" }), _jsx("h2", { style: headingStyle, children: viewModel.processTitle }), _jsx("p", { style: introCopyStyle, children: viewModel.introCopy })] }), _jsxs("div", { style: statusClusterStyle, children: [_jsx("span", { style: { ...statusPillStyle, color: currentTone.text, borderColor: currentTone.border, background: currentTone.chip }, children: viewModel.currentTask.statusLabel }), _jsx("button", { type: "button", style: flowToggleButtonStyle, "aria-expanded": isFlowOpen, onClick: () => setFlowOpen((current) => !current), children: isFlowOpen ? 'Hide flow' : 'View flow' })] })] }), renderProjectionCallToAction(snapshot, props), _jsx("div", { style: journeyTrackerShellStyle, children: viewModel.trackerItems.map((item) => {
                    const palette = tonePalette(item.tone);
                    return (_jsxs("button", { type: "button", style: {
                            ...trackerItemStyle,
                            background: palette.background,
                            borderColor: item.isCurrent ? palette.border : '#d7dee8',
                            boxShadow: item.isCurrent ? `0 18px 40px ${palette.shadow}` : 'none'
                        }, onClick: () => props.onRequestFocus?.(`stage:${item.id}`), children: [_jsxs("div", { style: trackerHeaderStyle, children: [_jsx("span", { style: { ...trackerStatePillStyle, color: palette.text, background: palette.chip }, children: item.stateLabel }), item.actorLabel ? _jsx("span", { style: trackerActorStyle, children: item.actorLabel }) : null] }), _jsx("strong", { style: trackerLabelStyle, children: item.label }), _jsx("span", { style: trackerHelperStyle, children: item.helperCopy })] }, item.id));
                }) }), _jsxs("div", { style: workspaceGridStyle, children: [_jsxs("section", { style: {
                            ...currentTaskCardStyle,
                            background: currentTone.background,
                            borderColor: currentTone.border,
                            boxShadow: `0 22px 44px ${currentTone.shadow}`
                        }, children: [_jsxs("div", { style: currentTaskHeaderStyle, children: [_jsxs("div", { children: [_jsx("div", { style: currentTaskLabelStyle, children: viewModel.currentTask.stageLabel }), _jsx("h3", { style: currentStageTitleStyle, children: viewModel.currentTask.stageTitle })] }), viewModel.currentTask.actorLabel ? (_jsx("div", { style: actorBadgeStyle, children: viewModel.currentTask.actorLabel })) : null] }), _jsxs("div", { style: currentTaskBodyStyle, children: [_jsx("div", { style: currentTaskMainColumnStyle, children: _jsxs("div", { style: currentStepCardStyle, children: [_jsx("div", { style: currentStepEyebrowStyle, children: "What to do now" }), _jsx("div", { style: currentStepTitleStyle, children: viewModel.currentTask.stepTitle }), _jsx("p", { style: currentStepSummaryStyle, children: viewModel.currentTask.stepSummary }), _jsx("p", { style: currentStepHelperStyle, children: viewModel.currentTask.helperCopy }), viewModel.currentTask.actions.length > 0 ? (_jsx("div", { style: actionGroupStyle, children: viewModel.currentTask.actions.map((action) => (_jsx("button", { type: "button", style: action.emphasis === 'primary' ? primaryActionButtonStyle : secondaryActionButtonStyle, onClick: () => props.onInvokeOutcome?.(action.id), disabled: !props.onInvokeOutcome, children: action.label }, action.id))) })) : (_jsx("div", { style: readOnlyNoticeStyle, children: "No action is needed from this surface right now." })), viewModel.currentTask.actions.some((action) => action.nextCopy) ? (_jsx("div", { style: nextActionHintsStyle, children: viewModel.currentTask.actions.map((action) => action.nextCopy ? (_jsxs("div", { style: nextActionHintStyle, children: [_jsxs("strong", { children: [action.label, ":"] }), " ", action.nextCopy] }, action.id)) : null) })) : null] }) }), _jsxs("aside", { style: supportingColumnStyle, children: [viewModel.currentTask.siblingSteps.length > 0 ? (_jsxs("div", { style: supportCardStyle, children: [_jsx("div", { style: supportCardLabelStyle, children: "Step sequence" }), _jsx("div", { style: stepChecklistStyle, children: viewModel.currentTask.siblingSteps.map((step) => {
                                                            const palette = tonePalette(step.tone);
                                                            return (_jsxs("button", { type: "button", style: {
                                                                    ...stepChecklistItemStyle,
                                                                    borderColor: step.isCurrent ? palette.border : '#d8dee8',
                                                                    background: step.isCurrent ? palette.background : '#ffffff'
                                                                }, onClick: () => props.onRequestFocus?.(`step:${step.id}`), children: [_jsx("span", { style: { ...stepChecklistStateStyle, color: palette.text }, children: step.stateLabel }), _jsx("strong", { style: stepChecklistTitleStyle, children: step.label }), _jsx("span", { style: stepChecklistHelperStyle, children: step.helperCopy })] }, step.id));
                                                        }) })] })) : (_jsxs("div", { style: supportCardStyle, children: [_jsx("div", { style: supportCardLabelStyle, children: "Current visibility" }), _jsx("p", { style: supportParagraphStyle, children: "This step is currently progressing in an internal-only part of the workflow. We will bring the next requester-facing task back here automatically." })] })), _jsxs("div", { style: supportCardStyle, children: [_jsx("div", { style: supportCardLabelStyle, children: "What happens next" }), _jsx("p", { style: supportParagraphStyle, children: viewModel.currentTask.nextCopy })] })] })] })] }), isFlowOpen ? (_jsxs("aside", { style: flowDrawerStyle, children: [_jsx("div", { style: flowDrawerHeaderStyle, children: _jsxs("div", { children: [_jsx("div", { style: eyebrowStyle, children: "Process flow" }), _jsx("h3", { style: flowHeadingStyle, children: "How this request can move" })] }) }), _jsx("div", { style: flowStageListStyle, children: viewModel.flowStages.map((stage) => {
                                    const palette = tonePalette(stage.tone);
                                    return (_jsxs("div", { style: {
                                            ...flowStageCardStyle,
                                            borderColor: stage.isCurrent ? palette.border : '#d7dee8',
                                            background: stage.isCurrent ? palette.background : '#ffffff'
                                        }, children: [_jsxs("div", { style: flowStageHeaderStyle, children: [_jsx("strong", { style: flowStageTitleStyle, children: stage.label }), _jsx("span", { style: { ...flowStatePillStyle, color: palette.text, background: palette.chip }, children: stage.stateLabel })] }), _jsx("div", { style: flowStageHelperStyle, children: stage.helperCopy }), stage.transitions.length > 0 ? (_jsx("div", { style: flowTransitionListStyle, children: stage.transitions.map((transition) => {
                                                    const transitionPalette = tonePalette(transition.tone);
                                                    return (_jsxs("div", { style: flowTransitionRowStyle, children: [_jsx("span", { style: { ...transitionOutcomeChipStyle, color: transitionPalette.text, borderColor: transitionPalette.border }, children: transition.label }), _jsx("span", { style: flowArrowStyle, children: "to" }), _jsx("span", { style: flowDestinationStyle, children: transition.destinationLabel })] }, transition.id));
                                                }) })) : (_jsx("div", { style: flowTerminalCopyStyle, children: "This stage currently has no configured next stage." }))] }, stage.id));
                                }) })] })) : null] }), props.mode === 'designer-preview' ? (_jsxs("details", { style: technicalDetailsStyle, children: [_jsx("summary", { style: technicalSummaryStyle, children: "Technical details" }), _jsxs("div", { style: technicalGridStyle, children: [_jsxs("span", { children: ["Process: ", formatTechnicalTitle(snapshot)] }), _jsxs("span", { children: ["Mode: ", props.mode] }), _jsxs("span", { children: ["Audience: ", resolvedAudience] }), _jsxs("span", { children: ["Current form: ", snapshot.activeFormId ?? 'none'] }), _jsxs("span", { children: ["Current form state: ", snapshot.activeFormStateId ?? 'none'] })] })] })) : null] }));
}
const surfaceShellStyle = {
    display: 'grid',
    gap: '1rem',
    padding: '1.2rem',
    borderRadius: '1.4rem',
    background: 'linear-gradient(180deg, #fffdfa 0%, #f5efe6 100%)',
    border: '1px solid #ece2d2',
    color: '#10233f'
};
const headerShellStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
};
const eyebrowStyle = {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: '#7b6a57'
};
const headingStyle = {
    margin: '0.35rem 0 0.2rem',
    fontSize: '1.65rem',
    lineHeight: 1.1
};
const introCopyStyle = {
    margin: 0,
    color: '#5b6470',
    fontSize: '0.98rem'
};
const statusClusterStyle = {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'center',
    flexWrap: 'wrap'
};
const statusPillStyle = {
    padding: '0.5rem 0.82rem',
    borderRadius: '999px',
    border: '1px solid #d7dee8',
    fontSize: '0.84rem',
    fontWeight: 700
};
const flowToggleButtonStyle = {
    padding: '0.7rem 1rem',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#10233f',
    cursor: 'pointer',
    fontWeight: 600
};
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
};
const projectionCopyStyle = {
    display: 'grid',
    gap: '0.3rem'
};
const projectionLabelStyle = {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#955f00',
    fontWeight: 700
};
const journeyTrackerShellStyle = {
    display: 'grid',
    gap: '0.8rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};
const trackerItemStyle = {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.95rem',
    borderRadius: '1rem',
    border: '1px solid #d7dee8',
    textAlign: 'left',
    cursor: 'pointer'
};
const trackerHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.6rem'
};
const trackerStatePillStyle = {
    padding: '0.26rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};
const trackerActorStyle = {
    fontSize: '0.76rem',
    color: '#576273'
};
const trackerLabelStyle = {
    fontSize: '0.98rem',
    lineHeight: 1.2
};
const trackerHelperStyle = {
    fontSize: '0.86rem',
    color: '#516071'
};
const workspaceGridStyle = {
    display: 'grid',
    gap: '1rem'
};
const currentTaskCardStyle = {
    display: 'grid',
    gap: '1rem',
    padding: '1.2rem',
    borderRadius: '1.25rem',
    border: '1px solid #d7dee8'
};
const currentTaskHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.85rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
};
const currentTaskLabelStyle = {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#6b7280',
    fontWeight: 700
};
const currentStageTitleStyle = {
    margin: '0.3rem 0 0',
    fontSize: '1.45rem',
    lineHeight: 1.15
};
const actorBadgeStyle = {
    padding: '0.45rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontSize: '0.84rem',
    fontWeight: 600
};
const currentTaskBodyStyle = {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    alignItems: 'start'
};
const currentTaskMainColumnStyle = {
    display: 'grid'
};
const currentStepCardStyle = {
    display: 'grid',
    gap: '0.8rem',
    padding: '1.1rem',
    borderRadius: '1.15rem',
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(255,255,255,0.8)'
};
const currentStepEyebrowStyle = {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6b7280',
    fontWeight: 700
};
const currentStepTitleStyle = {
    fontSize: '1.8rem',
    lineHeight: 1.05,
    fontWeight: 800
};
const currentStepSummaryStyle = {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.55,
    color: '#243247'
};
const currentStepHelperStyle = {
    margin: 0,
    fontSize: '0.94rem',
    lineHeight: 1.5,
    color: '#5d6675'
};
const actionGroupStyle = {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'center'
};
const primaryActionButtonStyle = {
    padding: '0.85rem 1.2rem',
    borderRadius: '0.95rem',
    border: '1px solid #b45309',
    background: '#c96500',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.96rem'
};
const secondaryActionButtonStyle = {
    padding: '0.82rem 1.08rem',
    borderRadius: '0.95rem',
    border: '1px solid #d3dbe6',
    background: '#ffffff',
    color: '#10233f',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.94rem'
};
const readOnlyNoticeStyle = {
    padding: '0.85rem 0.95rem',
    borderRadius: '0.95rem',
    background: '#f5f3ff',
    border: '1px solid #d7cffc',
    color: '#5b4ec8',
    fontWeight: 600
};
const nextActionHintsStyle = {
    display: 'grid',
    gap: '0.55rem'
};
const nextActionHintStyle = {
    fontSize: '0.86rem',
    color: '#546173'
};
const supportingColumnStyle = {
    display: 'grid',
    gap: '1rem'
};
const supportCardStyle = {
    display: 'grid',
    gap: '0.7rem',
    padding: '1rem',
    borderRadius: '1rem',
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(255,255,255,0.8)'
};
const supportCardLabelStyle = {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6b7280',
    fontWeight: 700
};
const stepChecklistStyle = {
    display: 'grid',
    gap: '0.7rem'
};
const stepChecklistItemStyle = {
    display: 'grid',
    gap: '0.2rem',
    padding: '0.8rem',
    borderRadius: '0.95rem',
    border: '1px solid #d8dee8',
    textAlign: 'left',
    background: '#ffffff',
    cursor: 'pointer'
};
const stepChecklistStateStyle = {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700
};
const stepChecklistTitleStyle = {
    fontSize: '0.94rem'
};
const stepChecklistHelperStyle = {
    fontSize: '0.82rem',
    color: '#5d6675'
};
const supportParagraphStyle = {
    margin: 0,
    fontSize: '0.92rem',
    lineHeight: 1.55,
    color: '#546173'
};
const flowDrawerStyle = {
    display: 'grid',
    gap: '1rem',
    padding: '1.1rem',
    borderRadius: '1.2rem',
    background: '#ffffff',
    border: '1px solid #e0e7f0'
};
const flowDrawerHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem'
};
const flowHeadingStyle = {
    margin: '0.3rem 0 0',
    fontSize: '1.2rem'
};
const flowStageListStyle = {
    display: 'grid',
    gap: '0.8rem'
};
const flowStageCardStyle = {
    display: 'grid',
    gap: '0.65rem',
    padding: '0.95rem',
    borderRadius: '1rem',
    border: '1px solid #d7dee8'
};
const flowStageHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
    flexWrap: 'wrap'
};
const flowStageTitleStyle = {
    fontSize: '1rem'
};
const flowStatePillStyle = {
    padding: '0.24rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700
};
const flowStageHelperStyle = {
    fontSize: '0.88rem',
    color: '#576273'
};
const flowTransitionListStyle = {
    display: 'grid',
    gap: '0.55rem'
};
const flowTransitionRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap'
};
const transitionOutcomeChipStyle = {
    padding: '0.25rem 0.55rem',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: 700
};
const flowArrowStyle = {
    fontSize: '0.82rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};
const flowDestinationStyle = {
    fontSize: '0.9rem',
    color: '#10233f',
    fontWeight: 600
};
const flowTerminalCopyStyle = {
    fontSize: '0.86rem',
    color: '#6b7280'
};
const technicalDetailsStyle = {
    padding: '0.95rem 1rem',
    borderRadius: '1rem',
    background: '#fbfaf7',
    border: '1px solid #e7ddcf'
};
const technicalSummaryStyle = {
    cursor: 'pointer',
    fontWeight: 700,
    color: '#5d6675'
};
const technicalGridStyle = {
    display: 'grid',
    gap: '0.45rem',
    marginTop: '0.85rem',
    fontSize: '0.84rem',
    color: '#5d6675'
};
const emptyStateStyle = {
    padding: '1rem',
    borderRadius: '0.85rem',
    background: '#f4f4f5',
    color: '#52525b'
};
