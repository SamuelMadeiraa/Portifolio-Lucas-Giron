import { get } from '@vercel/blob';
import { CONTENT_PATH, status } from './_lib.js';
import { readDefaults, merge, migrate, posterOf } from './_seo.js';

const xml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// GET /sitemap.xml → mapa do site, com as capas dos trabalhos (Google Imagens)
export async function GET(request) {
  const host = request.headers.get('x-forwarded-host') || new URL(request.url).host;

  let published = null;
  if (status().blob) {
    try {
      const r = await get(CONTENT_PATH, { access: 'public', useCache: true });
      if (r && r.statusCode === 200) published = JSON.parse(await new Response(r.stream).text());
    } catch {}
  }
  const c = migrate(merge((await readDefaults()) || {}, published || {}));

  const site = String(c.seo?.siteUrl || `https://${host}`).replace(/\/+$/, '');
  const lastmod = String(c.savedAt || new Date().toISOString()).slice(0, 10);
  const abs = u => /^https?:\/\//i.test(u) ? u : `${site}/${String(u).replace(/^\/+/, '')}`;

  const seen = new Set();
  const images = [];
  const add = (src, title) => {
    if (!src) return;
    const loc = abs(src);
    if (seen.has(loc)) return;
    seen.add(loc);
    images.push({ loc, title });
  };
  if (c.seo?.ogImage) add(c.seo.ogImage, c.person?.name || c.seo?.title);
  for (const p of [...(c.projects || []), ...(c.designs || [])]) {
    if (p && !p.hidden) add(posterOf(p), p.title);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${xml(site)}/</loc>
    <lastmod>${xml(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${images.slice(0, 1000).map(i => `    <image:image><image:loc>${xml(i.loc)}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
