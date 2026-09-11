/* ═══════════════════════════════════════════════════════════
   /api/content
   GET  → conteúdo publicado (público; o site lê daqui)
   PUT  → salva o conteúdo (só com login)
   Cada publicação vira uma versão nova em content/ no Vercel Blob;
   as 20 mais recentes ficam guardadas como histórico.
   ═══════════════════════════════════════════════════════════ */
import { list, put, del } from '@vercel/blob';
import { requireAdmin, hasStorage } from './_lib/auth.js';

const PREFIX = 'content/';
const KEEP = 20;

async function versions() {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  // nomes com timestamp de tamanho fixo → ordem alfabética = ordem de publicação
  return out.sort((a, b) => (a.pathname < b.pathname ? -1 : 1));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const fresh = req.query && 'fresh' in req.query;
    res.setHeader('Cache-Control', fresh ? 'private, no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
    if (!hasStorage()) return res.status(404).json({ error: 'Armazenamento não configurado.' });
    try {
      const v = await versions();
      const last = v[v.length - 1];
      if (!last) return res.status(404).json({ error: 'Nada publicado ainda.' });
      const r = await fetch(last.url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`blob ${r.status}`);
      return res.status(200).json(await r.json());
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ error: 'Não foi possível ler o conteúdo.' });
    }
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    if (!hasStorage()) {
      return res.status(500).json({ error: 'Armazenamento não configurado: conecte um Blob Store (público) ao projeto na Vercel e faça um novo deploy.' });
    }
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.projects)) {
      return res.status(400).json({ error: 'Conteúdo inválido.' });
    }
    const json = JSON.stringify(data, null, 2);
    if (json.length > 3_000_000) return res.status(413).json({ error: 'Conteúdo grande demais.' });
    try {
      const name = `${PREFIX}${String(Date.now()).padStart(15, '0')}.json`;
      await put(name, json, { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 });
      // mantém só as versões mais recentes
      const v = await versions();
      const old = v.slice(0, Math.max(0, v.length - KEEP));
      if (old.length) await del(old.map(b => b.url));
      return res.status(200).json({ ok: true, savedAt: Date.now() });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Falha ao salvar.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Método não permitido.' });
}
