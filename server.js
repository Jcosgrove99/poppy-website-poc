// Zero-dependency server for the Poppy POC.
// Serves the static site and makes poppy.json editable over HTTP.
// poppy.json lives at two paths that are always kept identical:
//   /poppy.json                 (root copy)
//   /.well-known/poppy.json     (the Personal Agent Protocol location)
//   GET  either path  -> returns poppy.json
//   PUT  either path  -> validates JSON and writes BOTH copies to disk
//   POST either path  -> same as PUT
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const POPPY_FILES = [
  path.join(ROOT, 'poppy.json'),
  path.join(ROOT, '.well-known', 'poppy.json'),
];
const POPPY_PATHS = ['/poppy.json', '/.well-known/poppy.json'];
const PORT = process.env.PORT || 3000;
const MAX_BODY = 1024 * 1024; // 1 MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function handleWrite(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      return send(res, 400, JSON.stringify({ ok: false, error: 'Invalid JSON: ' + err.message }), MIME['.json']);
    }
    const pretty = JSON.stringify(parsed, null, 2) + '\n';
    try {
      for (const file of POPPY_FILES) {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(file, pretty, 'utf8');
      }
    } catch (err) {
      return send(res, 500, JSON.stringify({ ok: false, error: String(err) }), MIME['.json']);
    }
    send(res, 200, JSON.stringify({ ok: true, bytes: Buffer.byteLength(pretty), files: POPPY_PATHS }), MIME['.json']);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (POPPY_PATHS.includes(pathname) && (req.method === 'PUT' || req.method === 'POST')) {
    return handleWrite(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed');
  }

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(PORT, () => {
  console.log(`Poppy site running at http://localhost:${PORT}`);
  console.log(`Editable file exposed at http://localhost:${PORT}/poppy.json and http://localhost:${PORT}/.well-known/poppy.json`);
});
