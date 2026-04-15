import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience';
import generatedPlan from '../../power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/source/dbm-generated-metadata.plan.json';
import { parsePortalRuntimeBootstrap } from './bootstrap.js';

type GeneratedPortalRuntimePlan = {
  portalRuntime?: {
    bootstrap?: DbmPortalRuntimeBootstrapV1;
    processExperienceRuntime?: DbmProcessExperienceRuntimeModelV1;
  } | null;
};

const portalRuntime = (generatedPlan as GeneratedPortalRuntimePlan).portalRuntime;
if (!portalRuntime?.bootstrap || !portalRuntime.processExperienceRuntime) {
  throw new Error('Generated metadata plan is missing portal runtime bootstrap/runtime content.');
}

export const portalRuntimeBootstrap = parsePortalRuntimeBootstrap(portalRuntime.bootstrap);
export const portalRuntimeModel = portalRuntime.processExperienceRuntime;
