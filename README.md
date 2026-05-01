
# Dynamics-BusinessMachine
[![Join the chat at https://app.gitter.im/#/room/#ys-dbm:gitter.im](https://badges.gitter.im/yagasoft/DynamicsCrm-TemplateBasedCodeGeneratorPlugin.svg)](https://app.gitter.im/#/room/#ys-dbm:gitter.im?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

---

The Dynamics Business Machine represents an innovative solution to modernise how business processes, logic, and flows are created and maintained in Microsoft Power Platform.

DBM is being reset around its original product vision: a designer that lets users define complete business cycles from portal to back office and back to portal again, with processes, sub-processes, stages, rendered forms, and JavaScript-first action logic.

Start your journey with DBM and make your business flows as agile and efficient as they should be.

You can read a quick overview of the solution and its functionality [here](https://blog.yagasoft.com/2024/11/dynamics-business-machine-business-automation-framework-mage-series).

## Features

DBM currently contains prototype/reference implementation assets. The active roadmap restarts product delivery at a new `R1` while preserving useful existing code paths as reference material.

The reset product direction includes:

-   Process portfolio designer: Define a main process and any number of sub-processes.
-   Stage spans: Align sub-process stages to full or fractional spans of the main-process timeline.
-   Rendered form experience: Show the process to business users on actual model-driven forms.
-   DBMScript actions: Define JavaScript-first actions for stage, form, field, backend, and button triggers.
-   Back-office runtime: Execute stage transitions, statuses, form behaviour, actions, routing, tasks, SLA/KPI, and support operations.
-   Portal continuity: Add actual portal rendering and return-path behaviour after the back-office runtime is stable.
-   Platform tooling: Manage source sync, solution packaging, versioning, tree/schema tooling, jobs, and ALM.

Below is the active high-level roadmap planned for DBM.

## Roadmap

- `R0`: Engineering foundation and governance
- `R1`: Process/stage designer and actual form render
- `R2`: DBMScript and action foundation
- `R3`: Back-office runtime
- `R4`: Back-office operations
- `R5`: Portal runtime and return path
- `R6`: Reuse, templates, artefacts, and documents
- `R7`: Platform tooling and ALM
- `R8`: Enterprise maturity
- `R9`: AI-assisted platform

The tracked release plan is the source of truth: [docs/roadmap/release-plan.md](docs/roadmap/release-plan.md).

## Documentation

Official tracked product documentation now lives under [docs/](docs/README.md).

Start with:

- [docs/architecture/product-principles.md](docs/architecture/product-principles.md)
- [docs/architecture/current-state-baseline.md](docs/architecture/current-state-baseline.md)
- [docs/roadmap/release-plan.md](docs/roadmap/release-plan.md)

Local planning drafts, execution notes, and working material remain outside Git in `_codex/`.

## Usage

First import the solution found at [Dynamics365-YsCommonSolution](https://github.com/yagasoft/Dynamics365-YsCommonSolution).
Next, import the latest solution from the 'releases' page.

Once installed, open the Yagasoft app, navigate to the 'Dynamics Business Machine' page, and you will see the following screen:
[<img src="https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-screen.png" width="600">](https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-screen.png)

### JavaScript script
[<img src="https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-resource.png" width="700">](https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-resource.png)

1.  Start by clicking the "Add New Resource" button to create a new file within the editor.
2.  Provide a unique file name that ends with `.js` .
3.  Set a display name for easy reference.
4.  Once the file is created, start writing your JavaScript code.
5.  After writing the code, save it as a web resource. This ensures that the script is properly version-controlled and easily integrated into Dynamics environments for deployment.

### JSON

Same goes for JSON files. After adding the file, add a property, name it, and then write your code for the property.

[<img src="https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-json.png" width="900">](https://blog.yagasoft.com/wp-content/uploads/dbm-overview-app-json.png)

## SDK features

DBM comes equipped with a range of functionalities that help create, update, delete, and retrieve data from Dataverse, all using a unified JavaScript-based approach.

### Context object

An object that is passed to the engine by the calling context. It is usually the Target row (entity).

`$this`

### Service

The Dataverse service.

`$service`

#### Create

`create(entity: Entity): Guid`

```js
const id = $service.create(new Ys.Entity('contact'));
```

#### Update

`update(entity: Entity): void`

```js
const e = new Ys.Entity($this.logicalName, $this.id);
e.attributes.lastname = 'Test!';
$service.update(e);
```

#### Delete

`delete(id: Guid): void`

```js
$service.delete(Guid.parse('3a47b1ba-9537-ef11-8409-000d3adabdf3'));
```

#### Retrieve

`retrieve(logicalName: string, id: Guid, columns: string[] | string): Entity`

```js
const r = $service.retrieve($this.logicalName, $this.id, 'firstname');
$log.info(r.attributes.firstname + ' ' + r.attributes.lastname);
```

#### RetrieveMultiple

`retrieveMultiple(fetchXml: string, count?: number, page?: number): Entity[]`

```js
const rm =
  $service.retrieveMultiple(`
    <fetch>
      <entity name='contact'>
        <attribute name='createdon' />
        <order attribute='createdon' descending='true' />
      </entity>
    </fetch>`);
$log.info(rm.length);
$log.info(rm[0].attributes.createdon);
$log.info(rm[0].attributes.parentcustomerid);
```

## Execute code

For this initial release, DBM has a custom step that takes the following parameters:

1.  Script file: the web resource containing the script to run.
2.  Script file ID: the unique path of the file.
3.  Inline script: hard code a script to run.
4.  Inline script type: what type of script is hard coded.
5.  JSON script action: action to execute on a JSON script if given.

You must provide a value for parameters 1, 2, or 3. Param 4 is required if 3 is given. Param 5 specifies the action if a JSON script is given.

## Changes

+ Check Releases page for the later changes
#### _v0.1.1.1 (2024-01-23)_
+ Kick-started project

---
**Copyright &copy; by Ahmed Elsawalhy ([Yagasoft](https://yagasoft.com))** -- _GPL v3 Licence_
