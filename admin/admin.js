/* ═══════════════════════════════════════════════
   PAINEL — admin.js
   Edita uma cópia (rascunho) do conteúdo do site.
   "Publicar" grava em /api/content e o site passa
   a usar a nova versão.
   ═══════════════════════════════════════════════ */

const DEFAULT = JSON.parse(JSON.stringify(window.SITE_DEFAULT || {}));
const migrate = window.SITE_MIGRATE || (x => x);
const FONTS = window.SITE_FONTS || { display: {}, mono: {} };
const ANCHORS = window.SITE_ANCHORS || {};
const BLOB_CLIENT = [
  'https://esm.sh/@vercel/blob@2.8.0/client?bundle',
  'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/client/+esm',
];
const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
// o Windows costuma mandar .glb/.pdf sem tipo
const MIME_BY_EXT = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
const $ = (s, c = document) => c.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => {
  if (over === undefined || over === null) return base;
  if (isObj(base) && isObj(over)) {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over;
};
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slugify = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB`
  : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
const fmtDur = s => { s = Math.max(0, Math.round(+s || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const fmtDate = d => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));
const abs = u => !u ? '' : /^(https?:|data:|blob:|\/)/.test(u) ? u : '/' + u;
const isImg = p => /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(p);
const isVid = p => /\.(mp4|m4v|webm|mov|ogv)$/i.test(p);
const ytId = s => {
  const v = String(s || '').trim();
  const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : '';
};
const ytThumb = id => id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
const hasVideo = x => !!(x && (x.video || x.vimeo || ytId(x.youtube)));

/* ── cores do painel = cores do site ── */
function applyAdminTheme(t) {
  const ok = v => /^#[0-9a-f]{6}$/i.test(v || '');
  if (!t || !ok(t.ink) || !ok(t.paper) || !ok(t.flare)) return;
  const nums = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgb = hex => nums(hex).join(',');
  const lum = hex => {
    const [r, g, b] = nums(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const mix = (p, a, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
  const light = lum(t.ink) > .5;
  const vars = {
    '--bg': t.ink, '--bg-rgb': rgb(t.ink),
    '--panel': mix(95, t.ink, t.paper), '--panel-2': mix(91, t.ink, t.paper), '--panel-3': mix(86, t.ink, t.paper),
    '--txt': t.paper, '--line': `rgba(${rgb(t.paper)},.09)`, '--line-2': `rgba(${rgb(t.paper)},.18)`,
    '--mut': `rgba(${rgb(t.paper)},.6)`, '--mut-2': `rgba(${rgb(t.paper)},.42)`,
    '--acc': t.flare, '--acc-rgb': rgb(t.flare), '--acc-2': ok(t.flareSoft) ? t.flareSoft : t.flare,
    '--on-acc': ok(t.onFlare) ? t.onFlare : '#FFFFFF',
    '--ok': light ? '#15803D' : '#4ADE80', '--warn': light ? '#B45309' : '#FBBF24', '--err': light ? '#DC2626' : '#F87171',
  };
  const root = document.documentElement.style;
  Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));
  root.colorScheme = light ? 'light' : 'dark';
  try { localStorage.setItem('giron:admin-theme', JSON.stringify(t)); } catch {}
}
try { applyAdminTheme(JSON.parse(localStorage.getItem('giron:admin-theme') || 'null')); } catch {}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}
const frag  = (...k) => h('div', { class: 'stack' }, k);
const grid  = (...k) => h('div', { class: 'grid2' }, k);
const badge = (t, kind) => h('span', { class: 'badge' + (kind ? ` badge--${kind}` : '') }, t);
const tip   = (...k) => h('p', { class: 'tip' }, k);
function box(title, desc, ...kids) {
  return h('section', { class: 'box' },
    h('header', { class: 'box__h' }, h('div', {}, h('h2', {}, title), desc && h('p', {}, desc))),
    h('div', { class: 'box__b' }, kids));
}

function toast(msg, kind = '', ms = 4200) {
  const t = h('div', { class: 'toast' + (kind ? ` toast--${kind}` : ''), role: 'status' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

const RICH_HINT = tip('Formatação: ', h('code', {}, '**negrito**'), ' e ', h('code', {}, '*itálico*'),
  ' (o itálico aparece na cor de destaque). Pular linha também funciona.');

/* ─────────────────────────────────────────────
   ESTADO
   ───────────────────────────────────────────── */
const S = { env: null, warns: [], saved: null, draft: null, tab: 'projects', dirty: false, uploading: 0 };

function normalize(d) {
  const item = p => {
    const x = {
      id: uid(), title: '', year: '', duration: 0, category: '', tag: '', description: '',
      vimeo: '', youtube: '', video: '', poster: '', hidden: false, ...p,
    };
    x.blocks = (Array.isArray(x.blocks) ? x.blocks : []).filter(b => b && BLOCK_TYPES[b.type]);
    x.blocks.forEach(b => { if (b.type === 'gallery') b.images ||= []; });
    return x;
  };
  d.projects = (d.projects || []).map(item);
  d.designs = (Array.isArray(d.designs) ? d.designs : []).map(item);
  for (const k of ['categories', 'ticker', 'designCategories']) if (!Array.isArray(d[k])) d[k] = [];
  d.hero.eyebrow ||= []; d.hero.rotator ||= [];
  d.about.paragraphs ||= []; d.about.stats ||= []; d.about.lists ||= [];
  d.about.lists.forEach(l => l.items ||= []);
  d.clients.items ||= []; d.contact.links ||= [];
  if (!Array.isArray(d.layout)) d.layout = clone(DEFAULT.layout);
  d.layout.forEach(s => {
    s.id ||= 's' + Math.random().toString(36).slice(2, 8);
    if (s.type === 'gallery') s.images ||= [];
    if (s.type === 'cards' || s.type === 'band') s.items ||= [];
  });
  d.nav.items ||= [];
  d.typography = { ...DEFAULT.typography, ...(d.typography || {}) };
  d.person = { ...DEFAULT.person, ...(d.person || {}) };
  delete d.sections;
  return d;
}
const hydrate = data => normalize(data ? merge(clone(DEFAULT), migrate(data)) : clone(DEFAULT));

let dirtyRaf;
function touch() {
  cancelAnimationFrame(dirtyRaf);
  dirtyRaf = requestAnimationFrame(() => {
    S.dirty = JSON.stringify(S.draft) !== JSON.stringify(S.saved);
    applyAdminTheme(S.draft?.theme);
    if ($('#dlg').open) S.refreshBlocks?.();
    $('#dirty').hidden = !S.dirty;
    $('#discardBtn').hidden = !S.dirty;
    $('#publishBtn').classList.toggle('is-pulse', S.dirty);
  });
}
addEventListener('beforeunload', e => {
  if (S.dirty || S.uploading) { e.preventDefault(); e.returnValue = ''; }
});

/* ─────────────────────────────────────────────
   API
   ───────────────────────────────────────────── */
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(path, {
    method, cache: 'no-store', credentials: 'same-origin',
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (r.status === 401 && path !== '/api/login') showLogin('Sua sessão expirou. Entre de novo.');
  if (!r.ok) throw Object.assign(new Error(data?.error || `Erro ${r.status}`), { status: r.status, data });
  return data;
}

const fetchLatest = async () => {
  const r = await fetch('/api/content?fresh=1', { cache: 'no-store' });
  return r.ok ? r.json() : null;
};

let blobClient;
async function loadBlobClient() {
  if (blobClient) return blobClient;
  for (const url of BLOB_CLIENT) {
    try { blobClient = await import(url); return blobClient; } catch {}
  }
  throw new Error('não foi possível carregar o módulo de upload (verifique a internet)');
}

/* Envia um arquivo e devolve a URL pública */
async function uploadFile(file, folder, onProgress = () => {}) {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  if (!file.type && MIME_BY_EXT[ext]) file = new File([file], file.name, { type: MIME_BY_EXT[ext] });
  const pathname = `media/${folder}/${slugify(file.name.replace(/\.[^.]+$/, '')) || 'arquivo'}${ext}`;
  S.uploading++;
  try {
    if (S.env.storage === 'local') {
      return await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('PUT', '/api/dev-upload?name=' + encodeURIComponent(pathname));
        x.setRequestHeader('content-type', file.type || 'application/octet-stream');
        x.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total * 100);
        x.onload = () => {
          let d = {}; try { d = JSON.parse(x.responseText); } catch {}
          x.status < 300 ? resolve(d.url) : reject(new Error(d.error || `Erro ${x.status}`));
        };
        x.onerror = () => reject(new Error('falha de rede'));
        x.send(file);
      });
    }
    const { upload } = await loadBlobClient();
    const r = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType: file.type || undefined,
      multipart: file.size > 50 * 1024 * 1024,
      onUploadProgress: e => onProgress(e.percentage),
    });
    return r.url;
  } finally {
    S.uploading--;
  }
}

/* Lê duração e captura um frame do vídeo como JPEG */
function videoInfo(src, { at = 1, crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    if (crossOrigin) v.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('tempo esgotado')), 30000);
    const fail = msg => { clearTimeout(timer); reject(new Error(msg)); };
    v.addEventListener('error', () => fail('formato não suportado pelo navegador'));
    v.addEventListener('loadedmetadata', () => {
      const d = isFinite(v.duration) ? v.duration : at + 1;
      v.currentTime = Math.min(Math.max(at, 0), Math.max(0, d - 0.1));
    }, { once: true });
    v.addEventListener('seeked', () => {
      try {
        const vw = v.videoWidth || 1280, vh = v.videoHeight || 720;
        const w = Math.min(1280, vw), hgt = Math.round(w * vh / vw);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = hgt;
        cv.getContext('2d').drawImage(v, 0, 0, w, hgt);
        cv.toBlob(b => {
          clearTimeout(timer);
          b ? resolve({ duration: v.duration, blob: b }) : reject(new Error('falha ao gerar a imagem'));
        }, 'image/jpeg', 0.85);
      } catch { fail('o servidor do vídeo não permite captura'); }
    }, { once: true });
    v.src = src;
  });
}

/* ─────────────────────────────────────────────
   COMPONENTES DE FORMULÁRIO
   ───────────────────────────────────────────── */
function field(obj, key, opts = {}) {
  const { label, type = 'text', hint, rows, placeholder, options, onChange, list, invert, maxlength } = opts;
  const set = v => { obj[key] = v; touch(); onChange?.(v); };

  if (type === 'toggle') {
    const ctl = h('input', { type: 'checkbox', class: 'toggle' });
    ctl.checked = invert ? !!obj[key] === false : obj[key] !== false;
    ctl.addEventListener('change', () => set(invert ? !ctl.checked : ctl.checked));
    return h('label', { class: 'f f--toggle' }, ctl, h('span', { class: 'f__l' }, label), hint && h('small', { class: 'f__h' }, hint));
  }
  if (type === 'color') return colorField(obj, key, opts);

  let ctl;
  if (rows) ctl = h('textarea', { rows, placeholder });
  else if (options) ctl = h('select', {}, options.map(o => h('option', { value: o.value }, o.label)));
  else ctl = h('input', { type, placeholder, list, maxlength });
  ctl.value = obj[key] ?? '';
  ctl.addEventListener(options ? 'change' : 'input', () =>
    set(type === 'number' ? (ctl.value === '' ? '' : Number(ctl.value)) : ctl.value));
  return h('label', { class: 'f' }, label && h('span', { class: 'f__l' }, label), ctl, hint && h('small', { class: 'f__h' }, hint));
}

function colorField(obj, key, { label, onChange }) {
  const pick = h('input', { type: 'color', 'aria-label': label });
  const txt = h('input', { type: 'text', maxlength: 7, spellcheck: 'false', 'aria-label': label });
  const valid = v => /^#[0-9a-f]{6}$/i.test(v);
  pick.value = valid(obj[key]) ? obj[key] : '#000000';
  txt.value = obj[key] || '';
  const set = v => { obj[key] = v; touch(); onChange?.(); };
  pick.addEventListener('input', () => { txt.value = pick.value.toUpperCase(); set(txt.value); });
  txt.addEventListener('input', () => {
    let v = txt.value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    if (valid(v)) { pick.value = v; set(v.toUpperCase()); }
  });
  return h('label', { class: 'f' }, h('span', { class: 'f__l' }, label), h('div', { class: 'color' }, pick, txt));
}

function rowTools(arr, i, redraw, { onChange, beforeDelete } = {}) {
  const mv = d => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    touch(); redraw(); onChange?.();
  };
  return h('div', { class: 'row__tools' },
    h('button', { type: 'button', class: 'ib', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0, onclick: () => mv(-1) }, '↑'),
    h('button', { type: 'button', class: 'ib', title: 'Descer', 'aria-label': 'Descer', disabled: i === arr.length - 1, onclick: () => mv(1) }, '↓'),
    h('button', {
      type: 'button', class: 'ib ib--del', title: 'Remover', 'aria-label': 'Remover',
      onclick: () => {
        if (beforeDelete && !beforeDelete(arr[i])) return;
        arr.splice(i, 1); touch(); redraw(); onChange?.();
      },
    }, '✕'));
}

/* lista de textos */
function strList(arr, { placeholder = '', rows, addLabel = 'Adicionar', onChange } = {}) {
  const wrap = h('div', { class: 'list' });
  const draw = () => wrap.replaceChildren(
    ...arr.map((v, i) => {
      const ctl = rows ? h('textarea', { rows, placeholder }) : h('input', { type: 'text', placeholder });
      ctl.value = v ?? '';
      ctl.addEventListener('input', () => { arr[i] = ctl.value; touch(); onChange?.(); });
      return h('div', { class: 'row' },
        h('span', { class: 'row__n mono' }, String(i + 1).padStart(2, '0')), ctl, rowTools(arr, i, draw, { onChange }));
    }),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        arr.push(''); touch(); draw(); onChange?.();
        [...wrap.querySelectorAll('.row input, .row textarea')].pop()?.focus();
      },
    }, '+ ' + addLabel));
  draw();
  return wrap;
}

/* lista de objetos (várias colunas) */
function objList(arr, fields, { addLabel = 'Adicionar', onChange } = {}) {
  const cols = fields.map(f => f.w || '1fr').join(' ');
  const wrap = h('div', { class: 'list' });
  const draw = () => wrap.replaceChildren(
    arr.length ? h('div', { class: 'list__head', style: `--cols:${cols}` }, fields.map(f => h('span', {}, f.label))) : null,
    ...arr.map((item, i) => h('div', { class: 'row' },
      h('span', { class: 'row__n mono' }, String(i + 1).padStart(2, '0')),
      h('div', { class: 'row__fields', style: `--cols:${cols}` }, fields.map(f => {
        const c = h('input', { type: f.type || 'text', placeholder: f.placeholder || '', 'aria-label': f.label });
        c.value = item[f.key] ?? '';
        c.addEventListener('input', () => { item[f.key] = c.value; touch(); onChange?.(); });
        return c;
      })),
      rowTools(arr, i, draw, { onChange }))),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        arr.push(Object.fromEntries(fields.map(f => [f.key, '']))); touch(); draw(); onChange?.();
        [...wrap.querySelectorAll('.row input')].slice(-fields.length)[0]?.focus();
      },
    }, '+ ' + addLabel));
  draw();
  return wrap;
}

function progressBar() {
  const bar = h('i'), lbl = h('span', { class: 'mono muted' });
  const el = h('div', { class: 'prog', hidden: true }, h('div', { class: 'prog__track' }, bar), lbl);
  return {
    el,
    show() { el.hidden = false; },
    hide() { el.hidden = true; bar.style.width = '0'; },
    set(p, t) { bar.style.width = `${p || 0}%`; lbl.textContent = `${t || ''} ${Math.round(p || 0)}%`; },
  };
}

/* imagem (capa, compartilhamento...) com envio e captura do vídeo */
function imageEditor(obj, key, { label = 'Imagem', name: nameOpt = 'imagem', videoKey, onChange } = {}) {
  const wrap = h('div', { class: 'poster' });
  const name = () => (typeof nameOpt === 'function' ? nameOpt() : nameOpt) || 'imagem';
  const prog = progressBar();
  const finish = () => { touch(); onChange?.(); draw(); };

  const sendImage = async file => {
    try {
      prog.show();
      obj[key] = await uploadFile(file, 'images', p => prog.set(p, 'Enviando imagem'));
      finish();
    } catch (e) { toast('Falha no envio: ' + e.message, 'err', 8000); }
    finally { prog.hide(); }
  };
  const capture = async at => {
    try {
      prog.show(); prog.set(0, 'Capturando frame');
      const info = await videoInfo(abs(obj[videoKey]), { at, crossOrigin: true });
      await sendImage(new File([info.blob], `${slugify(name()) || 'capa'}-capa.jpg`, { type: 'image/jpeg' }));
    } catch (e) {
      prog.hide();
      toast(`Não deu para capturar o frame (${e.message}). Envie uma imagem.`, 'err', 7000);
    }
  };

  const draw = () => {
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    input.addEventListener('change', () => input.files[0] && sendImage(input.files[0]));
    const at = h('input', { type: 'number', min: 0, step: 0.5, value: '1', class: 'poster__at', title: 'Segundo do vídeo', 'aria-label': 'Segundo do vídeo' });
    const url = h('input', { type: 'text', class: 'poster__url mono', placeholder: 'ou cole o endereço da imagem', 'aria-label': 'Endereço da imagem' });
    url.value = obj[key] || '';
    url.addEventListener('change', () => { obj[key] = url.value.trim(); finish(); });

    wrap.replaceChildren(
      h('span', { class: 'f__l' }, label),
      h('div', { class: 'poster__row' },
        h('div', { class: 'poster__img' }, obj[key] ? h('img', { src: abs(obj[key]), alt: '' }) : h('span', {}, 'Sem imagem')),
        h('div', { class: 'poster__actions' },
          h('div', { class: 'media__actions' },
            h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => input.click() }, 'Enviar imagem'),
            obj[key] && h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { obj[key] = ''; finish(); } }, 'Remover')),
          videoKey && obj[videoKey] && h('div', { class: 'poster__cap' },
            h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => capture(Number(at.value) || 0) }, 'Capturar do vídeo no segundo'),
            at),
          url, input)),
      prog.el);
  };
  draw();
  return wrap;
}

/* vídeo: arquivo próprio, YouTube ou Vimeo, + capa */
function mediaEditor(obj, { name: nameOpt = 'video', onMedia } = {}) {
  const wrap = h('div', { class: 'media' });
  const name = () => (typeof nameOpt === 'function' ? nameOpt() : nameOpt) || 'video';
  let mode = obj.video ? 'file' : ytId(obj.youtube) ? 'youtube' : obj.vimeo ? 'vimeo' : 'file';

  const sendVideo = async (file, prog) => {
    if (!file.type.startsWith('video/')) return toast('Escolha um arquivo de vídeo.', 'warn');
    try {
      prog.show(); prog.set(0, 'Preparando');
      // duração e frame saem do arquivo local, antes do envio
      const local = URL.createObjectURL(file);
      const info = await videoInfo(local, { at: 1 }).catch(() => null);
      URL.revokeObjectURL(local);

      obj.video = await uploadFile(file, 'videos', p => prog.set(p, 'Enviando vídeo'));
      if (isFinite(info?.duration) && info.duration > 0 && 'duration' in obj) obj.duration = Math.round(info.duration);
      if (info?.blob && (!obj.poster || obj.posterAuto)) {
        const img = new File([info.blob], `${slugify(name()) || 'video'}-capa.jpg`, { type: 'image/jpeg' });
        obj.poster = await uploadFile(img, 'images', p => prog.set(p, 'Enviando capa'));
        obj.posterAuto = true;
      }
      touch();
      toast(info ? 'Vídeo enviado. Duração e capa preenchidas.' : 'Vídeo enviado. Este formato não abre no navegador — prefira MP4 (H.264).', info ? 'ok' : 'warn', 6000);
    } catch (e) {
      toast('Falha no envio: ' + e.message, 'err', 8000);
    } finally {
      prog.hide();
      onMedia?.();
      draw();
    }
  };

  const draw = () => {
    const prog = progressBar();
    const seg = h('div', { class: 'seg' },
      h('button', { type: 'button', class: mode === 'file' ? 'is-on' : '', onclick: () => { mode = 'file'; draw(); } }, 'Arquivo de vídeo'),
      h('button', { type: 'button', class: mode === 'youtube' ? 'is-on' : '', onclick: () => { mode = 'youtube'; draw(); } }, 'Link do YouTube'),
      h('button', { type: 'button', class: mode === 'vimeo' ? 'is-on' : '', onclick: () => { mode = 'vimeo'; draw(); } }, 'Link do Vimeo'));

    let body;
    if (mode === 'file') {
      const input = h('input', { type: 'file', accept: 'video/*', hidden: true });
      input.addEventListener('change', () => input.files[0] && sendVideo(input.files[0], prog));
      const drop = h('div', { class: 'drop' },
        h('div', {}, h('strong', {}, 'Arraste o vídeo aqui'), h('br'), h('span', { class: 'muted' }, 'ou use o botão abaixo')));
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('is-over');
        const f = e.dataTransfer.files[0]; if (f) sendVideo(f, prog);
      });
      body = h('div', { class: 'media__body' },
        obj.video ? h('video', { class: 'media__video', src: abs(obj.video), controls: true, preload: 'metadata', playsinline: true }) : drop,
        h('div', { class: 'media__actions' },
          h('button', { type: 'button', class: 'b b--primary b--sm', onclick: () => input.click() }, obj.video ? 'Trocar vídeo' : 'Escolher vídeo'),
          obj.video && h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { obj.video = ''; touch(); onMedia?.(); draw(); } }, 'Remover vídeo'),
          input),
        prog.el,
        h('small', { class: 'f__h' }, 'MP4 (H.264) toca em todos os navegadores. O vídeo toca direto no site, sem Vimeo. Ao enviar, a duração e a capa são preenchidas sozinhas.'));
    } else if (mode === 'youtube') {
      body = h('div', { class: 'media__body' },
        field(obj, 'youtube', {
          label: 'Link do vídeo no YouTube', placeholder: 'https://youtu.be/… ou https://www.youtube.com/watch?v=…',
          onChange: v => {
            const id = ytId(v);
            if (!id) return;
            obj.youtube = id;
            obj.vimeo = '';
            if (!obj.poster || obj.posterAuto) { obj.poster = ytThumb(id); obj.posterAuto = true; }
            touch(); onMedia?.(); draw();
          },
        }),
        h('small', { class: 'f__h' }, 'Aceita vídeo normal, Shorts e live. A capa do YouTube entra sozinha (dá para trocar abaixo).'),
        obj.video && h('small', { class: 'f__h' }, 'Atenção: existe um arquivo enviado — ele tem prioridade sobre o YouTube.'));
    } else {
      body = h('div', { class: 'media__body' },
        field(obj, 'vimeo', {
          label: 'Link ou número do vídeo no Vimeo', placeholder: 'https://vimeo.com/123456789',
          onChange: v => { const m = String(v).match(/(\d{6,})/); if (m) { obj.vimeo = m[1]; obj.youtube = ''; } },
        }),
        obj.video && h('small', { class: 'f__h' }, 'Atenção: existe um arquivo enviado — ele tem prioridade sobre o Vimeo.'));
    }

    wrap.replaceChildren(seg, body,
      imageEditor(obj, 'poster', { label: 'Capa', name, videoKey: 'video', onChange: () => { obj.posterAuto = false; onMedia?.(); } }));
  };
  draw();
  return wrap;
}

/* ─────────────────────────────────────────────
   ABAS
   ───────────────────────────────────────────── */
const TABS = [
  { id: 'projects', icon: '▦', label: 'Projetos',              hint: 'Adicione, edite, reordene, oculte ou exclua trabalhos. Cada projeto pode ter uma página com vídeos, antes e depois, galerias, 3D…', render: viewProjects },
  { id: 'designs',  icon: '◈', label: 'Design & 3D',           hint: 'Trabalhos que não são vídeo: identidade visual, fotos, antes e depois, modelos 3D e PDFs.', render: viewDesigns },
  { id: 'categories', icon: '#', label: 'Categorias',          hint: 'Os filtros dos projetos: crie, renomeie, reordene e exclua.', render: viewCategories },
  { id: 'sections', icon: '☰', label: 'Seções & menu',         hint: 'Ordem das seções, seções novas e os links do menu.', render: viewSections },
  { id: 'hero',     icon: '◆', label: 'Início',                hint: 'Topo do site: nome, apresentação e chamadas.', render: viewHero },
  { id: 'about',    icon: '◉', label: 'Sobre',                 hint: 'Texto de apresentação e números.', render: viewAbout },
  { id: 'lists',    icon: '≡', label: 'Ferramentas & serviços', hint: 'Listas ao lado do texto “Sobre”. Crie quantas quiser.', render: viewLists },
  { id: 'clients',  icon: '↔', label: 'Clientes & faixa',      hint: 'Os letreiros que passam na tela.', render: viewClients },
  { id: 'contact',  icon: '✉', label: 'Contato & rodapé',      hint: 'E-mail, redes sociais e rodapé.', render: viewContact },
  { id: 'look',     icon: '◐', label: 'Aparência',       hint: 'Cores, fontes e efeitos visuais. Mudar a aparência não altera nenhum conteúdo.', render: viewLook },
  { id: 'general',  icon: '⚙', label: 'Geral & SEO',           hint: 'Marca, showreel, seção de trabalhos e como o site aparece no Google.', render: viewGeneral },
  { id: 'password', icon: '🔑', label: 'Senha',                hint: 'Trocar a senha de acesso ao painel. Vale na hora, sem publicar.', render: viewPassword },
  { id: 'media',    icon: '▶', label: 'Mídias',                hint: 'Todos os arquivos enviados. Apague o que não usa mais.', render: viewMedia },
  { id: 'history',  icon: '↺', label: 'Histórico & backup',    hint: 'Volte a uma versão anterior ou baixe um backup.', render: viewHistory },
];

function renderTabs() {
  $('#tabs').replaceChildren(...TABS.map(t =>
    h('button', { type: 'button', class: 'tab', 'data-tab': t.id, onclick: () => go(t.id) },
      h('span', { class: 'tab__i', 'aria-hidden': 'true' }, t.icon), t.label)));
}

function go(id) {
  const tab = TABS.find(t => t.id === id) || TABS[0];
  S.tab = tab.id;
  history.replaceState(null, '', '#' + tab.id);
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab.id));
  $('#tabTitle').textContent = tab.label;
  $('#tabHint').textContent = tab.hint;
  renderView();
  scrollTo(0, 0);
}

function renderView() {
  const tab = TABS.find(t => t.id === S.tab);
  $('#view').replaceChildren(tab.render());
}

/* ── Projetos e Design & 3D (mesma lista, conteúdos diferentes) ── */
const KINDS = {
  projects: { cats: 'categories',       noun: 'projeto',  Noun: 'Projeto',  nouns: 'projetos' },
  designs:  { cats: 'designCategories', noun: 'trabalho', Noun: 'Trabalho', nouns: 'trabalhos' },
};
S.redraw = {};

/* capa para a lista: a enviada, a do YouTube ou a primeira imagem dos blocos */
function thumbOf(p) {
  if (p.poster) return p.poster;
  if (ytId(p.youtube)) return ytThumb(ytId(p.youtube));
  for (const b of p.blocks || []) {
    const s = b.type === 'image' ? b.src
      : b.type === 'gallery' ? (b.images || []).find(x => x && x.src)?.src
      : b.type === 'compare' ? b.after
      : b.type === 'video' ? (b.poster || ytThumb(ytId(b.youtube)))
      : b.type === 'model' ? b.poster : '';
    if (s) return s;
  }
  return '';
}

function viewProjects() { return viewItems('projects'); }

function viewItems(kind) {
  const K = KINDS[kind];
  const d = S.draft;
  const items = d[kind];
  const catLabel = id => d[K.cats].find(c => c.id === id)?.label || 'sem categoria';
  const list = h('div', { class: 'plist' });
  const summary = h('span', { class: 'muted' });
  let dragFrom = null;

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const [p] = items.splice(from, 1);
    items.splice(to, 0, p);
    touch(); draw();
  };

  // itens do conteúdo original que não estão mais na lista
  const missing = () => (DEFAULT[kind] || []).filter(o => !items.some(p => p.id === o.id));
  const restoreOriginals = () => {
    const miss = missing();
    if (!miss.length) return;
    if (!confirm(`Trazer de volta ${miss.length} ${K.noun}(s) original(is)?\n\nOs que estão na lista agora continuam como estão.`)) return;
    items.push(...clone(miss));
    const used = new Set(miss.map(p => p.category));
    (DEFAULT[K.cats] || []).forEach(c => {
      if (used.has(c.id) && !d[K.cats].some(x => x.id === c.id)) d[K.cats].push(clone(c));
    });
    touch(); draw();
    toast(`${miss.length} ${K.noun}(s) restaurado(s). Clique em Publicar para colocar no ar.`, 'ok', 7000);
  };
  const restoreBtn = h('button', { type: 'button', class: 'b b--ghost', onclick: restoreOriginals });

  const draw = () => {
    const n = missing().length;
    restoreBtn.hidden = !n;
    restoreBtn.textContent = n === 1 ? `↺ Restaurar 1 ${K.noun} original` : `↺ Restaurar ${n} ${K.nouns} originais`;
    summary.textContent = `${items.length} ${K.nouns} · ${items.filter(p => !p.hidden).length} visíveis · a ordem daqui é a ordem do site (arraste para reordenar)`;
    list.replaceChildren(...(items.length ? items.map((p, i) => {
      const thumb = thumbOf(p);
      const nb = (p.blocks || []).length;
      const row = h('div', { class: 'prow' + (p.hidden ? ' is-hidden' : ''), draggable: 'true' },
        h('div', { class: 'prow__order', title: 'Arraste para reordenar' },
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
          h('span', { class: 'mono' }, String(i + 1).padStart(2, '0')),
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Descer', disabled: i === items.length - 1, onclick: () => move(i, i + 1) }, '↓')),
        h('button', { type: 'button', class: 'prow__thumb', title: 'Editar', onclick: () => editItem(kind, i) },
          thumb ? h('img', { src: abs(thumb), alt: '', loading: 'lazy', draggable: 'false' }) : h('span', {}, 'sem capa')),
        h('div', { class: 'prow__info' },
          h('strong', {}, p.title || 'Sem título'),
          h('span', { class: 'prow__meta mono' }, [catLabel(p.category), p.year, p.duration ? fmtDur(p.duration) : null].filter(Boolean).join(' · ')),
          h('span', { class: 'prow__badges' },
            p.video ? badge('Vídeo próprio', 'ok') : ytId(p.youtube) ? badge('YouTube') : p.vimeo ? badge('Vimeo')
              : nb ? null : badge(kind === 'projects' ? 'Sem vídeo' : 'Vazio', 'warn'),
            nb > 0 && badge(`${nb} bloco${nb > 1 ? 's' : ''}`, 'ok'),
            p.hidden && badge('Oculto'))),
        h('div', { class: 'prow__actions' },
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { p.hidden = !p.hidden; touch(); draw(); } }, p.hidden ? 'Mostrar' : 'Ocultar'),
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => editItem(kind, i) }, 'Editar'),
          h('button', {
            type: 'button', class: 'b b--danger b--sm',
            onclick: () => {
              if (!confirm(`Excluir “${p.title || 'Sem título'}”?\n\nEle some do site depois que você clicar em Publicar.`)) return;
              items.splice(i, 1); touch(); draw();
              toast(`${K.Noun} excluído do rascunho. Clique em Publicar para aplicar no site.`);
            },
          }, 'Excluir')));

      row.addEventListener('dragstart', e => { dragFrom = i; row.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => row.classList.remove('is-drag'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('is-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('is-over'); if (dragFrom !== null) move(dragFrom, i); dragFrom = null; });
      return row;
    }) : [h('div', { class: 'empty' },
      h('p', {}, kind === 'projects' ? 'Nenhum projeto na lista.' : 'Nenhum trabalho ainda. Clique em “+ Novo trabalho” e monte a página com fotos, antes e depois, 3D…'),
      n > 0 && h('p', { style: 'margin-top:14px' },
        h('button', { type: 'button', class: 'b b--primary', onclick: restoreOriginals }, `↺ Restaurar os ${n} ${K.nouns} originais`)))]));
  };
  draw();
  S.redraw[kind] = draw;
  if (kind === 'projects') S.redrawProjects = draw;

  return frag(
    h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'b b--primary', onclick: () => editItem(kind, -1) }, `+ Novo ${K.noun}`),
      kind === 'projects' && h('button', { type: 'button', class: 'b b--ghost', onclick: () => go('categories') }, '# Categorias'),
      restoreBtn,
      summary),
    list);
}

/* ── Design & 3D ── */
function viewDesigns() {
  const d = S.draft;
  return frag(
    viewItems('designs'),
    box('Categorias desta seção', 'Os filtros da seção Design & 3D. Categorias sem trabalhos visíveis não aparecem no site.',
      categoriesEditor('designs')),
    box('Textos da seção', 'A seção fica logo depois dos trabalhos em vídeo (mude a ordem em Seções & menu) e some sozinha enquanto estiver vazia.',
      grid(field(d.design, 'num', { label: 'Número' }), field(d.design, 'allLabel', { label: 'Filtro “todos”' })),
      field(d.design, 'title', { label: 'Título', rows: 2, hint: 'Pule linha para quebrar o título.' }),
      field(d.design, 'subtitle', { label: 'Subtítulo' })));
}

function categoriesEditor(kind = 'projects') {
  const d = S.draft;
  const cats = d[KINDS[kind].cats];
  const wrap = h('div', { class: 'list' });
  const draw = () => wrap.replaceChildren(
    ...cats.map((c, i) => {
      const used = d[kind].filter(p => p.category === c.id).length;
      const inp = h('input', { type: 'text', 'aria-label': 'Nome da categoria' });
      inp.value = c.label;
      inp.addEventListener('input', () => { c.label = inp.value; touch(); });
      return h('div', { class: 'row' },
        h('span', { class: 'row__n mono' }, String(i + 1).padStart(2, '0')),
        inp,
        h('span', { class: 'row__count mono muted' }, `${used} ${kind === 'projects' ? 'proj.' : 'trab.'}`),
        rowTools(cats, i, draw, {
          beforeDelete: () => !used || confirm(`${used} item(ns) usam “${c.label}”. Eles vão aparecer só em “Todos”. Remover mesmo?`),
          onChange: () => S.redraw[kind]?.(),
        }));
    }),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        cats.push({ id: 'cat-' + Math.random().toString(36).slice(2, 7), label: 'NOVA CATEGORIA' });
        touch(); draw();
        [...wrap.querySelectorAll('.row input')].pop()?.select();
      },
    }, '+ Nova categoria'));
  draw();
  return wrap;
}

function editProject(i) { return editItem('projects', i); }

function editItem(kind, i) {
  const K = KINDS[kind];
  const list = S.draft[kind];
  const isNew = i < 0;
  const P = isNew
    ? { id: uid(), title: '', year: new Date().getFullYear(), duration: 0, category: S.draft[K.cats][0]?.id || '',
        tag: '', description: '', vimeo: '', youtube: '', video: '', poster: '', hidden: false, blocks: [] }
    : clone(list[i]);
  P.blocks ||= [];
  const dlg = $('#dlg');

  const close = () => dlg.close();
  const save = () => {
    if (S.uploading) return toast('Aguarde o envio terminar.', 'warn');
    if (!String(P.title).trim()) return toast(`Dê um título ao ${K.noun}.`, 'warn');
    const good = P.blocks.filter(blockOk);
    if (kind === 'designs' && !good.length && !hasVideo(P) && !P.poster) {
      return toast('Adicione pelo menos um bloco (fotos, antes e depois, 3D, PDF…) ou uma capa.', 'warn');
    }
    const dropped = P.blocks.length - good.length;
    P.blocks = good;
    P.year = P.year === '' ? '' : Number(P.year) || '';
    P.duration = Math.round(Number(P.duration) || 0);
    if (isNew) list.unshift(P);
    else list[i] = P;
    touch(); close();
    S.redraw[kind]?.();
    toast((isNew ? `${K.Noun} adicionado no topo.` : `${K.Noun} atualizado.`)
      + (dropped ? ` ${dropped} bloco(s) vazio(s) ou incompleto(s) ficaram de fora.` : '')
      + ' Clique em Publicar para colocar no ar.', dropped ? 'warn' : 'ok', 7000);
  };

  const draw = () => $('#dlgInner').replaceChildren(
    h('header', { class: 'dlg__h' },
      h('h2', {}, isNew ? `Novo ${K.noun}` : `Editar ${K.noun}`),
      h('button', { type: 'button', class: 'ib', 'aria-label': 'Fechar', onclick: close }, '✕')),
    h('div', { class: 'dlg__b' },
      grid(
        field(P, 'title', { label: 'Título' }),
        field(P, 'tag', { label: 'Rótulo sobre a capa', placeholder: kind === 'projects' ? 'Ex.: Abertura' : 'Ex.: Branding' })),
      grid(
        catPick(P, draw, kind),
        field(P, 'year', { label: 'Ano', type: 'number' }),
        kind === 'projects' && field(P, 'duration', { label: 'Duração (segundos)', type: 'number', hint: 'Preenchida sozinha ao enviar um vídeo.' })),
      field(P, 'description', { label: 'Descrição', rows: 3, hint: 'Aparece no card e no topo da página do projeto.' }),
      h('span', { class: 'f__l' }, kind === 'projects' ? 'Vídeo principal' : 'Vídeo principal (opcional)'),
      mediaEditor(P, { name: () => P.title || K.noun, onMedia: draw }),
      h('div', { class: 'blocks-h' },
        h('h3', {}, 'Página do projeto'),
        tip('Monte a página com blocos — vídeos, antes e depois, galerias, imagens, textos, modelos 3D, PDFs e botões. No site eles aparecem um embaixo do outro, nesta ordem. Com pelo menos um bloco, o card abre a página do projeto.')),
      blocksEditor(P),
      field(P, 'hidden', { type: 'toggle', invert: true, label: 'Visível no site', hint: 'Desligue para esconder sem excluir.' })),
    h('footer', { class: 'dlg__f' },
      h('button', { type: 'button', class: 'b b--ghost', onclick: close }, 'Cancelar'),
      h('button', { type: 'button', class: 'b b--primary', onclick: save }, isNew ? `Adicionar ${K.noun}` : `Salvar ${K.noun}`)));

  draw();
  dlg.showModal();
  if (isNew) $('#dlgInner input')?.focus();
}

/* ─────────────────────────────────────────────
   BLOCOS DA PÁGINA DO PROJETO
   ───────────────────────────────────────────── */
const BLOCK_TYPES = {
  video:   { icon: '▶', label: 'Vídeo',          make: () => ({ type: 'video', title: '', video: '', vimeo: '', youtube: '', poster: '' }) },
  compare: { icon: '⇆', label: 'Antes e depois', make: () => ({ type: 'compare', before: '', after: '', caption: '' }) },
  gallery: { icon: '▦', label: 'Galeria',        make: () => ({ type: 'gallery', title: '', columns: '3', images: [] }) },
  image:   { icon: '▣', label: 'Imagem',         make: () => ({ type: 'image', src: '', caption: '' }) },
  text:    { icon: '¶', label: 'Texto',          make: () => ({ type: 'text', title: '', body: '' }) },
  model:   { icon: '◈', label: 'Modelo 3D',      make: () => ({ type: 'model', title: '', src: '', poster: '' }) },
  pdf:     { icon: '▤', label: 'PDF',            make: () => ({ type: 'pdf', src: '', label: 'VER PDF' }) },
  link:    { icon: '↗', label: 'Botão com link', make: () => ({ type: 'link', label: 'VER NO BEHANCE', url: '' }) },
};
const blockOk = b => {
  if (!b) return false;
  switch (b.type) {
    case 'video':   return hasVideo(b);
    case 'compare': return !!(b.before && b.after);
    case 'gallery': return (b.images || []).some(x => x && x.src);
    case 'image':   return !!b.src;
    case 'text':    return !!(String(b.title || '').trim() || String(b.body || '').trim());
    case 'model':   return !!b.src;
    case 'pdf':     return !!b.src;
    case 'link':    return !!(String(b.url || '').trim() && String(b.label || '').trim());
    default:        return false;
  }
};

/* arquivo qualquer (3D, PDF): envio, abrir, remover ou colar endereço */
function fileEditor(obj, key, { label = 'Arquivo', accept = '*/*', folder = 'files', onChange } = {}) {
  const wrap = h('div', { class: 'poster' });
  const prog = progressBar();
  const draw = () => {
    const input = h('input', { type: 'file', accept, hidden: true });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        prog.show();
        obj[key] = await uploadFile(f, folder, p => prog.set(p, 'Enviando'));
        touch(); onChange?.(obj[key]); draw();
        toast('Arquivo enviado.', 'ok');
      } catch (e) { toast('Falha no envio: ' + e.message, 'err', 8000); }
      finally { prog.hide(); }
    });
    const url = h('input', { type: 'text', class: 'poster__url mono', placeholder: 'ou cole o endereço do arquivo', 'aria-label': 'Endereço do arquivo' });
    url.value = obj[key] || '';
    url.addEventListener('change', () => { obj[key] = url.value.trim(); touch(); onChange?.(obj[key]); draw(); });
    let nameTxt = '';
    try { nameTxt = obj[key] ? decodeURIComponent(String(obj[key]).split('?')[0].split('/').pop()) : ''; } catch { nameTxt = obj[key]; }
    wrap.replaceChildren(
      h('span', { class: 'f__l' }, label),
      h('div', { class: 'media__actions' },
        h('button', { type: 'button', class: 'b b--primary b--sm', onclick: () => input.click() }, obj[key] ? 'Trocar arquivo' : 'Escolher arquivo'),
        obj[key] && h('a', { class: 'b b--ghost b--sm', href: abs(obj[key]), target: '_blank', rel: 'noopener' }, 'Abrir'),
        obj[key] && h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { obj[key] = ''; touch(); onChange?.(''); draw(); } }, 'Remover'),
        input),
      nameTxt && h('small', { class: 'f__h mono' }, nameTxt),
      url, prog.el);
  };
  draw();
  return wrap;
}

/* tira uma "foto" do modelo 3D para usar de capa */
let mvLoad = null;
async function modelPoster(src) {
  try { await (mvLoad ||= import(MODEL_VIEWER)); } catch (e) { mvLoad = null; throw e; }
  const holder = h('div', { style: 'position:fixed;right:0;bottom:0;width:800px;height:500px;opacity:.01;pointer-events:none;z-index:-1' });
  const mv = document.createElement('model-viewer');
  mv.style.cssText = 'width:100%;height:100%';
  mv.setAttribute('shadow-intensity', '1');
  holder.append(mv);
  document.body.append(holder);
  try {
    const loaded = new Promise((res, rej) => {
      mv.addEventListener('load', res, { once: true });
      mv.addEventListener('error', () => rej(new Error('modelo inválido')), { once: true });
      setTimeout(() => rej(new Error('tempo esgotado')), 30000);
    });
    mv.src = abs(src);
    await loaded;
    await new Promise(r => setTimeout(r, 800));
    const blob = await mv.toBlob({ mimeType: 'image/webp', qualityArgument: 0.9 });
    if (!blob || !blob.size) throw new Error('capa vazia');
    return blob;
  } finally { holder.remove(); }
}

function blockFields(b, P) {
  switch (b.type) {
    case 'video': return [
      field(b, 'title', { label: 'Título (opcional)', placeholder: 'Ex.: Making of' }),
      mediaEditor(b, { name: () => b.title || P.title || 'video' })];
    case 'compare': return [
      grid(imageEditor(b, 'before', { label: 'Antes', name: () => (P.title || 'projeto') + '-antes' }),
           imageEditor(b, 'after', { label: 'Depois', name: () => (P.title || 'projeto') + '-depois' })),
      field(b, 'caption', { label: 'Legenda (opcional)', placeholder: 'Ex.: Logo antigo → logo novo', hint: 'Use imagens com o mesmo tamanho e enquadramento.' })];
    case 'gallery': return [
      grid(field(b, 'title', { label: 'Título (opcional)', placeholder: 'Ex.: Bastidores' }),
           field(b, 'columns', { label: 'Colunas no computador', options: [2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) })) })),
      galleryEditor(b)];
    case 'image': return [
      imageEditor(b, 'src', { label: 'Imagem', name: () => P.title || 'imagem' }),
      field(b, 'caption', { label: 'Legenda (opcional)' })];
    case 'text': return [
      field(b, 'title', { label: 'Título (opcional)' }),
      field(b, 'body', { label: 'Texto', rows: 6, hint: 'Deixe uma linha em branco entre os parágrafos.' }),
      RICH_HINT.cloneNode(true)];
    case 'model': {
      const poster = h('div');
      const drawPoster = () => poster.replaceChildren(imageEditor(b, 'poster', { label: 'Capa do 3D (opcional)', name: () => (P.title || 'modelo') + '-3d' }));
      drawPoster();
      const auto = async () => {
        if (!b.src) return toast('Envie o arquivo 3D primeiro.', 'warn');
        toast('Gerando a capa do 3D…', '', 6000);
        try {
          const blob = await modelPoster(b.src);
          b.poster = await uploadFile(new File([blob], `${slugify(P.title) || 'modelo'}-3d.webp`, { type: 'image/webp' }), 'images');
          if (!P.poster && !thumbOf({ ...P, blocks: [] })) P.poster = b.poster;
          touch(); drawPoster();
          toast('Capa do 3D gerada.', 'ok');
        } catch (e) { toast(`Não deu para gerar a capa (${e.message}). Envie uma imagem.`, 'err', 7000); }
      };
      return [
        field(b, 'title', { label: 'Título (opcional)' }),
        fileEditor(b, 'src', { label: 'Arquivo 3D (.glb)', accept: '.glb,.gltf,model/gltf-binary,model/gltf+json', folder: '3d', onChange: v => { if (v && !b.poster) auto(); } }),
        tip('Use GLB (arquivo único). No Blender ou no Cinema 4D: exportar como glTF Binary (.glb). No site dá para girar e dar zoom.'),
        poster,
        h('div', { class: 'media__actions' }, h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: auto }, 'Gerar capa a partir do 3D'))];
    }
    case 'pdf': return [
      fileEditor(b, 'src', { label: 'Arquivo PDF', accept: 'application/pdf,.pdf', folder: 'docs' }),
      field(b, 'label', { label: 'Texto do botão', placeholder: 'VER APRESENTAÇÃO COMPLETA' })];
    case 'link': return [
      grid(field(b, 'label', { label: 'Texto do botão', placeholder: 'VER NO BEHANCE' }),
           field(b, 'url', { label: 'Link', placeholder: 'https://…, @usuario ou número do WhatsApp' }))];
    default: return [];
  }
}

function blocksEditor(P) {
  const wrap = h('div', { class: 'blocks' });
  const draw = focusIndex => {
    const cards = P.blocks.map((b, i) => {
      const t = BLOCK_TYPES[b.type] || { icon: '•', label: b.type };
      return h('div', { class: 'blk' + (blockOk(b) ? '' : ' is-empty') },
        h('div', { class: 'blk__h' },
          h('span', { class: 'blk__n mono' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'blk__i' }, t.icon),
          h('strong', {}, t.label),
          h('span', { class: 'badge badge--warn blk__warn', hidden: blockOk(b) }, 'Incompleto'),
          rowTools(P.blocks, i, () => draw(), { beforeDelete: blk => !blockOk(blk) || confirm(`Remover o bloco “${t.label}”?`) })),
        h('div', { class: 'blk__b' }, blockFields(b, P)));
    });
    wrap.replaceChildren(
      ...(cards.length ? cards : [h('p', { class: 'empty' }, 'Nenhum bloco ainda. Escolha abaixo o que colocar na página do projeto.')]),
      h('div', { class: 'blk-add' },
        h('span', { class: 'f__l' }, 'Adicionar bloco'),
        h('div', { class: 'blk-add__btns' }, Object.entries(BLOCK_TYPES).map(([type, t]) =>
          h('button', {
            type: 'button', class: 'b b--ghost b--sm',
            onclick: () => { P.blocks.push(t.make()); touch(); draw(P.blocks.length - 1); },
          }, `+ ${t.icon} ${t.label}`)))));
    if (focusIndex != null) wrap.children[focusIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // selo "Incompleto" acompanha o preenchimento (digitação e envios chamam touch)
  S.refreshBlocks = () => wrap.querySelectorAll(':scope > .blk').forEach((el, i) => {
    const ok = blockOk(P.blocks[i]);
    el.classList.toggle('is-empty', !ok);
    const warn = el.querySelector('.blk__warn');
    if (warn) warn.hidden = ok;
  });
  draw();
  return wrap;
}

/* ── Categorias ── */
function viewCategories() {
  return frag(
    box('Categorias', 'Viram os botões de filtro acima dos projetos. Crie, renomeie, reordene (setas) ou exclua. Categorias sem projetos visíveis não aparecem no site.',
      categoriesEditor()),
    tip('Para mudar a categoria de um projeto, abra ', h('strong', {}, 'Projetos → Editar'), '. Lá também dá para criar uma categoria nova na hora.'));
}

/* seletor de categoria com criação na hora (usado no editor de projeto) */
function catPick(P, redraw, kind = 'projects') {
  const cats = S.draft[KINDS[kind].cats];
  return h('div', { class: 'catpick' },
    field(P, 'category', { label: 'Categoria', options: [{ value: '', label: '— sem categoria —' }, ...cats.map(c => ({ value: c.id, label: c.label }))] }),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        const label = (prompt('Nome da nova categoria:') || '').trim();
        if (!label) return;
        const c = { id: 'cat-' + Math.random().toString(36).slice(2, 7), label };
        cats.push(c);
        P.category = c.id;
        touch(); redraw();
        toast(`Categoria “${label}” criada.`, 'ok');
      },
    }, '+ Nova categoria'));
}

/* fontes do Google para a prévia do painel */
const loadedFonts = new Set();
function loadFonts(ty) {
  const specs = [FONTS.display[ty.display], FONTS.mono[ty.mono]].filter(s => s && !loadedFonts.has(s));
  if (!specs.length) return;
  specs.forEach(s => loadedFonts.add(s));
  document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + specs.map(s => 'family=' + s).join('&') + '&display=swap' }));
}

/* ── Seções & menu ── */
const BUILTIN_SECTIONS = {
  ticker:  { label: 'Faixa de palavras', icon: '↔', tab: 'clients' },
  works:   { label: 'Trabalhos',         icon: '▦', tab: 'projects' },
  design:  { label: 'Design & 3D',       icon: '◈', tab: 'designs' },
  about:   { label: 'Sobre',             icon: '◉', tab: 'about' },
  clients: { label: 'Clientes',          icon: '↔', tab: 'clients' },
  contact: { label: 'Contato',           icon: '✉', tab: 'contact' },
};
const SECTION_TYPES = {
  text:    { label: 'Texto',              icon: '¶', desc: 'Título, parágrafos e uma imagem opcional.',
             make: () => ({ num: '', title: 'NOVA SEÇÃO', body: 'Escreva aqui o primeiro parágrafo.\n\nE aqui o segundo.', image: '', imageSide: 'right' }) },
  gallery: { label: 'Galeria de imagens', icon: '▦', desc: 'Grade de fotos que abrem em tela cheia.',
             make: () => ({ num: '', title: 'GALERIA', subtitle: '', columns: 3, images: [] }) },
  video:   { label: 'Vídeo em destaque',  icon: '▶', desc: 'Um vídeo grande com capa (arquivo ou Vimeo).',
             make: () => ({ num: '', title: 'EM DESTAQUE', subtitle: '', video: '', vimeo: '', poster: '' }) },
  cards:   { label: 'Cards',              icon: '▤', desc: 'Blocos com título e texto: processo, prêmios, depoimentos…',
             make: () => ({ num: '', title: 'COMO TRABALHO', subtitle: '', items: [{ title: 'Briefing', text: 'Entendemos o objetivo.' }, { title: 'Criação', text: 'Roteiro, estilo e animação.' }] }) },
  cta:     { label: 'Chamada com botão',  icon: '➜', desc: 'Frase grande e um botão para qualquer link.',
             make: () => ({ kicker: '', title: 'VAMOS CONVERSAR?', text: '', button: 'FALE COMIGO', url: '#contato' }) },
  band:    { label: 'Faixa de palavras',  icon: '↔', desc: 'Outro letreiro passando na tela.',
             make: () => ({ items: ['NOVA FAIXA', 'MOTION', 'DESIGN'] }) },
};
const sectionAnchor = s => BUILTIN_SECTIONS[s.type]
  ? (s.type === 'ticker' ? '' : ANCHORS[s.type] || '')
  : (s.type === 'band' ? '' : s.anchor || '');
const sectionName = s => BUILTIN_SECTIONS[s.type]
  ? BUILTIN_SECTIONS[s.type].label
  : s.type === 'band' ? `Faixa: ${(s.items || []).filter(Boolean)[0] || '(vazia)'}` : (s.title || 'Sem título');

function uniqueAnchor(base, selfId) {
  const taken = new Set(['inicio', ...Object.values(ANCHORS),
    ...S.draft.layout.filter(x => x.id !== selfId).map(x => x.anchor).filter(Boolean)]);
  const a = slugify(base) || 'secao';
  let out = a, n = 2;
  while (taken.has(out)) out = `${a}-${n++}`;
  return out;
}

function viewSections() {
  const d = S.draft;
  let dragFrom = null;
  const move = (a, b) => {
    if (b < 0 || b >= d.layout.length || a === b) return;
    const [x] = d.layout.splice(a, 1);
    d.layout.splice(b, 0, x);
    touch(); renderView();
  };
  const remove = i => {
    const s = d.layout[i];
    if (!confirm(`Excluir a seção “${sectionName(s)}”?\n\nEla some do site depois que você clicar em Publicar.`)) return;
    const a = sectionAnchor(s);
    d.layout.splice(i, 1);
    if (a) for (let k = d.nav.items.length - 1; k >= 0; k--) if (d.nav.items[k].target === '#' + a) d.nav.items.splice(k, 1);
    touch(); renderView();
  };
  const duplicate = i => {
    const c = clone(d.layout[i]);
    c.id = 's' + Math.random().toString(36).slice(2, 8);
    if (c.title) c.title += ' (cópia)';
    if (c.type !== 'band') c.anchor = uniqueAnchor(c.title || c.type, c.id);
    d.layout.splice(i + 1, 0, c);
    touch(); renderView();
  };
  const fixedRow = (label, meta, tab) => h('div', { class: 'srow srow--fixed' },
    h('span', { class: 'srow__lock', title: 'Posição fixa' }, '•'),
    h('span', { class: 'srow__i' }, '▬'),
    h('div', { class: 'prow__info' }, h('strong', {}, label), h('span', { class: 'prow__meta mono' }, meta)),
    h('div', { class: 'prow__actions' }, h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => go(tab) }, 'Editar')));

  const list = h('div', { class: 'plist' },
    fixedRow('Topo', 'sempre o primeiro', 'hero'),
    d.layout.map((s, i) => {
      const b = BUILTIN_SECTIONS[s.type], t = SECTION_TYPES[s.type];
      const anchor = sectionAnchor(s);
      const row = h('div', { class: 'srow' + (s.hidden ? ' is-hidden' : ''), draggable: 'true' },
        h('div', { class: 'prow__order', title: 'Arraste para reordenar' },
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
          h('span', { class: 'mono' }, String(i + 1).padStart(2, '0')),
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Descer', disabled: i === d.layout.length - 1, onclick: () => move(i, i + 1) }, '↓')),
        h('span', { class: 'srow__i' }, b?.icon || t?.icon || '•'),
        h('div', { class: 'prow__info' },
          h('strong', {}, sectionName(s)),
          h('span', { class: 'prow__meta mono' }, [b ? 'seção padrão' : t?.label, anchor && '#' + anchor].filter(Boolean).join(' · ')),
          s.hidden && h('span', { class: 'prow__badges' }, badge('Oculta'))),
        h('div', { class: 'prow__actions' },
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { s.hidden = !s.hidden; touch(); renderView(); } }, s.hidden ? 'Mostrar' : 'Ocultar'),
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => b ? go(b.tab) : editSection(i) }, 'Editar'),
          !b && h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => duplicate(i) }, 'Duplicar'),
          !b && h('button', { type: 'button', class: 'b b--danger b--sm', onclick: () => remove(i) }, 'Excluir')));
      row.addEventListener('dragstart', e => { dragFrom = i; row.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => row.classList.remove('is-drag'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('is-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('is-over'); if (dragFrom !== null) move(dragFrom, i); dragFrom = null; });
      return row;
    }),
    fixedRow('Rodapé', 'sempre o último', 'contact'));

  return frag(
    box('Ordem das seções', 'Arraste (ou use as setas) para mudar a ordem no site. Topo e rodapé ficam fixos. As seções padrão podem ser ocultadas; as que você criar também podem ser duplicadas e excluídas.', list),
    box('Adicionar seção', 'Escolha um tipo. A seção nova entra antes do Contato — depois é só arrastar.',
      h('div', { class: 'types' }, Object.entries(SECTION_TYPES).map(([type, t]) =>
        h('button', { type: 'button', class: 'type', onclick: () => addSection(type) },
          h('span', { class: 'type__i' }, t.icon), h('strong', {}, t.label), h('span', { class: 'muted' }, t.desc))))),
    box('Menu', 'Links do menu do topo e do menu do celular. Aponte para qualquer seção ou para um link externo.', menuEditor()));
}

function addSection(type) {
  const t = SECTION_TYPES[type];
  const s = { id: 's' + Math.random().toString(36).slice(2, 8), type, hidden: false, ...t.make() };
  if (type !== 'band') s.anchor = uniqueAnchor(s.title || type, s.id);
  editSection(-1, s);
}

function editSection(i, fresh) {
  const isNew = !!fresh;
  const orig = fresh || S.draft.layout[i];
  const X = clone(orig);
  const t = SECTION_TYPES[X.type];
  if (!t) return;
  const dlg = $('#dlg');
  const close = () => dlg.close();

  const save = () => {
    if (S.uploading) return toast('Aguarde o envio terminar.', 'warn');
    const d = S.draft;
    if (X.type !== 'band') {
      const old = isNew ? '' : orig.anchor;
      X.anchor = uniqueAnchor(X.anchor || X.title || X.type, X.id);
      if (old && old !== X.anchor) d.nav.items.forEach(n => { if (n.target === '#' + old) n.target = '#' + X.anchor; });
    }
    if (isNew) {
      const ci = d.layout.findIndex(s => s.type === 'contact');
      d.layout.splice(ci < 0 ? d.layout.length : ci, 0, X);
    } else {
      const at = d.layout.findIndex(s => s.id === X.id);
      d.layout[at < 0 ? i : at] = X;
    }
    touch(); close();
    if (S.tab === 'sections') renderView();
    toast(isNew ? 'Seção criada. Clique em Publicar para colocar no ar.' : 'Seção salva. Clique em Publicar para aplicar.', 'ok');
  };

  const head = () => grid(field(X, 'num', { label: 'Número', placeholder: 'Ex.: 04' }), field(X, 'title', { label: 'Título' }));
  const sub = () => field(X, 'subtitle', { label: 'Subtítulo (opcional)' });
  const fields = () => {
    switch (X.type) {
      case 'text': return [head(),
        field(X, 'body', { label: 'Texto', rows: 8, hint: 'Deixe uma linha em branco entre os parágrafos. O primeiro aparece maior.' }),
        RICH_HINT.cloneNode(true),
        imageEditor(X, 'image', { label: 'Imagem (opcional)', name: () => X.title || 'secao' }),
        field(X, 'imageSide', { label: 'Lado da imagem', options: [{ value: 'right', label: 'Direita' }, { value: 'left', label: 'Esquerda' }] })];
      case 'gallery': return [head(), sub(),
        field(X, 'columns', { label: 'Colunas no computador', options: [2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) })) }),
        h('span', { class: 'f__l' }, 'Imagens'), galleryEditor(X)];
      case 'video': return [head(), sub(),
        h('span', { class: 'f__l' }, 'Vídeo'), mediaEditor(X, { name: () => X.title || 'video', onMedia: draw })];
      case 'cards': return [head(), sub(),
        objList(X.items, [{ key: 'title', label: 'Título', w: '1fr' }, { key: 'text', label: 'Texto', w: '2fr' }], { addLabel: 'Adicionar card' }),
        RICH_HINT.cloneNode(true)];
      case 'cta': return [
        field(X, 'kicker', { label: 'Frase pequena acima (opcional)' }),
        field(X, 'title', { label: 'Título' }),
        field(X, 'text', { label: 'Texto (opcional)', rows: 3 }),
        grid(field(X, 'button', { label: 'Texto do botão' }),
             field(X, 'url', { label: 'Link do botão', placeholder: '#contato, https://… ou mailto:…' }))];
      case 'band': return [h('span', { class: 'f__l' }, 'Palavras'),
        strList(X.items, { placeholder: 'Ex.: DIREÇÃO DE ARTE', addLabel: 'Adicionar palavra' })];
      default: return [];
    }
  };

  const draw = () => $('#dlgInner').replaceChildren(
    h('header', { class: 'dlg__h' },
      h('h2', {}, `${isNew ? 'Nova seção' : 'Editar seção'} · ${t.label}`),
      h('button', { type: 'button', class: 'ib', 'aria-label': 'Fechar', onclick: close }, '✕')),
    h('div', { class: 'dlg__b' },
      fields(),
      X.type !== 'band' && field(X, 'anchor', { label: 'Endereço da seção', placeholder: 'ex.: depoimentos', hint: 'Usado nos links do menu (#endereço). Letras, números e hífen.' }),
      field(X, 'hidden', { type: 'toggle', invert: true, label: 'Visível no site' })),
    h('footer', { class: 'dlg__f' },
      h('button', { type: 'button', class: 'b b--ghost', onclick: close }, 'Cancelar'),
      h('button', { type: 'button', class: 'b b--primary', onclick: save }, isNew ? 'Criar seção' : 'Salvar seção')));

  draw();
  dlg.showModal();
}

/* galeria: várias imagens, com legenda e ordem */
function galleryEditor(X) {
  const wrap = h('div', { class: 'stack' });
  const prog = progressBar();
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const draw = () => wrap.replaceChildren(
    X.images.length
      ? h('div', { class: 'gal' }, X.images.map((im, k) => {
          const cap = h('input', { type: 'text', placeholder: 'Legenda (opcional)', 'aria-label': 'Legenda' });
          cap.value = im.caption || '';
          cap.addEventListener('input', () => { im.caption = cap.value; touch(); });
          return h('div', { class: 'gal__item' }, h('img', { src: abs(im.src), alt: '' }), h('div', { class: 'gal__b' }, cap, rowTools(X.images, k, draw)));
        }))
      : h('p', { class: 'empty' }, 'Nenhuma imagem ainda.'),
    h('div', { class: 'media__actions' },
      h('button', { type: 'button', class: 'b b--primary b--sm', onclick: () => input.click() }, '+ Adicionar imagens'), input),
    prog.el);
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    prog.show();
    for (const [n, f] of files.entries()) {
      try {
        const url = await uploadFile(f, 'images', p => prog.set(p, `Enviando ${n + 1} de ${files.length}`));
        X.images.push({ src: url, caption: '' });
        touch(); draw();
      } catch (e) { toast(`Falha em ${f.name}: ${e.message}`, 'err', 8000); }
    }
    prog.hide();
  });
  draw();
  return wrap;
}

/* menu: texto + destino (seção do site ou link externo) */
function menuEditor() {
  const d = S.draft, items = d.nav.items;
  const wrap = h('div', { class: 'stack' });
  const draw = () => {
    const opts = [{ value: '#inicio', label: 'Topo' },
      ...d.layout.filter(sectionAnchor).map(s => ({ value: '#' + sectionAnchor(s), label: sectionName(s) + (s.hidden ? ' (oculta)' : '') }))];
    wrap.replaceChildren(
      h('div', { class: 'list' },
        items.length ? h('div', { class: 'list__head', style: '--cols:1fr 1.3fr' }, h('span', {}, 'Texto'), h('span', {}, 'Leva para')) : null,
        items.map((it, i) => {
          const lbl = h('input', { type: 'text', placeholder: 'TRABALHOS', 'aria-label': 'Texto do link' });
          lbl.value = it.label || '';
          lbl.addEventListener('input', () => { it.label = lbl.value; touch(); });
          const isSection = opts.some(o => o.value === it.target);
          const sel = h('select', { 'aria-label': 'Destino do link' },
            opts.map(o => h('option', { value: o.value }, o.label)),
            h('option', { value: '__url' }, 'Link personalizado…'));
          sel.value = isSection ? it.target : '__url';
          const url = h('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Endereço do link', hidden: isSection });
          url.value = isSection ? '' : it.target || '';
          sel.addEventListener('change', () => {
            if (sel.value === '__url') { it.target = url.value.trim(); url.hidden = false; url.focus(); }
            else { it.target = sel.value; url.hidden = true; }
            touch();
          });
          url.addEventListener('input', () => { it.target = url.value.trim(); touch(); });
          return h('div', { class: 'row' },
            h('span', { class: 'row__n mono' }, String(i + 1).padStart(2, '0')),
            h('div', { class: 'row__fields', style: '--cols:1fr 1.3fr' }, lbl, h('div', { class: 'stack stack--tight' }, sel, url)),
            rowTools(items, i, draw));
        }),
        h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { items.push({ label: 'NOVO LINK', target: '#inicio' }); touch(); draw(); } }, '+ Adicionar link')),
      field(d.nav, 'reel', { label: 'Texto do botão showreel (no menu)' }),
      tip('Links para seções ocultas não aparecem no site.'));
  };
  draw();
  return wrap;
}

/* ── Início ── */
function viewHero() {
  const c = S.draft.hero;
  return frag(
    box('Nome', 'As duas linhas grandes do topo. A segunda aparece vazada (só o contorno).',
      grid(field(c, 'line1', { label: 'Linha 1' }), field(c, 'line2', { label: 'Linha 2' }))),
    box('Linha de cima', 'Rótulos pequenos acima do nome, separados por “/”.',
      strList(c.eyebrow, { placeholder: 'Ex.: CREATIVE MOTION DIRECTOR' })),
    box('Especialidades', 'Palavras que ficam girando abaixo do nome.',
      field(c, 'rotatorLabel', { label: 'Rótulo' }),
      strList(c.rotator, { placeholder: 'Ex.: VINHETAS' })),
    box('Apresentação', null,
      field(c, 'lede', { label: 'Texto', rows: 4 }), RICH_HINT,
      grid(
        field(c, 'ctaPrimary', { label: 'Botão do showreel' }),
        field(c, 'ctaSecondary', { label: 'Botão de projetos', hint: '{n} vira o número de projetos visíveis.' }))),
    box('Rodapé do topo', null,
      field(c, 'showStatus', { type: 'toggle', label: 'Mostrar status (bolinha verde)' }),
      grid(
        field(c, 'status', { label: 'Status' }),
        field(c, 'scrollLabel', { label: 'Texto “role”' }),
        field(c, 'clockLabel', { label: 'Legenda do relógio' }),
        field(c, 'timezone', { label: 'Fuso do relógio', list: 'tzlist', hint: 'Ex.: America/Sao_Paulo' })),
      h('datalist', { id: 'tzlist' }, ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife',
        'America/Cuiaba', 'America/Porto_Velho', 'America/Rio_Branco', 'America/Noronha', 'Europe/Lisbon', 'Europe/London',
        'America/New_York', 'America/Los_Angeles'].map(z => h('option', { value: z })))),
    box('Tela de carregamento', null, field(c, 'loaderLabel', { label: 'Texto' })));
}

/* ── Sobre ── */
function viewAbout() {
  const a = S.draft.about;
  return frag(
    box('Título da seção', null,
      grid(field(a, 'num', { label: 'Número' }), field(a, 'title', { label: 'Título' }))),
    box('Texto', null,
      field(a, 'lead', { label: 'Parágrafo de destaque (maior)', rows: 4 }),
      h('span', { class: 'f__l' }, 'Parágrafos'),
      strList(a.paragraphs, { rows: 3, placeholder: 'Escreva um parágrafo…', addLabel: 'Adicionar parágrafo' }),
      RICH_HINT,
      field(a, 'signature', { label: 'Assinatura', hint: 'Deixe vazio para não mostrar.' })),
    box('Números', 'Os destaques numéricos. Use {n} para mostrar a quantidade de projetos visíveis.',
      objList(a.stats, [
        { key: 'value', label: 'Número', w: '120px', placeholder: '10 ou {n}' },
        { key: 'suffix', label: 'Sufixo', w: '90px', placeholder: '+' },
        { key: 'label', label: 'Legenda', placeholder: 'ANOS DE ESTRADA' },
      ], { addLabel: 'Adicionar número' })));
}

/* ── Ferramentas & serviços ── */
function viewLists() {
  const lists = S.draft.about.lists;
  const redraw = () => renderView();
  return frag(
    ...lists.map((l, i) => {
      const title = h('h2', {}, l.title || 'Lista sem título');
      const sec = box('', null,
        field(l, 'title', { label: 'Título da lista', onChange: v => title.textContent = v || 'Lista sem título' }),
        objList(l.items, [
          { key: 'name', label: 'Item' },
          { key: 'detail', label: 'Detalhe (à direita)', w: '38%' },
        ], { addLabel: 'Adicionar item' }));
      sec.querySelector('.box__h > div').replaceChildren(title);
      sec.querySelector('.box__h').append(rowTools(lists, i, redraw, {
        beforeDelete: () => confirm(`Remover a lista “${l.title || 'sem título'}” inteira?`),
      }));
      return sec;
    }),
    lists.length ? null : h('p', { class: 'empty' }, 'Nenhuma lista.'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'b b--primary',
        onclick: () => { lists.push({ title: 'NOVA LISTA', items: [{ name: '', detail: '' }] }); touch(); redraw(); },
      }, '+ Nova lista')));
}

/* ── Clientes & faixa ── */
function viewClients() {
  const d = S.draft;
  return frag(
    box('Clientes', 'Nomes que passam no letreiro “No ar para”.',
      field(d.clients, 'label', { label: 'Título' }),
      strList(d.clients.items, { placeholder: 'Nome do cliente', addLabel: 'Adicionar cliente' })),
    box('Faixa de palavras', 'O letreiro grande logo abaixo do topo.',
      strList(d.ticker, { placeholder: 'Ex.: MOTION DESIGN', addLabel: 'Adicionar palavra' })),
    tip('Para esconder um letreiro inteiro, use a aba ', h('strong', {}, 'Seções & menu'), '.'));
}

/* ── Contato & rodapé ── */
function viewContact() {
  const c = S.draft.contact, f = S.draft.footer;
  return frag(
    box('Chamada', null,
      grid(field(c, 'num', { label: 'Número' }), field(c, 'kicker', { label: 'Frase acima do título' })),
      grid(field(c, 'line1', { label: 'Título — linha 1' }), field(c, 'line2', { label: 'Título — linha 2 (vazada)' }))),
    box('E-mail', null,
      field(c, 'email', { label: 'E-mail de contato', type: 'email', hint: 'Deixe vazio para não mostrar.' })),
    box('Redes e links', 'Aparecem como botões no contato, no menu do celular e no rodapé — cada um com o ícone certo, escolhido pelo link (Instagram, WhatsApp, YouTube, Vimeo, LinkedIn, Behance, TikTok, e-mail…).',
      objList(c.links, [
        { key: 'label', label: 'Nome', w: '1fr', placeholder: 'Instagram' },
        { key: 'handle', label: 'Texto pequeno', w: '1fr', placeholder: '@usuario ↗' },
        { key: 'url', label: 'Link', w: '1.4fr', placeholder: 'https://… ou número do WhatsApp' },
      ], { addLabel: 'Adicionar link' }),
      tip('WhatsApp: coloque só o número com DDD e país (ex.: 55 48 99999-9999) que o link é criado sozinho. Para o canal do YouTube, cole o link do canal (youtube.com/@seucanal).')),
    box('Rodapé', null,
      grid(field(f, 'name', { label: 'Nome (após o ©)' }), field(f, 'note', { label: 'Texto do meio' }), field(f, 'backToTop', { label: 'Link “voltar ao topo”' })),
      field(f, 'social', { type: 'toggle', label: 'Mostrar as redes com ícones no rodapé' })));
}

/* ── Cores & efeitos ── */
const PRESETS = [
  { name: 'Original', colors: { ...DEFAULT.theme } },
  { name: 'Azul elétrico', colors: { ink: '#07080D', ink2: '#0C0E16', ink3: '#141827', paper: '#EEF1F8', hi: '#FFFFFF', flare: '#2F6BFF', flareSoft: '#7FA3FF', onFlare: '#FFFFFF', live: '#4ADE80' } },
  { name: 'Verde ácido',   colors: { ink: '#080A08', ink2: '#0D110D', ink3: '#151A15', paper: '#EEF3EA', hi: '#FFFFFF', flare: '#B6FF00', flareSoft: '#CCFF4D', onFlare: '#0A0A0A', live: '#4ADE80' } },
  { name: 'Magenta',       colors: { ink: '#0A0709', ink2: '#120C10', ink3: '#1C1319', paper: '#F5EEF2', hi: '#FFFFFF', flare: '#FF2E88', flareSoft: '#FF6FAE', onFlare: '#FFFFFF', live: '#4ADE80' } },
  { name: 'Claro',         colors: { ink: '#F2F0EA', ink2: '#E8E5DC', ink3: '#DDD9CE', paper: '#121214', hi: '#000000', flare: '#FF3B00', flareSoft: '#D9420F', onFlare: '#FFFFFF', live: '#16A34A' } },
];
const COLOR_FIELDS = [
  ['ink', 'Fundo'], ['ink2', 'Fundo das faixas / menu'], ['ink3', 'Fundo dos cards'],
  ['paper', 'Texto'], ['hi', 'Texto em destaque (negrito)'], ['flare', 'Cor de destaque'],
  ['flareSoft', 'Destaque suave (itálico)'], ['onFlare', 'Texto sobre o destaque'], ['live', 'Bolinha “disponível”'],
];

function viewLook() {
  const d = S.draft, t = d.theme;
  const mini = h('div', { class: 'mini', 'aria-label': 'Prévia das cores' },
    h('div', { class: 'mini__cap' }, 'PRÉVIA'),
    h('div', { class: 'mini__nav' }, h('span', { class: 'mini__mark' }, d.brand.mark), h('span', { class: 'mini__links' }, 'TRABALHOS   SOBRE   CONTATO')),
    h('div', { class: 'mini__title' }, d.hero.line1, h('br'), h('span', { class: 'mini__out' }, d.hero.line2)),
    h('p', { class: 'mini__p' }, 'Texto de apresentação com ', h('em', {}, 'itálico'), ' e ', h('strong', {}, 'negrito'), '.'),
    h('div', { class: 'mini__btns' }, h('span', { class: 'mini__btn' }, '▶ VER SHOWREEL'), h('span', { class: 'mini__ghost' }, 'PROJETOS')),
    h('div', { class: 'mini__band' }, 'MOTION DESIGN', h('i', {}, '◆'), 'BROADCAST', h('i', {}, '◆'), 'VINHETAS'),
    h('div', { class: 'mini__card' }, h('span', { class: 'mini__tag' }, 'ABERTURA'), h('span', { class: 'mini__live' }, h('i'), 'DISPONÍVEL')));
  const paint = () => Object.entries(t).forEach(([k, v]) => mini.style.setProperty('--' + k, v));
  paint();
  const paintFonts = () => {
    const ty = d.typography;
    loadFonts(ty);
    mini.style.setProperty('--fd', `'${ty.display}', sans-serif`);
    mini.style.setProperty('--fm', `'${ty.mono}', monospace`);
  };
  paintFonts();

  const presets = h('div', { class: 'presets' }, PRESETS.map(p =>
    h('button', {
      type: 'button', class: 'preset',
      onclick: () => { Object.assign(t, p.colors); touch(); renderView(); toast(`Paleta “${p.name}” aplicada ao rascunho.`); },
    },
      h('span', { class: 'preset__sw' }, ['ink', 'ink3', 'paper', 'flare'].map(k => h('i', { style: `background:${p.colors[k]}` }))),
      h('span', {}, p.name))));

  const fx = d.effects, ty = d.typography;
  return frag(
    h('div', { class: 'look' },
      h('div', { class: 'stack' },
        box('Paletas prontas', 'Um clique aplica — depois ajuste cor por cor se quiser.', presets),
        box('Cores', null, h('div', { class: 'grid2' }, COLOR_FIELDS.map(([k, label]) => field(t, k, { type: 'color', label, onChange: paint }))))),
      mini),
    box('Efeitos', null,
      grid(
        field(fx, 'loader', { type: 'toggle', label: 'Tela de carregamento' }),
        field(fx, 'grain', { type: 'toggle', label: 'Granulado de filme' }),
        field(fx, 'scanlines', { type: 'toggle', label: 'Linhas de TV' }),
        field(fx, 'vignette', { type: 'toggle', label: 'Vinheta escura nas bordas' }),
        field(fx, 'cursor', { type: 'toggle', label: 'Cursor personalizado' }))),
    box('Tipografia', 'Fontes do Google Fonts. A prévia mostra como fica.',
      grid(
        field(ty, 'display', { label: 'Fonte principal (títulos e textos)', options: Object.keys(FONTS.display).map(f => ({ value: f, label: f })), onChange: paintFonts }),
        field(ty, 'mono', { label: 'Fonte dos rótulos pequenos', options: Object.keys(FONTS.mono).map(f => ({ value: f, label: f })), onChange: paintFonts }))),
    tip('Para esconder, reordenar ou criar seções, use a aba ', h('strong', {}, 'Seções & menu'), '.'));
}

/* ── Geral & SEO ── */
function viewGeneral() {
  const d = S.draft;
  const reel = d.showreel;
  const reelBox = h('div', { class: 'stack' });
  const drawReel = () => {
    const withMedia = d.projects.filter(p => p.video || p.vimeo || ytId(p.youtube));
    const sel = h('select', { 'aria-label': 'Copiar vídeo de um projeto' },
      h('option', { value: '' }, 'Copiar o vídeo de um projeto…'),
      withMedia.map(p => h('option', { value: p.id }, p.title)));
    sel.addEventListener('change', () => {
      const p = d.projects.find(x => x.id === sel.value);
      if (!p) return;
      Object.assign(reel, { vimeo: p.vimeo || '', youtube: p.youtube || '', video: p.video || '', poster: p.poster || '' });
      touch(); drawReel(); toast(`Showreel agora usa o vídeo de “${p.title}”.`);
    });
    reelBox.replaceChildren(
      grid(field(reel, 'title', { label: 'Título no player' }), h('label', { class: 'f' }, h('span', { class: 'f__l' }, 'Atalho'), sel)),
      mediaEditor(reel, { name: 'showreel' }),
      tip('Sem vídeo, os botões de showreel somem do site.'));
  };
  drawReel();

  return frag(
    box('Marca', null,
      grid(
        field(d.brand, 'mark', { label: 'Sigla (quadradinho)', maxlength: 3 }),
        field(d.brand, 'name', { label: 'Nome ao lado da sigla' }))),
    tip('Os links do menu ficam na aba ', h('strong', {}, 'Seções & menu'), '.'),
    box('Showreel', 'O vídeo dos botões “Showreel” e “Ver showreel”.', reelBox),
    box('Seção de trabalhos', null,
      grid(
        field(d.works, 'num', { label: 'Número' }),
        field(d.works, 'allLabel', { label: 'Filtro “todos”' })),
      field(d.works, 'title', { label: 'Título', rows: 2, hint: 'Pule linha para quebrar o título.' }),
      field(d.works, 'subtitle', { label: 'Subtítulo' })),
    box('Google e compartilhamento', 'Como o site aparece nos resultados de busca e quando o link é enviado no WhatsApp, Instagram etc.',
      field(d.seo, 'title', { label: 'Título da página', hint: 'Até ~60 caracteres. Comece pelo nome e diga o que você faz.' }),
      field(d.seo, 'description', { label: 'Descrição', rows: 3, hint: 'Até ~155 caracteres. É o texto que aparece embaixo do título no Google.' }),
      field(d.seo, 'siteUrl', { label: 'Endereço oficial do site', placeholder: 'https://lucasgiron.com.br', hint: 'Evita que o Google trate os endereços alternativos como sites diferentes.' }),
      imageEditor(d.seo, 'ogImage', { label: 'Imagem de compartilhamento (1200 × 630)', name: 'compartilhamento' })),
    box('Quem é (para o Google)', 'Vira ficha de identificação do site (schema.org). É o que ajuda a aparecer como resultado certo quando alguém busca pelo nome.',
      grid(
        field(d.person, 'name', { label: 'Nome' }),
        field(d.person, 'jobTitle', { label: 'Profissão', placeholder: 'Motion Designer e Animador Gráfico' })),
      grid(
        field(d.person, 'city', { label: 'Cidade' }),
        field(d.person, 'state', { label: 'Estado (sigla)', placeholder: 'SC' }),
        field(d.person, 'country', { label: 'País (sigla)', placeholder: 'BR' })),
      tip('As redes sociais da aba ', h('strong', {}, 'Contato & rodapé'), ' entram automaticamente aqui, confirmando ao Google que os perfis e o site são da mesma pessoa.')));
}

/* ── Senha ── */
function viewPassword() {
  const F = { current: '', next: '', repeat: '' };
  const msg = h('p', { class: 'f__h' });
  const btn = h('button', { type: 'button', class: 'b b--primary' }, 'Trocar senha');
  const when = S.env?.passwordUpdatedAt;

  const fail = t => { msg.className = 'err'; msg.textContent = t; };
  btn.addEventListener('click', async () => {
    msg.className = 'f__h';
    msg.textContent = '';
    if (!F.current) return fail('Digite a senha atual.');
    if (F.next.length < 8) return fail('A nova senha precisa de pelo menos 8 caracteres.');
    if (F.next !== F.repeat) return fail('A repetição não confere com a nova senha.');
    btn.disabled = true;
    try {
      await api('/api/password', { method: 'POST', body: { current: F.current, next: F.next } });
      S.env = await api('/api/me').catch(() => S.env);
      toast('Senha trocada. Use a nova da próxima vez que entrar.', 'ok', 8000);
      renderView();
    } catch (e) {
      fail(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  return frag(
    box('Trocar a senha do painel',
      'Vale na hora, sem precisar publicar. Quem estiver logado em outro aparelho vai precisar entrar de novo.',
      field(F, 'current', { label: 'Senha atual', type: 'password' }),
      grid(
        field(F, 'next', { label: 'Nova senha', type: 'password', hint: 'No mínimo 8 caracteres.' }),
        field(F, 'repeat', { label: 'Repita a nova senha', type: 'password' })),
      h('div', { class: 'toolbar' }, btn, when && h('span', { class: 'muted' }, `Última troca: ${fmtDate(when)}`)),
      msg),
    tip('A senha fica guardada embaralhada (hash), nunca em texto puro, nem no código nem no repositório.'),
    tip('Esqueceu a senha? Apague o arquivo que começa com ', h('strong', {}, 'site/auth-'), ' em Vercel → Storage → Blob: a senha volta a ser a da variável ', h('strong', {}, 'ADMIN_PASSWORD'), '.'));
}

/* ── Mídias ── */
function viewMedia() {
  const wrap = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Carregando…'));
  const remove = async (urls, msg) => {
    if (!confirm(msg)) return;
    try {
      await api('/api/media', { method: 'DELETE', body: { urls } });
      toast('Arquivo(s) apagado(s).', 'ok');
      load();
    } catch (e) { toast(e.message, 'err'); }
  };
  const load = async () => {
    let files;
    try { files = (await api('/api/media')).files || []; }
    catch (e) { wrap.replaceChildren(h('p', { class: 'err' }, 'Não foi possível listar: ' + e.message)); return; }
    const inUse = JSON.stringify(S.draft) + JSON.stringify(S.saved);
    const rows = files.map(f => ({ ...f, used: inUse.includes(f.url) }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const unused = rows.filter(r => !r.used);
    const total = rows.reduce((a, r) => a + r.size, 0);
    wrap.replaceChildren(
      h('div', { class: 'toolbar' },
        h('span', { class: 'muted' }, `${rows.length} arquivos · ${fmtBytes(total)} · ${unused.length} sem uso`),
        unused.length > 0 && h('button', {
          type: 'button', class: 'b b--danger b--sm',
          onclick: () => remove(unused.map(r => r.url), `Apagar ${unused.length} arquivo(s) sem uso?\n\nIsso é permanente. Versões antigas do histórico que usavam esses arquivos ficarão sem eles.`),
        }, `Apagar ${unused.length} sem uso`),
        h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: load }, 'Atualizar')),
      rows.length
        ? h('div', { class: 'mgrid' }, rows.map(r => h('div', { class: 'mitem' },
            isImg(r.pathname) ? h('img', { src: r.url, alt: '', loading: 'lazy' })
              : isVid(r.pathname) ? h('video', { src: r.url + '#t=0.5', preload: 'metadata', muted: true })
              : h('div', { class: 'mitem__file' }, /\.pdf$/i.test(r.pathname) ? 'PDF' : /\.(glb|gltf)$/i.test(r.pathname) ? '3D' : 'ARQUIVO'),
            h('div', { class: 'mitem__i' },
              h('span', { class: 'mitem__n', title: r.pathname }, r.pathname.split('/').pop()),
              h('span', { class: 'mono muted' }, fmtBytes(r.size)),
              r.used ? badge('Em uso', 'ok') : badge('Sem uso', 'warn')),
            h('div', { class: 'mitem__a' },
              h('a', { class: 'b b--ghost b--sm', href: r.url, target: '_blank', rel: 'noopener' }, 'Abrir'),
              h('button', {
                type: 'button', class: 'b b--danger b--sm', disabled: r.used,
                title: r.used ? 'Em uso no site — tire do projeto primeiro' : null,
                onclick: () => remove([r.url], 'Apagar este arquivo permanentemente?'),
              }, 'Apagar')))))
        : h('p', { class: 'empty' }, 'Nenhum arquivo enviado ainda. Os vídeos e imagens que você enviar pelos projetos aparecem aqui.'));
  };
  load();
  return wrap;
}

/* ── Histórico & backup ── */
function viewHistory() {
  const listEl = h('div', {}, h('p', { class: 'muted' }, 'Carregando…'));
  const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });

  const loadInto = (data, msg) => {
    if (!data || !Array.isArray(data.projects)) return toast('Arquivo inválido: não tem a lista de projetos.', 'err');
    S.draft = hydrate(data);
    touch(); renderView();
    toast(msg, 'ok', 6000);
  };

  imp.addEventListener('change', () => {
    const f = imp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { loadInto(JSON.parse(r.result), 'Backup carregado no rascunho. Revise e clique em Publicar.'); } catch { toast('Não é um JSON válido.', 'err'); } };
    r.readAsText(f);
  });

  (async () => {
    try {
      const { versions } = await api('/api/versions');
      listEl.replaceChildren(versions.length
        ? h('div', {}, versions.map((v, i) => h('div', { class: 'vrow' },
            h('div', { class: 'vrow__d' },
              h('strong', {}, fmtDate(v.uploadedAt)),
              h('span', { class: 'mono muted' }, fmtBytes(v.size)),
              i === 0 && badge('No ar', 'live')),
            h('button', {
              type: 'button', class: 'b b--ghost b--sm',
              onclick: async () => {
                if (S.dirty && !confirm('Isso substitui o rascunho atual (alterações não publicadas serão perdidas). Continuar?')) return;
                try {
                  const r = await fetch(v.url, { cache: 'no-store' });
                  loadInto(await r.json(), `Versão de ${fmtDate(v.uploadedAt)} carregada. Clique em Publicar para restaurá-la.`);
                } catch (e) { toast('Não foi possível abrir: ' + e.message, 'err'); }
              },
            }, 'Carregar no editor'))))
        : h('p', { class: 'empty' }, 'Nenhuma publicação ainda. Cada vez que você publicar, uma cópia fica aqui.'));
    } catch (e) { listEl.replaceChildren(h('p', { class: 'err' }, e.message)); }
  })();

  return frag(
    box('Versões publicadas', 'As últimas 30 publicações ficam guardadas. Carregue uma para revisar e clique em Publicar para restaurar.', listEl),
    box('Backup', 'Baixe todo o conteúdo do site num arquivo, ou restaure a partir de um.',
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'b b--ghost',
          onclick: () => {
            const blob = new Blob([JSON.stringify(S.draft, null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `site-backup-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
        }, 'Baixar backup (.json)'),
        h('button', { type: 'button', class: 'b b--ghost', onclick: () => imp.click() }, 'Importar backup'),
        imp)),
    box('Recomeçar', 'Volta todo o rascunho para o conteúdo original do site. Nada muda no ar até você publicar.',
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'b b--danger',
          onclick: () => {
            if (!confirm('Substituir o rascunho pelo conteúdo original?')) return;
            S.draft = normalize(clone(DEFAULT)); touch(); renderView();
            toast('Rascunho voltou ao original. Publique para aplicar.');
          },
        }, 'Voltar ao conteúdo original'))));
}

