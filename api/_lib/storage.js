/* ═══════════════════════════════════════════════════════════
   Armazenamento do conteúdo e dos arquivos enviados.
   - Vercel: Vercel Blob (quando existe BLOB_READ_WRITE_TOKEN)
   - Servidor próprio / Docker: pasta DATA_DIR no disco
       DATA_DIR/content/<timestamp>.json   versões do conteúdo
       DATA_DIR/uploads/<arquivo>          fotos e vídeos (servidos em /uploads/)
   ═══════════════════════════════════════════════════════════ */
import fsp from 'node:fs/promises';
import path from 'node:path';

const KEEP = 20; // versões do conteúdo guardadas como histórico

export const mode = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : process.env.DATA_DIR ? 'fs' : null);

const dataDir = () => path.resolve(process.env.DATA_DIR || 'data');
export const uploadsDir = () => path.join(dataDir(), 'uploads');
const contentDir = () => path.join(dataDir(), 'content');

const bad = msg => Object.assign(new Error(msg), { status: 400 });
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// o pacote do Vercel Blob só é carregado quando for usado
let blobMod = null;
const blob = async () => (blobMod ||= await import('@vercel/blob'));

async function blobList(prefix) {
  const { list } = await blob();
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

async function readdirSafe(dir) {
  try { return await fsp.readdir(dir); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

/* ══ conteúdo ══ */
export async function getContent() {
  if (mode() === 'blob') {
    const v = (await blobList('content/')).sort((a, b) => byName(a.pathname, b.pathname));
    const last = v[v.length - 1];
    if (!last) return null;
    const r = await fetch(last.url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`blob ${r.status}`);
    return r.json();
  }
  const names = (await readdirSafe(contentDir())).filter(n => /^\d+\.json$/.test(n)).sort(byName);
  if (!names.length) return null;
  return JSON.parse(await fsp.readFile(path.join(contentDir(), names[names.length - 1]), 'utf8'));
}

export async function saveContent(json) {
  // timestamp com tamanho fixo → ordem alfabética = ordem de publicação
  const name = `${String(Date.now()).padStart(15, '0')}.json`;
  if (mode() === 'blob') {
    const { put, del } = await blob();
    await put('content/' + name, json, { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 });
    const v = (await blobList('content/')).sort((a, b) => byName(a.pathname, b.pathname));
    const old = v.slice(0, Math.max(0, v.length - KEEP));
    if (old.length) await del(old.map(b => b.url));
    return;
  }
  const dir = contentDir();
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${name}.tmp`);
  await fsp.writeFile(tmp, json);
  await fsp.rename(tmp, path.join(dir, name)); // grava de forma atômica
  const names = (await readdirSafe(dir)).filter(n => /^\d+\.json$/.test(n)).sort(byName);
  for (const n of names.slice(0, Math.max(0, names.length - KEEP))) await fsp.rm(path.join(dir, n), { force: true });
}

/* ══ arquivos enviados ══ */
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.(public\.)?blob\.vercel-storage\.com\/uploads\//i;
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

export async function listUploads() {
  if (mode() === 'blob') {
    return (await blobList('uploads/'))
      .map(b => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }
  const dir = uploadsDir();
  const out = [];
  for (const n of await readdirSafe(dir)) {
    if (!SAFE_NAME.test(n)) continue; // ignora temporários (.parte) e ocultos
    const st = await fsp.stat(path.join(dir, n)).catch(() => null);
    if (st && st.isFile()) out.push({ url: `/uploads/${n}`, pathname: `uploads/${n}`, size: st.size, uploadedAt: st.mtime });
  }
  return out.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function deleteUpload(url) {
  if (mode() === 'blob') {
    if (!BLOB_URL.test(url)) throw bad('Arquivo inválido.');
    const { del } = await blob();
    await del(url);
    return;
  }
  const m = /^\/uploads\/(.+)$/.exec(url);
  if (!m || !SAFE_NAME.test(m[1])) throw bad('Arquivo inválido.');
  await fsp.rm(path.join(uploadsDir(), m[1]), { force: true });
}
