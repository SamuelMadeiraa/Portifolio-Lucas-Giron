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
/* ── vídeos (arquivo, Vimeo ou YouTube) e blocos da página do projeto ── */
const ytId = s => {
  const v = String(s || '').trim();
  const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : '';
};
const hasVideo = x => !!(x && (x.video || x.vimeo || ytId(x.youtube)));
const BLOCK_OK = {
  video:   hasVideo,
  compare: b => !!(b.before && b.after),
  gallery: b => (b.images || []).some(x => x && x.src),
  image:   b => !!b.src,
  text:    b => !!(String(b.title || '').trim() || String(b.body || '').trim()),
  model:   b => !!b.src,
  pdf:     b => !!b.src,
  link:    b => !!(b.url && b.label),
};
const blocksOf = p => (Array.isArray(p?.blocks) ? p.blocks : []).filter(b => b && BLOCK_OK[b.type] && BLOCK_OK[b.type](b));
const ytThumb = x => ytId(x?.youtube) ? `https://i.ytimg.com/vi/${ytId(x.youtube)}/hqdefault.jpg` : '';
// capa do card: a enviada, a do YouTube ou a primeira imagem dos blocos
const posterOf = p => {
  if (p.poster) return p.poster;
  if (ytThumb(p)) return ytThumb(p);
  for (const b of blocksOf(p)) {
    const src = b.type === 'image' ? b.src : b.type === 'gallery' ? b.images.find(x => x && x.src).src
      : b.type === 'compare' ? b.after : b.type === 'video' ? (b.poster || ytThumb(b)) : b.type === 'model' ? b.poster : '';
    if (src) return src;
  }
  return '';
};
const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';

/* ── ícones das redes, escolhidos pelo endereço do link ── */
const ICONS = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/>',
  vimeo: '<path d="M3 8.6c1.3-1.1 2.4-1.9 3.1-1.9 1.4 0 1.9 5.2 2.7 8 .6 2.2 1.3 3.3 2 3.3 1.3 0 4.4-4.1 6-8 .9-2.3.5-4.5-1.7-4.5-1 0-2 .4-2.7 1"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9.2 8.6c.2-.5.6-.5.9-.4l.8 1.8c.1.3 0 .5-.2.7l-.5.5c.5 1 1.3 1.8 2.3 2.3l.5-.5c.2-.2.4-.3.7-.2l1.8.8c.1.3.1.7-.4.9-.9.6-2 .5-3-.1a9 9 0 0 1-3.2-3.2c-.6-1-.7-2.1-.1-3z" fill="currentColor" stroke="none"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.4v.1M12 17v-3.8a2 2 0 0 1 4 0V17M12 10.5V17"/>',
  behance: '<path d="M3 7h4.5a2.5 2.5 0 0 1 0 5H3zM3 12h5a2.5 2.5 0 0 1 0 5H3z"/><path d="M14 13.5h7a3.5 3.5 0 1 0-1 2.6M15 7.5h4"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.3 4.3 5 4.5"/>',
  x: '<path d="M4 4l16 16M20 4L4 20"/>',
  facebook: '<path d="M14 21v-8h3l.5-3.5H14V7.8c0-1 .4-1.8 1.9-1.8h1.8V3.2A22 22 0 0 0 15 3c-2.6 0-4.3 1.6-4.3 4.4v2.1H8V13h2.7v8"/>',
  github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  dribbble: '<circle cx="12" cy="12" r="9"/><path d="M8.6 3.7c3 3.8 5.5 9.5 6.4 16.6M3.2 10.7c5 .3 10-1.2 14-5M6 18.5c3-4 7.8-5.6 14.6-4.6"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-1 6.5-.7 9 .8M8 12.5c2.5-.7 5.2-.4 7.3.8M8.6 15.3c1.9-.5 3.8-.3 5.4.6"/>',
  telegram: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/>',
  pinterest: '<circle cx="12" cy="12" r="9"/><path d="M11 8.5c2.5-.8 5 .5 5 3 0 2.3-1.6 3.8-3.4 3.3-.8-.2-1.2-.9-1.1-1.6M11.5 11l-2.5 9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const HOST = '\\/\\/([\\w-]+\\.)*';
