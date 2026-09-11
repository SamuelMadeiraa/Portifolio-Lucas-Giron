// POST /api/login  { user, pass }  → cria a sessão (cookie)
import { configured, safeEqual, setSession, wait } from './_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!configured()) {
    return res.status(500).json({ error: 'Login não configurado: defina ADMIN_USER e ADMIN_PASSWORD nas variáveis de ambiente do projeto na Vercel.' });
  }
  if (req.headers['x-lg-admin'] !== '1') return res.status(403).json({ error: 'Requisição recusada.' });

  const { user = '', pass = '' } = req.body || {};
  const userOk = safeEqual(String(user).trim().toLowerCase(), String(process.env.ADMIN_USER).trim().toLowerCase());
  const passOk = safeEqual(String(pass), String(process.env.ADMIN_PASSWORD));

  if (!(userOk && passOk)) {
    await wait(900 + Math.random() * 700); // atrasa tentativas de adivinhar a senha
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  setSession(res, process.env.ADMIN_USER);
  return res.status(200).json({ ok: true, user: process.env.ADMIN_USER });
}
