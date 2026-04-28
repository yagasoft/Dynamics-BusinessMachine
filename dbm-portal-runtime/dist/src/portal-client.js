function getFetchImpl(options) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Portal runtime requires fetch.');
    }
    return fetchImpl;
}
function normalizeApiBasePath(apiBasePath) {
    if (!apiBasePath) {
        return '/api/runtime';
    }
    const normalized = apiBasePath.trim().replace(/\/+$/, '');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
function normalizeGuid(id) {
    return id.replace(/[{}]/g, '');
}
async function parseResponse(response) {
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
            ? payload.message
            : `Portal runtime request failed with status ${response.status}.`);
    }
    return payload;
}
export async function refreshPortalRuntimeRecord(options) {
    const fetchImpl = getFetchImpl(options);
    const response = await fetchImpl(`${normalizeApiBasePath(options.apiBasePath)}/requests/${encodeURIComponent(normalizeGuid(options.requestId))}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    });
    return parseResponse(response);
}
export async function createPortalRuntimeDraft(options) {
    const fetchImpl = getFetchImpl(options);
    const response = await fetchImpl(`${normalizeApiBasePath(options.apiBasePath)}/drafts`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(options.values)
    });
    return parseResponse(response);
}
export async function submitPortalRuntimeRequest(options) {
    const fetchImpl = getFetchImpl(options);
    const response = await fetchImpl(`${normalizeApiBasePath(options.apiBasePath)}/requests/${encodeURIComponent(normalizeGuid(options.requestId))}/submit`, {
        method: 'POST',
        headers: {
            Accept: 'application/json'
        }
    });
    return parseResponse(response);
}
