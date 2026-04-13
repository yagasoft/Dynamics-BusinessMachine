import type { DataverseDriftReport, DataverseReadbackSnapshot, DataverseSynthesisPlan } from './types';
export declare function diffSynthesisPlan(plan: DataverseSynthesisPlan, snapshot: DataverseReadbackSnapshot): DataverseDriftReport;
