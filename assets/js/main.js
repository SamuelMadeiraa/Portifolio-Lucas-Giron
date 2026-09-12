/* ═══════════════════════════════════════════════
   LUCAS GIRON — main.js
   O conteúdo vem de /api/content (editado em /admin).
   Sem API (ou abrindo o arquivo direto), usa o padrão
   de assets/js/content.js.
   ═══════════════════════════════════════════════ */
(() => {
'use strict';

/* ─────────────────────────────────────────────
   1. HELPERS
   ───────────────────────────────────────────── */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp  = (a, b, n) => a + (b - a) * n;
const time  = s => {
  s = Math.max(0, Math.round(+s || 0));
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
};
const esc   = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// **negrito** e *itálico* nos textos editáveis
const rich  = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\n/g, '<br>');
const pick  = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
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
// bloqueia javascript: e afins em links vindos do conteúdo
const safeUrl = u => {
  const s = String(u || '').trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^(https?|mailto|tel):/i.test(s) ? '#' : s;
};
const repeatTo = (list, min) => {
  if (!list.length) return [];
  let out = list.slice();
  while (out.length < min) out = out.concat(list);
  return out;
};
const hexRgb = hex => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255].join(',');
};

/* ─────────────────────────────────────────────
   2. CONTEÚDO
   ───────────────────────────────────────────── */
const DEFAULT = window.SITE_DEFAULT || {};
const migrate = window.SITE_MIGRATE || (x => x);
const PREVIEW = new URLSearchParams(location.search).has('preview');
let C = DEFAULT;
const MEDIA = {};

async function loadContent(){
  // pré-visualização: rascunho que o painel deixou no navegador
  if (PREVIEW) {
    try {
      const d = JSON.parse(localStorage.getItem('giron:preview') || 'null');
      if (d) return merge(DEFAULT, migrate(d));
    } catch {}
  }
  if (location.protocol.startsWith('http')) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch('/api/content', { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return merge(DEFAULT, migrate(await r.json()));
    } catch {}
  }
  return DEFAULT;
}

/* ─────────────────────────────────────────────
   3. PRELOADER
   ───────────────────────────────────────────── */
const loader = $('#loader');
let contentDone = false, finished = false;

function finish(){
  if (finished) return;
  finished = true;
  document.body.classList.add('is-ready');
  loader.classList.add('is-out');
  $$('.loader__bars i').forEach((b, i) => b.style.animationDelay = `${i * .05}s`);
  setTimeout(() => loader.classList.add('is-done'), RM ? 60 : 1500);
  startHeroLoops();
}

(function preload(){
  const bars = $('.loader__bars');
  for (let i = 0; i < 8; i++) bars.appendChild(document.createElement('i'));
  const countEl = $('#loaderCount'), barEl = $('#loaderBar');
  let n = 0;
  if (RM) return;
  const tick = () => {
    if (finished) return;
    // segura em 90% até o conteúdo chegar
    n = contentDone ? n + Math.random() * 16 + 8 : Math.min(n + Math.random() * 9 + 3, 90);
    if (n >= 100) n = 100;
    countEl.textContent = String(Math.floor(n)).padStart(3, '0');
    barEl.style.width = n + '%';
    if (n < 100) setTimeout(tick, 35 + Math.random() * 55);
    else setTimeout(finish, 220);
  };
  setTimeout(tick, 200);
})();

loadContent().then(c => {
  C = c;
  applyContent();
  initInteractions();
  contentDone = true;
  if (RM || C.effects?.loader === false) {
    $('#loaderCount').textContent = '100';
    loader.classList.add('is-done');
    finish();
  }
});

/* ─────────────────────────────────────────────
   4. REVEAL NO SCROLL (usado pelos renders)
   ───────────────────────────────────────────── */
const io = new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const delay = parseFloat(el.dataset.delay || 0);
    setTimeout(() => {
      el.classList.add('is-in');
      if (el.hasAttribute('data-scramble-in')) scramble(el, 700);
    }, delay * 1000);
    obs.unobserve(el);
  });
}, { threshold:.16, rootMargin:'0px 0px -8% 0px' });
const watch = el => io.observe(el);

