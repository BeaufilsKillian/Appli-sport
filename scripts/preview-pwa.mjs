import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import update from '../api/update.ts';
const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.css': 'text/css', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    if (url.pathname === '/api/update') return update({ method: req.method, query: Object.fromEntries(url.searchParams) }, {
      setHeader: res.setHeader.bind(res), status(code) { res.statusCode = code; return this; }, send(body) { res.end(body); }, end() { res.end(); },
    });
    const guidePage = ['/guide', '/guide/', '/api/guide'].includes(url.pathname);
    if (url.pathname.startsWith('/api/') && !guidePage) {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.writeHead(url.pathname === '/api/config' ? 200 : 503);
      return res.end(JSON.stringify(url.pathname === '/api/config' ? { cloud: false } : { error: 'Connexion Neon non configurée en aperçu local.' }));
    }
    const relative = guidePage ? 'guide/index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', relative === 'sw.js' || relative.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600');
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(500); res.end('Preview error'); }
}).listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () => console.log(`Aperçu PWA : http://127.0.0.1:${process.env.PORT ?? 4173}`));
