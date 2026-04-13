"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const apply_1 = require("./apply");
const diff_1 = require("./diff");
const emit_1 = require("./emit");
const io_1 = require("./io");
const plan_1 = require("./plan");
const readback_1 = require("./readback");
function getArgument(name) {
    const index = process.argv.indexOf(name);
    if (index === -1 || index === process.argv.length - 1) {
        return null;
    }
    return process.argv[index + 1] ?? null;
}
async function main() {
    const command = process.argv[2];
    const modelPath = getArgument('--model');
    if (!command || !modelPath) {
        throw new Error('Usage: node dist/cli.js <plan|emit-source|readback|diff|apply-dev> --model <path> [options]');
    }
    const resolvedModelPath = node_path_1.default.resolve(modelPath);
    const model = await (0, io_1.loadModelFromFile)(resolvedModelPath);
    const plan = (0, plan_1.planDataverseSynthesis)(model);
    switch (command) {
        case 'plan': {
            const output = getArgument('--output');
            if (!output) {
                throw new Error('plan requires --output');
            }
            await (0, io_1.writeJsonFile)(node_path_1.default.resolve(output), plan);
            return;
        }
        case 'emit-source': {
            const outputRoot = getArgument('--output-root');
            if (!outputRoot) {
                throw new Error('emit-source requires --output-root');
            }
            await (0, emit_1.emitGeneratedMetadataSolution)(plan, node_path_1.default.resolve(outputRoot));
            return;
        }
        case 'readback': {
            const dataverseUrl = getArgument('--dataverse-url');
            const output = getArgument('--output');
            const accessToken = process.env.DBM_DATAVERSE_ACCESS_TOKEN;
            if (!dataverseUrl || !output || !accessToken) {
                throw new Error('readback requires --dataverse-url, --output, and DBM_DATAVERSE_ACCESS_TOKEN');
            }
            const snapshot = await (0, readback_1.readbackDataverseMetadata)(plan, { dataverseUrl }, { accessToken });
            await (0, io_1.writeJsonFile)(node_path_1.default.resolve(output), snapshot);
            return;
        }
        case 'diff': {
            const snapshotPath = getArgument('--snapshot');
            const output = getArgument('--output');
            if (!snapshotPath || !output) {
                throw new Error('diff requires --snapshot and --output');
            }
            const snapshot = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.resolve(snapshotPath), 'utf8'));
            const report = (0, diff_1.diffSynthesisPlan)(plan, snapshot);
            await (0, io_1.writeJsonFile)(node_path_1.default.resolve(output), report);
            return;
        }
        case 'apply-dev': {
            const dataverseUrl = getArgument('--dataverse-url');
            const output = getArgument('--output');
            const accessToken = process.env.DBM_DATAVERSE_ACCESS_TOKEN;
            if (!dataverseUrl || !output || !accessToken) {
                throw new Error('apply-dev requires --dataverse-url, --output, and DBM_DATAVERSE_ACCESS_TOKEN');
            }
            const report = await (0, apply_1.applySynthesisPlanToDev)(plan, { dataverseUrl }, { accessToken });
            await (0, io_1.writeJsonFile)(node_path_1.default.resolve(output), report);
            return;
        }
        default:
            throw new Error(`Unsupported command '${command}'.`);
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
