import { type Server as HttpServer } from 'node:http';
import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience';
export interface PortalRuntimeLocalProofServerOptions {
    repoRoot?: string;
    distRoot?: string;
    host?: string;
    port?: number;
    environment?: string;
    dataverseUrl?: string;
    bootstrap?: DbmPortalRuntimeBootstrapV1;
    runtimeModel?: DbmProcessExperienceRuntimeModelV1;
    hostPackageName?: string;
    fetchImpl?: typeof fetch;
    getAccessToken?: () => Promise<string>;
    logger?: {
        info?(message: string): void;
        error?(message: string): void;
    };
}
export interface PortalRuntimeLocalProofServerHandle {
    server: HttpServer;
    host: string;
    port: number;
    baseUrl: string;
    close(): Promise<void>;
}
export declare function createPortalRuntimeLocalProofServer(options?: PortalRuntimeLocalProofServerOptions): Promise<PortalRuntimeLocalProofServerHandle>;