/* ─────────────────────────────────────────────
   5. APLICA O CONTEÚDO NA PÁGINA
   ───────────────────────────────────────────── */
function applyTheme(t){
  const root = document.documentElement.style;
  const map = { ink:'--ink', ink2:'--ink-2', ink3:'--ink-3', paper:'--paper', hi:'--hi',
                flare:'--flare', flareSoft:'--flare-s', onFlare:'--on-flare', live:'--live' };
  for (const [k, v] of Object.entries(map)) if (hexRgb(t[k])) root.setProperty(v, t[k]);
  for (const k of ['ink', 'paper', 'flare']) {
    const rgb = hexRgb(t[k]);
    if (rgb) root.setProperty(`--${k}-rgb`, rgb);
  }
  const tc = $('meta[name="theme-color"]');
  if (tc && hexRgb(t.ink)) tc.content = t.ink;

  // favicon com a marca e as cores atuais
  const mark = esc(C.brand?.mark || '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${t.ink}'/><text y='73' x='50' text-anchor='middle' font-family='sans-serif' font-weight='900' font-size='${mark.length > 2 ? 44 : 62}' fill='${t.flare}'>${mark}</text></svg>`;
  const ico = $('link[rel="icon"]');
  if (ico && hexRgb(t.ink) && hexRgb(t.flare)) ico.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const setMeta = (sel, v) => { const m = $(sel); if (m && v) m.setAttribute('content', v); };

function applyContent(){
  const c = C;
  applyTheme(c.theme || {});

  const fx = c.effects || {};
  document.body.classList.toggle('no-grain', fx.grain === false);
  document.body.classList.toggle('no-scan', fx.scanlines === false);
  document.body.classList.toggle('no-vignette', fx.vignette === false);

  applyFonts(c.typography || {});

  if (c.seo) {
    if (c.seo.title) document.title = c.seo.title;
    setMeta('meta[name="description"]', c.seo.description);
    setMeta('meta[property="og:title"]', c.seo.title);
    setMeta('meta[property="og:description"]', c.seo.description);
    setMeta('meta[property="og:image"]', c.seo.ogImage);
  }

  // textos simples e textos com formatação
  $$('[data-k]').forEach(el => { const v = pick(c, el.dataset.k); if (v != null) el.textContent = v; });
  $$('[data-rich]').forEach(el => el.innerHTML = rich(pick(c, el.dataset.rich) || ''));

  const projects = (c.projects || []).filter(p => !p.hidden);
  const N = projects.length;

  // tudo que pode ser tocado no lightbox
  const reel = c.showreel || {};
  MEDIA.showreel = { title: reel.title, vimeo: reel.vimeo, video: reel.video, poster: reel.poster, meta: '' };
  projects.forEach(p => MEDIA[p.id] = {
    title: p.title, vimeo: p.vimeo, video: p.video, poster: p.poster,
    meta: [p.year, p.duration ? time(p.duration) : ''].filter(Boolean).join(' · '),
  });
  const hasReel = !!(reel.video || reel.vimeo);
  $$('[data-play="showreel"]').forEach(b => b.hidden = !hasReel);

  /* hero */
  const h = c.hero || {};
  $('#heroEyebrow').innerHTML = '<span class="dot"></span>' +
    (h.eyebrow || []).filter(Boolean).map(s => `<span>${esc(s)}</span>`).join('<span class="sep">/</span>');
  const rot = (h.rotator || []).filter(Boolean);
  $('#rotator').innerHTML = rot.map(s => `<span>${esc(s)}</span>`).join('');
  $('.hero__rotator').hidden = !rot.length;
  $('#ctaSecondary').textContent = String(h.ctaSecondary || '').replace('{n}', N);
  $('#ctaSecondary').parentElement.hidden = !h.ctaSecondary;
  $('#heroStatus').hidden = h.showStatus === false;

  /* ticker */
  const tk = (c.ticker || []).filter(Boolean);
  const tkHtml = repeatTo(tk, 10).map(s => `<span>${esc(s)}</span><i>◆</i>`).join('');
  $('#ticker').innerHTML = tkHtml + tkHtml;
  $('[data-section="ticker"]').dataset.empty = tk.length ? '' : '1';

  /* trabalhos */
  renderFilters(projects);
  renderGrid(projects);
  fillReel($('#reelRowA'), projects.slice(0, Math.ceil(N / 2)));
  fillReel($('#reelRowB'), projects.slice(Math.ceil(N / 2)).concat(N === 1 ? projects : []));

  /* sobre */
  renderAbout(c.about || {}, N);

  /* clientes */
  const cl = (c.clients?.items || []).filter(Boolean);
  const clHtml = repeatTo(cl, 10).map(s => `<span>${esc(s)}</span>`).join('');
  $('#clientTrack').innerHTML = clHtml + clHtml;
  $('[data-section="clients"]').dataset.empty = cl.length ? '' : '1';

  /* contato */
  const ct = c.contact || {};
  const mail = $('#contactMail');
  mail.textContent = ct.email || '';
  mail.href = ct.email ? `mailto:${ct.email}` : '#';
  mail.parentElement.hidden = !ct.email;
  const links = (ct.links || []).filter(l => l && l.url);
  $('#contactLinks').innerHTML = links.map(l => `
    <a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" class="clink" data-magnet>
      <span class="clink__t">${esc(l.label)}</span><span class="clink__h mono">${esc(l.handle)}</span>
    </a>`).join('');
  $('#drawerFoot').innerHTML = links.map(l =>
    `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(String(l.label || '').toUpperCase())}</a>`).join('');

  /* ordem das seções + seções criadas no painel */
  const main = $('main');
  $$('[data-ssr]').forEach(el => el.remove());   // tira o que veio pronto do servidor
  const builtin = {};
  $$('[data-section]').forEach(el => builtin[el.dataset.section] = el);
  const used = new Set();
  const visible = new Set(['inicio']);
  (c.layout || []).forEach(s => {
    if (!s || !s.type) return;
    let el = builtin[s.type];
    if (el) { if (used.has(s.type)) return; used.add(s.type); }
    else el = renderSection(s);
    if (!el) return;
    el.hidden = !!s.hidden || el.dataset.empty === '1';
    main.appendChild(el);
    if (!el.hidden && el.id) visible.add(el.id);
  });
  Object.entries(builtin).forEach(([k, el]) => { if (!used.has(k)) el.hidden = true; });

  /* menu (links para seções ocultas somem) */
  const navItems = (c.nav?.items || []).filter(i => {
    if (!i || !i.label) return false;
    const t = String(i.target || '');
    return !t.startsWith('#') || visible.has(t.slice(1));
  });
  const ext = t => /^https?:/i.test(t || '') ? ' target="_blank" rel="noopener"' : '';
  $('#navMenu').innerHTML = navItems.map(i =>
    `<a href="${esc(safeUrl(i.target))}" class="nav__link mono" data-scramble${ext(i.target)}>${esc(i.label)}</a>`).join('');
  $('#drawerLinks').innerHTML = navItems.map(i =>
    `<a href="${esc(safeUrl(i.target))}" class="drawer__link"${ext(i.target)}>${esc(i.label)}</a>`).join('');

  /* split de letras (depois dos textos no lugar) */
  $$('[data-split]').forEach(el => {
    const chars = [...el.textContent.trim()];
    el.textContent = '';
    chars.forEach((ch, i) => {
      const outer = document.createElement('span');
      outer.className = 'ch';
      const inner = document.createElement('span');
      inner.textContent = ch === ' ' ? ' ' : ch;
      inner.style.setProperty('--d', `${.35 + i * .045}s`);
      outer.appendChild(inner);
      el.appendChild(outer);
    });
  });

  if (PREVIEW) {
    const b = document.createElement('div');
    b.className = 'preview-badge mono';
    b.textContent = 'PRÉ-VISUALIZAÇÃO — AINDA NÃO PUBLICADO';
    document.body.appendChild(b);
    // o painel atualiza o rascunho → recarrega sozinho
    addEventListener('storage', e => { if (e.key === 'giron:preview') location.reload(); });
  }
}

/* ─────────────────────────────────────────────
   5b. FONTES E SEÇÕES CRIADAS NO PAINEL
   ───────────────────────────────────────────── */
const slug = window.SITE_SLUG || (s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));

function applyFonts(ty){
  const F = window.SITE_FONTS || { display: {}, mono: {} };
  const root = document.documentElement.style;
  const specs = [];
  if (F.display[ty.display]) {
    root.setProperty('--f-disp', `'${ty.display}', 'Helvetica Neue', Arial, sans-serif`);
    if (ty.display !== 'Archivo') specs.push(F.display[ty.display]);
  }
  if (F.mono[ty.mono]) {
    root.setProperty('--f-mono', `'${ty.mono}', ui-monospace, 'SF Mono', Menlo, monospace`);
    if (ty.mono !== 'IBM Plex Mono') specs.push(F.mono[ty.mono]);
  }
  if (specs.length) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + specs.map(s => 'family=' + s).join('&') + '&display=swap';
    document.head.appendChild(l);
  }
}

const secHead = s => (s.title || s.num) ? `
  <div class="sec-head">
    <div class="sec-head__l">
      ${s.num ? `<span class="sec-num mono">${esc(s.num)}</span>` : ''}
      <h2 class="sec-title" data-scramble-in>${esc(s.title)}</h2>
    </div>
    ${s.subtitle ? `<div class="sec-head__r"><p class="mono muted">${esc(s.subtitle)}</p></div>` : ''}
  </div>` : '';

function renderSection(s){
  const el = document.createElement('section');
  el.id = slug(s.anchor) || s.id;
  el.className = `xsec xsec--${s.type}`;
  const head = secHead(s);

  switch (s.type) {
    case 'text': {
      const paras = String(s.body || '').split(/\n\s*\n/).filter(p => p.trim());
      el.innerHTML = head + `
        <div class="xtext${s.image ? ' has-img' : ''}${s.imageSide === 'left' ? ' is-left' : ''}">
          <div class="xtext__body" data-reveal>${paras.map(p => `<p>${rich(p.trim())}</p>`).join('')}</div>
          ${s.image ? `<figure class="xtext__img" data-reveal><img src="${esc(safeUrl(s.image))}" alt="" loading="lazy"></figure>` : ''}
        </div>`;
      break;
    }
    case 'gallery': {
      const imgs = (s.images || []).filter(x => x && x.src);
      imgs.forEach((x, k) => MEDIA[`${s.id}:${k}`] = { title: x.caption || s.title, image: x.src, meta: `${k + 1} / ${imgs.length}` });
      el.innerHTML = head + `
        <div class="xgal" style="--cols:${clamp(+s.columns || 3, 1, 5)}">
          ${imgs.map((x, k) => `
            <figure class="xgal__item" data-reveal>
              <button class="xgal__btn" type="button" data-play="${esc(s.id)}:${k}" data-cursor="VER" aria-label="Ampliar imagem">
                <img src="${esc(safeUrl(x.src))}" alt="${esc(x.caption || '')}" loading="lazy">
              </button>
              ${x.caption ? `<figcaption class="mono muted">${esc(x.caption)}</figcaption>` : ''}
            </figure>`).join('')}
        </div>`;
      break;
    }
    case 'video': {
      MEDIA[s.id] = { title: s.title, video: s.video, vimeo: s.vimeo, poster: s.poster, meta: s.subtitle || '' };
      const has = !!(s.video || s.vimeo);
      el.innerHTML = head + `
        <div class="xvid" data-reveal>
          <button class="xvid__btn" type="button" ${has ? `data-play="${esc(s.id)}"` : 'disabled'} aria-label="Assistir ${esc(s.title)}">
            ${s.poster ? `<img src="${esc(safeUrl(s.poster))}" alt="" loading="lazy">` : ''}
            <span class="xvid__play mono">▶ PLAY</span>
          </button>
        </div>`;
      break;
    }
    case 'cards':
      el.innerHTML = head + `
        <div class="xcards">
          ${(s.items || []).filter(x => x && (x.title || x.text)).map((x, k) => `
            <article class="xcard" data-reveal>
              <span class="xcard__n mono">${String(k + 1).padStart(2, '0')}</span>
              <h3 class="xcard__t">${esc(x.title)}</h3>
              ${x.text ? `<p class="xcard__d">${rich(x.text)}</p>` : ''}
            </article>`).join('')}
        </div>`;
      break;
    case 'cta':
      el.innerHTML = `
        <div class="xcta" data-reveal>
          ${s.kicker ? `<p class="mono xcta__k">${esc(s.kicker)}</p>` : ''}
          <h2 class="xcta__t">${esc(s.title)}</h2>
          ${s.text ? `<p class="xcta__p">${rich(s.text)}</p>` : ''}
          ${s.button && s.url ? `<a class="btn btn--flare" href="${esc(safeUrl(s.url))}"${/^https?:/i.test(s.url) ? ' target="_blank" rel="noopener"' : ''} data-magnet><span>${esc(s.button)}</span></a>` : ''}
        </div>`;
      break;
    case 'band': {
      const it = (s.items || []).filter(Boolean);
      if (!it.length) return null;
      const html = repeatTo(it, 10).map(t => `<span>${esc(t)}</span><i>◆</i>`).join('');
      const band = document.createElement('div');
      band.className = 'ticker xsec--band';
      band.setAttribute('aria-hidden', 'true');
      band.innerHTML = `<div class="ticker__track">${html}${html}</div>`;
      return band;
    }
    default:
      return null;
  }
  return el;
}

/* ─────────────────────────────────────────────
   6. GRID DE TRABALHOS
   ───────────────────────────────────────────── */
const grid = $('#grid');

function renderFilters(projects){
  const counts = {};
  projects.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  const cats = (C.categories || []).filter(k => counts[k.id]);
  const f = $('#filters');
  f.innerHTML =
    `<button class="filter is-on mono" data-filter="all">${esc(C.works?.allLabel || 'TODOS')} <sup>${projects.length}</sup></button>` +
    cats.map(k => `<button class="filter mono" data-filter="${esc(k.id)}">${esc(k.label)} <sup>${counts[k.id]}</sup></button>`).join('');
  f.hidden = !cats.length;
}

function renderGrid(projects){
  grid.innerHTML = projects.map((p, i) => {
    const href = p.video || (p.vimeo ? `https://vimeo.com/${p.vimeo}` : '#');
    return `
    <div class="cardwrap" data-cat="${esc(p.category)}">
      <a class="card" href="${esc(safeUrl(href))}" target="_blank" rel="noopener"
         data-play="${esc(p.id)}" ${p.video ? `data-preview="${esc(safeUrl(p.video))}"` : ''}
         aria-label="Assistir ${esc(p.title)}">
        <div class="card__media">
          ${p.poster ? `<img class="card__img" src="${esc(safeUrl(p.poster))}" alt="${esc(p.title)}" width="1280" height="720" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : ''}
          <span class="card__glitch"></span>
          <span class="card__scan"></span>
          ${p.tag ? `<span class="card__tag">${esc(p.tag)}</span>` : ''}
          ${p.duration ? `<span class="card__dur">${time(p.duration)}</span>` : ''}
          <span class="card__bar"></span>
        </div>
        <div class="card__meta">
          <h3 class="card__t">${esc(p.title)}</h3>
          <span class="card__y">${esc(p.year)}</span>
        </div>
        ${p.description ? `<p class="card__d">${esc(p.description)}</p>` : ''}
      </a>
    </div>`;
  }).join('');

  $$('.card', grid).forEach((c, i) => {
    c.style.transitionDelay = `${(i % 3) * .09}s`;
    watch(c);
  });

  // capa que falhar → fundo neutro
  $$('.card__img', grid).forEach(img => {
    img.addEventListener('error', () => {
      img.style.opacity = '.25';
      img.closest('.card__media').style.background = 'linear-gradient(135deg,var(--ink-3),var(--ink))';
    }, { once:true });
  });

  // vídeo próprio: prévia muda no hover (só desktop)
  if (FINE && !RM) {
    $$('.card[data-preview]', grid).forEach(card => {
      let v;
      card.addEventListener('mouseenter', () => {
        if (!v) {
          v = document.createElement('video');
          v.className = 'card__vid';
          v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
          v.src = card.dataset.preview;
          card.querySelector('.card__media').insertBefore(v, card.querySelector('.card__glitch'));
        }
        v.play().then(() => v.classList.add('is-on')).catch(() => {});
      });
      card.addEventListener('mouseleave', () => { if (v) { v.pause(); v.classList.remove('is-on'); } });
    });
  }
}

function fillReel(el, list){
  const imgs = repeatTo(list.filter(p => p.poster), 6);
  el.innerHTML = imgs.concat(imgs).map(p =>
    `<img src="${esc(safeUrl(p.poster))}" alt="" loading="lazy" decoding="async">`).join('');
}

/* ─────────────────────────────────────────────
   7. SOBRE
   ───────────────────────────────────────────── */
function renderAbout(a, N){
  $('#aboutText').innerHTML =
    (a.lead ? `<p class="about__big" data-reveal>${rich(a.lead)}</p>` : '') +
    (a.paragraphs || []).filter(Boolean).map(t => `<p data-reveal>${rich(t)}</p>`).join('') +
    (a.signature ? `<div class="about__sign" data-reveal aria-hidden="true">${esc(a.signature)}</div>` : '');

  const stats = (a.stats || []).filter(s => s && (s.value !== '' || s.label));
  $('#stats').innerHTML = stats.map(s => {
    const raw = String(s.value ?? '').replace('{n}', N).trim();
    const num = /^\d+$/.test(raw);
    return `<div class="stat" data-reveal>
      ${num
        ? `<span class="stat__n" data-count="${raw}" data-suffix="${esc(s.suffix || '')}">0</span>`
        : `<span class="stat__n">${esc(raw + (s.suffix || ''))}</span>`}
      <span class="stat__l mono">${esc(s.label)}</span>
    </div>`;
  }).join('');
  $('#stats').hidden = !stats.length;

  $('#aboutLists').innerHTML = (a.lists || []).filter(l => l && (l.title || l.items?.length)).map(l => `
    <div class="kit" data-reveal>
      <h3 class="kit__t mono">${esc(l.title)}</h3>
      <ul class="kit__list">
        ${(l.items || []).filter(i => i && (i.name || i.detail)).map(i =>
          `<li><span>${esc(i.name)}</span><b>${esc(i.detail)}</b></li>`).join('')}
      </ul>
    </div>`).join('');
}

/* ─────────────────────────────────────────────
   8. SCRAMBLE DE TEXTO
   ───────────────────────────────────────────── */
const GLYPHS = '█▓▒░/\\<>*#$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function scramble(el, dur = 620) {
  if (RM) return;
  const final = el.dataset.txt || (el.dataset.txt = el.textContent);
  const chars = [...final];
  const start = performance.now();
  const step = now => {
    const p = clamp((now - start) / dur, 0, 1);
    const locked = Math.floor(p * chars.length);
    el.textContent = chars.map((c, i) =>
      (i < locked || c === ' ' || c === '\n') ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]
    ).join('');
    if (p < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  requestAnimationFrame(step);
}

/* ─────────────────────────────────────────────
   9. MODAL DE VÍDEO
   ───────────────────────────────────────────── */
const modal = $('#modal'), mFrame = $('#modalFrame'), mTitle = $('#modalTitle'), mMeta = $('#modalMeta');
let lastFocus = null;

function openMedia(key){
  const m = MEDIA[key];
  if (!m || !(m.video || m.vimeo || m.image)) return false;
  lastFocus = document.activeElement;
  mTitle.textContent = m.title || '';
  mMeta.textContent = m.meta || '';
  mFrame.innerHTML = m.image
    ? `<img src="${esc(safeUrl(m.image))}" alt="${esc(m.title || '')}">`
    : m.video
    ? `<video src="${esc(safeUrl(m.video))}" ${m.poster ? `poster="${esc(safeUrl(m.poster))}"` : ''} controls autoplay playsinline></video>`
    : `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(m.vimeo)}?autoplay=1&title=0&byline=0&portrait=0&dnt=1"
         allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(m.title || 'Vídeo')}"></iframe>`;
  modal.classList.add('is-open');
  document.documentElement.classList.add('is-locked');
  $('#modalClose').focus();
  return true;
}
function closeVideo(){
  if (!modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  document.documentElement.classList.remove('is-locked');
  mFrame.querySelector('video')?.pause();
  setTimeout(() => mFrame.innerHTML = '', 420);
  lastFocus?.focus();
}

/* ─────────────────────────────────────────────
   10. ROTATOR DE PALAVRAS
   ───────────────────────────────────────────── */
function startHeroLoops(){
  const rot = $('#rotator');
  if (!rot || RM) return;
  const items = $$('span', rot);
  if (items.length < 2) return;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % items.length;
    items.forEach(s => s.style.transform = `translateY(-${i * 100}%)`);
  }, 2200);
}

