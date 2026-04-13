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
(0, node_test_1.default)('planDataverseSynthesis maps the approval example into Dataverse entities, columns, and relationships', () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    strict_1.default.equal(plan.generatedMetadataSolutionName, 'DynamicsBusinessMachineGeneratedMetadata');
    strict_1.default.equal(plan.entities.length, 2);
    strict_1.default.equal(plan.relationships.some((relationship) => relationship.logicalName === 'dbm_request_dbm_requestdecision'), true);
    strict_1.default.equal(plan.entities
        .flatMap((entity) => entity.columns)
        .some((column) => column.logicalName === 'dbm_screeningresult' && column.attributeType === 'Picklist' && column.supported), true);
    strict_1.default.equal(plan.entities
        .flatMap((entity) => entity.columns)
        .some((column) => column.logicalName === 'dbm_requestid' && column.attributeType === 'Lookup' && column.supported), true);
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
(0, node_test_1.default)('diffSynthesisPlan detects missing columns and relationships as blocking drift', () => {
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
        diagnostics: []
    };
    const report = (0, index_1.diffSynthesisPlan)(plan, snapshot);
    strict_1.default.equal(report.hasBlockingDrift, true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'column'), true);
    strict_1.default.equal(report.differences.some((difference) => difference.kind === 'relationship'), true);
});
(0, node_test_1.default)('emitGeneratedMetadataSolution writes a tracked solution-source tree', async () => {
    const plan = (0, index_1.planDataverseSynthesis)(approval_request_v1_model_json_1.default);
    const outputRoot = node_path_1.default.join(process.cwd(), 'dist', 'test-output');
    await (0, index_1.emitGeneratedMetadataSolution)(plan, outputRoot);
    const solutionXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Other', 'Solution.xml'), 'utf8');
    const entityXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'Entity.xml'), 'utf8');
    const relationshipFileName = `${plan.relationships[0]?.schemaName}.xml`.replace(/[^A-Za-z0-9_.-]/g, '_');
    const relationshipXml = await node_fs_1.promises.readFile(node_path_1.default.join(outputRoot, 'src', 'Other', 'Relationships', relationshipFileName), 'utf8');
    strict_1.default.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
    strict_1.default.match(entityXml, /dbm_request/);
    strict_1.default.match(relationshipXml, /dbm_request_dbm_requestdecision/);
    await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
});
