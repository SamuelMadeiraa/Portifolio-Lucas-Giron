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
  d.projects = (d.projects || []).map(p => ({
    id: uid(), title: '', year: '', duration: 0, category: '', tag: '', description: '',
    vimeo: '', video: '', poster: '', hidden: false, ...p,
  }));
  for (const k of ['categories', 'ticker']) if (!Array.isArray(d[k])) d[k] = [];
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
  delete d.sections;
  return d;
}
const hydrate = data => normalize(data ? merge(clone(DEFAULT), migrate(data)) : clone(DEFAULT));

let dirtyRaf;
function touch() {
  cancelAnimationFrame(dirtyRaf);
  dirtyRaf = requestAnimationFrame(() => {
    S.dirty = JSON.stringify(S.draft) !== JSON.stringify(S.saved);
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

/* vídeo: arquivo próprio ou Vimeo, + capa */
function mediaEditor(obj, { name: nameOpt = 'video', onMedia } = {}) {
  const wrap = h('div', { class: 'media' });
  const name = () => (typeof nameOpt === 'function' ? nameOpt() : nameOpt) || 'video';
  let mode = obj.video || !obj.vimeo ? 'file' : 'vimeo';

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
    } else {
      body = h('div', { class: 'media__body' },
        field(obj, 'vimeo', {
          label: 'Link ou número do vídeo no Vimeo', placeholder: 'https://vimeo.com/123456789',
          onChange: v => { const m = String(v).match(/(\d{6,})/); if (m) obj.vimeo = m[1]; },
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
  { id: 'projects', icon: '▦', label: 'Projetos',              hint: 'Adicione, edite, reordene, oculte ou exclua trabalhos.', render: viewProjects },
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

/* ── Projetos ── */
function viewProjects() {
  const d = S.draft;
  const catLabel = id => d.categories.find(c => c.id === id)?.label || 'sem categoria';
  const list = h('div', { class: 'plist' });
  const summary = h('span', { class: 'muted' });
  let dragFrom = null;

  const move = (from, to) => {
    if (to < 0 || to >= d.projects.length || from === to) return;
    const [p] = d.projects.splice(from, 1);
    d.projects.splice(to, 0, p);
    touch(); draw();
  };

  // projetos do conteúdo original que não estão mais na lista
  const missing = () => (DEFAULT.projects || []).filter(o => !d.projects.some(p => p.id === o.id));
  const restoreOriginals = () => {
    const miss = missing();
    if (!miss.length) return;
    if (!confirm(`Trazer de volta ${miss.length} projeto(s) original(is)?\n\nOs projetos que estão na lista agora continuam como estão.`)) return;
    d.projects.push(...clone(miss));
    const used = new Set(miss.map(p => p.category));
    (DEFAULT.categories || []).forEach(c => {
      if (used.has(c.id) && !d.categories.some(x => x.id === c.id)) d.categories.push(clone(c));
    });
    touch(); draw();
    toast(`${miss.length} projeto(s) restaurado(s). Clique em Publicar para colocar no ar.`, 'ok', 7000);
  };
  const restoreBtn = h('button', { type: 'button', class: 'b b--ghost', onclick: restoreOriginals });

  const draw = () => {
    const n = missing().length;
    restoreBtn.hidden = !n;
    restoreBtn.textContent = n === 1 ? '↺ Restaurar 1 projeto original' : `↺ Restaurar ${n} projetos originais`;
    summary.textContent = `${d.projects.length} projetos · ${d.projects.filter(p => !p.hidden).length} visíveis · a ordem daqui é a ordem do site (arraste para reordenar)`;
    list.replaceChildren(...(d.projects.length ? d.projects.map((p, i) => {
      const row = h('div', { class: 'prow' + (p.hidden ? ' is-hidden' : ''), draggable: 'true' },
        h('div', { class: 'prow__order', title: 'Arraste para reordenar' },
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
          h('span', { class: 'mono' }, String(i + 1).padStart(2, '0')),
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Descer', disabled: i === d.projects.length - 1, onclick: () => move(i, i + 1) }, '↓')),
        h('button', { type: 'button', class: 'prow__thumb', title: 'Editar', onclick: () => editProject(i) },
          p.poster ? h('img', { src: abs(p.poster), alt: '', loading: 'lazy', draggable: 'false' }) : h('span', {}, 'sem capa')),
        h('div', { class: 'prow__info' },
          h('strong', {}, p.title || 'Sem título'),
          h('span', { class: 'prow__meta mono' }, [catLabel(p.category), p.year, p.duration ? fmtDur(p.duration) : null].filter(Boolean).join(' · ')),
          h('span', { class: 'prow__badges' },
            p.video ? badge('Vídeo próprio', 'ok') : p.vimeo ? badge('Vimeo') : badge('Sem vídeo', 'warn'),
            p.hidden && badge('Oculto'))),
        h('div', { class: 'prow__actions' },
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => { p.hidden = !p.hidden; touch(); draw(); } }, p.hidden ? 'Mostrar' : 'Ocultar'),
          h('button', { type: 'button', class: 'b b--ghost b--sm', onclick: () => editProject(i) }, 'Editar'),
          h('button', {
            type: 'button', class: 'b b--danger b--sm',
            onclick: () => {
              if (!confirm(`Excluir “${p.title || 'Sem título'}”?\n\nEle some do site depois que você clicar em Publicar.`)) return;
              d.projects.splice(i, 1); touch(); draw();
              toast('Projeto excluído do rascunho. Clique em Publicar para aplicar no site.');
            },
          }, 'Excluir')));

      row.addEventListener('dragstart', e => { dragFrom = i; row.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => row.classList.remove('is-drag'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('is-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('is-over'); if (dragFrom !== null) move(dragFrom, i); dragFrom = null; });
      return row;
    }) : [h('div', { class: 'empty' },
      h('p', {}, 'Nenhum projeto na lista.'),
      n > 0 && h('p', { style: 'margin-top:14px' },
        h('button', { type: 'button', class: 'b b--primary', onclick: restoreOriginals }, `↺ Restaurar os ${n} projetos originais`)))]));
  };
  draw();
  S.redrawProjects = draw;

  return frag(
    h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'b b--primary', onclick: () => editProject(-1) }, '+ Novo projeto'),
      h('button', { type: 'button', class: 'b b--ghost', onclick: () => go('categories') }, '# Categorias'),
      restoreBtn,
      summary),
    list);
}

function categoriesEditor() {
  const d = S.draft;
  const wrap = h('div', { class: 'list' });
  const draw = () => wrap.replaceChildren(
    ...d.categories.map((c, i) => {
      const used = d.projects.filter(p => p.category === c.id).length;
      const inp = h('input', { type: 'text', 'aria-label': 'Nome da categoria' });
      inp.value = c.label;
      inp.addEventListener('input', () => { c.label = inp.value; touch(); });
      return h('div', { class: 'row' },
        h('span', { class: 'row__n mono' }, String(i + 1).padStart(2, '0')),
        inp,
        h('span', { class: 'row__count mono muted' }, `${used} proj.`),
        rowTools(d.categories, i, draw, {
          beforeDelete: () => !used || confirm(`${used} projeto(s) usam “${c.label}”. Eles vão aparecer só em “Todos”. Remover mesmo?`),
          onChange: () => S.redrawProjects?.(),
        }));
    }),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        d.categories.push({ id: 'cat-' + Math.random().toString(36).slice(2, 7), label: 'NOVA CATEGORIA' });
        touch(); draw();
        [...wrap.querySelectorAll('.row input')].pop()?.select();
      },
    }, '+ Nova categoria'));
  draw();
  return wrap;
}

function editProject(i) {
  const isNew = i < 0;
  const P = isNew
    ? { id: uid(), title: '', year: new Date().getFullYear(), duration: 0, category: S.draft.categories[0]?.id || '',
        tag: '', description: '', vimeo: '', video: '', poster: '', hidden: false }
    : clone(S.draft.projects[i]);
  const dlg = $('#dlg');

  const close = () => dlg.close();
  const save = () => {
    if (S.uploading) return toast('Aguarde o envio terminar.', 'warn');
    if (!String(P.title).trim()) return toast('Dê um título ao projeto.', 'warn');
    P.year = P.year === '' ? '' : Number(P.year) || '';
    P.duration = Math.round(Number(P.duration) || 0);
    if (isNew) S.draft.projects.unshift(P);
    else S.draft.projects[i] = P;
    touch(); close();
    S.redrawProjects?.();
    toast(isNew ? 'Projeto adicionado no topo. Clique em Publicar para colocar no ar.' : 'Projeto atualizado. Clique em Publicar para aplicar.', 'ok');
  };

  const draw = () => $('#dlgInner').replaceChildren(
    h('header', { class: 'dlg__h' },
      h('h2', {}, isNew ? 'Novo projeto' : 'Editar projeto'),
      h('button', { type: 'button', class: 'ib', 'aria-label': 'Fechar', onclick: close }, '✕')),
    h('div', { class: 'dlg__b' },
      grid(
        field(P, 'title', { label: 'Título' }),
        field(P, 'tag', { label: 'Rótulo sobre a capa', placeholder: 'Ex.: Abertura' })),
      grid(
        catPick(P, draw),
        field(P, 'year', { label: 'Ano', type: 'number' }),
        field(P, 'duration', { label: 'Duração (segundos)', type: 'number', hint: 'Preenchida sozinha ao enviar um vídeo.' })),
      field(P, 'description', { label: 'Descrição', rows: 3 }),
      h('span', { class: 'f__l' }, 'Vídeo'),
      mediaEditor(P, { name: () => P.title || 'projeto', onMedia: draw }),
      field(P, 'hidden', { type: 'toggle', invert: true, label: 'Visível no site', hint: 'Desligue para esconder sem excluir.' })),
    h('footer', { class: 'dlg__f' },
      h('button', { type: 'button', class: 'b b--ghost', onclick: close }, 'Cancelar'),
      h('button', { type: 'button', class: 'b b--primary', onclick: save }, isNew ? 'Adicionar projeto' : 'Salvar projeto')));

  draw();
  dlg.showModal();
  if (isNew) $('#dlgInner input')?.focus();
}

/* ── Categorias ── */
function viewCategories() {
  return frag(
    box('Categorias', 'Viram os botões de filtro acima dos projetos. Crie, renomeie, reordene (setas) ou exclua. Categorias sem projetos visíveis não aparecem no site.',
      categoriesEditor()),
    tip('Para mudar a categoria de um projeto, abra ', h('strong', {}, 'Projetos → Editar'), '. Lá também dá para criar uma categoria nova na hora.'));
}

/* seletor de categoria com criação na hora (usado no editor de projeto) */
function catPick(P, redraw) {
  return h('div', { class: 'catpick' },
    field(P, 'category', { label: 'Categoria', options: [{ value: '', label: '— sem categoria —' }, ...S.draft.categories.map(c => ({ value: c.id, label: c.label }))] }),
    h('button', {
      type: 'button', class: 'b b--ghost b--sm',
      onclick: () => {
        const label = (prompt('Nome da nova categoria:') || '').trim();
        if (!label) return;
        const c = { id: 'cat-' + Math.random().toString(36).slice(2, 7), label };
        S.draft.categories.push(c);
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
    box('Redes e links', 'Aparecem como botões no contato e no menu do celular.',
      objList(c.links, [
        { key: 'label', label: 'Nome', w: '1fr', placeholder: 'Instagram' },
        { key: 'handle', label: 'Texto pequeno', w: '1fr', placeholder: '@usuario ↗' },
        { key: 'url', label: 'Link', w: '1.4fr', placeholder: 'https://…', type: 'url' },
      ], { addLabel: 'Adicionar link' })),
    box('Rodapé', null,
      grid(field(f, 'name', { label: 'Nome (após o ©)' }), field(f, 'note', { label: 'Texto do meio' }), field(f, 'backToTop', { label: 'Link “voltar ao topo”' }))));
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
    const withMedia = d.projects.filter(p => p.video || p.vimeo);
    const sel = h('select', { 'aria-label': 'Copiar vídeo de um projeto' },
      h('option', { value: '' }, 'Copiar o vídeo de um projeto…'),
      withMedia.map(p => h('option', { value: p.id }, p.title)));
    sel.addEventListener('change', () => {
      const p = d.projects.find(x => x.id === sel.value);
      if (!p) return;
      Object.assign(reel, { vimeo: p.vimeo || '', video: p.video || '', poster: p.poster || '' });
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
      field(d.seo, 'title', { label: 'Título da página' }),
      field(d.seo, 'description', { label: 'Descrição', rows: 3, hint: 'Ideal: até 160 caracteres.' }),
      imageEditor(d.seo, 'ogImage', { label: 'Imagem de compartilhamento (1200 × 630)', name: 'compartilhamento' })));
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
            isImg(r.pathname) ? h('img', { src: r.url, alt: '', loading: 'lazy' }) : h('video', { src: r.url + '#t=0.5', preload: 'metadata', muted: true }),
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
