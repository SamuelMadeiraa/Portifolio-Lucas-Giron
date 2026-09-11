/* ═══════════════════════════════════════════════════════════
   /api/upload — autoriza o envio de um arquivo do painel.
   O arquivo vai do navegador direto para o Vercel Blob
   (sem passar pelo limite de 4,5 MB das funções); esta rota só
   confere o login e gera a permissão de envio.
   ═══════════════════════════════════════════════════════════ */
import { handleUpload } from '@vercel/blob/client';
import { session } from './_lib/auth.js';

const TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async pathname => {
        if (!session(req)) throw new Error('Sua sessão expirou. Entre de novo.');
        if (!pathname.startsWith('uploads/') || pathname.includes('..')) throw new Error('Caminho inválido.');
        return {
          allowedContentTypes: TYPES,
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Envio recusado.' });
  }
}