const ICON_RULES = [
  ['instagram', 'instagram\\.com'], ['youtube', '(youtube\\.com|youtu\\.be)'], ['vimeo', 'vimeo\\.com'],
  ['whatsapp', '(wa\\.me|whatsapp\\.com)'], ['linkedin', 'linkedin\\.com'], ['behance', 'behance\\.net'],
  ['tiktok', 'tiktok\\.com'], ['x', '(twitter|x)\\.com'], ['facebook', '(facebook\\.com|fb\\.com)'],
  ['github', 'github\\.com'], ['dribbble', 'dribbble\\.com'], ['spotify', 'spotify\\.com'],
  ['telegram', '(t\\.me|telegram\\.(me|org))'], ['pinterest', 'pinterest\\.'],
].map(([k, re]) => [k, new RegExp(HOST + re, 'i')]).concat([['mail', /^mailto:/i], ['phone', /^tel:/i]]);
// logos das redes em versão sólida (os outros continuam em traço)
const SOLID = {
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-3.7a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z',
  youtube: 'M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.7 12 4.7 12 4.7s-5.9 0-7.6.5a2.8 2.8 0 0 0-2 2C2 8.9 2 12 2 12s0 3.1.4 4.8a2.8 2.8 0 0 0 2 2c1.7.5 7.6.5 7.6.5s5.9 0 7.6-.5a2.8 2.8 0 0 0 2-2c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.2V8.8l5.5 3.2z',
  whatsapp: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zM8.6 6.9c.3-.4.8-.4 1.1-.3l1.3 2.6c.1.3 0 .6-.2.8l-.7.8c.7 1.4 1.8 2.5 3.2 3.2l.8-.7c.2-.2.5-.3.8-.2l2.6 1.3c.1.3.1.8-.3 1.1-1.2 1-2.8.9-4.3.1a12 12 0 0 1-4.5-4.5c-.8-1.5-.9-3.1.2-4.2z',
  vimeo: 'M22 7.4c-.1 1.9-1.4 4.5-4 7.9-2.6 3.5-4.9 5.2-6.7 5.2-1.1 0-2.1-1-2.9-3.1L6.8 11.7C6.2 9.6 5.6 8.6 4.9 8.6c-.1 0-.6.3-1.4.9L2.6 8.4l2.6-2.3C6.4 5.1 7.3 4.6 7.9 4.5c1.4-.1 2.3.8 2.6 2.9.4 2.2.6 3.6.8 4.1.4 1.8.8 2.7 1.3 2.7.4 0 .9-.6 1.6-1.7.7-1.1 1.1-2 1.2-2.6.1-1-.3-1.5-1.2-1.5-.4 0-.9.1-1.3.3.9-2.8 2.5-4.2 5-4.1 1.8 0 2.7 1.2 2.6 3.5z',
  linkedin: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2.5 7v8h2.6v-8zm1.3-4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 10v8h2.5v-4c0-1 .2-2 1.5-2s1.4 1.1 1.4 2.1V18H19v-4.6c0-2-.5-3.6-2.9-3.6-1.3 0-2.2.6-2.6 1.3V10z',
  facebook: 'M12 2a10 10 0 0 0-1.6 19.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 12 2z',
  tiktok: 'M16.6 2h-3.2v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.1a6.1 6.1 0 1 0 5.3 6.1V8.6a7.7 7.7 0 0 0 4.4 1.4V6.8a4.5 4.5 0 0 1-4.4-4.8z',
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z',
};
const iconKey = url => (ICON_RULES.find(([, re]) => re.test(url)) || ['link'])[0];
const iconSvg = url => {
  const k = iconKey(url);
  return SOLID[k]
    ? `<svg class="ico ico--${k}" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${SOLID[k]}"/></svg>`
    : `<svg class="ico ico--${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
};
// aceita número de WhatsApp puro e e-mail sem "mailto:"
const socialUrl = u => {
  const s = String(u || '').trim();
  const digits = s.replace(/[\s()+.-]/g, '');
  if (/^\d{8,15}$/.test(digits)) return `https://wa.me/${digits}`;
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return 'mailto:' + s;
  if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('#') && !s.startsWith('/')) return 'https://' + s;
  return safeUrl(s);
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
  MEDIA.showreel = { title: reel.title, vimeo: reel.vimeo, youtube: reel.youtube, video: reel.video, poster: reel.poster, meta: '' };
  projects.forEach(p => MEDIA[p.id] = {
    title: p.title, vimeo: p.vimeo, youtube: p.youtube, video: p.video, poster: p.poster,
    meta: [p.year, p.duration ? time(p.duration) : ''].filter(Boolean).join(' · '),
  });
  const designs = (c.designs || []).filter(p => p && !p.hidden);
  designs.forEach(p => MEDIA['d:' + p.id] = { title: p.title, vimeo: p.vimeo, youtube: p.youtube, video: p.video, poster: p.poster, meta: p.year ? String(p.year) : '' });
  const hasReel = hasVideo(reel);
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
  renderFilters($('#filters'), projects, c.categories, c.works?.allLabel);
  renderGrid($('#grid'), projects, 'works');

  /* design & 3D */
  renderFilters($('#designFilters'), designs, c.designCategories, c.design?.allLabel);
  renderGrid($('#designGrid'), designs, 'design');
  $('[data-section="design"]').dataset.empty = designs.length ? '' : '1';

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
  const links = (ct.links || []).filter(l => l && l.url).map(l => ({ ...l, href: socialUrl(l.url) }));
  $('#contactLinks').innerHTML = links.map(l => `
    <a href="${esc(l.href)}" target="_blank" rel="noopener" class="clink clink--${iconKey(l.href)}" data-magnet>
      <span class="clink__t"><span class="clink__ico">${iconSvg(l.href)}</span>${esc(l.label)}</span><span class="clink__h mono">${esc(l.handle)}</span>
    </a>`).join('');
  $('#drawerFoot').innerHTML = links.map(l =>
    `<a href="${esc(l.href)}" target="_blank" rel="noopener">${iconSvg(l.href)}${esc(String(l.label || '').toUpperCase())}</a>`).join('');
  const foot = $('#footSocial');
  foot.innerHTML = links.map(l =>
    `<a class="soc soc--${iconKey(l.href)}" href="${esc(l.href)}" target="_blank" rel="noopener" aria-label="${esc(l.label)}" title="${esc(l.label)}">${iconSvg(l.href)}</a>`).join('');
  foot.hidden = !links.length || c.footer?.social === false;

  /* botão flutuante do WhatsApp — número próprio ou o primeiro WhatsApp dos links */
  const wa = c.whatsapp || {};
  const waDigits = String(wa.number || '').replace(/\D/g, '')
    || (links.find(l => iconKey(l.href) === 'whatsapp')?.href.match(/wa\.me\/(\d+)/) || [])[1] || '';
  const waBtn = $('#waFloat');
  waBtn.hidden = wa.enabled === false || !/^\d{8,15}$/.test(waDigits);
  waBtn.href = `https://wa.me/${waDigits}${wa.message ? '?text=' + encodeURIComponent(wa.message) : ''}`;
  waBtn.setAttribute('aria-label', wa.label || 'WhatsApp');
  $('#waFloatLabel').textContent = wa.label || '';
  $('#waFloatLabel').hidden = !wa.label;
  waBtn.classList.toggle('wa-float--left', wa.side === 'left');

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
      MEDIA[s.id] = { title: s.title, video: s.video, vimeo: s.vimeo, youtube: s.youtube, poster: s.poster, meta: s.subtitle || '' };
      const has = hasVideo(s);
      const poster = s.poster || ytThumb(s);
      el.innerHTML = head + `
        <div class="xvid" data-reveal>
          <button class="xvid__btn" type="button" ${has ? `data-play="${esc(s.id)}"` : 'disabled'} aria-label="Assistir ${esc(s.title)}">
            ${poster ? `<img src="${esc(safeUrl(poster))}" alt="" loading="lazy">` : ''}
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
const CASES = { works: [], design: [] };

function renderFilters(f, items, categories, allLabel){
  const counts = {};
  items.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  const cats = (categories || []).filter(k => counts[k.id]);
  f.innerHTML =
    `<button class="filter is-on mono" data-filter="all">${esc(allLabel || 'TODOS')} <sup>${items.length}</sup></button>` +
    cats.map(k => `<button class="filter mono" data-filter="${esc(k.id)}">${esc(k.label)} <sup>${counts[k.id]}</sup></button>`).join('');
  f.hidden = !cats.length;
}

// o que tem no projeto, para o selo do card: "3 FOTOS · 3D"
const extrasLabel = p => {
  const bl = blocksOf(p);
  const n = t => bl.filter(b => b.type === t).length;
  const imgs = bl.reduce((a, b) => a + (b.type === 'image' ? 1 : b.type === 'gallery' ? b.images.filter(x => x && x.src).length : 0), 0);
  return [
    n('video') ? `${n('video')} VÍDEO${n('video') > 1 ? 'S' : ''}` : '',
    imgs ? `${imgs} FOTO${imgs > 1 ? 'S' : ''}` : '',
    n('compare') ? 'ANTES/DEPOIS' : '',
    n('model') ? '3D' : '',
    n('pdf') ? 'PDF' : '',
  ].filter(Boolean).join(' · ');
};

function renderGrid(grid, items, kind){
  CASES[kind] = items;
  const key = p => (kind === 'design' ? 'd:' : '') + p.id;
  grid.innerHTML = items.map((p, i) => {
    const yt = ytId(p.youtube);
    const href = p.video || (p.vimeo ? `https://vimeo.com/${p.vimeo}` : yt ? `https://youtu.be/${yt}` : '#');
    const poster = posterOf(p);
    // com blocos → abre a página do projeto; só vídeo → abre o player
    const open = blocksOf(p).length ? `data-case="${kind}:${i}" data-cursor="VER"` : hasVideo(p) ? `data-play="${esc(key(p))}"` : '';
    const extras = extrasLabel(p);
    return `
    <div class="cardwrap" data-cat="${esc(p.category)}">
      <a class="card" href="${esc(safeUrl(href))}" target="_blank" rel="noopener"
         ${open} ${p.video ? `data-preview="${esc(safeUrl(p.video))}"` : ''}
         aria-label="${hasVideo(p) && !blocksOf(p).length ? 'Assistir' : 'Ver'} ${esc(p.title)}">
        <div class="card__media">
          ${poster ? `<img class="card__img" src="${esc(safeUrl(poster))}" alt="${esc(p.title)}" width="1280" height="720" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : ''}
          <span class="card__glitch"></span>
          <span class="card__scan"></span>
          ${p.tag ? `<span class="card__tag">${esc(p.tag)}</span>` : ''}
          ${p.duration ? `<span class="card__dur">${time(p.duration)}</span>` : extras ? `<span class="card__dur">${esc(extras)}</span>` : ''}
          ${p.duration && extras ? `<span class="card__extra mono">+ ${esc(extras)}</span>` : ''}
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
  const imgs = repeatTo(list.map(posterOf).filter(Boolean), 6);
  el.innerHTML = imgs.concat(imgs).map(src =>
    `<img src="${esc(safeUrl(src))}" alt="" loading="lazy" decoding="async">`).join('');
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

