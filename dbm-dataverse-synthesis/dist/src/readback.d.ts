import type { DataverseReadbackEntity, DataverseReadbackSnapshot, DataverseSynthesisPlan } from './types';
export declare function normalizeReadbackEntity(entityPayload: any, attributePayloads: any[]): DataverseReadbackEntity;
export declare function readbackDataverseMetadata(plan: DataverseSynthesisPlan, environmentConfig: {
    dataverseUrl: string;
}, auth: {
    accessToken: string;
}): Promise<DataverseReadbackSnapshot>;
