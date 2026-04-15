import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type { DbmPortalRuntimeSessionStateV1, StorageLike } from './types';
export declare const PORTAL_RUNTIME_SESSION_EVENT = "dbm-portal-runtime-session-changed";
export declare function getPortalRuntimeSessionStorageKey(bootstrap: DbmPortalRuntimeBootstrapV1): string;
export declare function loadPortalRuntimeSessionState(storage: StorageLike | null | undefined, bootstrap: DbmPortalRuntimeBootstrapV1): DbmPortalRuntimeSessionStateV1 | null;
export declare function savePortalRuntimeSessionState(storage: StorageLike | null | undefined, bootstrap: DbmPortalRuntimeBootstrapV1, state: DbmPortalRuntimeSessionStateV1): void;
export declare function clearPortalRuntimeSessionState(storage: StorageLike | null | undefined, bootstrap: DbmPortalRuntimeBootstrapV1): void;