/* ─────────────────────────────────────────────
   AÇÕES DA BARRA
   ───────────────────────────────────────────── */
/* partes do conteúdo que mudaram entre dois estados */
const KEY_NAMES = {
  projects: 'Projetos', categories: 'Categorias', layout: 'Seções', nav: 'Menu', theme: 'Cores',
  typography: 'Fontes', effects: 'Efeitos', hero: 'Início', about: 'Sobre e listas', clients: 'Clientes',
  ticker: 'Faixa de palavras', contact: 'Contato', footer: 'Rodapé', seo: 'Google e compartilhamento',
  brand: 'Marca', showreel: 'Showreel', works: 'Seção de trabalhos',
  designs: 'Design & 3D', designCategories: 'Categorias de design', design: 'Seção Design & 3D',
};
const changedKeys = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
  .filter(k => k !== 'savedAt' && JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]));
const keyNames = ks => ks.map(k => KEY_NAMES[k] || k).join(', ');

/* diálogo com várias opções → devolve o id do botão escolhido */
function choose(title, lines, buttons) {
  return new Promise(resolve => {
    const dlg = $('#dlg');
    let done = false;
    // resolve direto no clique: o evento 'close' do <dialog> atrasa em abas em segundo plano
    const finish = id => {
      if (done) return;
      done = true;
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
      resolve(id);
    };
    const onCancel = e => { e.preventDefault(); finish('cancel'); };   // tecla Esc
    dlg.addEventListener('cancel', onCancel);
    $('#dlgInner').replaceChildren(
      h('header', { class: 'dlg__h' }, h('h2', {}, title)),
      h('div', { class: 'dlg__b' }, lines.filter(Boolean).map(l => h('p', {}, l))),
      h('footer', { class: 'dlg__f dlg__f--wrap' }, buttons.map(b =>
        h('button', { type: 'button', class: 'b ' + (b.primary ? 'b--primary' : 'b--ghost'), onclick: () => finish(b.id) }, b.label))));
    dlg.showModal();
  });
}

