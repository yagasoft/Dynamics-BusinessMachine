import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { applySynthesisPlanToDev } from './apply';
import { diffSynthesisPlan } from './diff';
import { emitGeneratedMetadataSolution } from './emit';
import { loadModelFromFile, writeJsonFile } from './io';
import { planDataverseSynthesis } from './plan';
import { readbackDataverseMetadata } from './readback';

function getArgument(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const modelPath = getArgument('--model');
  if (!command || !modelPath) {
    throw new Error('Usage: node dist/cli.js <plan|emit-source|readback|diff|apply-dev> --model <path> [options]');
  }

  const resolvedModelPath = path.resolve(modelPath);
  const model = await loadModelFromFile(resolvedModelPath);
  const plan = planDataverseSynthesis(model);

  switch (command) {
    case 'plan': {
      const output = getArgument('--output');
      if (!output) {
        throw new Error('plan requires --output');
      }

      await writeJsonFile(path.resolve(output), plan);
      return;
    }
    case 'emit-source': {
      const outputRoot = getArgument('--output-root');
      if (!outputRoot) {
        throw new Error('emit-source requires --output-root');
      }

      await emitGeneratedMetadataSolution(plan, path.resolve(outputRoot));
      return;
    }
    case 'readback': {
      const dataverseUrl = getArgument('--dataverse-url');
      const output = getArgument('--output');
      const accessToken = process.env.DBM_DATAVERSE_ACCESS_TOKEN;
      if (!dataverseUrl || !output || !accessToken) {
        throw new Error('readback requires --dataverse-url, --output, and DBM_DATAVERSE_ACCESS_TOKEN');
      }

      const snapshot = await readbackDataverseMetadata(plan, { dataverseUrl }, { accessToken });
      await writeJsonFile(path.resolve(output), snapshot);
      return;
    }
    case 'diff': {
      const snapshotPath = getArgument('--snapshot');
      const output = getArgument('--output');
      if (!snapshotPath || !output) {
        throw new Error('diff requires --snapshot and --output');
      }

      const snapshot = JSON.parse(await readFile(path.resolve(snapshotPath), 'utf8'));
      const report = diffSynthesisPlan(plan, snapshot);
      await writeJsonFile(path.resolve(output), report);
      return;
    }
    case 'apply-dev': {
      const dataverseUrl = getArgument('--dataverse-url');
      const output = getArgument('--output');
      const accessToken = process.env.DBM_DATAVERSE_ACCESS_TOKEN;
      if (!dataverseUrl || !output || !accessToken) {
        throw new Error('apply-dev requires --dataverse-url, --output, and DBM_DATAVERSE_ACCESS_TOKEN');
      }

      const report = await applySynthesisPlanToDev(plan, { dataverseUrl }, { accessToken });
      await writeJsonFile(path.resolve(output), report);
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
