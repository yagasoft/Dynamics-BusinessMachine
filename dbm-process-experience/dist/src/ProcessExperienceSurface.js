import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function statePalette(state) {
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
function renderProjectionCallToAction(snapshot, props) {
    if (!snapshot.projection.message) {
        return null;
    }
    return (_jsxs("div", { style: projectionNoticeStyle, children: [_jsx("div", { children: snapshot.projection.message }), props.navigationTarget && props.onNavigateToFormRegion ? (_jsxs("button", { type: "button", style: ctaButtonStyle, onClick: () => props.onNavigateToFormRegion?.(props.navigationTarget), children: ["Focus ", props.navigationTarget.label] })) : null] }));
}
function renderStepRail(snapshot, onRequestFocus) {
    const currentStage = snapshot.stages.find((stage) => stage.id === snapshot.currentStageId);
    if (!currentStage) {
        return null;
    }
    const steps = snapshot.steps.filter((step) => step.stageId === currentStage.id);
    if (steps.length === 0) {
        return null;
    }
    return (_jsxs("div", { style: stepRailWrapperStyle, children: [_jsx("div", { style: eyebrowStyle, children: "Current Stage Steps" }), _jsx("div", { style: stepRailStyle, children: steps.map((step) => {
                    const palette = statePalette(step.state);
                    return (_jsxs("button", { type: "button", style: {
                            ...stepCardStyle,
                            background: palette.background,
                            borderColor: palette.border,
                            boxShadow: `0 14px 30px ${palette.shadow}`
                        }, onClick: () => onRequestFocus?.(`step:${step.id}`), children: [_jsx("span", { style: stepStatePillStyle, children: step.state }), _jsx("strong", { style: stepTitleStyle, children: step.displayName }), _jsxs("span", { style: stepMetaStyle, children: ["Type: ", step.stepType] }), _jsxs("span", { style: stepMetaStyle, children: ["Owner: ", step.owner?.displayName ?? 'Unassigned'] })] }, step.id));
                }) })] }));
}
export function ProcessExperienceSurface(props) {
    const snapshot = props.snapshot;
    if (!snapshot) {
        return _jsx("div", { style: emptyStateStyle, children: "Process experience becomes available once the model and workspace parse cleanly." });
    }
    return (_jsxs("div", { style: surfaceShellStyle, children: [_jsxs("div", { style: surfaceHeaderStyle, children: [_jsxs("div", { children: [_jsx("div", { style: eyebrowStyle, children: "DBM Process Experience" }), _jsx("h2", { style: headingStyle, children: snapshot.processId })] }), _jsxs("div", { style: badgeGroupStyle, children: [_jsxs("span", { style: badgeStyle, children: ["Mode: ", props.mode] }), _jsxs("span", { style: badgeStyle, children: ["Audience: ", props.audience ?? snapshot.audience] }), snapshot.portalStatus ? _jsxs("span", { style: badgeStyle, children: ["Portal: ", snapshot.portalStatus.displayName] }) : null, snapshot.internalStatus ? _jsxs("span", { style: badgeStyle, children: ["Internal: ", snapshot.internalStatus.displayName] }) : null] })] }), renderProjectionCallToAction(snapshot, props), _jsx("div", { style: stageRailStyle, children: snapshot.stages.map((stage) => {
                    const palette = statePalette(stage.state);
                    const currentStep = stage.currentStepId
                        ? snapshot.steps.find((step) => step.id === stage.currentStepId)
                        : null;
                    const transitions = snapshot.transitions.filter((transition) => transition.fromStageId === stage.id);
                    return (_jsxs("button", { type: "button", style: {
                            ...stageCardStyle,
                            background: palette.background,
                            borderColor: palette.border,
                            boxShadow: `0 16px 34px ${palette.shadow}`,
                            opacity: stage.visibility === 'collapsed-hidden' ? 0.72 : 1
                        }, onClick: () => props.onRequestFocus?.(`stage:${stage.id}`), children: [_jsxs("div", { style: stageCardHeaderStyle, children: [_jsx("span", { style: stageStatePillStyle, children: stage.state }), _jsx("span", { style: stageIdStyle, children: stage.id })] }), _jsx("div", { style: stageNameStyle, children: stage.displayName }), _jsxs("div", { style: stageMetaStyle, children: ["Type: ", stage.stageType] }), _jsxs("div", { style: stageMetaStyle, children: ["Owner: ", stage.actor?.displayName ?? 'Unassigned'] }), _jsxs("div", { style: stageMetaStyle, children: ["Form: ", stage.formId ?? 'No form'] }), _jsxs("div", { style: stageMetaStyle, children: ["Current step: ", currentStep?.displayName ?? 'Not active'] }), _jsxs("div", { style: stageMetaStyle, children: ["Visibility: ", stage.visibility] }), transitions.length > 0 ? (_jsx("div", { style: transitionGroupStyle, children: transitions.map((transition) => (_jsxs("span", { style: transitionChipStyle, children: [transition.outcome?.displayName ?? 'Continue', " \u2192 ", snapshot.stages.find((candidate) => candidate.id === transition.toStageId)?.displayName ?? transition.toStageId] }, transition.id))) })) : null] }, stage.id));
                }) }), renderStepRail(snapshot, props.onRequestFocus), _jsxs("div", { style: outcomeListStyle, children: [_jsx("div", { style: eyebrowStyle, children: "Available Outcomes" }), snapshot.availableOutcomes.length > 0 ? (_jsx("div", { style: chipRowStyle, children: snapshot.availableOutcomes.map((outcome) => (_jsx("button", { type: "button", style: outcomeButtonStyle, onClick: () => props.onInvokeOutcome?.(outcome.id), disabled: !props.onInvokeOutcome, children: outcome.displayName }, outcome.id))) })) : (_jsx("div", { style: mutedCopyStyle, children: "No outcomes are currently available for the selected process state." }))] })] }));
}
const surfaceShellStyle = {
    display: 'grid',
    gap: '1rem'
};
const surfaceHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
};
const eyebrowStyle = {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#64748b'
};
const headingStyle = {
    margin: '0.35rem 0 0',
    fontSize: '1.32rem'
};
const badgeGroupStyle = {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap'
};
const badgeStyle = {
    padding: '0.4rem 0.65rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid #d6d3d1',
    fontSize: '0.8rem'
};
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
};
const ctaButtonStyle = {
    padding: '0.55rem 0.8rem',
    borderRadius: '0.85rem',
    border: '1px solid #d97706',
    background: '#fff',
    color: '#9a3412',
    cursor: 'pointer'
};
const stageRailStyle = {
    display: 'grid',
    gap: '0.95rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
};
const stageCardStyle = {
    display: 'grid',
    gap: '0.35rem',
    padding: '1rem',
    borderRadius: '1rem',
    border: '1px solid #d4d4d8',
    textAlign: 'left',
    cursor: 'pointer'
};
const stageCardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center'
};
const stageStatePillStyle = {
    padding: '0.24rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.8)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};
const stageIdStyle = {
    fontSize: '0.74rem',
    color: '#475569'
};
const stageNameStyle = {
    marginTop: '0.25rem',
    fontSize: '1rem',
    fontWeight: 700
};
const stageMetaStyle = {
    fontSize: '0.86rem',
    color: '#334155'
};
const transitionGroupStyle = {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap',
    marginTop: '0.3rem'
};
const transitionChipStyle = {
    padding: '0.28rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontSize: '0.78rem'
};
const stepRailWrapperStyle = {
    display: 'grid',
    gap: '0.75rem'
};
const stepRailStyle = {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};
const stepCardStyle = {
    display: 'grid',
    gap: '0.35rem',
    padding: '0.85rem',
    borderRadius: '0.95rem',
    border: '1px solid #d4d4d8',
    textAlign: 'left',
    cursor: 'pointer'
};
const stepStatePillStyle = {
    width: 'fit-content',
    padding: '0.18rem 0.48rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.8)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};
const stepTitleStyle = {
    fontSize: '0.92rem'
};
const stepMetaStyle = {
    fontSize: '0.8rem',
    color: '#475569'
};
const outcomeListStyle = {
    display: 'grid',
    gap: '0.65rem'
};
const chipRowStyle = {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap'
};
const outcomeButtonStyle = {
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    background: '#fff',
    border: '1px solid #cbd5e1',
    cursor: 'pointer'
};
const mutedCopyStyle = {
    color: '#6b7280',
    fontSize: '0.92rem'
};
const emptyStateStyle = {
    padding: '1rem',
    borderRadius: '0.85rem',
    background: '#f4f4f5',
    color: '#52525b'
};