// player de vídeo: arquivo enviado > YouTube > Vimeo
function playerHtml(m, autoplay = true){
  const ap = autoplay ? 1 : 0;
  const yt = ytId(m.youtube);
  if (m.video) return `<video src="${esc(safeUrl(m.video))}" ${m.poster ? `poster="${esc(safeUrl(m.poster))}"` : ''} controls ${ap ? 'autoplay' : 'preload="metadata"'} playsinline></video>`;
  if (yt) return `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=${ap}&rel=0"
         allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(m.title || 'Vídeo')}"></iframe>`;
  return `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(m.vimeo)}?autoplay=${ap}&title=0&byline=0&portrait=0&dnt=1"
         allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(m.title || 'Vídeo')}"></iframe>`;
}

function openMedia(key){
  const m = MEDIA[key];
  if (!m || !(hasVideo(m) || m.image)) return false;
  lastFocus = document.activeElement;
  mTitle.textContent = m.title || '';
  mMeta.textContent = m.meta || '';
  mFrame.innerHTML = m.image
    ? `<img src="${esc(safeUrl(m.image))}" alt="${esc(m.title || '')}">`
    : playerHtml(m);
  modal.classList.add('is-open');
  document.documentElement.classList.add('is-locked');
  $('#modalClose').focus();
  return true;
}
function closeVideo(){
  if (!modal.classList.contains('is-open')) return false;
  modal.classList.remove('is-open');
  if (!caseEl.classList.contains('is-open')) document.documentElement.classList.remove('is-locked');
  mFrame.querySelector('video')?.pause();
  setTimeout(() => mFrame.innerHTML = '', 420);
  lastFocus?.focus();
  return true;
}

