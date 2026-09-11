/* ═══════════════════════════════════════════════════════════
   PAINEL ADMIN
   Edita o content.json do site e envia arquivos (fotos, vídeos),
   publicando direto no repositório do GitHub — 1 commit por publicação.
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
  const te = new TextEncoder(), td = new TextDecoder();
  const b64e = buf => { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const blobToB64 = b => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

  /* ══════════ CONSTANTES ══════════ */
  const STORE = 'lg-admin';
  const CDN = 'https://i.vimeocdn.com/video/';
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
    gh: null,             // { owner, repo, branch, token }
    local: false,         // modo sem GitHub
    content: null,        // o content.json sendo editado
    dirty: false,
    pending: new Map(),   // caminho → { file, url, size, name, type, keep }
    published: new Map(), // caminho → blob URL (acabou de publicar, o site ainda está atualizando)
    deleted: new Set(),   // caminhos a apagar do repositório
    media: [],            // arquivos em uploads/ no repositório
    previewWin: null,
  };
  const mediaMap = () => new Map(S.media.map(m => [m.path, m]));

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

  // todos os caminhos "uploads/…" usados no conteúdo
  function usedPaths(c) {
    const set = new Set();
    (function walk(v) {
      if (typeof v === 'string') { if (v.startsWith('uploads/')) set.add(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    })(c);
    return set;
  }
  // remove as referências a um arquivo apagado
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

  // URL para mostrar um arquivo dentro do painel
  function assetUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    if (S.pending.has(p)) return S.pending.get(p).url;
    if (S.published.has(p)) return S.published.get(p);
    const m = mediaMap().get(p);
    if (m && m.download_url) return m.download_url;
    return '../' + p;
  }
  const kindOf = p => /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(p) ? 'image' : /\.(mp4|webm|mov|m4v|ogv)$/i.test(p) ? 'video' : 'file';

  /* ══════════ TOAST / CONFIRMAÇÃO ══════════ */
  let toastT;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-err', !!err);
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('is-on'), err ? 6500 : 3200);
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
  function friendly(e) {
    if (!e) return 'erro desconhecido';
    if (e.status === 401) return 'token inválido ou expirado — entre de novo com um token novo';
    if (e.status === 403) return 'sem permissão — o token precisa de “Contents: Read and write” nesse repositório';
    if (e.status === 404) return 'repositório ou branch não encontrado';
    if (e.status === 409) return 'o repositório está vazio — faça pelo menos um commit antes';
    if (e.status === 422) return e.message || 'dados recusados pelo GitHub';
    if (e instanceof TypeError) return 'sem conexão com a internet';
    return e.message || 'erro desconhecido';
  }

  /* ══════════ STATUS / RASCUNHO / PRÉ-VISUALIZAÇÃO ══════════ */
  const draftKey = () => 'lg-admin-draft:' + (S.local ? 'local' : `${S.gh.owner}/${S.gh.repo}`);
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
    else if (S.dirty || S.deleted.size) { st.classList.add('is-dirty'); t.textContent = S.local ? 'Não exportado' : 'Não publicado'; }
    else { if (S.local) st.classList.add('is-local'); t.textContent = S.local ? 'Modo local' : 'Tudo publicado'; }
    $('#publishBtn').textContent = S.local ? 'Baixar arquivos' : 'Publicar';
  }

  function previewData() {
    const files = {};
    S.published.forEach((v, k) => { files[k] = v; });
    S.pending.forEach((v, k) => { files[k] = v.url; });
    return { content: S.content, files };
  }
  window.LG_PREVIEW = null;
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

  /* ══════════ GITHUB ══════════ */
  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(S.gh.owner)}/${encodeURIComponent(S.gh.repo)}${path}`, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${S.gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!r.ok) {
      let m = '';
      try { m = (await r.json()).message; } catch (e) { /* sem corpo */ }
      const err = new Error(m || r.statusText);
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  const ref = () => encodeURIComponent(S.gh.branch);

  async function loadSiteContent() {
    try {
      const r = await fetch('../content.json', { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch (e) { /* sem arquivo */ }
    return {};
  }
  async function loadRemote() {
    try {
      const j = await gh(`/contents/content.json?ref=${ref()}`);
      if (j.content) return JSON.parse(td.decode(b64d(j.content.replace(/\s/g, ''))));
      // arquivo > 1 MB: baixa pelo blob
      const b = await gh(`/git/blobs/${j.sha}`);
      return JSON.parse(td.decode(b64d(b.content.replace(/\s/g, ''))));
    } catch (e) {
      if (e.status === 404) {
        toast('content.json ainda não existe no repositório — ele será criado ao publicar.');
        return loadSiteContent();
      }
      throw e;
    }
  }
  async function loadMedia() {
    if (S.local) { S.media = []; return; }
    try {
      const list = await gh(`/contents/uploads?ref=${ref()}`);
      S.media = (Array.isArray(list) ? list : []).filter(f => f.type === 'file')
        .map(f => ({ path: f.path, name: f.name, size: f.size, download_url: f.download_url, sha: f.sha }));
    } catch (e) {
      if (e.status !== 404) toast('Não consegui listar os arquivos: ' + friendly(e), true);
      S.media = [];
    }
  }

  /* ══════════ SENHA (token criptografado no navegador) ══════════ */
  const canCrypto = !!(window.crypto && crypto.subtle && window.isSecureContext);
  async function keyFrom(pass, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await keyFrom(pass, salt);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, te.encode(JSON.stringify(obj)));
    return { v: 1, salt: b64e(salt), iv: b64e(iv), data: b64e(data) };
  }
  async function unseal(box, pass) {
    const k = await keyFrom(pass, b64d(box.salt));
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(box.iv) }, k, b64d(box.data));
    return JSON.parse(td.decode(buf));
  }
  const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } };

  /* ══════════ LOGIN ══════════ */
  function showLogin() {
    const st = readStore();
    $('#cryptoNote').hidden = canCrypto;
    const hasBox = st && st.box && canCrypto;
    $('#unlockForm').hidden = !hasBox;
    $('#setupForm').hidden = !!hasBox;
    if (hasBox) {
      $('#unlockInfo').textContent = `${st.owner}/${st.repo} · branch ${st.branch}`;
      setTimeout(() => $('#unlockPass').focus(), 50);
    } else if (st) {
      $('#ghOwner').value = st.owner || '';
      $('#ghRepo').value = st.repo || '';
      $('#ghBranch').value = st.branch || 'main';
    }
    $('#newPass').closest('.field').hidden = !canCrypto;
    $('#newPass').required = canCrypto;
  }
  const loginErr = m => { $('#loginErr').textContent = m || ''; };

  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    loginErr('');
    const btn = $('button[type=submit]', e.target);
    const cfg = {
      owner: $('#ghOwner').value.trim().replace(/^https?:\/\/github\.com\//i, '').split('/')[0],
      repo: $('#ghRepo').value.trim().replace(/\.git$/, ''),
      branch: $('#ghBranch').value.trim() || 'main',
      token: $('#ghToken').value.trim(),
    };
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      S.gh = cfg;
      const repo = await gh('');
      if (repo.permissions && !repo.permissions.push) throw Object.assign(new Error('x'), { status: 403 });
      await gh(`/branches/${ref()}`).catch(err => { if (err.status === 404) throw new Error(`a branch “${cfg.branch}” não existe nesse repositório`); throw err; });
      const store = { owner: cfg.owner, repo: cfg.repo, branch: cfg.branch };
      if (canCrypto) store.box = await seal({ token: cfg.token }, $('#newPass').value);
      localStorage.setItem(STORE, JSON.stringify(store));
      $('#ghToken').value = ''; $('#newPass').value = '';
      startApp();
    } catch (err) {
      S.gh = null;
      loginErr('Não deu certo: ' + friendly(err));
    } finally {
      btn.disabled = false; btn.textContent = 'Conectar';
    }
  });

  $('#unlockForm').addEventListener('submit', async e => {
    e.preventDefault();
    loginErr('');
    const st = readStore();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const { token } = await unseal(st.box, $('#unlockPass').value);
      S.gh = { owner: st.owner, repo: st.repo, branch: st.branch, token };
      $('#unlockPass').value = '';
      startApp();
    } catch (err) {
      loginErr('Senha incorreta.');
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  $('#resetSetup').addEventListener('click', async () => {
    if (!await ask('Configurar de novo?', 'Você vai precisar colar um token do GitHub e criar uma senha nova.', { ok: 'Configurar' })) return;
    const st = readStore() || {};
    delete st.box;
    localStorage.setItem(STORE, JSON.stringify(st));
    loginErr('');
    showLogin();
  });

  $('#localMode').addEventListener('click', () => { S.local = true; startApp(); });

  $('#logoutBtn').addEventListener('click', async () => {
    if ((S.dirty || S.pending.size) && !await ask('Sair sem publicar?', 'As alterações de texto ficam salvas como rascunho neste navegador, mas os arquivos enviados e não publicados serão perdidos.', { ok: 'Sair', danger: true })) return;
    S.dirty = false; S.pending.clear();
    location.reload();
  });

  /* ══════════ INÍCIO DO PAINEL ══════════ */
  async function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#localBar').hidden = !S.local;
    $('#repoLabel').textContent = S.local ? 'Modo local (sem GitHub)' : `${S.gh.owner}/${S.gh.repo}`;
    setStatus('saving', 'Carregando…');
    try {
      S.content = ensureShape(S.local ? await loadSiteContent() : await loadRemote());
    } catch (e) {
      toast('Não consegui carregar o conteúdo do GitHub: ' + friendly(e), true);
      S.content = ensureShape(await loadSiteContent());
    }
    await maybeRestoreDraft();
    renderAll();
    restoreTab();
    loadMedia().then(() => { renderMedia(); renderProjects(); });
  }

  async function maybeRestoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey())); } catch (e) { /* sem rascunho */ }
    if (!d || !d.content) return;
    if (JSON.stringify(ensureShape(d.content)) === JSON.stringify(S.content)) { clearDraft(); return; }
    const when = new Date(d.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const ok = await ask('Recuperar rascunho?',
      `Existem alterações não publicadas de ${when}. Quer continuar de onde parou? (Arquivos enviados e não publicados precisam ser enviados de novo.)`,
      { ok: 'Recuperar', cancel: 'Descartar' });
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

  /* ══════════ UPLOAD DE ARQUIVOS ══════════ */
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

  async function addUpload(file, { keep = false } = {}) {
    let f = file;
    if (f.type.startsWith('image/')) f = await optimizeImage(f);
    if (f.size > 95 * 1048576) throw new Error(`“${file.name}” tem ${fmtSize(f.size)}. O limite é 95 MB — para vídeos grandes, suba no Vimeo/YouTube e cole o link.`);
    const d = new Date();
    const base = slug(file.name.replace(/\.[^.]+$/, '')) || 'arquivo';
    const path = `uploads/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${base}-${Math.random().toString(36).slice(2, 6)}.${extOf(f)}`;
    S.pending.set(path, { file: f, url: URL.createObjectURL(f), size: f.size, name: path.split('/').pop(), type: f.type, keep });
    if (f.size > 25 * 1048576) toast(`Arquivo grande (${fmtSize(f.size)}): a publicação pode demorar um pouco.`);
    return path;
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
        </div>${S.pending.has(p) ? '<span class="pending">será enviado ao publicar</span>' : ''}</div>`;
      $('input', box).addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const np = await addUpload(f);
          setP(obj, path, np);
          on(np);
          draw();
        } catch (err) { toast(err.message, true); }
      });
      $('[data-a="lib"]', box).addEventListener('click', async () => {
        const np = await pickMedia(video ? 'video' : 'image');
        if (np) { setP(obj, path, np); on(np); draw(); }
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
      for (const f of e.target.files) {
        try { listArr(obj, path).push(await addUpload(f)); } catch (err) { toast(err.message, true); }
      }
      e.target.value = '';
      draw(); on();
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
  function allMedia() {
    const list = S.media.filter(m => !S.deleted.has(m.path))
      .map(m => ({ path: m.path, name: m.name, size: m.size, url: m.download_url, pending: false }));
    S.pending.forEach((v, k) => list.unshift({ path: k, name: v.name, size: v.size, url: v.url, pending: true }));
    return list;
  }
  const prevHtml = m => {
    const k = kindOf(m.path);
    if (k === 'image') return `<img src="${esc(m.url)}" alt="" loading="lazy">`;
    if (k === 'video') return `<video src="${esc(m.url)}#t=0.5" muted preload="metadata"></video>`;
    return '📄';
  };
  function pickMedia(kind) {
    return new Promise(res => {
      const items = allMedia().filter(m => kindOf(m.path) === kind);
      const d = el('div', 'confirm', `<div class="confirm__box" style="width:min(100%,760px);max-height:86vh;display:flex;flex-direction:column">
        <div class="row" style="justify-content:space-between"><h3>Escolher da biblioteca</h3><button type="button" class="icon-btn" data-x aria-label="Fechar">✕</button></div>
        <div class="media" style="overflow:auto">${items.length ? items.map(m => `
          <button type="button" class="mi" data-p="${esc(m.path)}" style="padding:0;text-align:left;cursor:pointer">
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
      const pend = [p.file, p.thumb].some(x => x && S.pending.has(x));
      return `<div class="proj${p.hidden ? ' is-off' : ''}" data-i="${i}">
        <span class="proj__handle" title="Arraste para reordenar">⠿</span>
        <div class="proj__thumb">${t.img ? `<img src="${esc(t.img)}" alt="" loading="lazy">` : t.video ? `<video src="${esc(t.video)}#t=0.5" muted preload="metadata"></video>` : ''}<b>${pad(i + 1)}</b></div>
        <div class="proj__info" data-act="edit" style="cursor:pointer">
          <span class="proj__t">${esc(p.t || 'Sem título')}</span>
          <div class="proj__m">
            <span class="chip chip--accent">${esc(catLabel(p.cat))}</span><span class="chip">${src}</span>
            ${p.hidden ? '<span class="chip chip--warn">oculto</span>' : ''}${pend ? '<span class="chip chip--warn">arquivo a enviar</span>' : ''}
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
            accept: 'video', hint: 'MP4, até ~95 MB',
            on: async v => {
              if (!v) return;
              ['id', 'h', 'yt', 'th'].forEach(k => delete p[k]);
              const pend = S.pending.get(v);
              if (pend) {
                const info = await videoInfo(pend.url);
                if (info.d) p.d = info.d;
                p.ar = info.ar;
                if (!p.thumb && info.poster) {
                  p.thumb = await addUpload(new File([info.poster], 'capa.webp', { type: 'image/webp' }));
                  thumbField._redraw();
                }
              }
              setTimeout(drawSrc, 0);
            },
          }),
        );
      };
      drawSrc();
      const thumbField = fImage(p, 'thumb', 'Capa (thumbnail)', { on: noop, hint: 'opcional — sem capa, usa a do Vimeo/YouTube' });
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
        toast(isNew ? 'Projeto adicionado.' : 'Projeto atualizado.');
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
    if (f.type === 'video/quicktime') toast('Arquivos .mov podem não tocar em todos os navegadores — MP4 é mais seguro.');
    let path;
    try { path = await addUpload(f); } catch (err) { return toast(err.message, true); }
    toast('Lendo o vídeo…');
    const info = await videoInfo(S.pending.get(path).url);
    const p = {
      file: path, t: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(), c: '',
      y: new Date().getFullYear(), cat: (S.content.categories[0] || {}).key || '', d: info.d, ar: info.ar,
    };
    if (info.poster) p.thumb = await addUpload(new File([info.poster], `capa-${f.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }));
    editProject(p, true);
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
        on: v => { if (v) { C.showreel.id = ''; delete C.showreel.h; renderTexts(); } changed(); },
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
  function onColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const L = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    const lum = .2126 * L[0] + .7152 * L[1] + .0722 * L[2];
    return (lum + .05) / .0524 >= .91 / (lum + .05) ? '#08080A' : '#F2EFE9';
  }
  function lumOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const L = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * L[0] + .7152 * L[1] + .0722 * L[2];
  }
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
    reset.addEventListener('click', () => { Object.assign(T, PRESETS[0]); delete T.name; renderVisual(); changed(); });
    c.append(reset);
    P.append(c);

    updateSample();
  }

  /* ══════════ MÍDIA ══════════ */
  function renderMedia() {
    const grid = $('#mediaGrid');
    if (!grid || !S.content) return;
    const used = usedPaths(S.content);
    const items = allMedia();
    grid.innerHTML = items.length ? '' : '<div class="empty" style="grid-column:1/-1">Nenhum arquivo enviado ainda.</div>';
    items.forEach(m => {
      const it = el('div', 'mi' + (used.has(m.path) ? ' is-used' : ''), `
        <div class="mi__prev">${prevHtml(m)}</div>
        <div class="mi__info"><span class="mi__n" title="${esc(m.name)}">${esc(m.name)}</span>
          <span class="mi__s">${fmtSize(m.size || 0)}${m.pending ? ' · a enviar' : ''}</span></div>
        <div class="mi__actions">
          <a class="icon-btn" href="${esc(m.url)}" target="_blank" rel="noopener" title="Abrir">↗</a>
          <button type="button" class="icon-btn icon-btn--danger" title="Excluir">✕</button>
        </div>`);
      $('button', it).addEventListener('click', async () => {
        const inUse = used.has(m.path);
        const ok = await ask('Excluir arquivo?', inUse
          ? `“${m.name}” está sendo usado no site. Se excluir, os lugares que usam ficam sem essa imagem/vídeo.`
          : `“${m.name}” será apagado do site ao publicar.`, { ok: 'Excluir', danger: true });
        if (!ok) return;
        if (m.pending) { URL.revokeObjectURL(S.pending.get(m.path).url); S.pending.delete(m.path); }
        else S.deleted.add(m.path);
        removeRefs(S.content, m.path);
        renderAll();
        changed();
      });
      grid.append(it);
    });
    const total = items.reduce((s, m) => s + (m.size || 0), 0);
    $('#mediaInfo').textContent = items.length ? `${items.length} arquivo(s) · ${fmtSize(total)}${S.deleted.size ? ` · ${S.deleted.size} para apagar ao publicar` : ''}` : '';
  }
  dropzone($('#mediaDrop'), async files => {
    let n = 0;
    for (const f of files) {
      try { await addUpload(f, { keep: true }); n++; } catch (err) { toast(err.message, true); }
    }
    if (n) { renderMedia(); changed(); toast(`${n} arquivo(s) adicionado(s). Publique para enviar ao site.`); }
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
  const jsonOut = () => JSON.stringify(S.content, null, 2) + '\n';

  function exportLocal() {
    const used = usedPaths(S.content);
    const files = [...S.pending].filter(([p, v]) => used.has(p) || v.keep);
    download(new Blob([jsonOut()], { type: 'application/json' }), 'content.json');
    files.forEach(([p, v], i) => setTimeout(() => download(v.file, p.split('/').pop()), 400 * (i + 1)));
    S.dirty = false;
    clearDraft();
    setStatus();
    toast(`Baixado! Coloque o content.json na raiz do site${files.length ? ` e os ${files.length} arquivo(s) na pasta uploads/` : ''}.`);
  }

  async function publish() {
    if (S.local) return exportLocal();
    if (!S.dirty && !S.deleted.size && !S.pending.size) return toast('Nada para publicar.');
    const btn = $('#publishBtn');
    btn.disabled = true;
    setStatus('saving');
    try {
      const head = await gh(`/git/ref/heads/${ref()}`);
      const base = head.object.sha;
      const baseCommit = await gh(`/git/commits/${base}`);
      const used = usedPaths(S.content);
      const toSend = [...S.pending].filter(([p, v]) => used.has(p) || v.keep);
      const tree = [];
      let n = 0;
      for (const [path, v] of toSend) {
        n++;
        setStatus('saving', `Enviando ${n}/${toSend.length}…`);
        const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: await blobToB64(v.file), encoding: 'base64' }) });
        tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      S.deleted.forEach(path => tree.push({ path, mode: '100644', type: 'blob', sha: null }));
      tree.push({ path: 'content.json', mode: '100644', type: 'blob', content: jsonOut() });
      setStatus('saving', 'Salvando…');
      const t = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) });
      const msg = 'Atualiza o site pelo painel admin' + (toSend.length ? ` (+${toSend.length} arquivo${toSend.length > 1 ? 's' : ''})` : '');
      const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: t.sha, parents: [base] }) });
      await gh(`/git/refs/heads/${ref()}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

      toSend.forEach(([p, v]) => S.published.set(p, v.url));
      S.pending.forEach((v, p) => { if (!S.published.has(p)) URL.revokeObjectURL(v.url); });
      S.pending.clear();
      S.deleted.clear();
      S.dirty = false;
      clearDraft();
      await loadMedia();
      renderAll();
      toast('Publicado! O site atualiza em cerca de 1 minuto.');
    } catch (e) {
      toast('Erro ao publicar: ' + friendly(e), true);
    } finally {
      btn.disabled = false;
      setStatus();
    }
  }

  $('#publishBtn').addEventListener('click', publish);
  $('#previewBtn').addEventListener('click', openPreview);
  addEventListener('beforeunload', e => {
    if (S.dirty || S.pending.size || S.deleted.size) { e.preventDefault(); e.returnValue = ''; }
  });
  // Ctrl/Cmd + S publica
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.content) { e.preventDefault(); publish(); }
  });

  showLogin();
})();
