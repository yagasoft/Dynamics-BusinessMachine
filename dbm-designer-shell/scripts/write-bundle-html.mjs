import fs from 'node:fs';
import path from 'node:path';

const bundleRoot = path.resolve(import.meta.dirname, '../../dbm-app/bundle');
const htmlPath = path.join(bundleRoot, 'index.html');
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dynamics Business Machine Designer</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./bundle.js"></script>
  </body>
</html>
`;

fs.mkdirSync(bundleRoot, { recursive: true });
fs.writeFileSync(htmlPath, html, 'utf8');
