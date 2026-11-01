// Minimal static server for the exported web app (SPA: unknown paths fall back to index.html).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_WEB_PORT } from './ports.mjs';

const root = fileURLToPath(new URL('../dist-e2e', import.meta.url));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory())
    file = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(E2E_WEB_PORT, '127.0.0.1');
