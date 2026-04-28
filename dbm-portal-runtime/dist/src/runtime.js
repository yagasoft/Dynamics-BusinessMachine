import { buildRuntimeProcessExperienceSnapshot } from 'dbm-process-experience';
function canSubmitRequest(bootstrap, record) {
    return bootstrap.allowedActions.includes('submit-request')
        && Boolean(record)
        && record?.runtimeState.stageId === bootstrap.defaultState.stageId;
}
function canRefreshStatus(bootstrap, record) {
    return bootstrap.allowedActions.includes('refresh-status')
        && Boolean(record);
}
function buildRequestReference(record) {
    return record?.requestReference ?? record?.id ?? null;
}
export function buildPortalRuntimeSnapshot(bootstrap, runtimeModel, record) {
    if (!record) {
        return null;
    }
    const availableOutcomeIds = canSubmitRequest(bootstrap, record) ? ['submit'] : [];
    return buildRuntimeProcessExperienceSnapshot(runtimeModel, record.runtimeState, {
        audience: 'portal',
        currentFormId: bootstrap.startFormId,
        availableOutcomeIds
    });
}
export function buildPortalRuntimeViewModel(options) {
    const snapshot = buildPortalRuntimeSnapshot(options.bootstrap, options.runtimeModel, options.record);
    const portalStatusLabel = snapshot?.portalStatus?.displayName ?? 'Ready to start';
    return {
        portalShell: {
            entryTitle: 'Approval request portal',
            entrySummary: options.record
                ? 'This portal shell reflects the canonical Dataverse runtime state for the current request.'
                : 'Complete the request fields, create a draft in this browser session, and submit only when you are ready.',
            requestReference: buildRequestReference(options.record),
            requestStateLabel: portalStatusLabel,
            sameSessionEnabled: options.sameSessionEnabled ?? true,
            sessionKey: options.record?.id ?? null,
            actions: {
                'create-draft': {
                    enabled: !options.record
                        && options.bootstrap.allowedActions.includes('create-draft')
                        && (options.canCreateDraft ?? true)
                        && !options.isBusy
                },
                'submit-request': {
                    enabled: canSubmitRequest(options.bootstrap, options.record) && !options.isBusy,
                    helperText: 'Send the request into the next internal review step.'
                },
                'refresh-status': {
                    enabled: canRefreshStatus(options.bootstrap, options.record) && !options.isBusy
                }
            }
        }
    };
}
