# DynamicsBusinessMachinePortalRuntime

This tracked slice holds the `R3.1` Power Pages portal runtime proof assets for the approval/request scenario.

## Scope

- Power Pages entry and request-shell templates for the external requester flow
- Dev-only anonymous access assumptions and limited proof-path table permissions
- The `dbm-portal-runtime` browser bundle and generated `portal-runtime-context.js` handoff points
- The portal bootstrap configuration mirrored from the Dataverse synthesis plan

## Notes

- These assets are tracked source for the portal proof slice, not the canonical process model.
- Dataverse runtime state and portal-safe status projection remain authoritative in the shared model and synthesis output.
- The portal bundle source of truth is [dbm-portal-runtime](../../../dbm-portal-runtime).
- Export the current bundle, generated context asset, bootstrap, templates, site settings, and permission payloads with `.\eng\scripts\Export-PortalRuntimePackage.ps1`.
- Provision the target Dev Power Pages site outside this repo first, then set the real `powerPages.websiteId` and `powerPages.websiteName` values in `azure/config/dev.json`.
- Apply the Dev portal assets through `.\eng\scripts\Invoke-PortalRuntimeDeployment.ps1 -TargetEnvironment Dev`.
