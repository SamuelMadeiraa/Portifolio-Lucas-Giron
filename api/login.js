import { checkPassword, sessionCookie, clearCookie, json, sleep, status, readAuth } from './_lib.js';

// POST /api/login  { password }  → cria a sessão (cookie HttpOnly)
export async function POST(request) {
  const auth = await readAuth();
  if (!status().password && !auth?.hash) {
    return json({ error: 'ADMIN_PASSWORD não configurada na Vercel.' }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch {}

  if (!(await checkPassword(body.password || ''))) {
    await sleep(900); // freia tentativas de força bruta
    return json({ error: 'Senha incorreta.' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': await sessionCookie() });
}

// DELETE /api/login → encerra a sessão
export function DELETE() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
