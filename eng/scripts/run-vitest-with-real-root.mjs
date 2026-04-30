import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';

const packageRoot = realpathSync(process.cwd());
const vitestPath = join(packageRoot, 'node_modules', 'vitest', 'vitest.mjs');
const args = [vitestPath, '--root', packageRoot, ...process.argv.slice(2)];

const result = spawnSync(process.execPath, args, {
  cwd: packageRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
