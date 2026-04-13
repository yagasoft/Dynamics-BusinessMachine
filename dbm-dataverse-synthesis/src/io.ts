import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DbmModelV1 } from 'dbm-contract';

export async function loadModelFromFile(filePath: string): Promise<DbmModelV1> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as DbmModelV1;
}

export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function getGeneratedMetadataTemplateRoot(repoRoot: string): string {
  return path.join(repoRoot, 'power-platform', 'solutions', 'DynamicsBusinessMachineGeneratedMetadata', 'template');
}