async function publish() {
  const btn = $('#publishBtn');
  if (btn.disabled) return;
  if (S.uploading) return toast('Aguarde o envio terminar antes de publicar.', 'warn');

  const lost = S.saved.projects.length - S.draft.projects.length;
  if (lost > 0 && !confirm(`Atenção: o site publicado tem ${S.saved.projects.length} projeto(s) e este rascunho tem ${S.draft.projects.length}.\n\n${lost} projeto(s) vão sumir do site. Publicar mesmo assim?`)) return;

  btn.disabled = true;
  btn.textContent = 'Publicando…';
  let conflict = false;
  try {
    const r = await api('/api/content', { method: 'PUT', body: S.draft, headers: { 'x-base-saved-at': S.base || '' } });
    S.draft.savedAt = r.savedAt;
    S.base = r.savedAt;
    S.saved = clone(S.draft);
    touch();
    toast('Publicado! O site atualiza em alguns segundos.', 'ok');
    if (S.tab === 'history') renderView();
  } catch (e) {
    if (e.status === 409) conflict = true;
    else toast('Não foi possível publicar: ' + e.message, 'err', 9000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publicar';
  }
  if (conflict) await resolveConflict();
}

/* Alguém publicou depois que este painel abriu: junta só o que foi mudado aqui
   por cima da versão mais nova — trocar uma cor nunca apaga projetos. */
async function resolveConflict() {
  let raw;
  try { raw = await fetchLatest(); } catch { return toast('Não foi possível ler a versão mais nova.', 'err'); }
  const latest = hydrate(raw);
  const mine = changedKeys(S.draft, S.saved);
  const theirs = changedKeys(latest, S.saved);
  const both = mine.filter(k => theirs.includes(k));

  const choice = await choose('O site foi alterado em outro lugar', [
    `Alguém publicou${raw?.savedAt ? ` em ${fmtDate(raw.savedAt)}` : ''} depois que você abriu o painel (outra aba, outro computador ou o celular).`,
    `O que você mudou aqui: ${keyNames(mine) || 'nada'}.`,
    `O que mudou lá: ${keyNames(theirs) || 'nada'}.`,
    both.length
      ? `Os dois mexeram em: ${keyNames(both)}. Se juntar, nesses pontos vale a sua versão.`
      : 'Não há conflito: juntando, nada se perde.',
  ], [
    { id: 'cancel', label: 'Cancelar' },
    { id: 'theirs', label: 'Descartar as minhas e abrir a mais nova' },
    { id: 'merge', label: 'Juntar e publicar', primary: true },
  ]);

  if (choice === 'merge') {
    mine.forEach(k => latest[k] = clone(S.draft[k]));
    S.saved = hydrate(raw);
    S.base = raw?.savedAt || '';
    S.draft = latest;
    renderView(); touch();
    await publish();
  } else if (choice === 'theirs') {
    S.draft = latest;
    S.saved = clone(latest);
    S.base = raw?.savedAt || '';
    renderView(); touch();
    toast('Versão mais nova carregada.', 'ok');
  }
}

/* ao voltar para a aba: se o site mudou em outro lugar, atualiza (ou avisa) */
let lastCheck = 0;
async function checkRemote() {
  if (!S.draft || $('#app').hidden || $('#dlg').open || Date.now() - lastCheck < 4000) return;
  lastCheck = Date.now();
  let raw;
  try { raw = await fetchLatest(); } catch { return; }
  const remote = raw?.savedAt || '';
  if (!remote || remote === (S.base || '')) return;
  if (!S.dirty) {
    S.draft = hydrate(raw);
    S.saved = clone(S.draft);
    S.base = remote;
    renderView(); touch();
    toast('O painel foi atualizado com a versão publicada mais nova.', '', 5000);
  } else if (S.warnedFor !== remote) {
    S.warnedFor = remote;
    toast('Atenção: o site foi publicado em outro lugar. Ao publicar, você poderá juntar as alterações sem perder nada.', 'warn', 10000);
  }
}
addEventListener('focus', checkRemote);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRemote(); });

