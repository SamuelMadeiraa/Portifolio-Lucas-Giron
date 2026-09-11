/* ═══════════════════════════════════════════════════════════
   /api/content
   GET  → conteúdo publicado (público; o site lê daqui)
   PUT  → salva o conteúdo (só com login)
   Cada publicação vira uma versão nova; as 20 mais recentes
   ficam guardadas como histórico (ver _lib/storage.js).
   ═══════════════════════════════════════════════════════════ */
import { requireAdmin } from './_lib/auth.js';
import { mode, getContent, saveContent } from './_lib/storage.js';

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const fresh = req.query && 'fresh' in req.query;
    res.setHeader('Cache-Control', fresh ? 'private, no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
    if (!mode()) return res.status(404).json({ error: 'Armazenamento não configurado.' });
    try {
      const data = await getContent();
      if (!data) return res.status(404).json({ error: 'Nada publicado ainda.' });
      return res.status(200).json(data);
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ error: 'Não foi possível ler o conteúdo.' });
    }
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    if (!mode()) {
      return res.status(500).json({ error: 'Armazenamento não configurado: na Vercel, conecte um Blob Store (público) ao projeto; no servidor próprio, defina DATA_DIR.' });
    }
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.projects)) {
      return res.status(400).json({ error: 'Conteúdo inválido.' });
    }
    const json = JSON.stringify(data, null, 2);
    if (json.length > 3_000_000) return res.status(413).json({ error: 'Conteúdo grande demais.' });
    try {
      await saveContent(json);
      return res.status(200).json({ ok: true, savedAt: Date.now() });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Falha ao salvar.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Método não permitido.' });
}
