/* ═══════════════════════════════════════════════════════════
   PAINEL ADMIN
   Login com usuário e senha (funções da Vercel). O conteúdo é salvo
   no Vercel Blob via /api/content e os arquivos sobem direto do
   navegador para o Blob (via /api/upload).
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ══════════ UTILIDADES ══════════ */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const getP = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setP(o, path, v) {
    const ks = path.split('.');
    let a = o;
    ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; });
    a[ks[ks.length - 1]] = v;
  }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ══════════ CONSTANTES ══════════ */
  const BLOB_CLIENT = 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/dist/client.js/+esm';
  const CDN = 'https://i.vimeocdn.com/video/';
  const LOCAL_UPLOAD = 'Envio de fotos e vídeos só funciona com o site na Vercel.';
  const LABELS = {
    navWorks: 'Trabalhos', navAbout: 'Sobre', navContact: 'Contato', specialty: 'Especialidade',
    works: 'Trabalhos\nSelecionados', all: 'Todos', about: 'Sobre', tools: 'Ferramentas',
    services: 'Serviços', clients: 'No ar para', showreel: 'Ver showreel',
  };
  const SHOW = {
    loader: 'Tela de carregamento (barras coloridas)',
    cursor: 'Cursor personalizado (computador)',
    ticker: 'Faixa de palavras',
    about: 'Seção “Sobre”',
    clients: 'Faixa de clientes',
    onair: 'Barra “No ar” no contato',
  };
  const PRESETS = [
    { name: 'Broadcast', bg: '#08080A', fg: '#F2EFE9', accent: '#FF3B00' },
    { name: 'Azul elétrico', bg: '#07080D', fg: '#EEF1F8', accent: '#2F62FF' },
    { name: 'Verde sinal', bg: '#070A08', fg: '#EDF2EE', accent: '#22C55E' },
    { name: 'Roxo neon', bg: '#0A0710', fg: '#F1EEF7', accent: '#A855F7' },
    { name: 'Amarelo', bg: '#0A0A08', fg: '#F4F2EA', accent: '#FFC400' },
    { name: 'Papel (claro)', bg: '#F2EFE9', fg: '#111114', accent: '#FF3B00' },
  ];
  const SWATCHES = ['#FF3B00', '#FF2E63', '#FFC400', '#22C55E', '#00C2FF', '#2F62FF', '#A855F7', '#F2EFE9'];
  const LAYOUTS = {
    'texto-imagem': 'Texto + imagem à direita',
    'imagem-texto': 'Imagem à esquerda + texto',
    'texto': 'Só texto',
    'galeria': 'Texto + galeria de imagens',
  };
  const RICH = 'use *itálico* e **negrito**';

  /* ══════════ ESTADO ══════════ */
  const S = {
    user: '',
    local: false,     // modo de teste sem servidor
    storage: false,   // Vercel Blob conectado?
    content: null,    // o conteúdo sendo editado
    dirty: false,
    media: [],        // arquivos enviados: { path, url, name, size }
    uploadMode: 'blob', // 'blob' = Vercel Blob · 'direct' = servidor próprio (Docker)
    previewWin: null,
  };

  /* ══════════ API ══════════ */
  async function api(path, opts = {}) {
    const headers = { 'X-LG-Admin': '1', ...(opts.headers || {}) };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch('/api/' + path, { credentials: 'same-origin', cache: 'no-store', ...opts, headers });
    let data = null;
    try { data = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) {
      const err = new Error((data && data.error) || r.statusText || 'erro');
      err.status = r.status;
      throw err;
    }
    return data;
  }
  function friendly(e) {
    if (!e) return 'erro desconhecido';
    if (e instanceof TypeError) return 'sem conexão com a internet';
    return e.message || 'erro desconhecido';
  }

  /* ══════════ FORMATO DO CONTEÚDO ══════════ */
  function ensureShape(c) {
    c = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
    const obj = k => { if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {}; return c[k]; };
    const arr = (o, k) => { if (!Array.isArray(o[k])) o[k] = []; return o[k]; };
    const site = obj('site');
    ['name', 'role', 'city', 'footer', 'description'].forEach(k => { if (site[k] == null) site[k] = ''; });
    const th = obj('theme');
    th.accent = th.accent || '#FF3B00';
    th.bg = th.bg || '#08080A';
    th.fg = th.fg || '#F2EFE9';
    if (th.grain === undefined) th.grain = true;
    const show = obj('show');
    Object.keys(SHOW).forEach(k => { if (show[k] === undefined) show[k] = true; });
    const lab = obj('labels');
    Object.entries(LABELS).forEach(([k, v]) => { if (lab[k] == null) lab[k] = v; });
    obj('showreel');
    const hero = obj('hero');
    arr(hero, 'specialties');
    if (hero.available === undefined) hero.available = true;
    if (!Array.isArray(c.ticker)) c.ticker = [];
    if (!Array.isArray(c.categories) || !c.categories.length) {
      c.categories = [{ key: 'broadcast', label: 'Broadcast' }, { key: 'motion', label: 'Motion' }, { key: 'filme', label: 'Filme' }];
    }
    const about = obj('about');
    ['paragraphs', 'stats', 'tools', 'services'].forEach(k => arr(about, k));
    if (about.photo == null) about.photo = '';
    if (!Array.isArray(c.sections)) c.sections = [];
    if (!Array.isArray(c.clients)) c.clients = [];
    arr(obj('contact'), 'links');
    if (!Array.isArray(c.projects)) c.projects = [];
    return c;
  }

  // arquivo enviado pelo painel? (URL do Blob ou caminho uploads/)
  const isUpload = v => typeof v === 'string' && (v.startsWith('uploads/') || v.startsWith('/uploads/') || /\.blob\.vercel-storage\.com\/uploads\//.test(v));
  function usedPaths(c) {
    const set = new Set();
    (function walk(v) {
      if (typeof v === 'string') { if (isUpload(v)) set.add(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    })(c);
    return set;
  }
  // tira as referências a um arquivo apagado
  function removeRefs(c, path) {
    (function walk(o) {
      if (Array.isArray(o)) {
        for (let i = o.length - 1; i >= 0; i--) {
          if (o[i] === path) o.splice(i, 1); else walk(o[i]);
        }
      } else if (o && typeof o === 'object') {
        Object.keys(o).forEach(k => { if (o[k] === path) o[k] = ''; else walk(o[k]); });
      }
    })(c);
  }

  const assetUrl = p => (!p ? '' : /^(https?:|data:|blob:|\/)/.test(p) ? p : '../' + p);
  const kindOf = p => /\.(jpe?g|png|webp|gif|svg|avif)(\?|$)/i.test(p) ? 'image' : /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(p) ? 'video' : 'file';

  /* ══════════ TOAST / CONFIRMAÇÃO ══════════ */
  let toastT;
  function toast(msg, err, sticky) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-err', !!err);
    t.classList.add('is-on');
    clearTimeout(toastT);
    if (!sticky) toastT = setTimeout(() => t.classList.remove('is-on'), err ? 6500 : 3200);
  }
  function ask(title, text, { ok = 'Confirmar', danger = false, cancel = 'Cancelar' } = {}) {
    return new Promise(res => {
      const d = el('div', 'confirm', `<div class="confirm__box" role="alertdialog" aria-modal="true">
        <h3>${esc(title)}</h3><p>${esc(text)}</p>
        <div class="row row--end"><button class="btn btn--ghost" type="button" data-v="0">${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-v="1">${esc(ok)}</button></div></div>`);
      document.body.append(d);
      const done = v => { d.remove(); document.removeEventListener('keydown', key, true); res(v); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', key, true);
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-v]');
        if (b) done(b.dataset.v === '1');
        else if (e.target === d) done(false);
      });
      $('[data-v="1"]', d).focus();
    });
  }

  /* ══════════ STATUS / RASCUNHO / PRÉ-VISUALIZAÇÃO ══════════ */
  const draftKey = () => 'lg-admin-draft:' + (S.local ? 'local' : 'site');
  let draftT, prevT;
  function changed() {
    S.dirty = true;
    setStatus();
    clearTimeout(draftT);
    draftT = setTimeout(saveDraft, 400);
    clearTimeout(prevT);
    prevT = setTimeout(refreshPreview, 900);
  }
  const noop = () => {};
  function saveDraft() {
    try { localStorage.setItem(draftKey(), JSON.stringify({ at: Date.now(), content: S.content })); } catch (e) { /* cheio */ }
  }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* ok */ } }

  function setStatus(mode, text) {
    const st = $('#status'), t = $('span', st);
    st.className = 'status mono';
    if (mode === 'saving') { st.classList.add('is-saving'); t.textContent = text || 'Publicando…'; }
    else if (S.dirty) { st.classList.add('is-dirty'); t.textContent = S.local ? 'Não exportado' : 'Não publicado'; }
    else { if (S.local) st.classList.add('is-local'); t.textContent = S.local ? 'Modo de teste' : 'Tudo publicado'; }
    $('#publishBtn').textContent = S.local ? 'Baixar content.json' : 'Publicar';
  }

  window.LG_PREVIEW = null;
  const previewData = () => ({ content: S.content, files: {} });
  function openPreview() {
    window.LG_PREVIEW = previewData();
    try { localStorage.setItem('lg-preview', JSON.stringify(S.content)); } catch (e) { /* cheio */ }
    if (S.previewWin && !S.previewWin.closed) {
      S.previewWin.location.reload();
      S.previewWin.focus();
    } else {
      S.previewWin = window.open('../?preview', 'lg-preview');
    }
  }
  function refreshPreview() {
    window.LG_PREVIEW = previewData();
    if (S.previewWin && !S.previewWin.closed) { try { S.previewWin.location.reload(); } catch (e) { /* fechou */ } }
  }

  /* ══════════ LOGIN ══════════ */
  function showLogin(noApi) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#noApiNote').hidden = !noApi;
    $('#localMode').hidden = !noApi;
    setTimeout(() => $('#loginUser').focus(), 50);
  }
  const loginErr = m => { $('#loginErr').textContent = m || ''; };

  $('#showPass').addEventListener('change', e => { $('#loginPass').type = e.target.checked ? 'text' : 'password'; });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    loginErr('');
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const r = await api('login', { method: 'POST', body: JSON.stringify({ user: $('#loginUser').value, pass: $('#loginPass').value }) });
      $('#loginPass').value = '';
      S.user = r.user;
      const me = await api('me');
      S.storage = !!me.storage;
      S.uploadMode = me.uploadMode || 'blob';
      startApp();
    } catch (err) {
      if (err.status === 404) { loginErr('O servidor do painel não foi encontrado.'); showLogin(true); }
      else loginErr(friendly(err));
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  $('#localMode').addEventListener('click', () => { S.local = true; startApp(); });

  $('#logoutBtn').addEventListener('click', async () => {
    if (S.dirty && !await ask('Sair sem publicar?', 'As alterações ficam guardadas como rascunho neste navegador e aparecem de novo quando você entrar.', { ok: 'Sair' })) return;
    if (!S.local) { try { await api('logout', { method: 'POST' }); } catch (e) { /* já saiu */ } }
    S.dirty = false;
    location.reload();
  });

  async function boot() {
    try {
      const me = await api('me');
      S.user = me.user;
      S.storage = !!me.storage;
      S.uploadMode = me.uploadMode || 'blob';
      startApp();
    } catch (e) {
      // 401 = servidor ok, sem sessão · 404/erro de rede = sem servidor (arquivo local)
      showLogin(e.status !== 401);
    }
  }

  /* ══════════ INÍCIO DO PAINEL ══════════ */
  async function loadSiteContent() {
    try {
      const r = await fetch('../content.json', { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch (e) { /* sem arquivo */ }
    return {};
  }
  async function loadContent() {
    if (S.local) return loadSiteContent();
    try { return await api('content?fresh=1'); }
    catch (e) {
      if (e.status === 404) return loadSiteContent(); // nada publicado ainda → começa do content.json do site
      throw e;
    }
  }
  async function loadMedia() {
    if (S.local || !S.storage) { S.media = []; return; }
    try {
      const r = await api('media');
      S.media = (r.files || []).map(f => ({ path: f.url, url: f.url, name: f.pathname.split('/').pop(), size: f.size }));
    } catch (e) {
      toast('Não consegui listar os arquivos: ' + friendly(e), true);
    }
  }

  async function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#localBar').hidden = !S.local;
    $('#storageBar').hidden = S.local || S.storage;
    $('#repoLabel').textContent = S.local ? 'Modo de teste' : `Olá, ${S.user}`;
    setStatus('saving', 'Carregando…');
    try {
      S.content = ensureShape(await loadContent());
    } catch (e) {
      toast('Não consegui carregar o conteúdo publicado: ' + friendly(e), true);
      S.content = ensureShape(await loadSiteContent());
    }
    await maybeRestoreDraft();
    renderAll();
    restoreTab();
    loadMedia().then(renderMedia);
  }

  async function maybeRestoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey())); } catch (e) { /* sem rascunho */ }
    if (!d || !d.content) return;
    if (JSON.stringify(ensureShape(d.content)) === JSON.stringify(S.content)) { clearDraft(); return; }
    const when = new Date(d.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const ok = await ask('Recuperar rascunho?', `Existem alterações não publicadas de ${when}. Quer continuar de onde parou?`, { ok: 'Recuperar', cancel: 'Descartar' });
    if (ok) { S.content = ensureShape(d.content); S.dirty = true; } else clearDraft();
  }

  function renderAll() {
    applyAdminTheme();
    renderProjects();
    renderCats();
    renderSections();
    renderTexts();
    renderVisual();
    renderMedia();
    setStatus();
  }

  /* ══════════ ABAS ══════════ */
  function showTab(name) {
    $$('.tab').forEach(x => x.classList.toggle('is-on', x.dataset.tab === name));
    $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    if (name === 'midia') renderMedia();
    try { localStorage.setItem('lg-admin-tab', name); } catch (e) { /* ok */ }
  }
  function restoreTab() {
    let t = 'projetos';
    try { t = localStorage.getItem('lg-admin-tab') || t; } catch (e) { /* ok */ }
    if (!$(`.tab[data-tab="${t}"]`)) t = 'projetos';
    showTab(t);
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => { showTab(t.dataset.tab); scrollTo(0, 0); }));

  /* ══════════ ENVIO DE ARQUIVOS (direto para o Vercel Blob) ══════════ */
  const EXT = {
    'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'application/pdf': 'pdf',
  };
  const extOf = f => EXT[f.type] || (f.name.match(/\.([a-z0-9]{2,5})$/i) || [, 'bin'])[1].toLowerCase();

  // imagens grandes → redimensiona (máx. 2400px) e converte para WebP
  async function optimizeImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return file;
    if (file.size < 450 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/webp', .86));
      if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    } catch (e) { return file; }
  }

  // servidor próprio (Docker): o arquivo vai direto no corpo da requisição, com progresso
  function xhrUpload(pathname, file, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', '/api/upload-file?name=' + encodeURIComponent(pathname));
      x.setRequestHeader('X-LG-Admin', '1');
      x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };
      x.onload = () => {
        let d = null;
        try { d = JSON.parse(x.responseText); } catch (e) { /* sem JSON */ }
        if (x.status >= 200 && x.status < 300 && d && d.url) resolve(d);
        else reject(new Error((d && d.error) || (x.status === 413 ? 'arquivo grande demais' : `erro ${x.status}`)));
      };
      x.onerror = () => reject(new Error('sem conexão com o servidor'));
      x.send(file);
    });
  }

  let blobMod = null;
  async function uploadFile(file, { quiet = false } = {}) {
    if (S.local) throw new Error(LOCAL_UPLOAD);
    if (!S.storage) throw new Error('O armazenamento não está ligado — conecte um Blob Store ao projeto na Vercel.');
    let f = file;
    if (f.type.startsWith('image/')) f = await optimizeImage(f);
    if (!EXT[f.type]) throw new Error(`“${file.name}”: tipo de arquivo não aceito. Use JPG, PNG, WebP, GIF, MP4, WebM ou PDF.`);
    if (f.size > 500 * 1048576) throw new Error(`“${file.name}” tem ${fmtSize(f.size)} — o limite é 500 MB. Para vídeos maiores, use Vimeo/YouTube.`);
    const d = new Date();
    const base = slug(file.name.replace(/\.[^.]+$/, '')) || 'arquivo';
    const pathname = `uploads/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${base}.${extOf(f)}`;
    const label = file.name.length > 28 ? file.name.slice(0, 25) + '…' : file.name;
    const progress = pct => { if (!quiet) toast(`Enviando ${label}… ${Math.round(pct)}%`, false, true); };
    if (!quiet) toast(`Enviando ${label}…`, false, true);
    try {
      let blob;
      if (S.uploadMode === 'direct') {
        blob = await xhrUpload(pathname, f, progress);
      } else {
        if (!blobMod) {
          try { blobMod = await import(BLOB_CLIENT); }
          catch (e) { throw new Error('não consegui carregar o módulo de envio (verifique a internet)'); }
        }
        blob = await blobMod.upload(pathname, f, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          contentType: f.type,
          multipart: f.size > 20 * 1048576,
          onUploadProgress: ({ percentage }) => progress(percentage),
        });
      }
      S.media.unshift({ path: blob.url, url: blob.url, name: blob.pathname.split('/').pop(), size: f.size });
      if (!quiet) toast('Arquivo enviado.');
      return blob.url;
    } catch (e) {
      throw new Error('Falha no envio: ' + (e.message || 'erro desconhecido'));
    }
  }

  // lê duração/proporção de um vídeo e captura um quadro para a capa
  function videoInfo(url) {
    return new Promise(res => {
      const v = document.createElement('video');
      let done = false;
      const finish = info => { if (!done) { done = true; res(info); } };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadedmetadata = () => {
        const info = { d: Math.round(v.duration) || 0, ar: v.videoWidth && v.videoHeight ? +(v.videoWidth / v.videoHeight).toFixed(4) : 16 / 9 };
        v.onseeked = () => {
          try {
            const c = document.createElement('canvas');
            const w = Math.min(1280, v.videoWidth || 1280);
            c.width = w; c.height = Math.round(w / info.ar);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            c.toBlob(b => finish({ ...info, poster: b }), 'image/webp', .85);
          } catch (e) { finish(info); }
        };
        v.currentTime = Math.min(1, (v.duration || 2) / 3);
      };
      v.onerror = () => finish({ d: 0, ar: 16 / 9 });
      setTimeout(() => finish({ d: 0, ar: 16 / 9 }), 15000);
    });
  }
  async function fileVideoInfo(file) {
    const url = URL.createObjectURL(file);
    try { return await videoInfo(url); } finally { URL.revokeObjectURL(url); }
  }

  /* ══════════ LINKS DE VÍDEO (Vimeo / YouTube) ══════════ */
  function parseVideoUrl(u) {
    u = String(u || '').trim();
    let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
    if (m) return { yt: m[1] };
    m = u.match(/vimeo\.com\/(?:.*\/)?(?:video\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/i);
    if (m) {
      const h = m[2] || (u.match(/[?&]h=([0-9a-f]+)/i) || [])[1];
      return h ? { id: m[1], h } : { id: m[1] };
    }
    if (/^\d{5,}$/.test(u)) return { id: u };
    return null;
  }
  const videoLink = p => p.yt ? `https://youtu.be/${p.yt}` : p.id ? `https://vimeo.com/${p.id}${p.h ? '/' + p.h : ''}` : '';

  async function fetchMeta(v) {
    if (v.id) {
      const url = `https://vimeo.com/${v.id}${v.h ? '/' + v.h : ''}`;
      const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=1280`);
      if (!r.ok) throw new Error('vimeo');
      const j = await r.json();
      const th = (j.thumbnail_url || '').match(/\/video\/([^?]+?)_\d+(?:x\d+)?(?:\?|$)/);
      return {
        t: j.title, d: j.duration || 0,
        y: parseInt((j.upload_date || '').slice(0, 4), 10) || new Date().getFullYear(),
        ar: j.width && j.height ? +(j.width / j.height).toFixed(4) : undefined,
        th: th ? th[1] : undefined,
      };
    }
    if (v.yt) {
      try {
        const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v.yt)}`);
        const j = await r.json();
        return { t: j.title || '', y: new Date().getFullYear() };
      } catch (e) { return { y: new Date().getFullYear() }; }
    }
    return {};
  }

  /* ══════════ CONSTRUTORES DE CAMPOS ══════════ */
  function label(text, hint) { return `<span>${esc(text)}${hint ? ` <small>${esc(hint)}</small>` : ''}</span>`; }

  function fText(obj, path, text, o = {}) {
    const w = el('label', 'field', label(text, o.hint));
    const i = el(o.multi ? 'textarea' : 'input', 'in');
    if (!o.multi) i.type = o.type || 'text';
    if (o.rows) i.rows = o.rows;
    if (o.ph) i.placeholder = o.ph;
    const v = getP(obj, path);
    i.value = v ?? '';
    i.addEventListener('input', () => {
      let val = i.value;
      if (o.type === 'number') val = val === '' ? '' : Number(val);
      setP(obj, path, val);
      (o.on || changed)(val);
    });
    w.append(i);
    return w;
  }

  function fToggle(obj, path, text, o = {}) {
    const w = el('label', 'check', `<input type="checkbox"><i></i><span>${esc(text)}</span>`);
    const c = $('input', w);
    c.checked = !!getP(obj, path);
    c.addEventListener('change', () => { setP(obj, path, c.checked); (o.on || changed)(c.checked); });
    return w;
  }

  function fSelect(obj, path, text, options, o = {}) {
    const w = el('label', 'field', label(text, o.hint));
    const s = el('select', 'in');
    const cur = getP(obj, path) ?? '';
    const opts = [...options];
    if (cur !== '' && !opts.some(x => x.v === cur)) opts.push({ v: cur, l: cur });
    s.innerHTML = opts.map(x => `<option value="${esc(x.v)}"${x.v === cur ? ' selected' : ''}>${esc(x.l)}</option>`).join('');
    s.addEventListener('change', () => { setP(obj, path, s.value); (o.on || changed)(s.value); });
    w.append(s);
    return w;
  }

  // imagem ou vídeo único: enviar do computador / escolher da biblioteca / remover
  function fImage(obj, path, text, o = {}) {
    const w = el('div', 'field', label(text, o.hint));
    const box = el('div', 'img-field');
    w.append(box);
    const video = o.accept === 'video';
    const on = o.on || changed;
    const draw = () => {
      const p = getP(obj, path);
      const u = assetUrl(p);
      box.innerHTML = `<div class="img-field__prev${o.square ? ' img-field__prev--sq' : ''}">${u
        ? (video || kindOf(p) === 'video' ? `<video src="${esc(u)}#t=0.5" muted preload="metadata"></video>` : `<img src="${esc(u)}" alt="">`)
        : `<span>${video ? 'sem vídeo' : 'sem imagem'}</span>`}</div>
        <div><div class="img-field__btns">
          <label class="btn btn--sm">Enviar do computador<input type="file" accept="${video ? 'video/*' : 'image/*'}"></label>
          <button class="btn btn--sm btn--ghost" type="button" data-a="lib">Biblioteca</button>
          ${p ? '<button class="btn btn--sm btn--ghost" type="button" data-a="rm">Remover</button>' : ''}
        </div></div>`;
      $('input', box).addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        box.classList.add('is-busy');
        try {
          const np = await uploadFile(f);
          setP(obj, path, np);
          await on(np, f);
          draw();
        } catch (err) {
          toast(err.message, true);
        } finally {
          box.classList.remove('is-busy');
        }
      });
      $('[data-a="lib"]', box).addEventListener('click', async () => {
        const np = await pickMedia(video ? 'video' : 'image');
        if (np) { setP(obj, path, np); await on(np); draw(); }
      });
      const rm = $('[data-a="rm"]', box);
      if (rm) rm.addEventListener('click', () => { setP(obj, path, ''); on(''); draw(); });
    };
    draw();
    w._redraw = draw;
    return w;
  }

  // botões ↑ ↓ ✕ de uma linha de lista
  function rowActions(a, i, after) {
    const box = el('div', 'li__actions', `
      <button type="button" class="icon-btn" data-m="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="icon-btn" data-m="1" title="Descer" ${i === a.length - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="icon-btn icon-btn--danger" data-m="x" title="Excluir">✕</button>`);
    box.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'x') a.splice(i, 1);
      else { const j = i + +m; [a[i], a[j]] = [a[j], a[i]]; }
      after();
    });
    return box;
  }

  function listArr(obj, path) {
    let a = getP(obj, path);
    if (!Array.isArray(a)) { a = []; setP(obj, path, a); }
    return a;
  }

  // lista de textos (CRUD)
  function fStrList(obj, path, text, o = {}) {
    const w = el('div', 'field', label(text, o.hint));
    const list = el('div', 'list');
    const add = el('button', 'btn btn--sm add-row', `+ ${esc(o.addLabel || 'Adicionar')}`);
    add.type = 'button';
    w.append(list, add);
    const on = o.on || changed;
    const draw = () => {
      list.innerHTML = '';
      const a = listArr(obj, path);
      if (!a.length) list.append(el('div', 'empty', 'Nenhum item.'));
      a.forEach((v, i) => {
        const row = el('div', 'li li--compact');
        const bodyEl = el('div', 'li__body');
        const inp = el(o.multi ? 'textarea' : 'input', 'in');
        if (o.multi) inp.rows = 3;
        inp.value = v ?? '';
        if (o.ph) inp.placeholder = o.ph;
        inp.addEventListener('input', () => { a[i] = inp.value; on(); });
        bodyEl.append(inp);
        row.append(bodyEl, rowActions(a, i, () => { draw(); on(); }));
        list.append(row);
      });
    };
    add.addEventListener('click', () => {
      listArr(obj, path).push('');
      draw(); on();
      const ins = $$('.in', list);
      if (ins.length) ins[ins.length - 1].focus();
    });
    draw();
    return w;
  }

  // lista de objetos (CRUD) — ex.: números, ferramentas, links
  function fObjList(obj, path, text, fields, o = {}) {
    const w = el('div', 'field', label(text, o.hint));
    const list = el('div', 'list');
    const add = el('button', 'btn btn--sm add-row', `+ ${esc(o.addLabel || 'Adicionar')}`);
    add.type = 'button';
    w.append(list, add);
    const on = o.on || changed;
    const draw = () => {
      list.innerHTML = '';
      const a = listArr(obj, path);
      if (!a.length) list.append(el('div', 'empty', 'Nenhum item.'));
      a.forEach((it, i) => {
        const row = el('div', 'li');
        const bodyEl = el('div', 'li__body ' + (o.cols || 'cols-2'));
        fields.forEach(f => bodyEl.append(f.type === 'toggle'
          ? fToggle(it, f.k, f.l, { on })
          : fText(it, f.k, f.l, { type: f.type, ph: f.ph, on })));
        row.append(bodyEl, rowActions(a, i, () => { draw(); on(); }));
        list.append(row);
      });
    };
    add.addEventListener('click', () => { listArr(obj, path).push(o.make ? o.make() : {}); draw(); on(); });
    draw();
    return w;
  }

  // várias imagens (galeria)
  function fImgList(obj, path, text, o = {}) {
    const w = el('div', 'field', label(text, o.hint));
    const grid = el('div', 'media');
    const btns = el('div', 'img-field__btns', `<label class="btn btn--sm">Enviar do computador<input type="file" accept="image/*" multiple></label>
      <button type="button" class="btn btn--sm btn--ghost" data-a="lib">Biblioteca</button>`);
    btns.style.marginTop = '10px';
    w.append(grid, btns);
    const on = o.on || changed;
    const draw = () => {
      const a = listArr(obj, path);
      grid.innerHTML = a.length ? '' : '<div class="empty" style="grid-column:1/-1">Nenhuma imagem.</div>';
      a.forEach((p, i) => {
        const m = el('div', 'mi', `<div class="mi__prev"><img src="${esc(assetUrl(p))}" alt=""></div>
          <div class="mi__actions">
            <button type="button" class="icon-btn" data-m="-1" title="Mover para trás" ${i ? '' : 'disabled'}>←</button>
            <button type="button" class="icon-btn" data-m="1" title="Mover para frente" ${i < a.length - 1 ? '' : 'disabled'}>→</button>
            <button type="button" class="icon-btn icon-btn--danger" data-m="x" title="Tirar da seção">✕</button>
          </div>`);
        m.addEventListener('click', e => {
          const b = e.target.closest('[data-m]');
          if (!b) return;
          const k = b.dataset.m;
          if (k === 'x') a.splice(i, 1);
          else { const j = i + +k; [a[i], a[j]] = [a[j], a[i]]; }
          draw(); on();
        });
        grid.append(m);
      });
    };
    $('input', btns).addEventListener('change', async e => {
      const files = [...e.target.files];
      e.target.value = '';
      btns.classList.add('is-busy');
      for (const f of files) {
        try { listArr(obj, path).push(await uploadFile(f)); draw(); } catch (err) { toast(err.message, true); }
      }
      btns.classList.remove('is-busy');
      on();
    });
    $('[data-a="lib"]', btns).addEventListener('click', async () => {
      const p = await pickMedia('image');
      if (p) { listArr(obj, path).push(p); draw(); on(); }
    });
    draw();
    return w;
  }

  const grid2 = (...els) => { const g = el('div', 'grid2'); g.append(...els); return g; };
  const grid3 = (...els) => { const g = el('div', 'grid3'); g.append(...els); return g; };
  function card(title, hint) {
    return el('div', 'card', `<h2>${esc(title)}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}`);
  }

  /* ══════════ EDITOR LATERAL ══════════ */
  const sheet = $('#sheet');
  let sheetOpen = false;
  function openSheet(title, build, { onSave, onDelete, saveLabel = 'Salvar' } = {}) {
    $('#sheetTitle').textContent = title;
    const bodyEl = $('#sheetBody');
    bodyEl.innerHTML = '';
    build(bodyEl);
    const foot = $('#sheetFoot');
    foot.innerHTML = '';
    if (onDelete) {
      const del = el('button', 'btn btn--danger', 'Excluir');
      del.type = 'button';
      del.addEventListener('click', async () => { if (await onDelete()) closeSheet(); });
      foot.append(del);
    }
    const cancel = el('button', 'btn btn--ghost', 'Cancelar');
    cancel.type = 'button';
    if (!onDelete) cancel.style.marginLeft = 'auto';
    cancel.addEventListener('click', closeSheet);
    const save = el('button', 'btn btn--primary', saveLabel);
    save.type = 'button';
    save.addEventListener('click', () => { if (onSave() !== false) closeSheet(); });
    foot.append(cancel, save);
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    sheetOpen = true;
    bodyEl.scrollTop = 0;
    setTimeout(() => { const f = $('input:not([type=file]),textarea,select', bodyEl); if (f) f.focus({ preventScroll: true }); }, 80);
  }
  function closeSheet() {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    sheetOpen = false;
  }
  $('#sheetX').addEventListener('click', closeSheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });

  /* ══════════ BIBLIOTECA (escolher arquivo já enviado) ══════════ */
  const prevHtml = m => {
    const k = kindOf(m.url);
    if (k === 'image') return `<img src="${esc(m.url)}" alt="" loading="lazy">`;
    if (k === 'video') return `<video src="${esc(m.url)}#t=0.5" muted preload="metadata"></video>`;
    return '📄';
  };
  function pickMedia(kind) {
    return new Promise(res => {
      const items = S.media.filter(m => kindOf(m.url) === kind);
      const d = el('div', 'confirm', `<div class="confirm__box" style="width:min(100%,760px);max-height:86vh;display:flex;flex-direction:column">
        <div class="row" style="justify-content:space-between"><h3>Escolher da biblioteca</h3><button type="button" class="icon-btn" data-x aria-label="Fechar">✕</button></div>
        <div class="media" style="overflow:auto">${items.length ? items.map(m => `
          <button type="button" class="mi" data-p="${esc(m.url)}" style="padding:0;text-align:left;cursor:pointer">
            <div class="mi__prev">${prevHtml(m)}</div><div class="mi__info"><span class="mi__n">${esc(m.name)}</span></div>
          </button>`).join('') : `<div class="empty" style="grid-column:1/-1">Nenhum${kind === 'video' ? ' vídeo' : 'a imagem'} na biblioteca ainda. Use “Enviar do computador”.</div>`}</div></div>`);
      document.body.append(d);
      const done = v => { d.remove(); document.removeEventListener('keydown', key, true); res(v); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      document.addEventListener('keydown', key, true);
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-p]');
        if (b) return done(b.dataset.p);
        if (e.target.closest('[data-x]') || e.target === d) done(null);
      });
    });
  }

  /* ══════════ ARRASTAR PARA REORDENAR ══════════ */
  function sortable(list, getArr, redraw) {
    let from = null;
    list.addEventListener('pointerdown', e => {
      const h = e.target.closest('.proj__handle');
      const row = e.target.closest('[data-i]');
      if (h && row) row.draggable = true;
    });
    list.addEventListener('dragstart', e => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      from = +row.dataset.i;
      row.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(from)); } catch (err) { /* ok */ }
    });
    list.addEventListener('dragover', e => {
      if (from === null) return;
      e.preventDefault();
      const row = e.target.closest('[data-i]');
      $$('.is-over', list).forEach(r => { if (r !== row) r.classList.remove('is-over'); });
      if (row) row.classList.add('is-over');
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      const row = e.target.closest('[data-i]');
      if (row && from !== null) {
        const to = +row.dataset.i;
        if (to !== from) {
          const a = getArr();
          const [it] = a.splice(from, 1);
          a.splice(to, 0, it);
          redraw(); changed();
        }
      }
      from = null;
    });
    list.addEventListener('dragend', () => {
      $$('[data-i]', list).forEach(r => { r.draggable = false; r.classList.remove('is-drag', 'is-over'); });
      from = null;
    });
  }

  /* ══════════ PROJETOS ══════════ */
  const catLabel = key => (S.content.categories.find(c => c.key === key) || {}).label || key || 'sem categoria';
  function projThumb(p) {
    if (p.thumb) return { img: assetUrl(p.thumb) };
    if (p.th) return { img: `${CDN}${p.th}_640` };
    if (p.yt) return { img: `https://i.ytimg.com/vi/${p.yt}/mqdefault.jpg` };
    if (p.file) return { video: assetUrl(p.file) };
    return {};
  }

  function renderProjects() {
    const list = $('#projList');
    const a = S.content.projects;
    $('#projTotal').textContent = a.filter(p => !p.hidden).length;
    if (!a.length) { list.innerHTML = '<div class="empty">Nenhum projeto ainda. Cole um link ou envie um vídeo acima.</div>'; return; }
    list.innerHTML = a.map((p, i) => {
      const t = projThumb(p);
      const src = p.file ? 'Arquivo' : p.yt ? 'YouTube' : 'Vimeo';
      return `<div class="proj${p.hidden ? ' is-off' : ''}" data-i="${i}">
        <span class="proj__handle" title="Arraste para reordenar">⠿</span>
        <div class="proj__thumb">${t.img ? `<img src="${esc(t.img)}" alt="" loading="lazy">` : t.video ? `<video src="${esc(t.video)}#t=0.5" muted preload="metadata"></video>` : ''}<b>${pad(i + 1)}</b></div>
        <div class="proj__info" data-act="edit" style="cursor:pointer">
          <span class="proj__t">${esc(p.t || 'Sem título')}</span>
          <div class="proj__m">
            <span class="chip chip--accent">${esc(catLabel(p.cat))}</span><span class="chip">${src}</span>
            ${p.hidden ? '<span class="chip chip--warn">oculto</span>' : ''}
            ${p.y ? `<span>${esc(p.y)}</span>` : ''}${p.c ? `<span>${esc(p.c)}</span>` : ''}
          </div>
        </div>
        <div class="proj__actions">
          <button type="button" class="icon-btn" data-act="up" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-btn" data-act="down" title="Descer" ${i === a.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="icon-btn" data-act="toggle" title="${p.hidden ? 'Mostrar no site' : 'Ocultar do site'}">${p.hidden ? '◌' : '◉'}</button>
          <button type="button" class="icon-btn" data-act="edit" title="Editar">✎</button>
          <button type="button" class="icon-btn icon-btn--danger" data-act="del" title="Excluir">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  $('#projList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('[data-i]');
    const i = +row.dataset.i;
    const a = S.content.projects;
    const p = a[i];
    switch (b.dataset.act) {
      case 'up': if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; break;
      case 'down': if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; break;
      case 'toggle': if (p.hidden) delete p.hidden; else p.hidden = true; break;
      case 'edit': editProject(p, false); return;
      case 'del':
        if (!await ask('Excluir projeto?', `“${p.t || 'Sem título'}” será removido do site.`, { ok: 'Excluir', danger: true })) return;
        a.splice(i, 1);
        toast('Projeto excluído.');
        break;
      default: return;
    }
    renderProjects(); renderCats(); changed();
  });
  sortable($('#projList'), () => S.content.projects, () => renderProjects());

  function cleanProject(p) {
    ['h', 'thumb', 'file', 'th', 'yt', 'id', 'c'].forEach(k => { if (p[k] === '' || p[k] == null) delete p[k]; });
    if (!p.hidden) delete p.hidden;
    if (p.ar && Math.abs(p.ar - 16 / 9) < .02) delete p.ar;
    return p;
  }

  function editProject(orig, isNew) {
    const p = clone(orig);
    const catOpts = [{ v: '', l: '— sem categoria —' }, ...S.content.categories.map(c => ({ v: c.key, l: c.label }))];
    let thumbField;
    openSheet(isNew ? 'Novo projeto' : 'Editar projeto', bodyEl => {
      bodyEl.append(
        fText(p, 't', 'Título', { on: noop }),
        fText(p, 'c', 'Cliente / descrição curta', { on: noop, ph: 'Ex.: NBA Brasil · Vinheta' }),
        grid2(fText(p, 'y', 'Ano', { type: 'number', on: noop }), fSelect(p, 'cat', 'Categoria', catOpts, { on: noop })),
        el('h3', 'group-t mono', 'Vídeo'),
      );
      const src = el('div');
      bodyEl.append(src);
      const drawSrc = () => {
        src.innerHTML = '';
        const tmp = { u: p.file ? '' : videoLink(p) };
        src.append(
          fText(tmp, 'u', 'Link do Vimeo ou YouTube', {
            ph: 'https://vimeo.com/…',
            hint: p.file ? '(colar um link substitui o arquivo enviado)' : '',
            on: v => {
              const r = parseVideoUrl(v);
              if (!r) return;
              ['id', 'h', 'yt', 'file', 'th'].forEach(k => delete p[k]);
              Object.assign(p, r);
            },
          }),
          el('div', 'or', 'ou'),
          fImage(p, 'file', 'Arquivo de vídeo do computador', {
            accept: 'video', hint: 'MP4 de preferência',
            on: async (v, file) => {
              if (!v) return;
              ['id', 'h', 'yt', 'th'].forEach(k => delete p[k]);
              if (file) {
                const info = await fileVideoInfo(file);
                if (info.d) p.d = info.d;
                p.ar = info.ar;
                if (!p.thumb && info.poster) {
                  try {
                    p.thumb = await uploadFile(new File([info.poster], 'capa.webp', { type: 'image/webp' }), { quiet: true });
                    if (thumbField) thumbField._redraw();
                  } catch (e) { /* sem capa automática */ }
                }
              }
              setTimeout(drawSrc, 0);
            },
          }),
        );
      };
      drawSrc();
      thumbField = fImage(p, 'thumb', 'Capa (thumbnail)', { on: noop, hint: 'opcional — sem capa, usa a do Vimeo/YouTube' });
      bodyEl.append(
        fText(p, 'd', 'Duração (segundos)', { type: 'number', on: noop, hint: 'aparece como timecode no card' }),
        thumbField,
        el('hr', 'sep'),
        fToggle(p, 'hidden', 'Ocultar do site (sem excluir)', { on: noop }),
      );
    }, {
      saveLabel: isNew ? 'Adicionar ao site' : 'Salvar',
      onSave: () => {
        if (!p.id && !p.yt && !p.file) { toast('Coloque um link de vídeo ou envie um arquivo.', true); return false; }
        if (!String(p.t || '').trim()) p.t = 'Sem título';
        p.y = parseInt(p.y, 10) || '';
        p.d = parseInt(p.d, 10) || 0;
        cleanProject(p);
        let target;
        if (isNew) { S.content.projects.unshift(p); target = p; }
        else { Object.keys(orig).forEach(k => delete orig[k]); Object.assign(orig, p); target = orig; }
        // trocou para um link do Vimeo sem capa → busca a capa
        if (target.id && !target.th && !target.thumb) {
          fetchMeta(target).then(m => { if (m.th) { target.th = m.th; renderProjects(); changed(); } }).catch(noop);
        }
        renderProjects(); renderCats(); changed();
        toast(isNew ? 'Projeto adicionado. Clique em Publicar para ir ao ar.' : 'Projeto atualizado.');
      },
      onDelete: isNew ? null : async () => {
        if (!await ask('Excluir projeto?', `“${orig.t || 'Sem título'}” será removido do site.`, { ok: 'Excluir', danger: true })) return false;
        const a = S.content.projects;
        a.splice(a.indexOf(orig), 1);
        renderProjects(); renderCats(); changed();
        toast('Projeto excluído.');
        return true;
      },
    });
  }

  // adicionar por link
  $('#addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const url = $('#addUrl').value;
    const v = parseVideoUrl(url);
    if (!v) return toast('Link não reconhecido. Use um link do Vimeo ou do YouTube.', true);
    if ((v.id && S.content.projects.some(p => p.id === v.id)) || (v.yt && S.content.projects.some(p => p.yt === v.yt))) {
      return toast('Esse vídeo já está na lista.', true);
    }
    const btn = $('#addBtn');
    btn.disabled = true; btn.textContent = 'Buscando…';
    let meta = {};
    try { meta = await fetchMeta(v); } catch (err) { toast('Não consegui buscar os dados do vídeo — preencha manualmente.', true); }
    btn.disabled = false; btn.textContent = 'Adicionar';
    const p = { ...v, t: meta.t || '', c: '', y: meta.y || new Date().getFullYear(), cat: (S.content.categories[0] || {}).key || '', d: meta.d || 0 };
    if (meta.th) p.th = meta.th;
    if (meta.ar) p.ar = meta.ar;
    $('#addUrl').value = '';
    editProject(p, true);
  });

  // adicionar vídeo do computador
  async function addVideoFile(f) {
    if (!f || !f.type.startsWith('video/')) return toast('Escolha um arquivo de vídeo (MP4 de preferência).', true);
    if (S.local) return toast(LOCAL_UPLOAD, true);
    if (f.type === 'video/quicktime') toast('Arquivos .mov podem não tocar em todos os navegadores — MP4 é mais seguro.');
    const zone = $('#videoDrop');
    zone.classList.add('is-busy');
    try {
      const info = await fileVideoInfo(f);
      const url = await uploadFile(f);
      const base = f.name.replace(/\.[^.]+$/, '');
      const p = {
        file: url, t: base.replace(/[-_]+/g, ' ').trim(), c: '',
        y: new Date().getFullYear(), cat: (S.content.categories[0] || {}).key || '', d: info.d, ar: info.ar,
      };
      if (info.poster) {
        try { p.thumb = await uploadFile(new File([info.poster], `capa-${base}.webp`, { type: 'image/webp' }), { quiet: true }); } catch (e) { /* sem capa */ }
      }
      renderMedia();
      editProject(p, true);
    } catch (err) {
      toast(err.message, true);
    } finally {
      zone.classList.remove('is-busy');
    }
  }
  function dropzone(zone, onFiles) {
    const input = $('input[type=file]', zone);
    input.addEventListener('change', () => { onFiles([...input.files]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('is-over')));
    zone.addEventListener('drop', e => { e.preventDefault(); onFiles([...e.dataTransfer.files]); });
  }
  dropzone($('#videoDrop'), files => addVideoFile(files[0]));

  /* ══════════ CATEGORIAS ══════════ */
  function renderCats() {
    const box = $('#catsList');
    const cats = S.content.categories;
    box.innerHTML = '';
    if (!cats.length) box.append(el('div', 'empty', 'Nenhuma categoria — todos os projetos aparecem sem filtro.'));
    cats.forEach((c, i) => {
      const n = S.content.projects.filter(p => p.cat === c.key).length;
      const row = el('div', 'li li--compact');
      const bodyEl = el('div', 'li__body');
      bodyEl.style.gridTemplateColumns = 'minmax(0,1fr) auto';
      bodyEl.style.alignItems = 'center';
      const inp = el('input', 'in');
      inp.value = c.label;
      inp.placeholder = 'Nome da categoria';
      inp.addEventListener('input', () => { c.label = inp.value; changed(); });
      inp.addEventListener('change', () => renderProjects());
      bodyEl.append(inp, el('span', 'chip', `${n} projeto${n === 1 ? '' : 's'}`));
      const act = el('div', 'li__actions', `
        <button type="button" class="icon-btn" data-m="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-m="1" title="Descer" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-m="x" title="Excluir">✕</button>`);
      act.addEventListener('click', async e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.m === 'x') {
          if (n && !await ask('Excluir categoria?', `Os ${n} projeto(s) de “${c.label}” ficam sem categoria (continuam aparecendo em “${S.content.labels.all || 'Todos'}”).`, { ok: 'Excluir', danger: true })) return;
          S.content.projects.forEach(p => { if (p.cat === c.key) p.cat = ''; });
          cats.splice(i, 1);
        } else {
          const j = i + +b.dataset.m;
          [cats[i], cats[j]] = [cats[j], cats[i]];
        }
        renderCats(); renderProjects(); changed();
      });
      row.append(bodyEl, act);
      box.append(row);
    });
  }
  $('#catAdd').addEventListener('click', () => {
    const cats = S.content.categories;
    let k = 'categoria', n = 2;
    while (cats.some(c => c.key === k)) k = `categoria-${n++}`;
    cats.push({ key: k, label: 'Nova categoria' });
    renderCats(); changed();
    const ins = $$('#catsList .in');
    if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); }
  });

  /* ══════════ SEÇÕES EXTRAS ══════════ */
  function renderSections() {
    const list = $('#secList');
    const a = S.content.sections;
    if (!a.length) {
      list.innerHTML = '<div class="empty">Nenhuma seção extra. Clique em “Nova seção” para criar — por exemplo “Prêmios”, “Processo”, “Depoimentos” ou “Bastidores”.</div>';
      return;
    }
    list.innerHTML = a.map((s, i) => {
      const img = (s.images || [])[0];
      return `<div class="xs${s.hidden ? ' is-off' : ''}" data-i="${i}">
        <span class="proj__handle" title="Arraste para reordenar">⠿</span>
        <div class="xs__img">${img ? `<img src="${esc(assetUrl(img))}" alt="" loading="lazy">` : '¶'}</div>
        <div class="proj__info" data-act="edit" style="cursor:pointer">
          <span class="proj__t">${esc(s.title || 'Sem título')}</span>
          <div class="proj__m"><span class="chip">${esc(LAYOUTS[s.layout] || LAYOUTS['texto-imagem'])}</span>
            ${s.nav ? '<span class="chip chip--accent">no menu</span>' : ''}${s.hidden ? '<span class="chip chip--warn">oculta</span>' : ''}</div>
        </div>
        <div class="proj__actions">
          <button type="button" class="icon-btn" data-act="up" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-btn" data-act="down" title="Descer" ${i === a.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="icon-btn" data-act="toggle" title="${s.hidden ? 'Mostrar' : 'Ocultar'}">${s.hidden ? '◌' : '◉'}</button>
          <button type="button" class="icon-btn" data-act="edit" title="Editar">✎</button>
          <button type="button" class="icon-btn icon-btn--danger" data-act="del" title="Excluir">✕</button>
        </div>
      </div>`;
    }).join('');
  }
  $('#secList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.closest('[data-i]').dataset.i;
    const a = S.content.sections;
    const s = a[i];
    switch (b.dataset.act) {
      case 'up': if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; break;
      case 'down': if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; break;
      case 'toggle': if (s.hidden) delete s.hidden; else s.hidden = true; break;
      case 'edit': editSection(s, false); return;
      case 'del':
        if (!await ask('Excluir seção?', `“${s.title || 'Sem título'}” será removida do site.`, { ok: 'Excluir', danger: true })) return;
        a.splice(i, 1);
        toast('Seção excluída.');
        break;
      default: return;
    }
    renderSections(); changed();
  });
  sortable($('#secList'), () => S.content.sections, () => renderSections());
  $('#secAdd').addEventListener('click', () => editSection({ title: '', kicker: '', text: '', layout: 'texto-imagem', images: [], cta: { label: '', url: '' }, nav: false }, true));

  function editSection(orig, isNew) {
    const s = clone(orig);
    if (!s.cta) s.cta = { label: '', url: '' };
    if (!Array.isArray(s.images)) s.images = [];
    openSheet(isNew ? 'Nova seção' : 'Editar seção', bodyEl => {
      bodyEl.append(
        fText(s, 'title', 'Título da seção', { on: noop, ph: 'Ex.: Prêmios' }),
        fText(s, 'kicker', 'Linha de apoio', { on: noop, hint: 'opcional, aparece ao lado do título' }),
        fSelect(s, 'layout', 'Formato', Object.entries(LAYOUTS).map(([v, l]) => ({ v, l })), { on: noop }),
        fText(s, 'text', 'Texto', { multi: true, rows: 9, on: noop, hint: `linha em branco separa parágrafos — ${RICH}` }),
        fImgList(s, 'images', 'Imagens', { on: noop, hint: 'no formato com imagem, usa a primeira; na galeria, todas' }),
        el('h3', 'group-t mono', 'Botão (opcional)'),
        grid2(fText(s, 'cta.label', 'Texto do botão', { on: noop, ph: 'Ex.: Ver no Behance' }), fText(s, 'cta.url', 'Link do botão', { on: noop, ph: 'https://…' })),
        el('hr', 'sep'),
        fToggle(s, 'nav', 'Mostrar no menu do topo', { on: noop }),
        fText(s, 'navLabel', 'Nome no menu', { on: noop, hint: 'se vazio, usa o título' }),
        fToggle(s, 'hidden', 'Ocultar do site (sem excluir)', { on: noop }),
      );
    }, {
      saveLabel: isNew ? 'Criar seção' : 'Salvar',
      onSave: () => {
        if (!String(s.title || '').trim() && !String(s.text || '').trim() && !s.images.length) {
          toast('Escreva pelo menos um título ou um texto.', true);
          return false;
        }
        if (!s.cta.label && !s.cta.url) delete s.cta;
        if (!s.hidden) delete s.hidden;
        if (!s.navLabel) delete s.navLabel;
        if (isNew) S.content.sections.push(s);
        else { Object.keys(orig).forEach(k => delete orig[k]); Object.assign(orig, s); }
        renderSections(); changed();
        toast(isNew ? 'Seção criada.' : 'Seção atualizada.');
      },
      onDelete: isNew ? null : async () => {
        if (!await ask('Excluir seção?', `“${orig.title || 'Sem título'}” será removida do site.`, { ok: 'Excluir', danger: true })) return false;
        const a = S.content.sections;
        a.splice(a.indexOf(orig), 1);
        renderSections(); changed();
        return true;
      },
    });
  }

  /* ══════════ TEXTOS ══════════ */
  function showreelField() {
    const C = S.content;
    const tmp = { u: C.showreel.id ? videoLink(C.showreel) : '' };
    const box = el('div');
    box.append(
      fText(tmp, 'u', 'Link do showreel no Vimeo', {
        ph: 'https://vimeo.com/…',
        on: v => {
          const r = parseVideoUrl(v);
          if (r && r.id) { C.showreel.id = r.id; if (r.h) C.showreel.h = r.h; else delete C.showreel.h; changed(); }
          else if (!v.trim()) { C.showreel.id = ''; delete C.showreel.h; changed(); }
        },
      }),
      el('div', 'or', 'ou'),
      fImage(C.showreel, 'file', 'Arquivo de vídeo do computador', {
        accept: 'video', hint: 'usado só se não houver link',
        on: v => { if (v) { C.showreel.id = ''; delete C.showreel.h; setTimeout(renderTexts, 0); } changed(); },
      }),
    );
    return box;
  }

  function renderTexts() {
    const P = $('#textsPanel');
    const C = S.content;
    P.innerHTML = '';
    P.append(el('p', 'hint', `Tudo o que você escrever aqui aparece no site depois de <b>Publicar</b>. Nos textos longos, ${RICH}.`));

    let c = card('Identidade', 'Seu nome vira o título gigante do topo e o logo.');
    c.append(
      grid2(fText(C, 'site.name', 'Nome'), fText(C, 'site.role', 'Função / cargo')),
      grid2(fText(C, 'site.city', 'Cidade'), fText(C, 'site.footer', 'Texto do rodapé')),
      fText(C, 'site.description', 'Descrição para Google e redes sociais', { multi: true, rows: 2 }),
    );
    P.append(c);

    c = card('Topo do site');
    c.append(
      fText(C, 'hero.lede', 'Texto de apresentação', { multi: true, rows: 4, hint: RICH }),
      fText(C, 'labels.specialty', 'Rótulo das especialidades'),
      fStrList(C, 'hero.specialties', 'Especialidades (ficam girando)', { addLabel: 'Adicionar especialidade' }),
      fToggle(C, 'hero.available', 'Mostrar “disponível” com luz verde'),
      fText(C, 'hero.availableText', 'Texto de disponibilidade'),
    );
    P.append(c);

    c = card('Showreel', 'O vídeo que abre nos botões “Showreel” e no selo giratório.');
    c.append(showreelField(), grid2(fText(C, 'showreel.title', 'Título do showreel'), fText(C, 'labels.showreel', 'Texto do botão')));
    P.append(c);

    c = card('Faixa de palavras', 'A faixa colorida inclinada logo abaixo do topo.');
    c.append(fStrList(C, 'ticker', 'Palavras', { addLabel: 'Adicionar palavra' }));
    P.append(c);

    c = card('Seção Trabalhos');
    c.append(grid2(
      fText(C, 'labels.works', 'Título', { multi: true, rows: 2, hint: 'Enter = quebra de linha' }),
      fText(C, 'labels.all', 'Nome do filtro “todos”'),
    ));
    P.append(c);

    c = card('Sobre');
    c.append(
      fText(C, 'labels.about', 'Título da seção'),
      fImage(C.about, 'photo', 'Sua foto', { square: true, hint: 'aparece ao lado do texto — de preferência vertical' }),
      fText(C, 'about.big', 'Frase de destaque', { multi: true, rows: 3, hint: RICH }),
      fStrList(C, 'about.paragraphs', 'Parágrafos', { multi: true, addLabel: 'Adicionar parágrafo', hint: RICH }),
      fObjList(C, 'about.stats', 'Números', [
        { k: 'n', l: 'Número', type: 'number' },
        { k: 'suffix', l: 'Sufixo', ph: '+' },
        { k: 'label', l: 'Legenda' },
        { k: 'auto', l: 'Usar total de projetos', type: 'toggle' },
      ], { addLabel: 'Adicionar número', make: () => ({ n: 0, suffix: '', label: '' }) }),
      fText(C, 'labels.tools', 'Título da lista de ferramentas'),
      fObjList(C, 'about.tools', 'Ferramentas', [
        { k: 'name', l: 'Ferramenta' },
        { k: 'desc', l: 'Uso' },
      ], { addLabel: 'Adicionar ferramenta', make: () => ({ name: '', desc: '' }) }),
      fText(C, 'labels.services', 'Título da lista de serviços'),
      fStrList(C, 'about.services', 'Serviços', { addLabel: 'Adicionar serviço' }),
    );
    P.append(c);

    c = card('Clientes');
    c.append(fText(C, 'labels.clients', 'Rótulo da faixa'), fStrList(C, 'clients', 'Clientes', { addLabel: 'Adicionar cliente' }));
    P.append(c);

    c = card('Contato');
    c.append(
      fText(C, 'contact.kicker', 'Chamada'),
      grid2(fText(C, 'contact.title1', 'Título — linha 1'), fText(C, 'contact.title2', 'Título — linha 2 (contorno)')),
      fText(C, 'contact.email', 'E-mail', { type: 'email', ph: 'voce@email.com' }),
      grid2(
        fText(C, 'contact.instagram', 'Instagram', { hint: 'usuário ou link' }),
        fText(C, 'contact.vimeo', 'Vimeo', { hint: 'usuário ou link' }),
      ),
      fObjList(C, 'contact.links', 'Outros links (LinkedIn, Behance, WhatsApp…)', [
        { k: 'label', l: 'Nome', ph: 'LinkedIn' },
        { k: 'handle', l: 'Texto pequeno', ph: '/in/seu-nome ↗' },
        { k: 'url', l: 'Link', ph: 'https://…' },
      ], { cols: 'cols-3', addLabel: 'Adicionar link', make: () => ({ label: '', handle: '', url: '' }) }),
    );
    P.append(c);

    c = card('Menu do topo');
    c.append(grid3(
      fText(C, 'labels.navWorks', 'Link “Trabalhos”'),
      fText(C, 'labels.navAbout', 'Link “Sobre”'),
      fText(C, 'labels.navContact', 'Link “Contato”'),
    ));
    P.append(c);
  }

  /* ══════════ VISUAL ══════════ */
  function lumOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const L = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * L[0] + .7152 * L[1] + .0722 * L[2];
  }
  const onColor = hex => { const lum = lumOf(hex); return (lum + .05) / .0524 >= .91 / (lum + .05) ? '#08080A' : '#F2EFE9'; };
  const contrast = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

  function applyAdminTheme() {
    const a = S.content.theme.accent || '#FF3B00';
    document.documentElement.style.setProperty('--accent', a);
    document.documentElement.style.setProperty('--on-accent', onColor(a));
  }
  function updateSample() {
    const T = S.content.theme;
    const s = $('.sample');
    if (s) {
      s.style.setProperty('--s-bg', T.bg);
      s.style.setProperty('--s-fg', T.fg);
      s.style.setProperty('--s-accent', T.accent);
      s.style.setProperty('--s-on', onColor(T.accent));
    }
    const warn = $('#contrastWarn');
    if (warn) {
      const c = contrast(T.bg, T.fg);
      warn.hidden = c >= 4.5;
      warn.textContent = `Atenção: o texto está com pouco contraste com o fundo (${c.toFixed(1)}:1). O ideal é pelo menos 4,5:1.`;
    }
    $$('.sw').forEach(b => b.classList.toggle('is-on', b.dataset.c.toUpperCase() === T.accent.toUpperCase()));
    applyAdminTheme();
  }

  function fColor(obj, key, text) {
    const w = el('div', 'field', `<span>${esc(text)}</span><div class="color-row"><input type="color" aria-label="${esc(text)}"><input class="in" maxlength="7" aria-label="Código da cor ${esc(text)}"></div>`);
    const [pick, hex] = $$('input', w);
    const set = (v, from) => {
      v = String(v).trim().toUpperCase();
      if (!v.startsWith('#')) v = '#' + v;
      if (!/^#[0-9A-F]{6}$/.test(v)) return;
      obj[key] = v;
      if (from !== 'pick') pick.value = v;
      if (from !== 'hex') hex.value = v;
      updateSample();
      changed();
    };
    pick.value = obj[key];
    hex.value = obj[key];
    pick.addEventListener('input', () => set(pick.value, 'pick'));
    hex.addEventListener('input', () => set(hex.value, 'hex'));
    w._set = v => set(v);
    return w;
  }

  function renderVisual() {
    const P = $('#visualPanel');
    const T = S.content.theme;
    P.innerHTML = '';

    let c = card('Cores', 'A cor de destaque aparece em botões, detalhes, cursor, faixa e brilhos. Fundo e texto mudam o site inteiro.');
    const presets = el('div', 'row');
    presets.style.marginTop = '14px';
    PRESETS.forEach(p => {
      const b = el('button', 'btn btn--sm', `<span style="display:inline-flex;gap:3px">${[p.bg, p.fg, p.accent].map(x => `<i style="width:10px;height:10px;border-radius:50%;background:${x};box-shadow:0 0 0 1px rgba(255,255,255,.2)"></i>`).join('')}</span>${esc(p.name)}`);
      b.type = 'button';
      b.addEventListener('click', () => { Object.assign(T, { bg: p.bg, fg: p.fg, accent: p.accent }); renderVisual(); changed(); });
      presets.append(b);
    });
    const accent = fColor(T, 'accent', 'Cor de destaque');
    const sw = el('div', 'swatches');
    SWATCHES.forEach(x => {
      const b = el('button', 'sw');
      b.type = 'button';
      b.dataset.c = x;
      b.style.background = x;
      b.title = x;
      b.addEventListener('click', () => accent._set(x));
      sw.append(b);
    });
    accent.append(sw);
    const cols = el('div', 'colors');
    cols.append(accent, fColor(T, 'bg', 'Fundo'), fColor(T, 'fg', 'Texto'));
    c.append(presets, cols,
      el('div', 'sample', `<span class="sample__t">${esc((S.content.site.name || 'Seu nome').split(' ')[0])} <em>${esc((S.content.site.name || '').split(' ').slice(1).join(' ') || 'Nome')}</em></span><span class="sample__btn">▶ Ver showreel</span><span class="sample__tag mono"><i></i>00:00:18:00</span>`),
      el('p', 'err', ''),
    );
    $('.err', c).id = 'contrastWarn';
    P.append(c);

    c = card('Efeitos e seções', 'Ligue ou desligue partes do site.');
    const checks = el('div', 'checks');
    checks.append(fToggle(T, 'grain', 'Textura de TV (granulado e linhas)'));
    Object.entries(SHOW).forEach(([k, l]) => checks.append(fToggle(S.content.show, k, l)));
    c.append(checks);
    P.append(c);

    c = card('Restaurar');
    const reset = el('button', 'btn', 'Voltar às cores originais');
    reset.type = 'button';
    reset.style.marginTop = '12px';
    reset.addEventListener('click', () => { const { bg, fg, accent: a } = PRESETS[0]; Object.assign(T, { bg, fg, accent: a }); renderVisual(); changed(); });
    c.append(reset);
    P.append(c);

    updateSample();
  }

  /* ══════════ MÍDIA ══════════ */
  function renderMedia() {
    const grid = $('#mediaGrid');
    if (!grid || !S.content) return;
    const used = usedPaths(S.content);
    const items = S.media;
    grid.innerHTML = items.length ? '' : `<div class="empty" style="grid-column:1/-1">${S.local ? LOCAL_UPLOAD : 'Nenhum arquivo enviado ainda.'}</div>`;
    items.forEach(m => {
      const it = el('div', 'mi' + (used.has(m.url) ? ' is-used' : ''), `
        <div class="mi__prev">${prevHtml(m)}</div>
        <div class="mi__info"><span class="mi__n" title="${esc(m.name)}">${esc(m.name)}</span>
          <span class="mi__s">${fmtSize(m.size || 0)}</span></div>
        <div class="mi__actions">
          <a class="icon-btn" href="${esc(m.url)}" target="_blank" rel="noopener" title="Abrir">↗</a>
          <button type="button" class="icon-btn icon-btn--danger" title="Excluir">✕</button>
        </div>`);
      $('button', it).addEventListener('click', async () => {
        const inUse = used.has(m.url);
        const ok = await ask('Excluir arquivo?', inUse
          ? `“${m.name}” está sendo usado no site. Se excluir, os lugares que usam ficam sem essa imagem/vídeo — publique em seguida.`
          : `“${m.name}” será apagado.`, { ok: 'Excluir', danger: true });
        if (!ok) return;
        try {
          await api('media?url=' + encodeURIComponent(m.url), { method: 'DELETE' });
          S.media = S.media.filter(x => x.url !== m.url);
          if (inUse) { removeRefs(S.content, m.url); renderAll(); changed(); toast('Arquivo excluído. Clique em Publicar para atualizar o site.'); }
          else { renderMedia(); toast('Arquivo excluído.'); }
        } catch (e) {
          toast('Não consegui excluir: ' + friendly(e), true);
        }
      });
      grid.append(it);
    });
    const total = items.reduce((s, m) => s + (m.size || 0), 0);
    $('#mediaInfo').textContent = items.length ? `${items.length} arquivo(s) · ${fmtSize(total)}` : '';
  }
  dropzone($('#mediaDrop'), async files => {
    if (S.local) return toast(LOCAL_UPLOAD, true);
    const zone = $('#mediaDrop');
    zone.classList.add('is-busy');
    let n = 0;
    for (const f of files) {
      try { await uploadFile(f); n++; renderMedia(); } catch (err) { toast(err.message, true); }
    }
    zone.classList.remove('is-busy');
    if (n) toast(`${n} arquivo(s) enviado(s). Escolha na “Biblioteca” de qualquer campo de imagem.`);
  });

  /* ══════════ PUBLICAR ══════════ */
  function download(blob, name) {
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function publish() {
    if (S.local) {
      download(new Blob([JSON.stringify(S.content, null, 2) + '\n'], { type: 'application/json' }), 'content.json');
      S.dirty = false; clearDraft(); setStatus();
      return toast('content.json baixado.');
    }
    if (!S.dirty) return toast('Nada para publicar.');
    const btn = $('#publishBtn');
    btn.disabled = true;
    setStatus('saving');
    try {
      await api('content', { method: 'PUT', body: JSON.stringify(S.content) });
      S.dirty = false;
      clearDraft();
      toast('Publicado! O site atualiza em até 1 minuto.');
    } catch (e) {
      if (e.status === 401) {
        toast('Sua sessão expirou — entre de novo. As alterações ficaram guardadas como rascunho.', true);
        saveDraft();
        setTimeout(() => { S.dirty = false; location.reload(); }, 2600);
      } else {
        toast('Erro ao publicar: ' + friendly(e), true);
      }
    } finally {
      btn.disabled = false;
      setStatus();
    }
  }

  $('#publishBtn').addEventListener('click', publish);
  $('#previewBtn').addEventListener('click', openPreview);
  addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  // Ctrl/Cmd + S publica
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.content) { e.preventDefault(); publish(); }
  });

  boot();
})();
