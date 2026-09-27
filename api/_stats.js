/* Contador próprio de visitas e cliques — guardado no Redis (Upstash).
   Conectar o "Upstash for Redis" ao projeto na Vercel cria as variáveis
   KV_REST_API_URL / KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / _TOKEN).

   Chaves por dia (fuso de São Paulo), a:AAAA-MM-DD:…
     visits          contador de visitas (1 por sessão)
     people          HyperLogLog das pessoas diferentes (id anônimo do navegador)
     region / city   hash  "BR|SP" / "São Paulo|BR|SP" → visitas
     ref             hash  origem (google, instagram, direto…) → visitas
     clicks          hash  rede → cliques
     clickers:<rede> HyperLogLog de quem clicou naquela rede
     projects        hash  título do projeto → vezes que foi aberto */

const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const statsConfigured = () => !!(URL_() && TOKEN());

// vários comandos numa ida só → [resultado, …]
export async function redis(commands) {
  const r = await fetch(URL_().replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + TOKEN(), 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`Redis respondeu ${r.status}`);
  const out = await r.json();
  return out.map(x => {
    if (x.error) throw new Error('Redis: ' + x.error);
    return x.result;
  });
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export const today = () => dayFmt.format(new Date());
// os últimos n dias, do mais antigo para hoje
export function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayFmt.format(new Date(Date.now() - i * 864e5)));
  return [...new Set(out)];
}
export const key = (day, name) => `a:${day}:${name}`;

// o que pode ser clicado (mesmos nomes dos ícones do site)
export const KINDS = ['instagram', 'youtube', 'vimeo', 'whatsapp', 'linkedin', 'behance', 'tiktok', 'x', 'facebook',
  'github', 'dribbble', 'spotify', 'telegram', 'pinterest', 'mail', 'phone', 'link'];

// origem da visita → nome curto
const SOURCES = [
  [/(^|\.)google\./, 'google'], [/(^|\.)bing\.com$/, 'bing'], [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'], [/(^|\.)vimeo\.com$/, 'vimeo'], [/(^|\.)behance\.net$/, 'behance'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'], [/(^|\.)tiktok\.com$/, 'tiktok'],
];
export function source(raw) {
  const s = String(raw || '').trim().toLowerCase().slice(0, 100);
  if (!s) return 'direto';
  const host = s.replace(/^https?:\/\//, '').split('/')[0].replace(/^(www|m|l|lm|mobile)\./, '');
  const hit = SOURCES.find(([re]) => re.test(host));
  return hit ? hit[1] : (host.replace(/[^a-z0-9.-]/g, '').slice(0, 40) || 'direto');
}

export const BR_STATES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
