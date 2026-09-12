import { list, del } from '@vercel/blob';
import { isAuthed, json, unauthorized, status, MEDIA_DIR } from './_lib.js';

// GET /api/media → todos os arquivos enviados pelo painel
export async function GET(request) {
  if (!(await isAuthed(request))) return unauthorized();
  if (!status().blob) return json({ files: [] });

  const files = [];
  let cursor;
  do {
    const page = await list({ prefix: MEDIA_DIR, limit: 1000, cursor });
    page.blobs.forEach(b => files.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return json({ files });
}

// DELETE /api/media  { urls: [...] } → apaga arquivos (só dentro de media/)
export async function DELETE(request) {
  if (!(await isAuthed(request))) return unauthorized();

  let body = {};
  try { body = await request.json(); } catch {}
  const urls = (Array.isArray(body.urls) ? body.urls : []).filter(u => {
    try {
      const url = new URL(u);
      return url.hostname.endsWith('.blob.vercel-storage.com') && url.pathname.slice(1).startsWith(MEDIA_DIR);
    } catch { return false; }
  });

  if (urls.length) await del(urls);
  return json({ ok: true, deleted: urls.length });
}
