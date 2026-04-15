function getFetchImpl(options) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Portal runtime requires fetch.');
    }
    return fetchImpl;
}
function normalizeOrigin(siteOrigin) {
    if (!siteOrigin) {
        return '';
    }
    return siteOrigin.replace(/\/$/, '');
}
function normalizeGuid(id) {
    return id.replace(/[{}]/g, '');
}
function buildApiUrl(bootstrap, siteOrigin, suffix = '') {
    return `${siteOrigin}/_api/${bootstrap.requestEntitySetName}${suffix}`;
}
function getPowerPagesShell() {
    const shell = globalThis.shell;
    if (!shell || typeof shell.getTokenDeferred !== 'function') {
        return null;
    }
    return shell;
}
async function buildHeaders() {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };
    const shell = getPowerPagesShell();
    if (!shell) {
        return headers;
    }
    const requestVerificationToken = await shell.getTokenDeferred?.();
    if (requestVerificationToken?.trim()) {
        headers.__RequestVerificationToken = requestVerificationToken.trim();
    }
    return headers;
}
function resolveCreatedRecordId(response) {
    const entityId = response.headers.get('entityid')?.trim();
    if (entityId) {
        return normalizeGuid(entityId);
    }
    const entityUrl = response.headers.get('odata-entityid')?.trim() ?? response.headers.get('OData-EntityId')?.trim();
    if (!entityUrl) {
        throw new Error('Portal runtime create draft response did not include an entity id.');
    }
    const match = /\(([^)]+)\)$/.exec(entityUrl);
    if (!match?.[1]) {
        throw new Error('Portal runtime could not parse the created entity id.');
    }
    return normalizeGuid(match[1]);
}
function extractRuntimeState(bootstrap, values) {
    const fields = bootstrap.runtimeStateFieldLogicalNames;
    return {
        stageId: values[fields.stageId] ?? bootstrap.defaultState.stageId,
        stepId: values[fields.stepId] ?? bootstrap.defaultState.stepId,
        formStateId: values[fields.formStateId] ?? bootstrap.defaultState.formStateId,
        internalStatusId: values[fields.internalStatusId] ?? bootstrap.defaultState.internalStatusId,
        portalStatusId: values[fields.portalStatusId] ?? bootstrap.defaultState.portalStatusId
    };
}
function toPortalRuntimeRecord(bootstrap, requestId, values) {
    const titleReference = typeof values.dbm_title === 'string' && values.dbm_title.trim()
        ? values.dbm_title.trim()
        : null;
    const logicalIdKey = `${bootstrap.requestEntityLogicalName}id`;
    const recordIdReference = typeof values[logicalIdKey] === 'string'
        ? values[logicalIdKey]
        : null;
    return {
        id: normalizeGuid(requestId),
        values,
        runtimeState: extractRuntimeState(bootstrap, values),
        requestReference: titleReference || recordIdReference || normalizeGuid(requestId)
    };
}
export async function refreshPortalRuntimeRecord(options) {
    const fetchImpl = getFetchImpl(options);
    const selectFields = [
        `${options.bootstrap.requestEntityLogicalName}id`,
        'dbm_title',
        options.bootstrap.runtimeStateFieldLogicalNames.stageId,
        options.bootstrap.runtimeStateFieldLogicalNames.stepId,
        options.bootstrap.runtimeStateFieldLogicalNames.formStateId,
        options.bootstrap.runtimeStateFieldLogicalNames.internalStatusId,
        options.bootstrap.runtimeStateFieldLogicalNames.portalStatusId,
        options.bootstrap.runtimeStateFieldLogicalNames.portalProfileKey
    ]
        .filter(Boolean)
        .join(',');
    const response = await fetchImpl(`${buildApiUrl(options.bootstrap, normalizeOrigin(options.siteOrigin), `(${normalizeGuid(options.requestId)})`)}?$select=${encodeURIComponent(selectFields)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: await buildHeaders()
    });
    if (!response.ok) {
        throw new Error(`Portal runtime refresh failed with status ${response.status}.`);
    }
    const payload = await response.json();
    return toPortalRuntimeRecord(options.bootstrap, options.requestId, payload);
}
export async function createPortalRuntimeDraft(options) {
    const fetchImpl = getFetchImpl(options);
    const headers = await buildHeaders();
    const response = await fetchImpl(buildApiUrl(options.bootstrap, normalizeOrigin(options.siteOrigin)), {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(options.values)
    });
    if (!response.ok) {
        throw new Error(`Portal runtime draft creation failed with status ${response.status}.`);
    }
    const requestId = resolveCreatedRecordId(response);
    return refreshPortalRuntimeRecord({
        bootstrap: options.bootstrap,
        requestId,
        fetchImpl,
        siteOrigin: options.siteOrigin
    });
}
export async function submitPortalRuntimeRequest(options) {
    const fetchImpl = getFetchImpl(options);
    const headers = await buildHeaders();
    const response = await fetchImpl(buildApiUrl(options.bootstrap, normalizeOrigin(options.siteOrigin), `(${normalizeGuid(options.requestId)})`), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
            ...headers,
            'If-Match': '*'
        },
        body: JSON.stringify({
            [options.bootstrap.portalCommandFieldLogicalName]: 'submit'
        })
    });
    if (!response.ok) {
        throw new Error(`Portal runtime submit failed with status ${response.status}.`);
    }
}
