import { isAuthed, json, status, readAuth } from './_lib.js';

// GET /api/me → estado da sessão e da configuração
export async function GET(request) {
  const s = status();
  const auth = await readAuth();
  return json({
    authed: await isAuthed(request),
    storage: 'blob',
    configured: { password: s.password || !!auth?.hash, blob: s.blob },
    passwordUpdatedAt: auth?.updatedAt || null,
  });
}
