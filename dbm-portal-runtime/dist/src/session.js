const SESSION_STORAGE_PREFIX = 'dbm.portal-runtime.session';
export function getPortalRuntimeSessionStorageKey(bootstrap) {
    return `${SESSION_STORAGE_PREFIX}:${bootstrap.packageId}:${bootstrap.processId}`;
}
export function loadPortalRuntimeSessionState(storage, bootstrap) {
    if (!storage) {
        return null;
    }
    const raw = storage.getItem(getPortalRuntimeSessionStorageKey(bootstrap));
    if (!raw) {
        return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.requestId || !parsed?.sessionKey) {
        return null;
    }
    return parsed;
}
export function savePortalRuntimeSessionState(storage, bootstrap, state) {
    if (!storage) {
        return;
    }
    storage.setItem(getPortalRuntimeSessionStorageKey(bootstrap), JSON.stringify(state));
}
export function clearPortalRuntimeSessionState(storage, bootstrap) {
    if (!storage) {
        return;
    }
    storage.removeItem(getPortalRuntimeSessionStorageKey(bootstrap));
}
