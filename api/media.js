/* ═══════════════════════════════════════════════════════════
   /api/media — arquivos enviados pelo painel (só com login)
   GET              → lista os arquivos em uploads/
   DELETE ?url=…    → apaga um arquivo
   ═══════════════════════════════════════════════════════════ */
import { list, del } from '@vercel/blob';
import { requireAdmin, hasStorage } from './_lib/auth.js';

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.(public\.)?blob\.vercel-storage\.com\/uploads\//i;

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!hasStorage()) return res.status(200).json({ files: [], storage: false });

  try {
    if (req.method === 'GET') {
      const files = [];
      let cursor;
      do {
        const r = await list({ prefix: 'uploads/', cursor, limit: 1000 });
        files.push(...r.blobs.map(b => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })));
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      return res.status(200).json({ files, storage: true });
    }

    if (req.method === 'DELETE') {
      const url = String((req.query && req.query.url) || '');
      if (!BLOB_URL.test(url)) return res.status(400).json({ error: 'Arquivo inválido.' });
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Falha no armazenamento.' });
  }
}
