import type { DataverseApplyReport, DataverseEnvironmentConfig, DataverseSynthesisPlan } from './types';
export declare function applySynthesisPlanToDev(plan: DataverseSynthesisPlan, environmentConfig: DataverseEnvironmentConfig, auth: {
    accessToken: string;
}): Promise<DataverseApplyReport>;
