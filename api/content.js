import { get, put, list, del } from '@vercel/blob';
import { isAuthed, json, unauthorized, status, CONTENT_PATH, VERSIONS_DIR, KEEP_VERSIONS } from './_lib.js';

const MAX_BYTES = 1_000_000;

// GET /api/content → conteúdo publicado (público, com cache curto na CDN)
export async function GET(request) {
  if (!status().blob) return json({ error: 'not-configured' }, 404);

  const fresh = new URL(request.url).searchParams.has('fresh');
  const result = await get(CONTENT_PATH, { access: 'public', useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200) return json({ error: 'empty' }, 404);

  const text = await new Response(result.stream).text();
  return new Response(text, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // o painel pede ?fresh para sempre ver a última versão
      'cache-control': fresh ? 'no-store' : 'public, max-age=0, s-maxage=10, stale-while-revalidate=60',
    },
  });
}

// PUT /api/content → publica um novo conteúdo e guarda uma cópia no histórico
export async function PUT(request) {
  if (!(await isAuthed(request))) return unauthorized();
  if (!status().blob) return json({ error: 'Blob não configurado na Vercel (BLOB_READ_WRITE_TOKEN).' }, 503);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'Conteúdo grande demais.' }, 413);

  let data;
  try { data = JSON.parse(text); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects)) {
    return json({ error: 'Formato inesperado: falta a lista de projetos.' }, 400);
  }

  // não deixa publicar por cima de uma versão mais nova (outra aba / outro aparelho)
  const base = request.headers.get('x-base-saved-at');
  if (base !== null) {
    const cur = await get(CONTENT_PATH, { access: 'public', useCache: false }).catch(() => null);
    if (cur && cur.statusCode === 200) {
      let curSaved = '';
      try { curSaved = JSON.parse(await new Response(cur.stream).text()).savedAt || ''; } catch {}
      if (curSaved && curSaved !== base) return json({ error: 'conflict', savedAt: curSaved }, 409);
    }
  }

  data.savedAt = new Date().toISOString();
  const body = JSON.stringify(data);
  const opts = { access: 'public', addRandomSuffix: false, contentType: 'application/json' };

  await put(CONTENT_PATH, body, { ...opts, allowOverwrite: true, cacheControlMaxAge: 60 });
  await put(`${VERSIONS_DIR}${data.savedAt.replace(/[:.]/g, '-')}.json`, body, opts);

  // mantém só as últimas N versões
  try {
    const { blobs } = await list({ prefix: VERSIONS_DIR, limit: 1000 });
    const old = blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(KEEP_VERSIONS)
      .map(b => b.url);
    if (old.length) await del(old);
  } catch {}

  return json({ ok: true, savedAt: data.savedAt });
}