/* ─────────────────────────────────────────────
   9b. PÁGINA DO PROJETO (blocos um embaixo do outro)
   ───────────────────────────────────────────── */
const caseEl = $('#case'), caseInner = $('#caseInner');
let caseFocus = null, caseTimer = null, mvLoading = null;
const loadModelViewer = () => (mvLoading ||= import(MODEL_VIEWER).catch(err => { mvLoading = null; throw err; }));

const caseH = (title, hint) => `<h3 class="case__h mono">${esc(title)}${hint ? ` <span>${esc(hint)}</span>` : ''}</h3>`;

function blockHtml(b, k, p, prev){
  const ext = u => /^https?:/i.test(u || '') ? ' target="_blank" rel="noopener"' : '';
  switch (b.type) {
    case 'video':
      return `<section class="case__block">${b.title ? caseH(b.title) : ''}
        <div class="case__player">${playerHtml({ ...b, title: b.title || p.title }, false)}</div></section>`;
    case 'compare':
      return `<section class="case__block">${prev !== 'compare' ? caseH('ANTES E DEPOIS', '· arraste a barra') : ''}
        <figure class="cmp">
          <img class="cmp__base" src="${esc(safeUrl(b.before))}" alt="Antes" loading="lazy" draggable="false">
          <div class="cmp__top"><img src="${esc(safeUrl(b.after))}" alt="Depois" loading="lazy" draggable="false"></div>
          <span class="cmp__tag cmp__tag--l mono">ANTES</span><span class="cmp__tag cmp__tag--r mono">DEPOIS</span>
          <span class="cmp__bar" aria-hidden="true"><i>⇆</i></span>
          <input class="cmp__range" type="range" min="0" max="100" step="0.1" value="50" aria-label="Comparar antes e depois">
        </figure>
        ${b.caption ? `<p class="case__cap mono">${esc(b.caption)}</p>` : ''}</section>`;
    case 'gallery': {
      const imgs = b.images.filter(x => x && x.src);
      return `<section class="case__block">${caseH(b.title || 'GALERIA', '· ' + String(imgs.length).padStart(2, '0'))}
        <div class="case__gal" style="--cols:${clamp(+b.columns || 3, 1, 5)}">
          ${imgs.map((x, j) => {
            const mk = `case:${k}:${j}`;
            MEDIA[mk] = { title: x.caption || b.title || p.title, image: x.src, meta: `${j + 1} / ${imgs.length}` };
            return `<figure class="case__gi"><button class="xgal__btn" type="button" data-play="${mk}" data-cursor="VER" aria-label="Ampliar imagem">
              <img src="${esc(safeUrl(x.src))}" alt="${esc(x.caption || '')}" loading="lazy"></button>
              ${x.caption ? `<figcaption class="mono muted">${esc(x.caption)}</figcaption>` : ''}</figure>`;
          }).join('')}
        </div></section>`;
    }
    case 'image': {
      const mk = `case:${k}`;
      MEDIA[mk] = { title: b.caption || p.title, image: b.src };
      return `<figure class="case__block case__fig"><button class="xgal__btn" type="button" data-play="${mk}" data-cursor="VER" aria-label="Ampliar imagem">
        <img src="${esc(safeUrl(b.src))}" alt="${esc(b.caption || '')}" loading="lazy"></button>
        ${b.caption ? `<figcaption class="case__cap mono">${esc(b.caption)}</figcaption>` : ''}</figure>`;
    }
    case 'text': {
      const paras = String(b.body || '').split(/\n\s*\n/).filter(x => x.trim());
      return `<section class="case__block case__text">${b.title ? `<h3 class="case__tt">${esc(b.title)}</h3>` : ''}
        ${paras.map(x => `<p>${rich(x.trim())}</p>`).join('')}</section>`;
    }
    case 'model':
      return `<section class="case__block">${caseH(b.title || 'MODELO 3D', '· arraste para girar')}
        <div class="case__model">
          <model-viewer src="${esc(safeUrl(b.src))}" ${b.poster ? `poster="${esc(safeUrl(b.poster))}"` : ''} alt="${esc(b.title || p.title)}"
            camera-controls auto-rotate touch-action="pan-y" shadow-intensity="1" interaction-prompt="auto" ar></model-viewer>
          <span class="case__loading mono">CARREGANDO 3D…</span>
        </div></section>`;
    case 'pdf':
      return `<div class="case__block case__btns"><a class="btn btn--ghost" href="${esc(safeUrl(b.src))}" target="_blank" rel="noopener" data-magnet>
        <span>${esc(b.label || 'VER PDF')} ↗</span></a></div>`;
    case 'link':
      return `<div class="case__block case__btns"><a class="btn btn--flare" href="${esc(socialUrl(b.url))}"${ext(socialUrl(b.url))} data-magnet>
        <span>${esc(b.label)} ↗</span></a></div>`;
    default: return '';
  }
}

