import { get } from '@vercel/blob';
import { CONTENT_PATH, status } from './_lib.js';
import { loadDefaults, renderPage } from './_seo.js';

/* GET / → devolve o HTML já preenchido com o conteúdo publicado.
   O navegador continua montando a página por cima (mesmo resultado),
   mas o Google recebe tudo pronto, sem depender de JavaScript. */
export async function GET(request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const [shell, defaults, published] = await Promise.all([
    fetch(`${origin}/index.html`).then(r => (r.ok ? r.text() : '')).catch(() => ''),
    loadDefaults(origin),
    readContent(),
  ]);

  // sem o molde não há o que preencher: entrega o arquivo estático
  if (!shell) {
    return new Response(null, { status: 302, headers: { location: '/index.html', 'cache-control': 'no-store' } });
  }

  let html;
  try {
    html = renderPage(shell, published, origin, defaults);
  } catch {
    html = shell; // qualquer erro na montagem → site normal, montado no navegador
  }

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400',
    },
  });
}

async function readContent() {
  if (!status().blob) return null;
  try {
    const r = await get(CONTENT_PATH, { access: 'public', useCache: true });
    if (r && r.statusCode === 200) return JSON.parse(await new Response(r.stream).text());
  } catch {}
  return null;
}
