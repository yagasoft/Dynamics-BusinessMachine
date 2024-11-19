
# Dynamics-BusinessMachine
[![Join the chat at https://app.gitter.im/#/room/#ys-dbm:gitter.im](https://badges.gitter.im/yagasoft/DynamicsCrm-TemplateBasedCodeGeneratorPlugin.svg)](https://app.gitter.im/#/room/#ys-dbm:gitter.im?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

---

The Dynamics Business Machine represents an innovative solution to modernise how business logic and flows are created and maintained in Microsoft Power Platform.

By unifying logic and providing a more intuitive development interface, DBM aims to help developers increase efficiency, reduce redundancy, and deliver more advanced business processes.

Start your journey with DBM and make your business flows as agile and efficient as they should be.

You can read a quick overview of the solution and its functionality [here](https://blog.yagasoft.com/2024/11/dynamics-business-machine-business-automation-framework-mage-series).

## Features

DBM is equipped with a user-friendly interface for managing code, creating new resources, and visually defining JSON trees to easily build or update record hierarchies. Here are some core features:

-   Unified SDK: Use a standardised API for Dataverse services that works across the front end and backend environments.
-   Modernised editor: Edit JavaScript code through an intuitive visual editor that integrates with Dynamics solutions as Web Resources.
-   JSON tree editor: Easily create and manage record hierarchies through a JSON tree structure, enabling a simplified, visual approach to managing data.
-   Enhanced business flow management: Design and manage business flows directly from the editor, with more advanced options to control stages, subprocesses, and handle intricate conditions.
-   DV schema hierarchy: Define a table tree structure that supports inheritance.
-   Integrated data: Include data in solution deployments for faster and more consistent deployments.

Below is the high-level roadmap planned for DBM.

## Roadmap

(click to enlarge)
[<img src="https://blog.yagasoft.com/wp-content/uploads/dbm-roadmap.jpg" height="500">](https://blog.yagasoft.com/wp-content/uploads/dbm-roadmap.jpg)

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
