# DynamicsBusinessMachineGeneratedMetadata

This solution workspace holds the layered generated Dataverse metadata source for DBM.

## Structure

- `template/`
  - minimal tracked template metadata for the generated solution shell
- `source/`
  - generated tracked source emitted from the canonical approval/request model

## Rules

- treat `source/` as emitted tracked output, not hand-authored product source
- keep the solution name fixed as `DynamicsBusinessMachineGeneratedMetadata`
- import this solution only after `DynamicsBusinessMachine`
