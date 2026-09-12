import { handleUpload } from '@vercel/blob/client';
import { isAuthed, json, unauthorized, MEDIA_DIR } from './_lib.js';

const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB por arquivo

/* POST /api/upload
   O navegador envia o arquivo direto para o Vercel Blob (sem passar pelo
   limite de tamanho das funções). Aqui só autorizamos e geramos o token. */
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

  // o aviso de "upload concluído" vem da própria Vercel, assinado — não tem cookie
  if (body?.type === 'blob.generate-client-token' && !(await isAuthed(request))) return unauthorized();

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        if (!(await isAuthed(request))) throw new Error('Não autorizado');
        if (!pathname.startsWith(MEDIA_DIR)) throw new Error('Caminho inválido');
        return {
          allowedContentTypes: ['video/*', 'image/*'],
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return json(result);
  } catch (err) {
    return json({ error: err.message }, 400);
  }
}
