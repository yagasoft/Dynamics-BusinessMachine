import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';

const [toolRelativePath, ...toolArgs] = process.argv.slice(2);
if (!toolRelativePath) {
  throw new Error('Usage: run-node-tool-with-real-root.mjs <tool-relative-path> [...args]');
}

const packageRoot = realpathSync(process.cwd());
const toolPath = join(packageRoot, toolRelativePath);

const result = spawnSync(process.execPath, [toolPath, ...toolArgs], {
  cwd: packageRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
