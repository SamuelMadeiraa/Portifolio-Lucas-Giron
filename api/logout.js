// POST /api/logout → encerra a sessão
import { clearSession } from './_lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  clearSession(res);
  return res.status(200).json({ ok: true });
}
