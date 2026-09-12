import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { get } from '@vercel/blob';
import { CONTENT_PATH, status } from './_lib.js';
import { readDefaults, renderPage } from './_seo.js';

/* GET / → devolve o HTML já preenchido com o conteúdo publicado.
   O navegador continua montando a página por cima (mesmo resultado),
   mas o Google recebe tudo pronto, sem depender de JavaScript.

   O molde é page.html (e não index.html) porque, na Vercel, um arquivo
   estático em / teria prioridade sobre esta função. */
const SHELL = path.join(process.cwd(), 'page.html');

export async function GET(request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const [shell, defaults, published] = await Promise.all([
    readFile(SHELL, 'utf8').catch(() => ''),
    readDefaults(),
    readContent(),
  ]);

  // sem o molde não há o que preencher: entrega o arquivo estático
  if (!shell) {
    return new Response(null, { status: 302, headers: { location: '/page.html', 'cache-control': 'no-store' } });
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
