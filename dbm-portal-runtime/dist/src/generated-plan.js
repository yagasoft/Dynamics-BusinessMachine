import generatedPlan from '../../power-platform/solutions/DynamicsBusinessMachineGeneratedMetadata/source/dbm-generated-metadata.plan.json';
import { parsePortalRuntimeBootstrap } from './bootstrap.js';
const portalRuntime = generatedPlan.portalRuntime;
if (!portalRuntime?.bootstrap || !portalRuntime.processExperienceRuntime) {
    throw new Error('Generated metadata plan is missing portal runtime bootstrap/runtime content.');
}
export const portalRuntimeBootstrap = parsePortalRuntimeBootstrap(portalRuntime.bootstrap);
export const portalRuntimeModel = portalRuntime.processExperienceRuntime;
