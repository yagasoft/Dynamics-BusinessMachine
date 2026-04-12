# DynamicsBusinessMachine Solution Baseline

This folder holds the tracked Dataverse packaging baseline for the DBM PoC solution.

## Contents

- `baseline/solution.xml`
  - the shipped solution manifest promoted into source control
- `baseline/customizations.xml`
  - the shipped component manifest used as the packaging baseline
- `baseline/dvtablesearchentities/`
  - additional solution metadata required by the packaged PoC

## Packaging model

- CI copies `baseline/` into a staging directory.
- The staging script places `solution.xml` and `customizations.xml` under `Other/` so PAC packs the legacy XML layout correctly.
- The staging script updates the solution version from `eng/version.json`.
- The staging script replaces component payloads using `power-platform/manifests/webresources.yml`.
- Plugin assembly metadata is rewritten from the built `Yagasoft.Dbm.Plugins.dll` so the packaged XML matches the produced assembly identity.
