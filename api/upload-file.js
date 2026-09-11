/* ═══════════════════════════════════════════════════════════
   POST /api/upload-file?name=uploads/<nome>.<ext>
   Envio direto para o disco do servidor (Docker / VPS).
   O corpo da requisição é o próprio arquivo. Na Vercel quem
   cuida disso é o /api/upload (Vercel Blob).
   ═══════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from './_lib/auth.js';
import { mode, uploadsDir } from './_lib/storage.js';

const EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'mp4', 'webm', 'mov', 'pdf']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!requireAdmin(req, res)) return;
  if (mode() !== 'fs') return res.status(400).json({ error: 'Envio direto só existe no servidor próprio (Docker).' });

  const m = /^uploads\/([a-z0-9-]{1,80})\.([a-z0-9]{2,5})$/i.exec(String((req.query && req.query.name) || ''));
  if (!m) return res.status(400).json({ error: 'Nome de arquivo inválido.' });
  const ext = m[2].toLowerCase();
  if (!EXT.has(ext)) return res.status(415).json({ error: 'Tipo de arquivo não aceito.' });

  const max = (Number(process.env.MAX_UPLOAD_MB) || 500) * 1048576;
  if (Number(req.headers['content-length'] || 0) > max) {
    return res.status(413).json({ error: `Arquivo maior que ${Math.round(max / 1048576)} MB.` });
  }

  const dir = uploadsDir();
  const final = `${m[1]}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const tmp = path.join(dir, `.${final}.parte`);
  let size = 0;
  try {
    await fsp.mkdir(dir, { recursive: true });
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmp);
      req.on('data', chunk => {
        size += chunk.length;
        if (size > max) {
          const err = Object.assign(new Error(`Arquivo maior que ${Math.round(max / 1048576)} MB.`), { status: 413 });
          req.unpipe(out);
          out.destroy();
          reject(err);
        }
      });
      req.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      req.pipe(out);
    });
    if (!size) throw Object.assign(new Error('Arquivo vazio.'), { status: 400 });
    await fsp.rename(tmp, path.join(dir, final));
    return res.status(200).json({ url: `/uploads/${final}`, pathname: `uploads/${final}`, size });
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    if (!res.headersSent) return res.status(e.status || 500).json({ error: e.message || 'Falha ao salvar o arquivo.' });
  }
}
