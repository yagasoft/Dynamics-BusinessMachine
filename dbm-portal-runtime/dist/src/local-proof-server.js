import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePortalRuntimeBootstrap } from './bootstrap.js';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_AZURE_CLI_WINDOWS_PATHS = [
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.exe',
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd',
    'C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.exe',
    'C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd'
];
function resolveRepoRoot(repoRoot) {
    if (repoRoot?.trim()) {
        return path.resolve(repoRoot);
    }
    const currentFile = fileURLToPath(import.meta.url);
    return path.resolve(path.dirname(currentFile), '../../..');
}
function getDefaultDistRoot(repoRoot) {
    return path.join(repoRoot, 'dbm-portal-runtime', 'dist', 'spa');
}
async function readJsonFile(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}
function splitPathEntries(value) {
    return (value ?? '')
        .split(path.delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
async function resolvePortalRuntimeMetadata(options, repoRoot) {
    if (options.bootstrap && options.runtimeModel) {
        return {
            bootstrap: options.bootstrap,
            runtimeModel: options.runtimeModel,
            hostPackageName: options.hostPackageName ?? 'dbm-portal-runtime'
        };
    }
    const planPath = path.join(repoRoot, 'power-platform', 'solutions', 'DynamicsBusinessMachineGeneratedMetadata', 'source', 'dbm-generated-metadata.plan.json');
    const plan = await readJsonFile(planPath);
    if (!plan.portalRuntime?.bootstrap || !plan.portalRuntime.processExperienceRuntime) {
        throw new Error(`Generated metadata plan '${planPath}' is missing portalRuntime bootstrap/runtime content.`);
    }
    return {
        bootstrap: parsePortalRuntimeBootstrap(plan.portalRuntime.bootstrap),
        runtimeModel: plan.portalRuntime.processExperienceRuntime,
        hostPackageName: plan.portalRuntime.hostPackageName ?? 'dbm-portal-runtime'
    };
}
async function resolveEnvironmentConfig(options, repoRoot) {
    if (options.environment?.trim() && options.dataverseUrl?.trim()) {
        return {
            environment: options.environment.trim(),
            dataverseUrl: options.dataverseUrl.trim()
        };
    }
    const configPath = path.join(repoRoot, 'azure', 'config', 'dev.json');
    const config = await readJsonFile(configPath);
    if (!config.dataverseUrl?.trim()) {
        throw new Error(`Environment config '${configPath}' is missing dataverseUrl.`);
    }
    return {
        environment: config.environment?.trim() || 'Dev',
        dataverseUrl: config.dataverseUrl.trim()
    };
}
function getDataverseApiBaseUrl(dataverseUrl) {
    return `${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2`;
}
function normalizeGuid(id) {
    return id.replace(/[{}]/g, '');
}
function getPrimaryIdAttribute(bootstrap) {
    return `${bootstrap.requestEntityLogicalName}id`;
}
function buildSelectFields(bootstrap) {
    const unique = new Set([
        getPrimaryIdAttribute(bootstrap),
        'dbm_title',
        ...bootstrap.entryFields.map((field) => field.logicalName),
        bootstrap.runtimeStateFieldLogicalNames.stageId,
        bootstrap.runtimeStateFieldLogicalNames.stepId,
        bootstrap.runtimeStateFieldLogicalNames.formStateId,
        bootstrap.runtimeStateFieldLogicalNames.internalStatusId,
        bootstrap.runtimeStateFieldLogicalNames.portalStatusId,
        bootstrap.runtimeStateFieldLogicalNames.portalProfileKey
    ]);
    return Array.from(unique).filter(Boolean);
}
function buildRequestReference(bootstrap, values) {
    const title = values.dbm_title;
    if (typeof title === 'string' && title.trim()) {
        return title.trim();
    }
    for (const field of bootstrap.entryFields) {
        const candidate = values[field.logicalName];
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }
    const recordId = values[getPrimaryIdAttribute(bootstrap)];
    return typeof recordId === 'string' && recordId.trim() ? normalizeGuid(recordId) : null;
}
function toPortalRuntimeRecord(bootstrap, values) {
    const primaryIdAttribute = getPrimaryIdAttribute(bootstrap);
    const id = values[primaryIdAttribute];
    if (typeof id !== 'string' || !id.trim()) {
        throw new Error(`Dataverse did not return '${primaryIdAttribute}' for the portal runtime record.`);
    }
    return {
        id: normalizeGuid(id),
        values,
        runtimeState: {
            stageId: values[bootstrap.runtimeStateFieldLogicalNames.stageId] ?? bootstrap.defaultState.stageId,
            stepId: values[bootstrap.runtimeStateFieldLogicalNames.stepId] ?? bootstrap.defaultState.stepId,
            formStateId: values[bootstrap.runtimeStateFieldLogicalNames.formStateId] ?? bootstrap.defaultState.formStateId,
            internalStatusId: values[bootstrap.runtimeStateFieldLogicalNames.internalStatusId] ?? bootstrap.defaultState.internalStatusId,
            portalStatusId: values[bootstrap.runtimeStateFieldLogicalNames.portalStatusId] ?? bootstrap.defaultState.portalStatusId
        },
        requestReference: buildRequestReference(bootstrap, values)
    };
}
function extractCreatedRecordId(bootstrap, response, payloadText) {
    const entityUrl = response.headers.get('OData-EntityId') ?? response.headers.get('odata-entityid') ?? '';
    const match = /\(([0-9a-fA-F-]{36})\)$/.exec(entityUrl);
    if (match?.[1]) {
        return normalizeGuid(match[1]);
    }
    if (payloadText.trim()) {
        const payload = JSON.parse(payloadText);
        const value = payload[getPrimaryIdAttribute(bootstrap)];
        if (typeof value === 'string' && value.trim()) {
            return normalizeGuid(value);
        }
    }
    throw new Error('Dataverse create response did not include the created request id.');
}
async function invokeDataverse(fetchImpl, dataverseUrl, accessToken, method, relativePath, body, additionalHeaders) {
    const response = await fetchImpl(`${getDataverseApiBaseUrl(dataverseUrl)}/${relativePath}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': JSON_CONTENT_TYPE,
            'OData-Version': '4.0',
            'OData-MaxVersion': '4.0',
            ...additionalHeaders
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payloadText = await response.text();
    if (!response.ok) {
        throw new Error(`Dataverse ${method} ${relativePath} failed with status ${response.status}.${payloadText ? ` ${payloadText}` : ''}`);
    }
    return { response, payloadText };
}
async function retrievePortalRuntimeRecord(fetchImpl, dataverseUrl, accessToken, bootstrap, requestId) {
    const selectClause = buildSelectFields(bootstrap).join(',');
    const { payloadText } = await invokeDataverse(fetchImpl, dataverseUrl, accessToken, 'GET', `${bootstrap.requestEntitySetName}(${normalizeGuid(requestId)})?$select=${encodeURIComponent(selectClause)}`);
    return toPortalRuntimeRecord(bootstrap, JSON.parse(payloadText));
}
async function readRequestBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function writeJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', JSON_CONTENT_TYPE);
    response.end(`${JSON.stringify(payload, null, 2)}\n`);
}
function writeBody(response, statusCode, content, contentType) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', contentType);
    response.end(content);
}
function guessContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
            return 'application/javascript; charset=utf-8';
        case '.css':
            return 'text/css; charset=utf-8';
        case '.json':
            return JSON_CONTENT_TYPE;
        case '.svg':
            return 'image/svg+xml';
        case '.png':
            return 'image/png';
        default:
            return 'application/octet-stream';
    }
}
async function acquireAzureCliAccessToken(dataverseUrl) {
    const azureCliArgs = ['account', 'get-access-token', '--resource', dataverseUrl.replace(/\/$/, ''), '--output', 'json'];
    let command = 'az';
    let args = azureCliArgs;
    if (process.platform === 'win32') {
        const pathCandidates = [
            ...splitPathEntries(process.env.PATH).flatMap((entry) => [
                path.join(entry, 'az.exe'),
                path.join(entry, 'az.cmd')
            ]),
            ...DEFAULT_AZURE_CLI_WINDOWS_PATHS
        ];
        let resolvedAzureCliPath = null;
        for (const candidate of pathCandidates) {
            if (await fileExists(candidate)) {
                resolvedAzureCliPath = candidate;
                break;
            }
        }
        if (resolvedAzureCliPath?.toLowerCase().endsWith('.cmd')) {
            const escapedAzureCliPath = resolvedAzureCliPath.replace(/'/g, "''");
            const escapedDataverseUrl = dataverseUrl.replace(/\/$/, '').replace(/'/g, "''");
            args = [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                `& '${escapedAzureCliPath}' account get-access-token --resource '${escapedDataverseUrl}' --output json`
            ];
            command = process.env.SystemRoot
                ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
                : 'powershell.exe';
        }
        else if (resolvedAzureCliPath) {
            command = resolvedAzureCliPath;
        }
    }
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => {
            reject(error);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Azure CLI failed to acquire a Dataverse access token.${stderr.trim() ? ` ${stderr.trim()}` : ''}`));
                return;
            }
            const payload = JSON.parse(stdout);
            if (!payload.accessToken?.trim()) {
                reject(new Error('Azure CLI did not return an access token for Dataverse.'));
                return;
            }
            const expiresOn = payload.expiresOn ? Date.parse(payload.expiresOn) : Number.NaN;
            resolve({
                accessToken: payload.accessToken.trim(),
                expiresOn: Number.isNaN(expiresOn) ? null : expiresOn
            });
        });
    });
}
async function fileExists(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.isFile();
    }
    catch {
        return false;
    }
}
export async function createPortalRuntimeLocalProofServer(options = {}) {
    const repoRoot = resolveRepoRoot(options.repoRoot);
    const environmentConfig = await resolveEnvironmentConfig(options, repoRoot);
    const metadata = await resolvePortalRuntimeMetadata(options, repoRoot);
    const distRoot = path.resolve(options.distRoot ?? getDefaultDistRoot(repoRoot));
    const host = options.host ?? DEFAULT_HOST;
    const port = options.port ?? DEFAULT_PORT;
    const fetchImpl = options.fetchImpl ?? fetch;
    const logger = options.logger ?? {};
    if (!await fileExists(path.join(distRoot, 'index.html'))) {
        throw new Error(`Local SPA build output is missing from '${distRoot}'. Run 'npm run build' in dbm-portal-runtime first.`);
    }
    let cachedAccessToken = null;
    const getAccessToken = options.getAccessToken ?? (async () => {
        const now = Date.now();
        if (cachedAccessToken?.value && (!cachedAccessToken.expiresAt || cachedAccessToken.expiresAt - now > 300_000)) {
            return cachedAccessToken.value;
        }
        const token = await acquireAzureCliAccessToken(environmentConfig.dataverseUrl);
        cachedAccessToken = {
            value: token.accessToken,
            expiresAt: token.expiresOn
        };
        return token.accessToken;
    });
    async function handleApiRequest(request, response, pathname) {
        if (request.method === 'GET' && pathname === '/api/runtime/health') {
            writeJson(response, 200, {
                status: 'ready',
                environment: environmentConfig.environment,
                dataverseUrl: environmentConfig.dataverseUrl,
                hostPackageName: metadata.hostPackageName,
                routes: metadata.bootstrap.routes
            });
            return;
        }
        const accessToken = await getAccessToken();
        if (request.method === 'POST' && pathname === '/api/runtime/drafts') {
            const payload = await readRequestBody(request);
            const createResult = await invokeDataverse(fetchImpl, environmentConfig.dataverseUrl, accessToken, 'POST', metadata.bootstrap.requestEntitySetName, payload, { Prefer: 'return=representation' });
            const requestId = extractCreatedRecordId(metadata.bootstrap, createResult.response, createResult.payloadText);
            const record = await retrievePortalRuntimeRecord(fetchImpl, environmentConfig.dataverseUrl, accessToken, metadata.bootstrap, requestId);
            writeJson(response, 201, record);
            return;
        }
        const getMatch = /^\/api\/runtime\/requests\/([^/]+)$/.exec(pathname);
        if (request.method === 'GET' && getMatch?.[1]) {
            const record = await retrievePortalRuntimeRecord(fetchImpl, environmentConfig.dataverseUrl, accessToken, metadata.bootstrap, getMatch[1]);
            writeJson(response, 200, record);
            return;
        }
        const submitMatch = /^\/api\/runtime\/requests\/([^/]+)\/submit$/.exec(pathname);
        if (request.method === 'POST' && submitMatch?.[1]) {
            await invokeDataverse(fetchImpl, environmentConfig.dataverseUrl, accessToken, 'PATCH', `${metadata.bootstrap.requestEntitySetName}(${normalizeGuid(submitMatch[1])})`, {
                [metadata.bootstrap.portalCommandFieldLogicalName]: 'submit'
            }, { 'If-Match': '*' });
            const record = await retrievePortalRuntimeRecord(fetchImpl, environmentConfig.dataverseUrl, accessToken, metadata.bootstrap, submitMatch[1]);
            writeJson(response, 200, record);
            return;
        }
        writeJson(response, 404, {
            message: `Unknown local proof API route '${pathname}'.`
        });
    }
    const server = createServer(async (request, response) => {
        const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
        const pathname = requestUrl.pathname;
        try {
            if (pathname.startsWith('/api/runtime/')) {
                await handleApiRequest(request, response, pathname);
                return;
            }
            const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
            const candidatePath = path.resolve(path.join(distRoot, relativePath));
            const staticRoot = `${distRoot}${path.sep}`;
            if (candidatePath.startsWith(staticRoot) && await fileExists(candidatePath)) {
                writeBody(response, 200, await fs.readFile(candidatePath), guessContentType(candidatePath));
                return;
            }
            const shouldServeSpa = request.method === 'GET' || request.method === 'HEAD';
            if (shouldServeSpa) {
                const indexPath = path.join(distRoot, 'index.html');
                writeBody(response, 200, await fs.readFile(indexPath), 'text/html; charset=utf-8');
                return;
            }
            response.statusCode = 405;
            response.end();
        }
        catch (error) {
            logger.error?.(error instanceof Error ? error.stack ?? error.message : String(error));
            writeJson(response, 500, {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve());
    });
    const address = server.address();
    const resolvedPort = typeof address === 'object' && address ? address.port : port;
    logger.info?.(`DBM local proof host ready at http://${host}:${resolvedPort}${metadata.bootstrap.routes.entryPath}`);
    return {
        server,
        host,
        port: resolvedPort,
        baseUrl: `http://${host}:${resolvedPort}`,
        close: () => new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
                if (error) {
                    rejectClose(error);
                    return;
                }
                resolveClose();
            });
        })
    };
}
