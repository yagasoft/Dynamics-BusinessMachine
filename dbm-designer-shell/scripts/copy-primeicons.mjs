import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(import.meta.dirname, '../node_modules/primeicons/fonts');
const bundleRoot = path.resolve(import.meta.dirname, '../../dbm-app/bundle');
const files = ['primeicons.eot', 'primeicons.svg', 'primeicons.ttf', 'primeicons.woff', 'primeicons.woff2'];

fs.mkdirSync(bundleRoot, { recursive: true });
for (const file of files) {
  const sourcePath = path.join(sourceRoot, file);
  const targetPath = path.join(bundleRoot, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}
