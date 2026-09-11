// GET /api/me → diz se há sessão ativa e como os arquivos são enviados
import { configured, session } from './_lib/auth.js';
import { mode } from './_lib/storage.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const s = session(req);
  if (!s) return res.status(401).json({ ok: false, configured: configured() });
  const m = mode();
  return res.status(200).json({
    ok: true,
    user: s.u,
    storage: Boolean(m),
    // 'blob' = direto para o Vercel Blob · 'direct' = para o próprio servidor (Docker)
    uploadMode: m === 'fs' ? 'direct' : 'blob',
  });
}
