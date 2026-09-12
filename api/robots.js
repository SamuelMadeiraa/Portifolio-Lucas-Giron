import { get } from '@vercel/blob';
import { CONTENT_PATH, status } from './_lib.js';

// GET /robots.txt → o que os buscadores podem visitar
export async function GET(request) {
  const host = request.headers.get('x-forwarded-host') || new URL(request.url).host;
  let site = `https://${host}`;

  if (status().blob) {
    try {
      const r = await get(CONTENT_PATH, { access: 'public', useCache: true });
      if (r && r.statusCode === 200) {
        const c = JSON.parse(await new Response(r.stream).text());
        if (c?.seo?.siteUrl) site = String(c.seo.siteUrl);
      }
    } catch {}
  }
  site = site.replace(/\/+$/, '');

  const txt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${site}/sitemap.xml
`;
  return new Response(txt, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
