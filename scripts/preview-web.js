// Static, loopback-only preview of the packaged site. No microphone/API requests are proxied.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Static visual preview only.'); }
  let target;
  try { const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)); }
  catch { res.writeHead(400); return res.end(); }
  if (!target.startsWith(root + path.sep) || !mime[path.extname(target)] || path.relative(root, target).split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(404); return res.end(); }
  fs.readFile(target, (error, bytes) => {
    if (error) { res.writeHead(404); return res.end('Run npm run package:web before previewing.'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
}).listen(8976, '127.0.0.1', () => console.log('Visual preview: http://127.0.0.1:8976/v2-ai-audience.html'));
