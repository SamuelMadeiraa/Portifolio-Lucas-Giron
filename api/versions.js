import { list } from '@vercel/blob';
import { isAuthed, json, unauthorized, status, VERSIONS_DIR } from './_lib.js';

// GET /api/versions → histórico de publicações (mais recentes primeiro)
export async function GET(request) {
  if (!(await isAuthed(request))) return unauthorized();
  if (!status().blob) return json({ versions: [] });

  const { blobs } = await list({ prefix: VERSIONS_DIR, limit: 1000 });
  const versions = blobs
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .map(b => ({ url: b.url, uploadedAt: b.uploadedAt, size: b.size }));
  return json({ versions });
}
