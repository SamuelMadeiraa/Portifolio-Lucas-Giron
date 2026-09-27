import { createHash } from 'node:crypto';
import { statsConfigured, redis, today, key, KINDS, source } from './_stats.js';

/* POST /api/track  { t: 'visit', r: origem } | { t: 'click', k: rede, p?: projeto }, v: id anônimo
   Chamado pelo próprio site (sendBeacon). Responde sempre 204: quem visita nunca vê erro.
   Cidade e estado vêm dos cabeçalhos de geolocalização da Vercel — nenhum IP é guardado. */

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i;
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f|]/g, ' ').trim().slice(0, n);
const decode = s => { try { return decodeURIComponent(s || ''); } catch { return s || ''; } };

export async function POST(request) {
  const done = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!statsConfigured()) return done;

  const hd = request.headers;
  if (BOT.test(hd.get('user-agent') || '')) return done;
  // só conta o que vem do próprio site
  try {
    if (new URL(hd.get('origin') || hd.get('referer') || '').host !== hd.get('host')) return done;
  } catch { return done; }

  let b;
  try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch { return done; }
  if (!b || typeof b !== 'object') return done;

  const day = today();
  // sem id no navegador (armazenamento bloqueado): usa um resumo do IP + navegador do dia, sem guardar o IP
  const vid = clip(b.v, 40).replace(/[^\w-]/g, '') || createHash('sha256')
    .update(day + (hd.get('x-forwarded-for') || '') + (hd.get('user-agent') || '')).digest('base64url').slice(0, 22);

  const cmds = [];
  if (b.t === 'visit') {
    const country = clip(hd.get('x-vercel-ip-country'), 2).toUpperCase();
    const region = clip(hd.get('x-vercel-ip-country-region'), 3).toUpperCase();
    const city = clip(decode(hd.get('x-vercel-ip-city')), 60);
    cmds.push(['INCR', key(day, 'visits')], ['PFADD', key(day, 'people'), vid],
      ['HINCRBY', key(day, 'ref'), source(b.r), 1]);
    if (country) cmds.push(['HINCRBY', key(day, 'region'), `${country}|${region}`, 1]);
    if (city) cmds.push(['HINCRBY', key(day, 'city'), `${city}|${country}|${region}`, 1]);
  } else if (b.t === 'click') {
    if (b.k === 'projeto') {
      const p = clip(b.p, 80);
      if (p) cmds.push(['HINCRBY', key(day, 'projects'), p, 1]);
    } else if (KINDS.includes(b.k)) {
      cmds.push(['HINCRBY', key(day, 'clicks'), b.k, 1], ['PFADD', key(day, 'clickers:' + b.k), vid]);
    }
  }
  if (cmds.length) await redis(cmds).catch(() => {});
  return done;
}
