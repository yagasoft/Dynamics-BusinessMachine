import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type { DbmPortalRuntimeSessionStateV1, StorageLike } from './types.js';

const SESSION_STORAGE_PREFIX = 'dbm.portal-runtime.session';
export const PORTAL_RUNTIME_SESSION_EVENT = 'dbm-portal-runtime-session-changed';

function emitPortalRuntimeSessionChange(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(PORTAL_RUNTIME_SESSION_EVENT));
}

export function getPortalRuntimeSessionStorageKey(bootstrap: DbmPortalRuntimeBootstrapV1): string {
  return `${SESSION_STORAGE_PREFIX}:${bootstrap.packageId}:${bootstrap.processId}`;
}

export function loadPortalRuntimeSessionState(
  storage: StorageLike | null | undefined,
  bootstrap: DbmPortalRuntimeBootstrapV1
): DbmPortalRuntimeSessionStateV1 | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(getPortalRuntimeSessionStorageKey(bootstrap));
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as DbmPortalRuntimeSessionStateV1;
  if (!parsed?.requestId || !parsed?.sessionKey) {
    return null;
  }

  return parsed;
}

export function savePortalRuntimeSessionState(
  storage: StorageLike | null | undefined,
  bootstrap: DbmPortalRuntimeBootstrapV1,
  state: DbmPortalRuntimeSessionStateV1
): void {
  if (!storage) {
    return;
  }

  storage.setItem(getPortalRuntimeSessionStorageKey(bootstrap), JSON.stringify(state));
  emitPortalRuntimeSessionChange();
}

export function clearPortalRuntimeSessionState(
  storage: StorageLike | null | undefined,
  bootstrap: DbmPortalRuntimeBootstrapV1
): void {
  if (!storage) {
    return;
  }

  storage.removeItem(getPortalRuntimeSessionStorageKey(bootstrap));
  emitPortalRuntimeSessionChange();
}