function openCase(kind, i){
  const p = (CASES[kind] || [])[i];
  if (!p) return;
  clearTimeout(caseTimer);
  closeDrawer();
  caseFocus = document.activeElement;
  const cats = kind === 'design' ? C.designCategories : C.categories;
  const cat = (cats || []).find(x => x.id === p.category)?.label;
  const kicker = [cat, p.tag, p.year].filter(Boolean).map(esc).join(' · ');
  let prev = '';
  const blocks = blocksOf(p).map((b, k) => { const html = blockHtml(b, k, p, prev); prev = b.type; return html; }).join('');

  caseInner.innerHTML = `
    <header class="case__head">
      ${kicker ? `<p class="case__kicker mono">${kicker}</p>` : ''}
      <h2 class="case__title">${esc(p.title)}</h2>
      ${p.description ? `<p class="case__desc">${rich(p.description)}</p>` : ''}
    </header>
    ${hasVideo(p) ? `<div class="case__player">${playerHtml(p, false)}</div>` : ''}
    ${blocks}`;
  caseEl.scrollTop = 0;
  caseEl.classList.add('is-open');
  document.documentElement.classList.add('is-locked');
  $('#caseClose').focus({ preventScroll: true });

  const models = $$('model-viewer', caseInner);
  if (models.length) {
    models.forEach(mv => {
      const loading = mv.parentElement.querySelector('.case__loading');
      mv.addEventListener('load', () => loading.classList.add('is-done'), { once: true });
      mv.addEventListener('error', () => { loading.textContent = 'NÃO FOI POSSÍVEL CARREGAR O 3D'; }, { once: true });
    });
    loadModelViewer().catch(() => models.forEach(mv => { mv.parentElement.querySelector('.case__loading').textContent = 'NÃO FOI POSSÍVEL CARREGAR O VISUALIZADOR 3D'; }));
  }
}
function closeCase(){
  if (!caseEl.classList.contains('is-open')) return false;
  caseEl.classList.remove('is-open');
  document.documentElement.classList.remove('is-locked');
  caseTimer = setTimeout(() => caseInner.innerHTML = '', 450); // para os vídeos
  caseFocus?.focus({ preventScroll: true });
  return true;
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
      const play = e.target.closest('[data-play],[data-case],.card');
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

  /* filtro (trabalhos e design têm filtros próprios) */
  [[$('#filters'), $('#grid')], [$('#designFilters'), $('#designGrid')]].forEach(([filters, grid]) => filters.addEventListener('click', e => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    $$('.filter', filters).forEach(b => b.classList.toggle('is-on', b === btn));
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
  }));

  /* lightbox e página do projeto */
  document.addEventListener('click', e => {
    const cs = e.target.closest('[data-case]');
    if (cs && !e.metaKey && !e.ctrlKey && e.button === 0) {
      e.preventDefault();
      const [kind, i] = cs.dataset.case.split(':');
      openCase(kind, +i);
      return;
    }
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
  $('#caseClose').addEventListener('click', closeCase);
  // barra do antes e depois
  caseInner.addEventListener('input', e => {
    const r = e.target.closest('.cmp__range');
    if (r) r.parentElement.style.setProperty('--pos', r.value + '%');
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (closeVideo()) return;      // primeiro fecha a imagem/vídeo ampliado
    if (closeCase()) return;       // depois a página do projeto
    closeDrawer();
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
