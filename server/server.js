/* ═══════════════════════════════════════════════════════════
   Servidor próprio (Docker / VPS)
   Serve o site, o painel, os arquivos enviados (/uploads/) e as
   mesmas rotas de /api usadas na Vercel — sem dependências extras.
   ═══════════════════════════════════════════════════════════ */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA = process.env.DATA_DIR;
const PORT = Number(process.env.PORT) || 3000;

// rotas de /api (os mesmos arquivos da Vercel)
const API = new Set(['login', 'logout', 'me', 'content', 'media', 'upload', 'upload-file']);
// só isto do projeto é público — nada de api/, server/, data/, .env, .git…
const PUBLIC_FILES = new Set(['index.html', 'content.json']);
const PUBLIC_DIRS = ['assets/', 'admin/'];
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function send(res, code, text) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

// dá ao req/res o mesmo formato das funções da Vercel
function vercelize(req, res, url) {
  req.query = Object.fromEntries(url.searchParams);
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => {
    const i = c.indexOf('=');
    try { return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; } catch { return [c.slice(0, i), c.slice(i + 1)]; }
  }));
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const handlers = new Map();
async function handler(name) {
  if (!handlers.has(name)) {
    const mod = await import(pathToFileURL(path.join(ROOT, 'api', `${name}.js`)).href);
    handlers.set(name, mod.default);
  }
  return handlers.get(name);
}

// arquivo estático com cache, ETag e Range (necessário para vídeo)
async function serveFile(req, res, file, { cacheControl, headers = {} } = {}) {
  const st = await fsp.stat(file).catch(() => null);
  if (!st || !st.isFile()) return false;
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Last-Modified', st.mtime.toUTCString());
  res.setHeader('ETag', etag);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return true; }

  let start = 0, end = st.size - 1;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(Number(m[2]), st.size - 1); }
    else start = Math.max(0, st.size - Number(m[2]));
    if (start > end || start >= st.size) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${st.size}`);
      res.end();
      return true;
    }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
  }
  res.setHeader('Content-Length', st.size ? end - start + 1 : 0);
  if (req.method === 'HEAD' || !st.size) { res.end(); return true; }
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (p === '/healthz') return send(res, 200, 'ok');

    // ── API ──
    const api = /^\/api\/([a-z-]+)\/?$/.exec(p);
    if (api) {
      vercelize(req, res, url);
      if (!API.has(api[1])) return res.status(404).json({ error: 'Rota não encontrada.' });
      // o envio direto lê o corpo em streaming; o resto recebe JSON já interpretado
      if (api[1] !== 'upload-file' && !['GET', 'HEAD'].includes(req.method)) {
        const raw = await readBody(req, 5 * 1048576);
        const type = req.headers['content-type'] || '';
        if (raw.length && type.includes('application/json')) {
          try { req.body = JSON.parse(raw.toString('utf8')); }
          catch { return res.status(400).json({ error: 'JSON inválido.' }); }
        } else {
          req.body = raw.length ? raw.toString('utf8') : undefined;
        }
      }
      const h = await handler(api[1]);
      await h(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    // ── arquivos enviados pelo painel ──
    if (p.startsWith('/uploads/')) {
      const name = p.slice('/uploads/'.length);
      const cache = { cacheControl: 'public, max-age=31536000, immutable' };
      // primeiro os enviados pelo painel (volume de dados); depois a pasta uploads/ do projeto (modo de teste)
      if (SAFE_NAME.test(name) && (await serveFile(req, res, path.join(DATA, 'uploads', name), cache)
        || await serveFile(req, res, path.join(ROOT, 'uploads', name), cache))) return;
      return send(res, 404, 'Not found');
    }

    // ── site e painel ──
    if (p === '/admin') { res.statusCode = 301; res.setHeader('Location', '/admin/'); return res.end(); }
    let rel = p.replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    rel = path.posix.normalize(rel);
    const hidden = rel.startsWith('..') || rel.split('/').some(s => s.startsWith('.'));
    const allowed = !hidden && (PUBLIC_FILES.has(rel) || PUBLIC_DIRS.some(d => rel.startsWith(d)));
    if (allowed) {
      const isAdmin = rel.startsWith('admin/');
      const headers = isAdmin
        ? { 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' }
        : {};
      const cacheControl = isAdmin || rel.endsWith('.html') || rel === 'content.json' ? 'no-cache' : 'public, max-age=3600';
      if (await serveFile(req, res, path.join(ROOT, rel), { cacheControl, headers })) return;
    }
    return send(res, 404, 'Not found');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, e.status === 413 ? 'Payload too large' : 'Erro interno');
    else res.destroy();
  }
});

server.requestTimeout = 0;      // vídeos grandes podem demorar para subir
server.headersTimeout = 60_000;
server.keepAliveTimeout = 65_000;

server.listen(PORT, () => {
  console.log(`Portfólio no ar na porta ${PORT} — dados em ${DATA}`);
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) console.warn('Aviso: defina ADMIN_USER e ADMIN_PASSWORD para liberar o painel.');
});

const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
