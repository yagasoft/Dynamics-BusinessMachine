import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import AjvImport from 'ajv';

import { liveE2ECaseSchema } from './case-schema.js';
import type { LiveE2ECaseDefinition, LiveE2EEnvironmentConfig, LiveE2ERunContext } from './types.js';

const AjvConstructor = AjvImport as unknown as new (options: { allErrors: boolean; strict: boolean }) => {
  compile: <T>(schema: object) => ((value: unknown) => value is T) & { errors?: Array<{ instancePath?: string; message?: string }> };
};

const ajv = new AjvConstructor({
  allErrors: true,
  strict: false
});

const validateCaseDefinition = ajv.compile<LiveE2ECaseDefinition>(liveE2ECaseSchema);

export function getRepoRoot(): string {
  return path.resolve(path.dirname(normalizePath(new URL(import.meta.url).pathname)), '..', '..');
}

function normalizePath(filePath: string): string {
  return process.platform === 'win32' && filePath.startsWith('/') ? filePath.slice(1) : filePath;
}

export function getCaseCatalogDirectory(repoRoot = getRepoRoot()): string {
  return path.join(repoRoot, 'eng', 'live-e2e', 'cases');
}

export function loadCaseCatalog(repoRoot = getRepoRoot()): LiveE2ECaseDefinition[] {
  const catalogDirectory = getCaseCatalogDirectory(repoRoot);
  const files = readdirSync(catalogDirectory)
    .filter((entry: string) => entry.endsWith('.json'))
    .sort((left: string, right: string) => left.localeCompare(right));

  const cases = files.map((fileName: string) => {
    const fullPath = path.join(catalogDirectory, fileName);
    const payload = JSON.parse(readFileSync(fullPath, 'utf8')) as LiveE2ECaseDefinition;
    if (!validateCaseDefinition(payload)) {
      const errors = (validateCaseDefinition.errors ?? [])
        .map((error: { instancePath?: string; message?: string }) => `${error.instancePath || '/'} ${error.message}`)
        .join('; ');
      throw new Error(`Live E2E case '${fileName}' is invalid: ${errors}`);
    }

    return payload;
  });

  const scenarioIds = new Set<string>();
  for (const item of cases) {
    if (scenarioIds.has(item.scenarioId)) {
      throw new Error(`Duplicate live E2E scenario id '${item.scenarioId}' was found in the case catalog.`);
    }

    scenarioIds.add(item.scenarioId);
  }

  return cases;
}

export function loadEnvironmentConfig(configPath: string): LiveE2EEnvironmentConfig {
  return parseJsonFile(normalizePath(configPath)) as LiveE2EEnvironmentConfig;
}

export function loadRunContext(contextPath: string): LiveE2ERunContext {
  return parseJsonFile(normalizePath(contextPath)) as LiveE2ERunContext;
}

export function selectCases(
  caseCatalog: LiveE2ECaseDefinition[],
  environmentConfig: LiveE2EEnvironmentConfig,
  caseSet: 'full' | 'promotion',
  explicitCaseIds?: string[]
): LiveE2ECaseDefinition[] {
  const selectedIds = explicitCaseIds && explicitCaseIds.length > 0
    ? explicitCaseIds
    : environmentConfig.liveE2E.caseSets[caseSet];

  return selectedIds.map((scenarioId) => {
    const entry = caseCatalog.find((item) => item.scenarioId === scenarioId);
    if (!entry) {
      throw new Error(`Live E2E case set '${caseSet}' references unknown scenario '${scenarioId}'.`);
    }

    if (!entry.runModes.includes(caseSet)) {
      throw new Error(`Live E2E scenario '${scenarioId}' does not declare support for run mode '${caseSet}'.`);
    }

    return entry;
  });
}

function parseJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf8');
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized);
}
