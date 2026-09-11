// GET /api/me → diz se há sessão ativa e se o armazenamento está ligado
import { configured, session, hasStorage } from './_lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const s = session(req);
  if (!s) return res.status(401).json({ ok: false, configured: configured() });
  return res.status(200).json({ ok: true, user: s.u, storage: hasStorage() });
}