function preview() {
  try { localStorage.setItem('giron:preview', JSON.stringify(S.draft)); }
  catch { return toast('Não foi possível abrir a pré-visualização (armazenamento do navegador bloqueado).', 'err'); }
  window.open('/?preview', 'giron-preview');
}

function discard() {
  if (!confirm('Descartar todas as alterações não publicadas?')) return;
  S.draft = clone(S.saved);
  touch(); renderView();
}

$('#publishBtn').addEventListener('click', publish);
$('#previewBtn').addEventListener('click', preview);
$('#discardBtn').addEventListener('click', discard);
$('#logoutBtn').addEventListener('click', async () => {
  if (S.dirty && !confirm('Há alterações não publicadas. Sair mesmo assim?')) return;
  try { await api('/api/login', { method: 'DELETE' }); } catch {}
  S.dirty = false;
  location.reload();
});
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('#app').hidden) { e.preventDefault(); publish(); }
});

/* ─────────────────────────────────────────────
   LOGIN E INÍCIO
   ───────────────────────────────────────────── */
function showLogin(err, notice) {
  $('#dlg').open && $('#dlg').close();
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginErr').textContent = err || '';
  const n = notice || S.warns.join(' ');
  $('#loginNotice').hidden = !n;
  $('#loginNotice').textContent = n;
  $('#loginPw').focus();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  $('#loginErr').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#loginPw').value } });
    $('#loginPw').value = '';
    await start();
  } catch (err) {
    $('#loginErr').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

async function start() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  let data = null;
  try {
    const r = await fetch('/api/content?fresh=1', { cache: 'no-store' });
    if (r.ok) data = await r.json();
  } catch {}
  S.draft = hydrate(data);
  S.base = data?.savedAt || '';
  S.saved = clone(S.draft);
  applyAdminTheme(S.draft.theme);
  renderTabs();
  go(location.hash.slice(1) || 'projects');
  touch();
  if (!data) toast('Ainda não há nada publicado pelo painel — você está editando o conteúdo original do site.', '', 7000);
  if (S.warns.length) toast(S.warns.join(' '), 'warn', 10000);
}

(async function boot() {
  try { S.env = await api('/api/me'); } catch { S.env = null; }
  if (!S.env) {
    return showLogin(null, 'A API não respondeu. Abra o painel pelo site publicado na Vercel, ou localmente pelo tools/dev-server.ps1.');
  }
  const cfg = S.env.configured || {};
  if (!cfg.password) S.warns.push('Defina a variável ADMIN_PASSWORD no projeto da Vercel para conseguir entrar.');
  if (!cfg.blob) S.warns.push('Conecte um Blob Store (público) ao projeto na Vercel para salvar e enviar vídeos.');
  if (S.env.authed) start(); else showLogin();
})();
