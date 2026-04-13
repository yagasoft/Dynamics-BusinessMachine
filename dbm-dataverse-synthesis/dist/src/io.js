"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadModelFromFile = loadModelFromFile;
exports.writeJsonFile = writeJsonFile;
exports.getGeneratedMetadataTemplateRoot = getGeneratedMetadataTemplateRoot;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
async function loadModelFromFile(filePath) {
    const content = await node_fs_1.promises.readFile(filePath, 'utf8');
    return JSON.parse(content);
}
async function writeJsonFile(filePath, payload) {
    await node_fs_1.promises.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    await node_fs_1.promises.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
function getGeneratedMetadataTemplateRoot(repoRoot) {
    return node_path_1.default.join(repoRoot, 'power-platform', 'solutions', 'DynamicsBusinessMachineGeneratedMetadata', 'template');
}