/* ─────────────────────────────────────────────
   11. INTERAÇÕES (depois do conteúdo no lugar)
   ───────────────────────────────────────────── */
function initInteractions(){
  const fx = C.effects || {};

  /* cursor customizado */
  if (FINE && !RM && fx.cursor !== false) {
    const cur = $('#cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__text');
    document.body.classList.add('has-cursor');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive:true });
    (function loop(){
      rx = lerp(rx, mx, .16); ry = lerp(ry, my, .16);
      dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', e => {
      const play = e.target.closest('[data-play],.card');
      const link = e.target.closest('a,button,.filter');
      cur.classList.toggle('is-play', !!play);
      cur.classList.toggle('is-link', !!link && !play);
      if (play) label.textContent = play.dataset.cursor || 'PLAY';
    });
    addEventListener('mouseout', e => { if (!e.relatedTarget) cur.style.opacity = '0'; });
    addEventListener('mouseover', () => cur.style.opacity = '1');
  }

  /* botões magnéticos */
  if (FINE && !RM) {
    $$('[data-magnet]').forEach(el => {
      let raf, tx = 0, ty = 0, cx = 0, cy = 0, active = false;
      const run = () => {
        cx = lerp(cx, tx, .18); cy = lerp(cy, ty, .18);
        el.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px)`;
        if (active || Math.abs(cx - tx) > .1 || Math.abs(cy - ty) > .1) raf = requestAnimationFrame(run);
        else el.style.transform = '';
      };
      el.addEventListener('mouseenter', () => { active = true; cancelAnimationFrame(raf); run(); });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        tx = clamp((e.clientX - (r.left + r.width / 2)) * .32, -22, 22);
        ty = clamp((e.clientY - (r.top + r.height / 2)) * .42, -14, 14);
      });
      el.addEventListener('mouseleave', () => { active = false; tx = 0; ty = 0; });
    });
  }

  /* scramble e reveal */
  $$('[data-scramble]').forEach(el => el.addEventListener('mouseenter', () => scramble(el, 420)));
  $$('[data-reveal],[data-scramble-in]').forEach(watch);

  /* filtro */
  $('#filters').addEventListener('click', e => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    $$('.filter').forEach(b => b.classList.toggle('is-on', b === btn));
    const f = btn.dataset.filter;
    let shown = 0;
    $$('.cardwrap', grid).forEach(w => {
      const ok = f === 'all' || w.dataset.cat === f;
      w.style.display = ok ? '' : 'none';
      const card = w.querySelector('.card');
      if (ok) {
        card.classList.remove('is-in');
        card.style.transitionDelay = `${(shown % 3) * .07}s`;
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));
        shown++;
      }
    });
  });

  /* lightbox */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-play]');
    // ctrl/cmd/meio = deixa abrir o link em nova aba
    if (t && !e.metaKey && !e.ctrlKey && e.button === 0) {
      e.preventDefault();
      openMedia(t.dataset.play);
      return;
    }
    if (e.target === modal) closeVideo();
  });
  $('#modalClose').addEventListener('click', closeVideo);
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeVideo(); closeDrawer(); }
  });

  /* contadores */
  const cio = new IntersectionObserver((es, obs) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count, suf = el.dataset.suffix || '';
      if (RM) { el.textContent = target + suf; obs.unobserve(el); return; }
      const t0 = performance.now(), dur = 1400;
      const run = now => {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + (p === 1 ? suf : '');
        if (p < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      obs.unobserve(el);
    });
  }, { threshold:.6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* relógio + ano */
  const opts = { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
  let fmt;
  try { fmt = new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone: C.hero?.timezone || 'America/Sao_Paulo' }); }
  catch { fmt = new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone: 'America/Sao_Paulo' }); }
  const clock = $('#clock');
  const tickClock = () => clock.textContent = fmt.format(new Date());
  tickClock(); setInterval(tickClock, 1000);
  $('#year').textContent = new Date().getFullYear();

  /* menu mobile */
  burger.addEventListener('click', () => {
    const open = !drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', open);
    burger.classList.toggle('is-on', open);
    burger.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('is-locked', open);
  });
  $$('.drawer__link').forEach(a => a.addEventListener('click', closeDrawer));

  /* scroll: progresso, nav, parallax */
  const nav = $('#nav'), bar = $('#progressBar');
  const rowA = $('#reelRowA'), rowB = $('#reelRowB'), glow = $('#heroGlow');
  let lastY = 0, ticking = false, gx = innerWidth / 2, gy = innerHeight / 2, cgx = gx, cgy = gy;

  if (FINE && !RM) addEventListener('mousemove', e => { gx = e.clientX; gy = e.clientY; }, { passive:true });

  function frame(){
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `${clamp(y / (max || 1), 0, 1) * 100}%`;
    nav.classList.toggle('is-stuck', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 400 && !modal.classList.contains('is-open'));
    lastY = y;
    if (!RM && FINE) {
      cgx = lerp(cgx, gx, .06); cgy = lerp(cgy, gy, .06);
      glow.style.transform = `translate3d(${cgx}px,${cgy + y * .3}px,0) translate(-50%,-50%)`;
    }
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive:true });
  if (FINE && !RM) (function glowLoop(){ frame(); requestAnimationFrame(glowLoop); })();
  else frame();

  /* deriva contínua das esteiras de thumbs */
  if (!RM) {
    let drift = 0;
    const spanA = () => rowA.scrollWidth / 2 || 2400;
    const spanB = () => rowB.scrollWidth / 2 || 2400;
    (function driftLoop(){
      if (scrollY < innerHeight * 1.3) {
        drift += .3;
        const a = drift % spanA();
        const b = drift % spanB();
        rowA.style.transform = `translate3d(${-a - scrollY * .18}px,0,0)`;
        rowB.style.transform = `translate3d(${b - spanB() + scrollY * .18}px,0,0)`;
      }
      requestAnimationFrame(driftLoop);
    })();
  }
}

/* ─────────────────────────────────────────────
   12. MENU MOBILE
   ───────────────────────────────────────────── */
const burger = $('#burger'), drawer = $('#drawer');
function closeDrawer(){
  drawer.classList.remove('is-open');
  burger.classList.remove('is-on');
  burger.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('is-locked');
}

})();
