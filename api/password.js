import { isAuthed, checkPassword, writeAuth, sessionCookie, json, unauthorized, status, sleep } from './_lib.js';

const MIN = 8, MAX = 200;

/* POST /api/password  { current, next } → troca a senha do painel.
   Vale na hora e derruba as sessões abertas em outros aparelhos —
   por isso a resposta já traz um cookie novo para quem trocou. */
export async function POST(request) {
  if (!(await isAuthed(request))) return unauthorized();
  if (!status().blob) {
    return json({ error: 'Sem Blob configurado na Vercel, não há onde guardar a nova senha.' }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch {}
  const current = String(body.current || '');
  const next = String(body.next || '');

  if (!(await checkPassword(current))) {
    await sleep(900);
    return json({ error: 'A senha atual está errada.' }, 403);
  }
  if (next.length < MIN) return json({ error: `A nova senha precisa de pelo menos ${MIN} caracteres.` }, 400);
  if (next.length > MAX) return json({ error: 'Senha comprida demais.' }, 400);
  if (next === current) return json({ error: 'A nova senha é igual à atual.' }, 400);

  const auth = await writeAuth(next);
  return json({ ok: true, updatedAt: auth.updatedAt }, 200, { 'set-cookie': await sessionCookie() });
}
