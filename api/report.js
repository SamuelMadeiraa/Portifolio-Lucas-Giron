import { isAuthed, json, unauthorized } from './_lib.js';
import { statsConfigured, redis, lastDays, key, KINDS, BR_STATES } from './_stats.js';

/* GET /api/report?days=28 → relatório do contador próprio para o painel:
   pessoas, visitas por dia, estados, cidades, origem e cliques. */

const PERIODS = [7, 28, 90];
const HASHES = ['region', 'city', 'ref', 'clicks', 'projects'];
const country = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const countryName = cc => { try { return country.of(cc) || cc; } catch { return cc; } };

// soma os hashes de vários dias (o Upstash devolve [campo, valor, campo, valor…])
const sum = lists => {
  const out = new Map();
  for (const arr of lists) for (let i = 0; i + 1 < (arr || []).length; i += 2)
    out.set(arr[i], (out.get(arr[i]) || 0) + (Number(arr[i + 1]) || 0));
  return out;
};
// junta chaves que viram o mesmo nome e ordena do maior para o menor
const top = (map, label, n = 50) => {
  const acc = new Map();
  for (const [k, v] of map) {
    const { id, ...rest } = label(k);
    const cur = acc.get(id) || { ...rest, count: 0 };
    cur.count += v;
    acc.set(id, cur);
  }
  return [...acc.values()].sort((a, b) => b.count - a.count).slice(0, n);
};

const cache = new Map();

export async function GET(request) {
  if (!(await isAuthed(request))) return unauthorized();
  if (!statsConfigured()) return json({ configured: false });

  const asked = Number(new URL(request.url).searchParams.get('days'));
  const days = PERIODS.includes(asked) ? asked : 28;
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < 60_000) return json(hit.data);

  const list = lastDays(days);
  try {
    const res = await redis([
      ['MGET', ...list.map(d => key(d, 'visits'))],
      ['PFCOUNT', ...list.map(d => key(d, 'people'))],
      ...KINDS.map(k => ['PFCOUNT', ...list.map(d => key(d, 'clickers:' + k))]),
      ...list.flatMap(d => HASHES.map(n => ['HGETALL', key(d, n)])),
    ]);
    const [visits, people] = res;
    const clickers = Object.fromEntries(KINDS.map((k, i) => [k, Number(res[2 + i]) || 0]));
    const perDay = res.slice(2 + KINDS.length);
    const H = Object.fromEntries(HASHES.map((n, j) => [n, sum(list.map((_, i) => perDay[i * HASHES.length + j]))]));

    const daily = list.map((date, i) => ({ date, visits: Number(visits?.[i]) || 0 }));
    const clicks = top(H.clicks, k => ({ id: k, kind: k })).map(c => ({ ...c, people: clickers[c.kind] || 0 }));
    const projects = top(H.projects, k => ({ id: k, name: k }));

    const data = {
      configured: true, days, updatedAt: new Date().toISOString(),
      totals: {
        people: Number(people) || 0,
        visits: daily.reduce((a, d) => a + d.visits, 0),
        clicks: clicks.reduce((a, c) => a + c.count, 0),
        projects: projects.reduce((a, p) => a + p.count, 0),
      },
      daily,
      // no Brasil por estado; fora dele, por país
      regions: top(H.region, k => {
        const [cc, uf] = k.split('|');
        return cc === 'BR'
          ? { id: 'BR|' + uf, name: BR_STATES[uf] || 'Brasil (estado não identificado)', sub: '' }
          : { id: cc, name: countryName(cc), sub: 'exterior' };
      }),
      cities: top(H.city, k => {
        const [city, cc, uf] = k.split('|');
        return { id: k, name: city, sub: cc === 'BR' ? uf : countryName(cc) };
      }),
      sources: top(H.ref, k => ({ id: k, name: k })),
      clicks,
      projects,
    };
    cache.set(days, { at: Date.now(), data });
    return json(data);
  } catch (e) {
    return json({ configured: true, error: 'Não foi possível ler o banco de dados: ' + e.message }, 502);
  }
}
