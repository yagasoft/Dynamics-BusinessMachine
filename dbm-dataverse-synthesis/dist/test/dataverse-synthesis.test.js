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
const index_1 = require("../src/index");
function jsonResponse(status, payload) {
    return new Response(payload ? JSON.stringify(payload) : null, {
        status,
        headers: payload ? { 'Content-Type': 'application/json' } : undefined
    });
}
async function createRuntimeHarness(formId) {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const outputRoot = node_path_1.default.join(process.cwd(), 'dist', 'runtime-test-output', `${formId}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const templateRoot = node_path_1.default.join(process.cwd(), '..', 'power-platform', 'solutions', 'DynamicsBusinessMachineGeneratedMetadata', 'template');
    await (0, index_1.emitGeneratedMetadataSolution)(plan, outputRoot, templateRoot);
    const runtimeJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js'), 'utf8');
    const configFileName = formId === 'request-form' ? 'request-form.js' : 'review-form.js';
    const onLoadName = formId === 'request-form' ? 'dbmOnLoad_request_form' : 'dbmOnLoad_review_form';
    const configJs = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', configFileName), 'utf8');
    const sandbox = {
        console,
        Response,
        Headers,
        fetch: async () => jsonResponse(404, { error: 'fetch-not-configured' }),
        setTimeout: (callback) => {
            callback();
            return 0;
        },
        clearTimeout: () => undefined,
        Xrm: {
            Utility: {
                getGlobalContext: () => ({
                    getClientUrl: () => 'https://example.crm4.dynamics.com'
                })
            }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const context = (0, node_vm_1.createContext)(sandbox);
    (0, node_vm_1.runInContext)(runtimeJs, context);
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
        cleanup: async () => {
            await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
        }
    };
}
function createMockFormContext(config, entityId, initialValues) {
    const attributes = new Map();
    const controls = new Map();
    const sections = new Map();
    const tabs = new Map();
    const notifications = [];
    for (const sectionConfig of config.sections) {
        if (!tabs.has(sectionConfig.tabName)) {
            tabs.set(sectionConfig.tabName, {
                visible: true,
                sections: {
                    get: (name) => sections.get(`${sectionConfig.tabName}:${name}`) ?? null
                },
                setVisible(value) {
                    this.visible = value;
                },
                getVisible() {
                    return this.visible;
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
                    getRequiredLevel: () => requiredLevel
                });
            }
            if (!controls.has(controlConfig.controlName)) {
                const state = {
                    controlName: controlConfig.controlName,
                    visible: true,
                    disabled: false,
                    requiredLevel: 'none'
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
                        getRequiredLevel: attribute.getRequiredLevel
                    }),
                    setVisible: (value) => {
                        state.visible = value;
                    },
                    getVisible: () => state.visible,
                    setDisabled: (value) => {
                        state.disabled = value;
                    },
                    getDisabled: () => state.disabled,
                    state
                });
            }
        }
    }
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
        notifications
    };
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
    strict_1.default.equal(plan.behaviors.filter((behavior) => behavior.supported).length, 3);
    strict_1.default.equal(plan.summary.supportedForms, 2);
    strict_1.default.equal(plan.summary.supportedBehaviors, 3);
    strict_1.default.equal(plan.forms.some((form) => form.id === 'request-form' &&
        form.systemFormId === '{8d65fa31-b54d-5d9b-84e0-07d87e113130}' &&
        form.sections.some((section) => section.sectionName === 'request_supporting_section')), true);
    strict_1.default.equal(plan.behaviors.some((behavior) => behavior.webResourceName === 'ys_/dbm/forms/config/request-form.js' &&
        behavior.kind === 'form-config'), true);
    strict_1.default.ok(requestEntity);
    strict_1.default.equal(requestEntity?.columns.some((column) => column.logicalName === 'dbm_currentstageid' && column.source === 'synthetic'), true);
    strict_1.default.ok(reviewForm?.runtime);
    strict_1.default.equal(reviewForm?.runtime?.decisionOutcomeFieldLogicalName, 'dbm_decisionoutcome');
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
    const reviewFormXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Entities', 'dbm_Requestdecision', 'FormXml', 'main', '{4e37e2e6-61cb-544d-848a-9f870ec4cf4d}.xml'), 'utf8');
    const runtimeMetadataXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js.data.xml'), 'utf8');
    strict_1.default.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
    strict_1.default.match(solutionXml, /type="61" schemaName="ys_\/dbm\/forms\/runtime\.js"/);
    strict_1.default.match(requestEntityXml, /<Name>dbm_title<\/Name>/);
    strict_1.default.match(requestFormXml, /<formLibraries>/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/runtime\.js/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/config\/request-form\.js/);
    strict_1.default.match(requestFormXml, /<event name="onload"/);
    strict_1.default.match(requestConfigJs, /dbmOnLoad_request_form/);
    strict_1.default.match(requestConfigJs, /"runtime": \{/);
    strict_1.default.match(reviewConfigJs, /dbm_decisionoutcome/);
    strict_1.default.match(runtimeJs, /DBM\.ProcessRuntime/);
    strict_1.default.match(reviewFormXml, /dbm_decisionoutcome/);
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
        strict_1.default.match(form.notifications[0]?.message ?? '', /Capture Supporting Details/);
    }
    finally {
        await harness.cleanup();
    }
});
(0, node_test_1.default)('generated request runtime creates a review record when screening completes', async () => {
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
        const result = await harness.sync(form.executionContext, harness.config);
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
                'dbm_requestid@odata.bind': '/dbm_requests(request-2)',
                dbm_decisionsummary: 'Review request Travel Request.'
            }
        ]);
        strict_1.default.match(form.notifications[1]?.message ?? '', /different DBM form/i);
        strict_1.default.equal(form.controls.get('dbm_screeningresult')?.state.disabled, true);
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
        strict_1.default.match(form.notifications[0]?.message ?? '', /Manager Review -> Record Approval/);
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
        if (method === 'POST' && relative === 'PublishAllXml') {
            return json(204);
        }
        if (method === 'GET' && relative.startsWith('systemforms(')) {
            return json(404, { error: { message: 'Not found' } });
        }
        if (method === 'GET' && relative.startsWith('webresourceset?')) {
            return json(200, { value: [] });
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
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
