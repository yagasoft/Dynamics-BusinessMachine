import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '../../dbm-app/bundle/bundle.js');

const bundle = fs.readFileSync(bundlePath, 'utf8');

if (bundle.includes('process.env.NODE_ENV')) {
  throw new Error(
    `Browser bundle regression: ${bundlePath} still contains raw process.env.NODE_ENV checks.`
  );
}

console.log(`Verified browser bundle is free of raw process.env.NODE_ENV checks: ${bundlePath}`);
