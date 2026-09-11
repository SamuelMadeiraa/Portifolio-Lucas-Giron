/* ═══════════════════════════════════════════════════════════
   Login do painel — usuário e senha definidos nas variáveis de
   ambiente da Vercel (ADMIN_USER / ADMIN_PASSWORD).
   A sessão é um cookie assinado (HMAC), válido por 7 dias.
   Arquivos com "_" no início não viram rota na Vercel.
   ═══════════════════════════════════════════════════════════ */
import crypto from 'node:crypto';

const COOKIE = 'lg_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

// chave de assinatura: SESSION_SECRET, ou derivada da senha (trocar a senha derruba as sessões abertas)
function secret() {
  const base = process.env.SESSION_SECRET
    || `${process.env.ADMIN_USER}|${process.env.ADMIN_PASSWORD}|${process.env.BLOB_READ_WRITE_TOKEN || ''}`;
  return crypto.createHash('sha256').update(base).digest();
}

export const configured = () => Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);

// comparação em tempo constante (não vaza o tamanho nem o conteúdo da senha)
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!mac || mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Date.now()) return null;
    if (p.u !== process.env.ADMIN_USER) return null;
    return p;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  if (req.cookies && req.cookies[name]) return req.cookies[name];
  const raw = req.headers.cookie || '';
  const hit = raw.split(/;\s*/).find(c => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export const session = req => (configured() ? verify(readCookie(req, COOKIE)) : null);

// cookie só por HTTPS (COOKIE_SECURE=false libera HTTP, só para testes sem domínio)
const secureFlag = () => (process.env.COOKIE_SECURE === 'false' ? '' : ' Secure;');

export function setSession(res, user) {
  const token = sign({ u: user, exp: Date.now() + MAX_AGE * 1000 });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly;${secureFlag()} SameSite=Strict; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly;${secureFlag()} SameSite=Strict; Max-Age=0`);
}

// exige login; em alterações exige também o cabeçalho do painel (bloqueia pedidos vindos de outros sites)
export function requireAdmin(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!session(req)) {
    res.status(401).json({ error: 'Sua sessão expirou. Entre de novo.' });
    return false;
  }
  if (req.method !== 'GET' && req.headers['x-lg-admin'] !== '1') {
    res.status(403).json({ error: 'Requisição recusada.' });
    return false;
  }
  return true;
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
