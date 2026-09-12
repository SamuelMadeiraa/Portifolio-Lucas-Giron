/* Utilitários compartilhados pelas funções da API.
   Arquivos com "_" na frente não viram rota na Vercel. */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';

export const COOKIE = 'giron_session';
const WEEK = 60 * 60 * 24 * 7;

export const CONTENT_PATH  = 'site/content.json';
export const VERSIONS_DIR  = 'site/versions/';
export const MEDIA_DIR     = 'media/';
export const KEEP_VERSIONS = 30;

const secret = () =>
  process.env.SESSION_SECRET ||
  createHash('sha256').update('giron:' + (process.env.ADMIN_PASSWORD || '') + (process.env.BLOB_READ_WRITE_TOKEN || '')).digest('hex');

const hmac = (value, key = secret()) => createHmac('sha256', key).update(String(value)).digest('base64url');

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/* ── SENHA ─────────────────────────────────────────────
   A senha trocada no painel fica no Blob como HMAC feito com o
   segredo do servidor — sem esse segredo o arquivo não serve para
   nada, e o nome dele também sai do segredo (não dá para adivinhar).
   Enquanto ninguém trocar a senha, vale a ADMIN_PASSWORD. */
const AUTH_PATH = () => `site/auth-${hmac('auth-file')}.json`;
const hashPassword = pw => hmac('pw:' + String(pw));

let authCache, authAt = 0;
export async function readAuth(force = false) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!force && authCache !== undefined && Date.now() - authAt < 5000) return authCache;
  try {
    const r = await get(AUTH_PATH(), { access: 'public', useCache: false });
    const text = r && r.statusCode === 200 ? await new Response(r.stream).text() : '';
    authCache = text ? JSON.parse(text) : null;
  } catch { authCache = null; }
  authAt = Date.now();
  return authCache;
}

export async function writeAuth(password) {
  const data = { hash: hashPassword(password), updatedAt: new Date().toISOString() };
  await put(AUTH_PATH(), JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
  authCache = data;
  authAt = Date.now();
  return data;
}

export async function checkPassword(pw) {
  const auth = await readAuth();
  if (auth?.hash) return safeEq(hashPassword(pw), auth.hash);
  const real = process.env.ADMIN_PASSWORD;
  return real ? safeEq(hashPassword(pw), hashPassword(real)) : false;
}

export const status = () => ({
  password: !!process.env.ADMIN_PASSWORD,
  blob: !!process.env.BLOB_READ_WRITE_TOKEN,
});

/* ── SESSÃO ────────────────────────────────────────────
   A assinatura leva junto a senha em vigor: trocar a senha derruba
   as sessões abertas em qualquer aparelho. */
const sessionKey = async () => {
  const auth = await readAuth();
  return secret() + '|' + (auth?.hash || hashPassword(process.env.ADMIN_PASSWORD || ''));
};

export async function sessionCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + WEEK);
  return `${COOKIE}=${exp}.${hmac(exp, await sessionKey())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${WEEK}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAuthed(request) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(/(?:^|;\s*)giron_session=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) <= Date.now() / 1000) return false;
  const auth = await readAuth();
  if (!auth?.hash && !process.env.ADMIN_PASSWORD) return false;
  return safeEq(sig, hmac(exp, await sessionKey()));
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const unauthorized = () => json({ error: 'Não autorizado' }, 401);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
