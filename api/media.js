/* ═══════════════════════════════════════════════════════════
   /api/media — arquivos enviados pelo painel (só com login)
   GET              → lista os arquivos
   DELETE ?url=…    → apaga um arquivo
   ═══════════════════════════════════════════════════════════ */
import { requireAdmin } from './_lib/auth.js';
import { mode, listUploads, deleteUpload } from './_lib/storage.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!mode()) return res.status(200).json({ files: [], storage: false });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ files: await listUploads(), storage: true });
    }
    if (req.method === 'DELETE') {
      await deleteUpload(String((req.query && req.query.url) || ''));
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Falha no armazenamento.' });
  }
}
