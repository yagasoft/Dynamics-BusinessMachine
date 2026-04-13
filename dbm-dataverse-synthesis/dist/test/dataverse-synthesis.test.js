"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const approval_request_v1_model_json_1 = __importDefault(require("../../docs/architecture/examples/approval-request-v1.model.json"));
const index_1 = require("../src/index");
(0, node_test_1.default)('planDataverseSynthesis maps the approval example into entities, existing forms, and JS behaviors', () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
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
    const runtimeMetadataXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js.data.xml'), 'utf8');
    strict_1.default.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
    strict_1.default.match(solutionXml, /type="61" schemaName="ys_\/dbm\/forms\/runtime\.js"/);
    strict_1.default.match(requestEntityXml, /<Name>dbm_title<\/Name>/);
    strict_1.default.match(requestFormXml, /<formLibraries>/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/runtime\.js/);
    strict_1.default.match(requestFormXml, /ys_\/dbm\/forms\/config\/request-form\.js/);
    strict_1.default.match(requestFormXml, /<event name="onload"/);
    strict_1.default.match(requestConfigJs, /dbmOnLoad_request_form/);
    strict_1.default.match(runtimeMetadataXml, /<Name>ys_\/dbm\/forms\/runtime\.js<\/Name>/);
    await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
});
(0, node_test_1.default)('applySynthesisPlanToDev bootstraps the generated solution and keeps relationship-backed metadata idempotent', async () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const requests = [];
    const queuedResponses = [
        { status: 200, payload: { value: [] } },
        { status: 200, payload: { value: [{ publisherid: '11111111-1111-1111-1111-111111111111', uniquename: 'yagasoft' }] } },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 404 },
        { status: 204 },
        { status: 200, payload: { value: [] } },
        { status: 204 },
        { status: 204 },
        {
            status: 200,
            payload: {
                LogicalName: 'dbm_request',
                SchemaName: 'dbm_Request',
                PrimaryIdAttribute: 'dbm_requestid',
                PrimaryNameAttribute: 'dbm_title'
            }
        },
        {
            status: 200,
            payload: {
                value: [
                    {
                        LogicalName: 'dbm_title',
                        SchemaName: 'dbm_Title',
                        AttributeType: 'String',
                        IsPrimaryName: true,
                        RequiredLevel: { Value: 'ApplicationRequired' }
                    },
                    {
                        LogicalName: 'dbm_amount',
                        SchemaName: 'dbm_Amount',
                        AttributeType: 'Money',
                        IsPrimaryName: false,
                        RequiredLevel: { Value: 'ApplicationRequired' }
                    }
                ]
            }
        },
        {
            status: 200,
            payload: {
                LogicalName: 'dbm_requestdecision',
                SchemaName: 'dbm_Requestdecision',
                PrimaryIdAttribute: 'dbm_requestdecisionid',
                PrimaryNameAttribute: 'dbm_name'
            }
        },
        {
            status: 200,
            payload: {
                value: [
                    {
                        LogicalName: 'dbm_name',
                        SchemaName: 'dbm_Name',
                        AttributeType: 'String',
                        IsPrimaryName: true,
                        RequiredLevel: { Value: 'ApplicationRequired' }
                    },
                    {
                        LogicalName: 'dbm_requestid',
                        SchemaName: 'dbm_RequestId',
                        AttributeType: 'Lookup',
                        IsPrimaryName: false,
                        RequiredLevel: { Value: 'ApplicationRequired' }
                    }
                ]
            }
        },
        { status: 200, payload: { Targets: ['dbm_request'] } },
        {
            status: 200,
            payload: {
                value: [
                    {
                        SchemaName: 'dbm_request_dbm_requestdecision',
                        ReferencedEntity: 'dbm_request',
                        ReferencingEntity: 'dbm_requestdecision',
                        ReferencingAttribute: 'dbm_requestid'
                    }
                ]
            }
        },
        { status: 404 },
        { status: 404 },
        { status: 200, payload: { value: [] } },
        { status: 200, payload: { value: [] } },
        { status: 200, payload: { value: [] } }
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
        const next = queuedResponses.shift();
        strict_1.default.ok(next, `Unexpected fetch call: ${String(input)}`);
        const bodyText = typeof init?.body === 'string' ? init.body : undefined;
        requests.push({
            method: init?.method ?? 'GET',
            url: String(input),
            body: bodyText ? JSON.parse(bodyText) : undefined,
            headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries())
        });
        return new Response(next.payload ? JSON.stringify(next.payload) : null, {
            status: next.status,
            headers: next.payload ? { 'Content-Type': 'application/json' } : undefined
        });
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
    strict_1.default.equal(queuedResponses.length, 0);
});
