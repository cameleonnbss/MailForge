// language: JavaScript, file: scripts/preview.js
// Zero-dependency static server for the renderer. Useful to review the interface
// in a plain browser (the in-renderer mock bridge supplies demo data) without
// launching Electron. Run: npm run preview
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 4321;
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = clean === '/' ? '/index.html' : clean;
  const candidates = [path.join(ROOT, 'src', 'renderer', relative), path.join(ROOT, relative)];
  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = http.createServer((request, response) => {
  const file = resolve(request.url);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('404');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`MailForge preview: http://${HOST}:${PORT} (mock bridge, no real sending)\n`);
});
