"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const node_vm_1 = require("node:vm");
const approval_request_v1_model_json_1 = __importDefault(require("../../docs/architecture/examples/approval-request-v1.model.json"));
const generic_existing_form_v1_model_json_1 = __importDefault(require("../../docs/architecture/examples/generic-existing-form-v1.model.json"));
const index_1 = require("../src/index");
function jsonResponse(status, payload) {
    return new Response(payload ? JSON.stringify(payload) : null, {
        status,
        headers: payload ? { 'Content-Type': 'application/json' } : undefined
    });
}
function sanitizeFunctionIdentifier(value) {
    const normalized = value.replace(/[^A-Za-z0-9_]/g, '_');
    return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}
async function createRuntimeHarnessForModel(model, formId) {
    const { buildRuntimeProcessExperienceSnapshot } = await import('dbm-process-experience');
    const plan = (0, index_1.planDataverseSynthesis)(model);
    const runtimeJs = plan.behaviors.find((behavior) => behavior.webResourceName === 'ys_/dbm/forms/runtime.js')?.content;
    const configFileName = `${formId}.js`;
    const onLoadName = sanitizeFunctionIdentifier(`dbmOnLoad_${formId}`);
    const configJs = plan.behaviors.find((behavior) => behavior.webResourceName === `ys_/dbm/forms/config/${configFileName}`)?.content;
    strict_1.default.ok(runtimeJs, `Failed to locate generated runtime.js content for '${formId}'.`);
    strict_1.default.ok(configJs, `Failed to locate generated config content for '${formId}'.`);
    const sandbox = {
        console,
        Response,
        Headers,
        URL,
        URLSearchParams,
        fetch: async () => jsonResponse(404, { error: 'fetch-not-configured' }),
        setTimeout: (callback) => {
            callback();
            return 0;
        },
        clearTimeout: () => undefined,
        Xrm: {
            Utility: {
                getGlobalContext: () => ({
                    getClientUrl: () => 'https://example.crm4.dynamics.com',
                    getCurrentAppUrl: () => 'https://example.crm4.dynamics.com/main.aspx?appid=test-app-id&pagetype=entityrecord'
                }),
                lookupObjects: async () => []
            },
            Navigation: {
                openForm: async () => undefined
            }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const context = (0, node_vm_1.createContext)(sandbox);
    (0, node_vm_1.runInContext)(runtimeJs, context);
    sandbox.DBM.ProcessExperienceHost = {
        buildRuntimeProcessExperienceSnapshot,
        render: () => undefined,
        unmount: () => undefined
    };
    const originalInitialize = sandbox.DBM.ProcessRuntime.initialize;
    let capturedConfig = null;
    sandbox.DBM.ProcessRuntime.initialize = (_executionContext, config) => {
        capturedConfig = config;
    };
    (0, node_vm_1.runInContext)(configJs, context);
    sandbox[onLoadName]({});
    sandbox.DBM.ProcessRuntime.initialize = originalInitialize;
    strict_1.default.ok(capturedConfig, `Failed to capture generated runtime config for '${formId}'.`);
    return {
        config: capturedConfig,
        sandbox,
        sync: sandbox.DBM.ProcessRuntime.sync,
        cleanup: async () => undefined
    };
}
function createMockFormContext(config, entityId, initialValues) {
    const attributes = new Map();
    const controls = new Map();
    const sections = new Map();
    const tabs = new Map();
    const sectionRenders = [];
    const overlayRenders = [];
    const notifications = [];
    for (const sectionConfig of config.sections) {
        if (!tabs.has(sectionConfig.tabName)) {
            tabs.set(sectionConfig.tabName, {
                visible: true,
                focused: false,
                sections: {
                    get: (name) => sections.get(`${sectionConfig.tabName}:${name}`) ?? null
                },
                setVisible(value) {
                    this.visible = value;
                },
                getVisible() {
                    return this.visible;
                },
                setFocus() {
                    this.focused = true;
                }
            });
        }
        const sectionKey = `${sectionConfig.tabName}:${sectionConfig.sectionName}`;
        if (!sections.has(sectionKey)) {
            sections.set(sectionKey, {
                visible: true,
                setVisible(value) {
                    this.visible = value;
                },
                getVisible() {
                    return this.visible;
                }
            });
        }
        for (const controlConfig of sectionConfig.controls) {
            if (!attributes.has(controlConfig.controlName)) {
                let currentValue = initialValues[controlConfig.controlName];
                let requiredLevel = 'none';
                attributes.set(controlConfig.controlName, {
                    getValue: () => currentValue,
                    setValue: (value) => {
                        currentValue = value;
                    },
                    setRequiredLevel: (level) => {
                        requiredLevel = level;
                    },
                    getRequiredLevel: () => requiredLevel,
                    fireOnChange: () => undefined
                });
            }
            if (!controls.has(controlConfig.controlName)) {
                const state = {
                    controlName: controlConfig.controlName,
                    visible: true,
                    disabled: false,
                    requiredLevel: 'none',
                    focused: false
                };
                const attribute = attributes.get(controlConfig.controlName);
                controls.set(controlConfig.controlName, {
                    getAttribute: () => ({
                        getValue: attribute.getValue,
                        setValue: attribute.setValue,
                        setRequiredLevel: (level) => {
                            state.requiredLevel = level;
                            attribute.setRequiredLevel(level);
                        },
                        getRequiredLevel: attribute.getRequiredLevel,
                        fireOnChange: attribute.fireOnChange
                    }),
                    setVisible: (value) => {
                        state.visible = value;
                    },
                    getVisible: () => state.visible,
                    setDisabled: (value) => {
                        state.disabled = value;
                    },
                    getDisabled: () => state.disabled,
                    setFocus: () => {
                        state.focused = true;
                    },
                    state
                });
            }
        }
    }
    if (config.processHost?.supported?.controlName) {
        const controlName = config.processHost.supported.controlName;
        if (!controls.has(controlName)) {
            controls.set(controlName, {
                getAttribute: () => null,
                setVisible: () => undefined,
                getVisible: () => true,
                setDisabled: () => undefined,
                getDisabled: () => false,
                setFocus: () => undefined,
                getContentWindow: async () => ({
                    DBM: {
                        [config.processHost.supported.frameBridgeName]: {
                            render: (props) => sectionRenders.push(props)
                        }
                    }
                }),
                getObject: () => ({ tagName: 'IFRAME', id: controlName }),
                state: {
                    controlName,
                    visible: true,
                    disabled: false,
                    requiredLevel: 'none',
                    focused: false
                }
            });
        }
    }
    const documentElements = new Map();
    const documentBody = {
        firstChild: null,
        prepend(node) {
            if (node.id) {
                documentElements.set(node.id, node);
            }
            this.firstChild = node;
        },
        insertBefore(node) {
            if (node.id) {
                documentElements.set(node.id, node);
            }
            this.firstChild = node;
        },
        appendChild(node) {
            if (node.id) {
                documentElements.set(node.id, node);
            }
            this.firstChild = this.firstChild ?? node;
        }
    };
    const document = {
        body: documentBody,
        getElementById: (id) => documentElements.get(id) ?? null,
        createElement: (_tagName) => ({
            id: '',
            style: {}
        })
    };
    const formContext = {
        getAttribute: (name) => attributes.get(name) ?? null,
        getControl: (name) => controls.get(name) ?? null,
        data: {
            entity: {
                getId: () => `{${entityId}}`,
                addOnSave: () => undefined
            }
        },
        ui: {
            tabs: {
                get: (name) => tabs.get(name) ?? null
            },
            setFormNotification: (message, level, id) => {
                notifications.push({ message, level, id });
            },
            clearFormNotification: (id) => {
                const index = notifications.findIndex((entry) => entry.id === id);
                if (index >= 0) {
                    notifications.splice(index, 1);
                }
            }
        }
    };
    return {
        executionContext: {
            getFormContext: () => formContext
        },
        controls,
        sections,
        tabs,
        notifications,
        sectionRenders,
        overlayRenders,
        document,
        installOverlayBridge(targetSandbox) {
            targetSandbox.document = document;
            targetSandbox.DBM.ProcessExperienceHost.render = (target, props) => {
                overlayRenders.push({
                    targetId: target?.id ?? null,
                    props
                });
            };
        }
    };
}
async function createRuntimeHarness(formId) {
    return createRuntimeHarnessForModel(approval_request_v1_model_json_1.default, formId);
}
(0, node_test_1.default)('planDataverseSynthesis maps the approval example into entities, existing forms, and JS behaviors', () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const requestEntity = plan.entities.find((entity) => entity.logicalName === 'dbm_request');
    const reviewForm = plan.forms.find((form) => form.id === 'review-form');
    strict_1.default.equal(plan.generatedMetadataSolutionName, 'DynamicsBusinessMachineGeneratedMetadata');
    strict_1.default.equal(plan.entities.length, 2);
    strict_1.default.equal(plan.relationships.some((relationship) => relationship.logicalName === 'dbm_request_dbm_requestdecision'), true);
    strict_1.default.equal(plan.forms.length, 2);
    strict_1.default.equal(plan.forms.every((form) => form.supported), true);
    strict_1.default.equal(plan.behaviors.filter((behavior) => behavior.supported).length, 5);
    strict_1.default.equal(plan.summary.supportedForms, 2);
    strict_1.default.equal(plan.summary.supportedBehaviors, 5);
    strict_1.default.equal(plan.forms.some((form) => form.id === 'request-form' &&
        form.systemFormId === '{8d65fa31-b54d-5d9b-84e0-07d87e113130}' &&
        form.sections.some((section) => section.sectionName === 'request_supporting_section') &&
        form.processHost?.supported?.sectionName === 'dbm_process_host_request_form'), true);
    strict_1.default.equal(plan.behaviors.some((behavior) => behavior.webResourceName === 'ys_/dbm/forms/config/request-form.js' &&
        behavior.kind === 'form-config'), true);
    strict_1.default.equal(plan.behaviors.some((behavior) => behavior.webResourceName === 'ys_/dbm/process-experience/renderer.js' &&
        behavior.kind === 'process-renderer'), true);
    strict_1.default.ok(requestEntity);
    strict_1.default.equal(requestEntity?.columns.some((column) => column.logicalName === 'dbm_currentstageid' && column.source === 'synthetic'), true);
    strict_1.default.ok(reviewForm?.runtime);
    strict_1.default.equal(reviewForm?.runtime?.processOwner.entityLogicalName, 'dbm_request');
    strict_1.default.equal(reviewForm?.runtime?.currentForm.entityLogicalName, 'dbm_requestdecision');
    strict_1.default.equal(reviewForm?.runtime?.currentForm.relatedProcessOwnerLookupFieldLogicalName, 'dbm_requestid');
    strict_1.default.equal(reviewForm?.runtime?.stageHandoffsByStageId['manager-review']?.strategy, 'create-related');
    strict_1.default.equal(reviewForm?.processHost?.overlay.enabled, true);
    strict_1.default.equal(reviewForm?.processHost?.designerEntryUrl, '/main.aspx?forceUCI=1&pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&packageName=dbm-approval-request');
});
(0, node_test_1.default)('planDataverseSynthesis supports a non-reference existing-form model with explicit cross-entity handoff', () => {
    const plan = (0, index_1.planDataverseSynthesis)(generic_existing_form_v1_model_json_1.default);
    const assignmentForm = plan.forms.find((form) => form.id === 'assignment-form');
    const caseEntity = plan.entities.find((entity) => entity.logicalName === 'dbm_case');
    strict_1.default.equal(plan.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length, 0);
    strict_1.default.equal(plan.forms.length, 2);
    strict_1.default.equal(plan.forms.every((form) => form.supported), true);
    strict_1.default.equal(plan.relationships.some((relationship) => relationship.logicalName === 'dbm_case_dbm_caseassignment'), true);
    strict_1.default.ok(caseEntity);
    strict_1.default.equal(caseEntity?.columns.some((column) => column.logicalName === 'dbm_currentstageid' && column.source === 'synthetic'), true);
    strict_1.default.ok(assignmentForm?.runtime);
    strict_1.default.equal(assignmentForm?.runtime?.processOwner.entityLogicalName, 'dbm_case');
    strict_1.default.equal(assignmentForm?.runtime?.currentForm.entityLogicalName, 'dbm_caseassignment');
    strict_1.default.equal(assignmentForm?.runtime?.currentForm.relatedProcessOwnerLookupFieldLogicalName, 'dbm_caseid');
    const assignmentHandoff = assignmentForm?.runtime?.stageHandoffsByStageId['assignment-work'];
    strict_1.default.ok(assignmentHandoff);
    strict_1.default.equal(assignmentHandoff?.sourceStageId, 'draft-case');
    strict_1.default.equal(assignmentHandoff?.targetStageId, 'assignment-work');
    strict_1.default.equal(assignmentHandoff?.sourceEntityLogicalName, 'dbm_case');
    strict_1.default.equal(assignmentHandoff?.targetEntityLogicalName, 'dbm_caseassignment');
    strict_1.default.equal(assignmentHandoff?.targetPrimaryIdLogicalName, 'dbm_caseassignmentid');
    strict_1.default.equal(assignmentHandoff?.targetPrimaryNameLogicalName, 'dbm_name');
    strict_1.default.equal(assignmentHandoff?.targetFormId, 'assignment-form');
    strict_1.default.equal(assignmentHandoff?.targetSystemFormId, '{22222222-2222-2222-2222-222222222222}');
    strict_1.default.equal(assignmentHandoff?.relationshipId, 'case-to-assignment');
    strict_1.default.equal(assignmentHandoff?.relationshipLogicalName, 'dbm_case_dbm_caseassignment');
    strict_1.default.equal(assignmentHandoff?.referencingEntityLogicalName, 'dbm_caseassignment');
    strict_1.default.equal(assignmentHandoff?.referencingAttributeLogicalName, 'dbm_caseid');
    strict_1.default.equal(assignmentHandoff?.referencingNavigationPropertyName, 'dbm_caseid');
    strict_1.default.equal(assignmentHandoff?.strategy, 'create-related');
    strict_1.default.equal(plan.behaviors.some((behavior) => behavior.webResourceName === 'ys_/dbm/forms/config/assignment-form.js' &&
        behavior.kind === 'form-config'), true);
    strict_1.default.equal(assignmentForm?.processHost?.supported?.sectionName, 'dbm_process_host_assignment_form');
    strict_1.default.equal(assignmentForm?.processHost?.designerEntryUrl, '/main.aspx?forceUCI=1&pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&packageName=dbm-case-assignment');
});
(0, node_test_1.default)('normalizeReadbackEntity captures lookup targets and picklist values', () => {
    const entity = (0, index_1.normalizeReadbackEntity)({
        LogicalName: 'dbm_request',
        SchemaName: 'dbm_Request',
        PrimaryIdAttribute: 'dbm_requestid',
        PrimaryNameAttribute: 'dbm_title'
    }, [
        {
            LogicalName: 'dbm_title',
            SchemaName: 'dbm_Title',
            AttributeType: 'String',
            IsPrimaryName: true,
            RequiredLevel: { Value: 'ApplicationRequired' }
        },
        {
            LogicalName: 'dbm_requestid',
            SchemaName: 'dbm_RequestId',
            AttributeType: 'Lookup',
            IsPrimaryName: false,
            RequiredLevel: { Value: 'ApplicationRequired' },
            Targets: ['dbm_request']
        },
        {
            LogicalName: 'dbm_screeningresult',
            SchemaName: 'dbm_ScreeningResult',
            AttributeType: 'Picklist',
            IsPrimaryName: false,
            RequiredLevel: { Value: 'None' },
            OptionSet: { Options: [{ Value: 100000000 }, { Value: 100000001 }] }
        }
    ]);
    strict_1.default.equal(entity.primaryNameAttributeLogicalName, 'dbm_title');
    strict_1.default.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_requestid')?.targets, ['dbm_request']);
    strict_1.default.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_screeningresult')?.optionValues, [100000000, 100000001]);
});
(0, node_test_1.default)('diffSynthesisPlan detects missing forms and web resources as blocking drift', () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const snapshot = {
        generatedUtc: new Date().toISOString(),
        dataverseUrl: 'https://example.invalid',
        solutionName: plan.generatedMetadataSolutionName,
        entities: [
            {
                logicalName: 'dbm_request',
                schemaName: 'dbm_Request',
                primaryIdLogicalName: 'dbm_requestid',
                primaryNameAttributeLogicalName: 'dbm_title',
                columns: []
            }
        ],
        relationships: [],
        forms: [],
        webResources: [],
        diagnostics: []
    };
    const report = (0, index_1.diffSynthesisPlan)(plan, snapshot);
    strict_1.default.equal(report.hasBlockingDrift, true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'column'), true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'relationship'), true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'form'), true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'webresource'), true);
});
(0, node_test_1.default)('diffSynthesisPlan treats process-host form artifacts as blocking drift', () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const snapshot = {
        generatedUtc: new Date().toISOString(),
        dataverseUrl: 'https://example.invalid',
        solutionName: plan.generatedMetadataSolutionName,
        entities: plan.entities.map((entity) => ({
            logicalName: entity.logicalName,
            schemaName: entity.schemaName,
            primaryIdLogicalName: entity.primaryIdLogicalName,
            primaryNameAttributeLogicalName: entity.primaryNameAttributeLogicalName,
            columns: entity.columns.map((column) => ({
                logicalName: column.logicalName,
                schemaName: column.schemaName,
                attributeType: column.attributeType,
                isPrimaryNameAttribute: column.isPrimaryNameAttribute,
                requiredLevel: column.required ? 'ApplicationRequired' : 'None',
                targets: column.lookupTargetLogicalName ? [column.lookupTargetLogicalName] : [],
                optionValues: (column.choiceOptions ?? []).map((option) => option.value)
            }))
        })),
        relationships: plan.relationships.map((relationship) => ({
            logicalName: relationship.logicalName,
            schemaName: relationship.schemaName,
            relationshipType: 'OneToManyRelationship',
            referencedEntityLogicalName: relationship.referencedEntityLogicalName,
            referencingEntityLogicalName: relationship.referencingEntityLogicalName,
            referencingAttributeLogicalName: relationship.referencingAttributeLogicalName
        })),
        forms: plan.forms.map((form) => ({
            formId: form.systemFormId,
            name: form.displayName,
            entityLogicalName: form.entityLogicalName,
            type: 2,
            formXml: form.id === 'request-form'
                ? `<form><tabs><tab name="${form.processHost?.supported.sectionName ?? 'missing'}"><section name="not-the-process-host"><control id="other-control" datafieldname="other" classid="WebResourceControl"><parameters><Url>missing-host.html</Url></parameters></control></section></tab></tabs></form>`
                : `<form><tabs><tab name="${form.processHost?.supported.sectionName ?? 'missing'}"><section name="${form.processHost?.supported.sectionName ?? 'missing'}"><control id="${form.processHost?.supported.controlName ?? 'missing'}" classid="WebResourceControl"><parameters><Url>${form.processHost?.supported.webResourceName ?? 'missing'}</Url></parameters></control></section></tab></tabs></form>`,
            managedFormLibrariesXml: form.managedFormLibrariesXml,
            managedEventsXml: form.managedEventsXml,
            libraries: form.libraries,
            eventHandlers: form.eventHandlers
        })),
        webResources: plan.behaviors.map((behavior) => ({
            id: behavior.webResourceId,
            name: behavior.webResourceName,
            displayName: behavior.displayName,
            webResourceType: behavior.webResourceType,
            content: behavior.content
        })),
        diagnostics: []
    };
    const report = (0, index_1.diffSynthesisPlan)(plan, snapshot);
    strict_1.default.equal(report.hasBlockingDrift, true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'form' &&
        difference.logicalName === '{8d65fa31-b54d-5d9b-84e0-07d87e113130}' &&
        /process-host/.test(difference.message)), true);
});
(0, node_test_1.default)('emitGeneratedMetadataSolution writes patched forms and behavior web resources', async () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const outputRoot = node_path_1.default.join(process.cwd(), 'dist', 'test-output');
    const templateRoot = node_path_1.default.join(process.cwd(), '..', 'power-platform', 'solutions', 'DynamicsBusinessMachineGeneratedMetadata', 'template');
    await (0, index_1.emitGeneratedMetadataSolution)(plan, outputRoot, templateRoot);
    const solutionXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Other', 'Solution.xml'), 'utf8');
    const requestEntityXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'Entity.xml'), 'utf8');
    const requestFormXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'FormXml', 'main', '{8d65fa31-b54d-5d9b-84e0-07d87e113130}.xml'), 'utf8');
    const requestConfigJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', 'request-form.js'), 'utf8');
    const reviewConfigJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', 'review-form.js'), 'utf8');
    const runtimeJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js'), 'utf8');
    const rendererJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'process-experience', 'renderer.js'), 'utf8');
    const hostHtml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'process-experience', 'host.html'), 'utf8');
    const reviewFormXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Entities', 'dbm_Requestdecision', 'FormXml', 'main', '{4e37e2e6-61cb-544d-848a-9f870ec4cf4d}.xml'), 'utf8');
    const runtimeMetadataXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js.data.xml'), 'utf8');
    strict_1.default.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
    strict_1.default.match(solutionXml, /type="61" schemaName="ys_\/dbm\/process-experience\/renderer\.js"/);
    strict_1.default.match(solutionXml, /type="61" schemaName="ys_\/dbm\/forms\/runtime\.js"/);
    strict_1.default.match(requestEntityXml, /<Name>dbm_title<\/Name>/);
    strict_1.default.match(requestFormXml, /<formLibraries>/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/process-experience\/renderer\.js/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/runtime\.js/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/config\/request-form\.js/);
    strict_1.default.match(requestFormXml, /WebResource_dbmProcessHost_request_form/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/process-experience\/host\.html/);
    strict_1.default.match(requestFormXml, /<event name="onload"/);
    strict_1.default.match(requestConfigJs, /dbmOnLoad_request_form/);
    strict_1.default.match(requestConfigJs, /"runtime": \{/);
    strict_1.default.match(requestConfigJs, /"processHost": \{/);
    strict_1.default.match(reviewConfigJs, /dbm_decisionoutcome/);
    strict_1.default.match(runtimeJs, /DBM\.ProcessRuntime/);
    strict_1.default.match(runtimeJs, /ProcessExperienceHost/);
    strict_1.default.match(rendererJs, /ProcessExperienceHost/);
    strict_1.default.match(hostHtml, /dbm-process-host-root/);
    strict_1.default.match(reviewFormXml, /dbm_decisionoutcome/);
    strict_1.default.match(reviewFormXml, /WebResource_dbmProcessHost_review_form/);
    strict_1.default.match(runtimeMetadataXml, /<Name>ys_\/dbm\/forms\/runtime\.js<\/Name>/);
    await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
});
(0, node_test_1.default)('generated request runtime sync advances large requests into supporting details and persists runtime state', async () => {
    const harness = await createRuntimeHarness('request-form');
    try {
        const patchedPayloads = [];
        const requestRecord = {
            dbm_requestid: 'request-1',
            dbm_title: 'Budget Request',
            dbm_amount: 10000,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000000
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_requests(request-1)')) {
                return jsonResponse(200, requestRecord);
            }
            if (method === 'PATCH' && relative === 'dbm_requests(request-1)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            throw new Error(`Unexpected fetch during request runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'request-1', {
            dbm_title: 'Budget Request',
            dbm_amount: 10000,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000000
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config);
        strict_1.default.equal(result?.state.stageId, 'draft-request');
        strict_1.default.equal(result?.state.stepId, 'capture-supporting-details');
        strict_1.default.equal(result?.state.formStateId, 'request-supporting-state');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'draft-request',
                dbm_currentstepid: 'capture-supporting-details',
                dbm_currentformstateid: 'request-supporting-state',
                dbm_internalstatusid: 'draft',
                dbm_portalstatusid: 'draft'
            }
        ]);
        strict_1.default.equal(form.controls.get('dbm_supportingnotes')?.state.visible, true);
        strict_1.default.equal(form.controls.get('dbm_screeningresult')?.state.visible, false);
        strict_1.default.equal(form.sectionRenders.length, 1);
        strict_1.default.equal(form.sectionRenders[0]?.snapshot.currentStepId, 'capture-supporting-details');
        strict_1.default.equal(form.sectionRenders[0]?.mode, 'model-driven-section');
        strict_1.default.equal(form.sectionRenders[0]?.navigationTarget?.controlName, 'dbm_supportingnotes');
        strict_1.default.equal(form.overlayRenders.length, 1);
        strict_1.default.equal(form.overlayRenders[0]?.targetId, harness.config.processHost.overlay.containerId);
        strict_1.default.equal(form.overlayRenders[0]?.props.mode, 'model-driven-overlay');
        form.sectionRenders[0]?.onNavigateToFormRegion?.(form.sectionRenders[0]?.navigationTarget);
        strict_1.default.equal(form.tabs.get('request_main_tab')?.focused, true);
        strict_1.default.equal(form.controls.get('dbm_supportingnotes')?.state.focused, true);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generated request runtime creates a related record and prepares cross-form handoff when screening completes', async () => {
    const harness = await createRuntimeHarness('request-form');
    try {
        const patchedPayloads = [];
        const createdReviewPayloads = [];
        const requestRecord = {
            dbm_requestid: 'request-2',
            dbm_title: 'Travel Request',
            dbm_amount: 3000,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000001,
            dbm_currentstageid: 'internal-screening-stage',
            dbm_currentstepid: 'screen-request',
            dbm_currentformstateid: 'request-screening-state',
            dbm_internalstatusid: 'internal-screening',
            dbm_portalstatusid: 'under-review'
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_requests(request-2)')) {
                return jsonResponse(200, requestRecord);
            }
            if (method === 'GET' && relative.startsWith('dbm_requestdecisions?')) {
                return jsonResponse(200, { value: [] });
            }
            if (method === 'PATCH' && relative === 'dbm_requests(request-2)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            if (method === 'POST' && relative === 'dbm_requestdecisions') {
                createdReviewPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(200, { dbm_requestdecisionid: 'review-1' });
            }
            throw new Error(`Unexpected fetch during screening runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'request-2', {
            dbm_title: 'Travel Request',
            dbm_amount: 3000,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000001
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config, 'submit');
        strict_1.default.equal(result?.state.stageId, 'manager-review');
        strict_1.default.equal(result?.state.stepId, 'choose-decision');
        strict_1.default.equal(result?.state.formStateId, 'review-decision-state');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'manager-review',
                dbm_currentstepid: 'choose-decision',
                dbm_currentformstateid: 'review-decision-state',
                dbm_internalstatusid: 'awaiting-manager-decision',
                dbm_portalstatusid: 'under-review'
            }
        ]);
        strict_1.default.deepEqual(createdReviewPayloads, [
            {
                dbm_name: 'dbm requestdecision request2',
                'dbm_requestid@odata.bind': '/dbm_requests(request-2)'
            }
        ]);
        strict_1.default.equal(form.controls.get('dbm_screeningresult')?.state.disabled, true);
        strict_1.default.equal(form.sectionRenders.length, 1);
        strict_1.default.match(form.sectionRenders[0]?.snapshot.projection.message ?? '', /different DBM form/i);
        strict_1.default.equal(form.overlayRenders.length, 1);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generic existing-form runtime creates a related record and opens the generated target form during handoff', async () => {
    const harness = await createRuntimeHarnessForModel(generic_existing_form_v1_model_json_1.default, 'case-form');
    try {
        const patchedPayloads = [];
        const createdAssignmentPayloads = [];
        const openedForms = [];
        const caseRecord = {
            dbm_caseid: 'case-1',
            dbm_title: 'Cross-table proof',
            dbm_description: 'Validate generic handoff behavior.'
        };
        harness.sandbox.Xrm.Navigation.openForm = async (options) => {
            openedForms.push(options);
            return {};
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_cases(case-1)')) {
                return jsonResponse(200, caseRecord);
            }
            if (method === 'PATCH' && relative === 'dbm_cases(case-1)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            if (method === 'POST' && relative === 'dbm_caseassignments') {
                createdAssignmentPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(200, { dbm_caseassignmentid: 'assignment-1' });
            }
            throw new Error(`Unexpected fetch during generic create-related runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'case-1', {
            dbm_title: 'Cross-table proof',
            dbm_description: 'Validate generic handoff behavior.'
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config, 'submit');
        strict_1.default.equal(result?.state.stageId, 'assignment-work');
        strict_1.default.equal(result?.state.stepId, 'prepare-assignment');
        strict_1.default.equal(result?.state.formStateId, 'assignment-work-state');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'assignment-work',
                dbm_currentstepid: 'prepare-assignment',
                dbm_currentformstateid: 'assignment-work-state',
                dbm_internalstatusid: 'assigned',
                dbm_portalstatusid: 'assigned'
            }
        ]);
        strict_1.default.deepEqual(createdAssignmentPayloads, [
            {
                dbm_name: 'dbm caseassignment case1',
                'dbm_caseid@odata.bind': '/dbm_cases(case-1)'
            }
        ]);
        strict_1.default.deepEqual(openedForms.map((entry) => ({
            entityName: entry.entityName,
            entityId: entry.entityId,
            formId: entry.formId,
            openInNewWindow: entry.openInNewWindow
        })), [
            {
                entityName: 'dbm_caseassignment',
                entityId: 'assignment-1',
                formId: '{22222222-2222-2222-2222-222222222222}',
                openInNewWindow: false
            }
        ]);
        strict_1.default.equal(form.sectionRenders.length, 1);
        strict_1.default.match(form.sectionRenders[0]?.snapshot.projection.message ?? '', /different DBM form/i);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generic existing-form runtime does not persist a cross-form handoff when the related record cannot be created', async () => {
    const harness = await createRuntimeHarnessForModel(generic_existing_form_v1_model_json_1.default, 'case-form');
    try {
        const patchedPayloads = [];
        const openedForms = [];
        const caseRecord = {
            dbm_caseid: 'case-create-failure',
            dbm_title: 'Broken handoff proof',
            dbm_description: 'Validate create-related failure handling.'
        };
        harness.sandbox.Xrm.Navigation.openForm = async (options) => {
            openedForms.push(options);
            return {};
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_cases(case-create-failure)')) {
                return jsonResponse(200, caseRecord);
            }
            if (method === 'PATCH' && relative === 'dbm_cases(case-create-failure)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            if (method === 'POST' && relative === 'dbm_caseassignments') {
                return jsonResponse(400, { error: { message: 'invalid-bind-property' } });
            }
            throw new Error(`Unexpected fetch during generic create-related failure runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'case-create-failure', {
            dbm_title: 'Broken handoff proof',
            dbm_description: 'Validate create-related failure handling.'
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config, 'submit');
        strict_1.default.equal(result?.status, 'error');
        strict_1.default.equal(result?.state.stageId, 'draft-case');
        strict_1.default.equal(result?.state.stepId, 'capture-case');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'draft-case',
                dbm_currentstepid: 'capture-case',
                dbm_currentformstateid: 'case-edit-state',
                dbm_internalstatusid: 'draft',
                dbm_portalstatusid: 'draft'
            }
        ]);
        strict_1.default.deepEqual(openedForms, []);
        strict_1.default.equal(form.sectionRenders.length, 1);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generic existing-form runtime can select an existing related target record during handoff', async () => {
    const harness = await createRuntimeHarnessForModel(generic_existing_form_v1_model_json_1.default, 'case-form');
    try {
        const patchedPayloads = [];
        const openedForms = [];
        const caseRecord = {
            dbm_caseid: 'case-2',
            dbm_title: 'Existing assignment proof',
            dbm_description: 'Validate existing related selection.'
        };
        harness.config.runtime.stageHandoffsByStageId['assignment-work'].strategy = 'select-existing-related';
        harness.sandbox.Xrm.Navigation.openForm = async (options) => {
            openedForms.push(options);
            return {};
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_cases(case-2)')) {
                return jsonResponse(200, caseRecord);
            }
            if (method === 'GET' && relative.startsWith('dbm_caseassignments?')) {
                return jsonResponse(200, {
                    value: [
                        {
                            dbm_caseassignmentid: 'assignment-existing',
                            _dbm_caseid_value: 'case-2',
                            dbm_summary: 'Existing related assignment'
                        }
                    ]
                });
            }
            if (method === 'PATCH' && relative === 'dbm_cases(case-2)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            throw new Error(`Unexpected fetch during generic select-existing runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'case-2', {
            dbm_title: 'Existing assignment proof',
            dbm_description: 'Validate existing related selection.'
        });
        const result = await harness.sync(form.executionContext, harness.config, 'submit');
        strict_1.default.equal(result?.state.stageId, 'assignment-work');
        strict_1.default.equal(result?.state.stepId, 'prepare-assignment');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'assignment-work',
                dbm_currentstepid: 'prepare-assignment',
                dbm_currentformstateid: 'assignment-work-state',
                dbm_internalstatusid: 'assigned',
                dbm_portalstatusid: 'assigned'
            }
        ]);
        strict_1.default.deepEqual(openedForms.map((entry) => ({
            entityName: entry.entityName,
            entityId: entry.entityId,
            formId: entry.formId,
            openInNewWindow: entry.openInNewWindow
        })), [
            {
                entityName: 'dbm_caseassignment',
                entityId: 'assignment-existing',
                formId: '{22222222-2222-2222-2222-222222222222}',
                openInNewWindow: false
            }
        ]);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generic existing-form runtime applies terminal statuses when a target-form outcome reaches an end stage', async () => {
    const harness = await createRuntimeHarnessForModel(generic_existing_form_v1_model_json_1.default, 'assignment-form');
    try {
        const patchedPayloads = [];
        const assignmentRecord = {
            dbm_caseassignmentid: 'assignment-complete-1',
            dbm_summary: 'Ready to complete.',
            _dbm_caseid_value: 'case-complete-1'
        };
        const caseRecord = {
            dbm_caseid: 'case-complete-1',
            dbm_currentstageid: 'assignment-work',
            dbm_currentstepid: 'prepare-assignment',
            dbm_currentformstateid: 'assignment-work-state',
            dbm_internalstatusid: 'assigned',
            dbm_portalstatusid: 'assigned'
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_caseassignments(assignment-complete-1)')) {
                return jsonResponse(200, assignmentRecord);
            }
            if (method === 'GET' && relative.startsWith('dbm_cases(case-complete-1)')) {
                return jsonResponse(200, caseRecord);
            }
            if (method === 'PATCH' && relative === 'dbm_cases(case-complete-1)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            throw new Error(`Unexpected fetch during generic terminal completion runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'assignment-complete-1', {
            dbm_summary: 'Ready to complete.',
            dbm_caseid: [{ id: 'case-complete-1', name: 'Case Complete 1', entityType: 'dbm_case' }]
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config, 'complete');
        strict_1.default.equal(result?.state.stageId, 'completed');
        strict_1.default.equal(result?.state.internalStatusId, 'complete');
        strict_1.default.equal(result?.state.portalStatusId, 'complete');
        strict_1.default.equal(form.sectionRenders.at(-1)?.snapshot.currentStageId, 'completed');
        strict_1.default.equal(form.sectionRenders.at(-1)?.snapshot.currentStepId, null);
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'completed',
                dbm_currentstepid: 'prepare-assignment',
                dbm_currentformstateid: 'assignment-work-state',
                dbm_internalstatusid: 'complete',
                dbm_portalstatusid: 'complete'
            }
        ]);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generated request runtime still renders the supported process host when overlay is disabled', async () => {
    const harness = await createRuntimeHarness('request-form');
    try {
        harness.config.processHost.overlay.enabled = false;
        const requestRecord = {
            dbm_requestid: 'request-3',
            dbm_title: 'Equipment Request',
            dbm_amount: 1500,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000000
        };
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_requests(request-3)')) {
                return jsonResponse(200, requestRecord);
            }
            if (method === 'PATCH' && relative === 'dbm_requests(request-3)') {
                return jsonResponse(204);
            }
            throw new Error(`Unexpected fetch during overlay-disabled runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'request-3', {
            dbm_title: 'Equipment Request',
            dbm_amount: 1500,
            dbm_assignedapprover: 'manager@example.com',
            dbm_supportingnotes: '',
            dbm_screeningresult: 100000000
        });
        const result = await harness.sync(form.executionContext, harness.config);
        strict_1.default.ok(result?.state.stageId);
        strict_1.default.ok(result?.state.stepId);
        strict_1.default.equal(form.sectionRenders.length, 1);
        strict_1.default.equal(form.sectionRenders[0]?.mode, 'model-driven-section');
        strict_1.default.equal(form.sectionRenders[0]?.designerEntryUrl, 'https://example.crm4.dynamics.com/main.aspx?appid=test-app-id&pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&packageName=dbm-approval-request');
        strict_1.default.equal(form.overlayRenders.length, 0);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generated review runtime uses review-form defaults and resolves lookup values from Dataverse Web API payloads', async () => {
    const harness = await createRuntimeHarness('review-form');
    try {
        const patchedPayloads = [];
        harness.config.runtime.rules['decision-request-bound'] = "decision-request == 'request-123'";
        harness.config.runtime.stepTransitions = [
            {
                fromStepId: 'choose-decision',
                guardRuleId: 'decision-request-bound',
                target: {
                    stepId: 'record-approval'
                }
            }
        ];
        harness.sandbox.fetch = async (input, init) => {
            const url = new URL(String(input));
            const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
            const method = init?.method ?? 'GET';
            if (method === 'GET' && relative.startsWith('dbm_requests(request-123)')) {
                return jsonResponse(200, {
                    dbm_requestid: 'request-123',
                    dbm_title: 'Capital Spend',
                    dbm_amount: 2500,
                    dbm_assignedapprover: 'manager@example.com'
                });
            }
            if (method === 'GET' && relative.startsWith('dbm_requestdecisions(review-1)')) {
                return jsonResponse(200, {
                    dbm_requestdecisionid: 'review-1',
                    _dbm_requestid_value: 'request-123',
                    dbm_decisionsummary: 'Review request Capital Spend.'
                });
            }
            if (method === 'GET' && relative.startsWith('dbm_requestdecisions?')) {
                return jsonResponse(200, {
                    value: [
                        {
                            dbm_requestdecisionid: 'review-1',
                            dbm_requestid: 'request-123',
                            dbm_decisionsummary: 'Review request Capital Spend.'
                        }
                    ]
                });
            }
            if (method === 'PATCH' && relative === 'dbm_requests(request-123)') {
                patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
                return jsonResponse(204);
            }
            throw new Error(`Unexpected fetch during review runtime test: ${method} ${relative}`);
        };
        const form = createMockFormContext(harness.config, 'review-1', {
            dbm_requestid: [{ id: '{request-123}' }],
            dbm_decisionsummary: 'Review request Capital Spend.',
            dbm_decisionoutcome: null,
            dbm_decisioncomment: ''
        });
        form.installOverlayBridge(harness.sandbox);
        const result = await harness.sync(form.executionContext, harness.config);
        strict_1.default.equal(result?.state.stageId, 'manager-review');
        strict_1.default.equal(result?.state.stepId, 'record-approval');
        strict_1.default.equal(result?.state.formStateId, 'review-approval-state');
        strict_1.default.deepEqual(patchedPayloads, [
            {
                dbm_currentstageid: 'manager-review',
                dbm_currentstepid: 'record-approval',
                dbm_currentformstateid: 'review-approval-state',
                dbm_internalstatusid: 'approved',
                dbm_portalstatusid: 'approved'
            }
        ]);
        strict_1.default.equal(form.controls.get('dbm_decisionoutcome')?.state.visible, true);
        strict_1.default.equal(form.controls.get('dbm_decisioncomment')?.state.visible, false);
        strict_1.default.equal(form.sectionRenders.length, 1);
        strict_1.default.equal(form.sectionRenders[0]?.snapshot.currentStepId, 'record-approval');
        strict_1.default.equal(form.overlayRenders.length, 1);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('applySynthesisPlanToDev bootstraps the generated solution and keeps relationship-backed metadata idempotent', async () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const requests = [];
    let solutionExists = false;
    const createdEntities = new Set();
    const createdColumns = new Map();
    const createdRelationships = new Set();
    const webResources = new Map();
    const formXmlById = new Map(plan.forms.map((form) => [
        form.systemFormId.replace(/[{}]/g, '').toLowerCase(),
        `<form><tabs><tab id="{${form.systemFormId.replace(/[{}]/g, '').toUpperCase()}}"><columns><column><sections><section name="${form.sections[0]?.sectionName ?? 'section'}"><labels><label description="General" languagecode="1033" /></labels><rows /></section></sections></column></columns></tab></tabs><formLibraries /><events /></form>`
    ]));
    function ensureColumnSet(entityLogicalName) {
        const existing = createdColumns.get(entityLogicalName);
        if (existing) {
            return existing;
        }
        const next = new Set();
        createdColumns.set(entityLogicalName, next);
        return next;
    }
    function getEntityPlan(entityLogicalName) {
        return plan.entities.find((entity) => entity.logicalName === entityLogicalName) ?? null;
    }
    function toAttributePayload(entityLogicalName, columnLogicalName) {
        const entity = getEntityPlan(entityLogicalName);
        const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
        strict_1.default.ok(column, `Missing synthesized column '${entityLogicalName}.${columnLogicalName}'.`);
        return {
            LogicalName: column.logicalName,
            SchemaName: column.schemaName,
            AttributeType: column.attributeType,
            IsPrimaryName: column.isPrimaryNameAttribute,
            RequiredLevel: { Value: column.required ? 'ApplicationRequired' : 'None' }
        };
    }
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
        const url = new URL(String(input));
        const bodyText = typeof init?.body === 'string' ? init.body : undefined;
        requests.push({
            method: init?.method ?? 'GET',
            url: url.toString(),
            body: bodyText ? JSON.parse(bodyText) : undefined,
            headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries())
        });
        const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
        const method = init?.method ?? 'GET';
        const json = (status, payload) => new Response(payload ? JSON.stringify(payload) : null, {
            status,
            headers: payload ? { 'Content-Type': 'application/json' } : undefined
        });
        if (method === 'GET' && relative.startsWith('solutions?')) {
            return json(200, { value: solutionExists ? [{ solutionid: 'solution-id', uniquename: plan.generatedMetadataSolutionName, version: '1.0.0.0' }] : [] });
        }
        if (method === 'GET' && relative.startsWith('publishers?')) {
            return json(200, { value: [{ publisherid: '11111111-1111-1111-1111-111111111111', uniquename: 'yagasoft' }] });
        }
        if (method === 'POST' && relative === 'solutions') {
            solutionExists = true;
            return json(204);
        }
        const entityMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\?\$select=LogicalName(?:,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute)?/.exec(relative);
        if (method === 'GET' && entityMatch) {
            const entityLogicalName = entityMatch[1] ?? '';
            if (!createdEntities.has(entityLogicalName)) {
                return json(404, { error: { message: 'Not found' } });
            }
            const entity = getEntityPlan(entityLogicalName);
            strict_1.default.ok(entity, `Missing synthesized entity '${entityLogicalName}'.`);
            return json(200, {
                LogicalName: entity.logicalName,
                SchemaName: entity.schemaName,
                PrimaryIdAttribute: entity.primaryIdLogicalName,
                PrimaryNameAttribute: entity.columns.find((column) => column.isPrimaryNameAttribute)?.logicalName ?? null
            });
        }
        if (method === 'POST' && relative === 'EntityDefinitions') {
            const logicalName = String(requests[requests.length - 1]?.body?.LogicalName ?? '');
            createdEntities.add(logicalName);
            const primaryNameAttribute = String(requests[requests.length - 1]?.body?.PrimaryNameAttribute ?? '');
            if (primaryNameAttribute) {
                ensureColumnSet(logicalName).add(primaryNameAttribute);
            }
            return json(204);
        }
        const attributeGetMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\?\$select=LogicalName/.exec(relative);
        if (method === 'GET' && attributeGetMatch) {
            const entityLogicalName = attributeGetMatch[1] ?? '';
            const columnLogicalName = attributeGetMatch[2] ?? '';
            return ensureColumnSet(entityLogicalName).has(columnLogicalName)
                ? json(200, { LogicalName: columnLogicalName })
                : json(404, { error: { message: 'Not found' } });
        }
        const attributePostMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes$/.exec(relative);
        if (method === 'POST' && attributePostMatch) {
            const entityLogicalName = attributePostMatch[1] ?? '';
            const schemaName = String(requests[requests.length - 1]?.body?.SchemaName ?? '');
            const entity = getEntityPlan(entityLogicalName);
            const column = entity?.columns.find((entry) => entry.schemaName === schemaName) ?? null;
            strict_1.default.ok(column, `Missing synthesized column for schema '${schemaName}'.`);
            ensureColumnSet(entityLogicalName).add(column.logicalName);
            return json(204);
        }
        const relationshipQueryMatch = /RelationshipDefinitions\/Microsoft\.Dynamics\.CRM\.OneToManyRelationshipMetadata\?\$select=SchemaName(?:,ReferencedEntity,ReferencingEntity,ReferencingAttribute)?&\$filter=([^&]+)/.exec(relative);
        if (method === 'GET' && relationshipQueryMatch) {
            const filter = decodeURIComponent(relationshipQueryMatch[1] ?? '');
            const relationship = plan.relationships.find((entry) => createdRelationships.has(entry.logicalName) && (filter.includes(entry.schemaName) || filter.includes(entry.logicalName)));
            if (!relationship) {
                return json(200, { value: [] });
            }
            return json(200, {
                value: [
                    {
                        SchemaName: relationship.schemaName,
                        ReferencedEntity: relationship.referencedEntityLogicalName,
                        ReferencingEntity: relationship.referencingEntityLogicalName,
                        ReferencingAttribute: relationship.referencingAttributeLogicalName
                    }
                ]
            });
        }
        if (method === 'POST' && relative === 'RelationshipDefinitions') {
            const schemaName = String(requests[requests.length - 1]?.body?.SchemaName ?? '');
            const relationship = plan.relationships.find((entry) => entry.schemaName === schemaName || entry.logicalName === schemaName) ?? null;
            strict_1.default.ok(relationship, `Missing synthesized relationship '${schemaName}'.`);
            strict_1.default.ok(relationship.referencingAttributeLogicalName, `Missing referencing attribute for relationship '${schemaName}'.`);
            createdRelationships.add(relationship.logicalName);
            ensureColumnSet(relationship.referencingEntityLogicalName).add(relationship.referencingAttributeLogicalName);
            return json(204);
        }
        const entityAttributesMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\?\$select=LogicalName,SchemaName,AttributeType,IsPrimaryName,RequiredLevel/.exec(relative);
        if (method === 'GET' && entityAttributesMatch) {
            const entityLogicalName = entityAttributesMatch[1] ?? '';
            const logicalNames = [...ensureColumnSet(entityLogicalName)];
            return json(200, {
                value: logicalNames.map((logicalName) => toAttributePayload(entityLogicalName, logicalName))
            });
        }
        const lookupMetadataMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\/Microsoft\.Dynamics\.CRM\.LookupAttributeMetadata\?\$select=Targets/.exec(relative);
        if (method === 'GET' && lookupMetadataMatch) {
            const entityLogicalName = lookupMetadataMatch[1] ?? '';
            const columnLogicalName = lookupMetadataMatch[2] ?? '';
            const entity = getEntityPlan(entityLogicalName);
            const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
            return json(200, { Targets: column?.lookupTargetLogicalName ? [column.lookupTargetLogicalName] : [] });
        }
        const picklistMetadataMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\/Microsoft\.Dynamics\.CRM\.PicklistAttributeMetadata\?\$select=LogicalName&\$expand=OptionSet/.exec(relative);
        if (method === 'GET' && picklistMetadataMatch) {
            const entityLogicalName = picklistMetadataMatch[1] ?? '';
            const columnLogicalName = picklistMetadataMatch[2] ?? '';
            const entity = getEntityPlan(entityLogicalName);
            const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
            return json(200, {
                OptionSet: {
                    Options: (column?.choiceOptions ?? []).map((option) => ({ Value: option.value }))
                }
            });
        }
        const systemFormMatch = /systemforms\(([^)]+)\)(?:\?\$select=formid,name,formxml)?/.exec(relative);
        if (systemFormMatch && method === 'GET') {
            const formId = (systemFormMatch[1] ?? '').replace(/[{}]/g, '').toLowerCase();
            const formPlan = plan.forms.find((entry) => entry.systemFormId.replace(/[{}]/g, '').toLowerCase() === formId);
            const formXml = formXmlById.get(formId);
            return formPlan && formXml
                ? json(200, { formid: formPlan.systemFormId, name: formPlan.displayName, formxml: formXml })
                : json(404, { error: { message: 'Not found' } });
        }
        if (systemFormMatch && method === 'PATCH') {
            const formId = (systemFormMatch[1] ?? '').replace(/[{}]/g, '').toLowerCase();
            formXmlById.set(formId, String(requests[requests.length - 1]?.body?.formxml ?? ''));
            return json(204);
        }
        if (method === 'GET' && relative.startsWith('webresourceset?')) {
            const filterMatch = /\$filter=([^&]+)/.exec(relative);
            const decodedFilter = decodeURIComponent(filterMatch?.[1] ?? '');
            const matched = [...webResources.entries()]
                .filter(([name]) => decodedFilter.includes(name))
                .map(([name, resource]) => ({
                webresourceid: resource.id,
                name,
                displayname: resource.displayName,
                webresourcetype: resource.webResourceType,
                content: resource.content
            }));
            return json(200, { value: matched });
        }
        if (method === 'POST' && relative === 'webresourceset') {
            const body = requests[requests.length - 1]?.body ?? {};
            const name = String(body.name ?? '');
            webResources.set(name, {
                id: `wr-${webResources.size + 1}`,
                displayName: body.displayname ?? null,
                webResourceType: body.webresourcetype ?? null,
                content: body.content ?? ''
            });
            return json(204);
        }
        const webResourcePatchMatch = /webresourceset\(([^)]+)\)$/.exec(relative);
        if (webResourcePatchMatch && method === 'PATCH') {
            const body = requests[requests.length - 1]?.body ?? {};
            const name = String(body.name ?? '');
            webResources.set(name, {
                id: webResourcePatchMatch[1] ?? `wr-${webResources.size + 1}`,
                displayName: body.displayname ?? null,
                webResourceType: body.webresourcetype ?? null,
                content: body.content ?? ''
            });
            return json(204);
        }
        if (method === 'POST' && relative === 'PublishAllXml') {
            return json(204);
        }
        strict_1.default.fail(`Unexpected fetch call: ${method} ${relative}`);
    });
    try {
        const report = await (0, index_1.applySynthesisPlanToDev)(plan, { dataverseUrl: 'https://example.crm.dynamics.com' }, { accessToken: 'token' });
        strict_1.default.equal(report.status, 'success');
        strict_1.default.equal(report.actions.some((action) => action.componentType === 'solution' && action.state === 'created'), true);
        strict_1.default.equal(report.actions.some((action) => action.componentType === 'relationship' && action.state === 'created'), true);
        strict_1.default.equal(report.actions.some((action) => action.componentType === 'column' &&
            action.logicalName === 'dbm_requestdecision.dbm_requestid' &&
            action.message.includes('relationship metadata')), true);
        const relationshipCreate = requests.find((request) => request.url.endsWith('/RelationshipDefinitions') && request.method === 'POST');
        strict_1.default.ok(relationshipCreate);
        strict_1.default.equal(relationshipCreate?.headers['mscrm.solutionuniquename'], 'DynamicsBusinessMachineGeneratedMetadata');
        strict_1.default.equal(relationshipCreate?.body?.Lookup?.SchemaName, 'dbm_Requestid');
        strict_1.default.equal(relationshipCreate?.body?.ReferencedEntity, 'dbm_request');
        strict_1.default.equal(relationshipCreate?.body?.ReferencingEntity, 'dbm_requestdecision');
        const entityCreate = requests.find((request) => request.url.endsWith('/EntityDefinitions') && request.method === 'POST');
        strict_1.default.ok(entityCreate);
        strict_1.default.equal(entityCreate?.body?.PrimaryNameAttribute, 'dbm_title');
        strict_1.default.equal(report.actions.some((action) => action.componentType === 'webresource' &&
            action.logicalName === 'ys_/dbm/process-experience/renderer.js' &&
            action.state === 'created'), true);
        strict_1.default.equal(report.actions.some((action) => action.componentType === 'form' &&
            action.logicalName === '{8d65fa31-b54d-5d9b-84e0-07d87e113130}' &&
            action.state === 'updated'), true);
        const requestFormXml = formXmlById.get('8d65fa31-b54d-5d9b-84e0-07d87e113130');
        strict_1.default.ok(requestFormXml?.includes('dbm_process_host_request_form'));
        strict_1.default.ok(requestFormXml?.includes('ys_/dbm/process-experience/host.html'));
        strict_1.default.ok(requestFormXml?.includes('ys_/dbm/forms/config/request-form.js'));
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
