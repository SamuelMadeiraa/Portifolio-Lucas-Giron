/* ═══════════════════════════════════════════════════════════
   LUCAS GIRON — Creative Motion Director
   O conteúdo (textos, projetos, imagens, cores) vem de /content.json,
   que é editado pelo painel em /admin.
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // *itálico* e **negrito** nos textos editáveis
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  body.classList.add('is-loading');

  const THUMBS_LOCAL = true; // tenta assets/thumbs/{id}.jpg primeiro (projetos do Vimeo)
  const CDN = 'https://i.vimeocdn.com/video/';
  let VCOLOR = 'FF3B00'; // cor do player do Vimeo (acompanha a cor de destaque)

  // arquivos ainda não publicados (pré-visualização do painel): caminho → blob URL
  let FILES = {};
  const asset = p => (!p ? '' : (FILES[p] || p));

  /* ══ CONTEÚDO PADRÃO — usado só se o content.json não carregar
        (ex.: abrindo o index.html direto do disco). ══ */
  const DEFAULTS = {
    site: { name: 'Lucas Giron', role: 'Creative Motion Director', city: 'Florianópolis — BR', footer: 'Florianópolis · Santa Catarina · Brasil', description: '' },
    theme: { accent: '#FF3B00', bg: '#08080A', fg: '#F2EFE9', grain: true },
    show: { loader: true, cursor: true, ticker: true, about: true, clients: true, onair: true },
    labels: {
      navWorks: 'Trabalhos', navAbout: 'Sobre', navContact: 'Contato', specialty: 'Especialidade',
      works: 'Trabalhos\nSelecionados', all: 'Todos', about: 'Sobre', tools: 'Ferramentas',
      services: 'Serviços', clients: 'No ar para', showreel: 'Ver showreel',
    },
    showreel: { id: '535644122', title: 'Showreel 2024' },
    hero: {
      specialties: ['Aberturas de TV', 'Vinhetas', 'Motion 2D', 'Pacote gráfico', 'Explainers'],
      lede: 'Dez anos desenhando movimento para telas grandes e pequenas. Do *opening* da NBA no Amazon Prime Video às vinhetas do NBA Brasil — construo identidades que **entram no ar** e ficam na memória.',
      available: true,
      availableText: 'Disponível para projetos',
    },
    ticker: ['Motion design', 'Broadcast', 'Vinhetas', 'Aberturas', 'Animação 2D', 'Direção', 'Explainer', 'Pós-produção'],
    categories: [
      { key: 'broadcast', label: 'Broadcast' },
      { key: 'motion', label: 'Motion' },
      { key: 'filme', label: 'Filme' },
    ],
    about: {
      big: 'Sou **Lucas Giron**, motion director em Florianópolis. Trabalho na fronteira entre design gráfico e cinema: pego uma marca, um conceito ou um jogo de basquete e transformo em *movimento*.',
      paragraphs: [
        'Comecei em produtora, passei por direção e finalização de programas de TV e hoje concentro o trabalho em pacotes gráficos completos — abertura, GCs, transições, encerramento — para emissoras, agências e marcas.',
        'Já assinei aberturas para a **NBA no Amazon Prime Video** (com a Madruga Films), vinhetas para o **NBA Brasil**, a identidade do programa **Em Pauta** da Assembleia Legislativa de SC e animações 2D para a **Rede Jesuíta de Educação**.',
      ],
      photo: '',
      stats: [
        { n: 10, suffix: '+', label: 'Anos de estrada' },
        { n: 20, suffix: '', label: 'Projetos publicados', auto: true },
        { n: 3, suffix: '', label: 'Emissoras / streamings' },
      ],
      tools: [
        { name: 'After Effects', desc: 'Motion / Composição' },
        { name: 'Cinema 4D', desc: '3D / Render' },
        { name: 'Premiere Pro', desc: 'Edição' },
        { name: 'DaVinci Resolve', desc: 'Cor / Finalização' },
        { name: 'Illustrator · Photoshop', desc: 'Design' },
      ],
      services: ['Pacote gráfico de TV', 'Abertura & vinheta', 'Animação de logo', 'Vídeo explainer', 'Direção & finalização'],
    },
    sections: [],
    clients: ['NBA Brasil', 'Amazon Prime Video', 'ALESC', 'Rede Jesuíta', 'Madruga Filmes', 'Colégio Catarinense', 'CORE-SC', 'ABDEH', 'Selfit', 'Academia Prime', 'Escola Internacional'],
    contact: { kicker: 'Tem um projeto para colocar no ar?', title1: 'Vamos', title2: 'Animar', email: 'email@exemplo.com', instagram: 'lucasgiron.aep', vimeo: 'gironlucas', links: [] },
    projects: [
      { id: '764150238', t: 'NBA — Abertura Prime Video', c: 'Amazon Prime Video · Madruga Filmes', y: 2022, cat: 'broadcast', d: 18,  th: '1534707789-d89780118a4d3cc4f4ca03a62a11be48e8384c8039b769b61acd1f98c9781a46-d' },
      { id: '584999486', t: 'Dicionário NBA',             c: 'NBA Brasil',                          y: 2021, cat: 'broadcast', d: 34,  th: '1210644360-dc42defb0f364117bc455e18aaa46ae198844edfa4e652b5bd6e1396d5557fd1-d' },
      { id: '567049229', t: 'Em Pauta',                   c: 'ALESC — Assembleia Legislativa de SC', y: 2021, cat: 'broadcast', d: 30,  th: '1172401434-1e7f1e4670f151d0f60b0601d5458c9504a42cd03abbb15d755c66a235ca8395-d' },
      { id: '468518303', t: 'Rede Jesuíta',               c: 'Rede Jesuíta de Educação',            y: 2020, cat: 'motion',    d: 131, th: '975699225-779077f049adf07f2eff6ef0d62ef33d16ce69fdd8b8aeb78f46b191cbc4e565-d' },
      { id: '581918148', t: 'Vinheta Viralizou',          c: 'NBA Brasil',                          y: 2021, cat: 'broadcast', d: 5,   th: '1204410129-14e0f9fcac4c9bc6ebc5385143eeac59db8a9bdb4d0356a5f1f78dae0c4f5d61-d' },
      { id: '847440801', t: 'Acessa Agro — Explainers',   c: 'Madruga Filmes',                      y: 2023, cat: 'motion',    d: 119, th: '1700687211-af5e3986f4216b458697c3f563b3672d45a809e36d6b5866628e2dd735ce5137-d' },
      { id: '855040781', t: 'Olimpíadas Catarinense 2023', c: 'Colégio Catarinense',                y: 2023, cat: 'filme',     d: 124, th: '1711235661-6455c7181d0d9f7552c6b432d90dbeb17d000fb979156ff9c09b28c234e92f36-d' },
      { id: '952132088', t: 'ETH Passeio Sapiens',        c: 'ETH',                                 y: 2024, cat: 'filme',     d: 135, th: '1861644775-04eb1d4d3fef2fd8cf77280709d5a4d5d81c60079238ebed83caf7efe90d3836-d', ar: 1.7792 },
      { id: '639502539', t: 'Core SC',                    c: 'CORE-SC',                             y: 2021, cat: 'broadcast', d: 162, th: '1286045457-5555b062f49ae4217c7f85006b6783e7fc4064507cf36b21b' },
      { id: '924797684', t: 'Selfit Trindade',            c: 'Selfit · Inauguração',                y: 2024, cat: 'filme',     d: 77,  th: '1817916658-a060cc8f1295725f8d2244b5d0f7a6450c72efebb9f1a728e1f9772da199c50d-d' },
      { id: '412315243', t: 'Vinheta ABDEH',              c: 'ABDEH · Cinema 4D + After Effects',   y: 2020, cat: 'motion',    d: 15,  th: '884666238-7082671c5fdf6b7d421972b3b973a391c293f6ee86b0ac631fc07c1fba26ed17-d' },
      { id: '924449405', t: 'Aline Manfro',               c: 'Odontopediatria',                     y: 2024, cat: 'filme',     d: 92,  th: '1817362554-5f474714baf62b12f24ee067679cd0f8f9042926a2270f794d3407d23caa46f8-d' },
      { id: '535655695', t: 'Todas as Formas de Amor — Ep. 3', c: 'Websérie · Hospital Baía Sul',  y: 2021, cat: 'filme',     d: 201, th: '1108956811-3911b0ef12c7d900ed0245d9f114a939f4bbbef14ab0555930efce57c22c4300-d', ar: 2.3529 },
      { id: '567038935', t: 'Engenharia do Corpo',        c: 'Animação',                            y: 2021, cat: 'motion',    d: 60,  th: '1172381737-a4f4bb77f75d612d5654cb6e8577d293889ec6a137cc065fd302068afefec99a-d' },
      { id: '492201849', t: 'VT Escola Internacional',    c: 'Edição & finalização',                y: 2020, cat: 'broadcast', d: 30,  th: '1070776198-2f6f55ae9689f807e74c240f1190b4317f2f36344683e0aaa17ad9c238d79de0-d' },
      { id: '458179585', t: 'Institucional Prime',        c: 'Academia Prime',                      y: 2020, cat: 'filme',     d: 60,  th: '957895899-43c0797df887675431efca6447f0f7e77b9524bd5797781eb3cc971f6a827a3d-d' },
      { id: '458174695', t: 'Prime — Short Film',         c: 'Academia Prime',                      y: 2020, cat: 'filme',     d: 35,  th: '957864437-f3276eb22aa90548c08f7854c82d95e3dbd9c3db4acfca43ba3b3caa5c2c7c20-d' },
      { id: '446616864', t: 'Opuntia',                    c: 'Autoral · Canon T2i',                 y: 2020, cat: 'filme',     d: 108, th: '938269739-94e565ef6619d2ac4768a4b97190004c1339da83a323eca1281e36880f927898-d' },
      { id: '417766810', t: 'SC Odonto',                  c: 'Série de 3 animações',                y: 2020, cat: 'motion',    d: 30,  th: '892106372-237089c72e0c7a5bea83f96f49e391c2fcf41de18fad2b2b6fa17241a2333aee-d', ar: 1 },
      { id: '404624564', t: 'Estudo Figueirense',         c: 'Estudo 3D',                           y: 2020, cat: 'motion',    d: 8,   th: '874543488-59ab9f0e502f019f428197c34e2ba0e60abdd734f9b17edfa59ac5e00eafd512-d' },
    ],
  };

  // junta o content.json por cima do padrão (campo faltando → usa o padrão)
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') {
      const out = { ...base };
      if (over && typeof over === 'object' && !Array.isArray(over)) {
        for (const k in over) out[k] = k in base ? merge(base[k], over[k]) : over[k];
      }
      return out;
    }
    return over === undefined || over === null ? base : over;
  }

  // ?preview → rascunho vindo do painel (ainda não publicado)
  function fromAdmin() {
    const wins = [window.opener, window.parent !== window ? window.parent : null];
    for (const w of wins) {
      try { if (w && w.LG_PREVIEW && w.LG_PREVIEW.content) return w.LG_PREVIEW; } catch (e) { /* outra origem */ }
    }
    try {
      const c = JSON.parse(localStorage.getItem('lg-preview'));
      if (c) return { content: c, files: {} };
    } catch (e) { /* sem rascunho */ }
    return null;
  }

  async function loadContent() {
    if (new URLSearchParams(location.search).has('preview')) {
      const src = fromAdmin();
      if (src) {
        FILES = { ...(src.files || {}) };
        body.classList.add('is-preview');
        return merge(DEFAULTS, JSON.parse(JSON.stringify(src.content)));
      }
    }
    try {
      const r = await fetch('content.json', { cache: 'no-cache' });
      if (r.ok) return merge(DEFAULTS, await r.json());
    } catch (e) { /* offline / arquivo local */ }
    return DEFAULTS;
  }

  loadContent().then(init);

  /* ══════════ TEMA ══════════ */
  const okHex = h => /^#[0-9a-f]{6}$/i.test(h || '');
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // escolhe texto escuro ou claro por cima de uma cor (o que tiver mais contraste)
  function onColor(r, g, b) {
    const L = [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    const lum = .2126 * L[0] + .7152 * L[1] + .0722 * L[2];
    return (lum + .05) / .0524 >= .91 / (lum + .05) ? '#08080A' : '#F2EFE9';
  }
  function applyTheme(t) {
    const root = document.documentElement.style;
    const hex = okHex(t.accent) ? t.accent.toUpperCase() : '#FF3B00';
    const [r, g, b] = rgbOf(hex);
    root.setProperty('--accent', hex);
    root.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    root.setProperty('--on-accent', onColor(r, g, b));
    VCOLOR = hex.slice(1);

    // fundo e texto (só mexe se forem diferentes do padrão)
    const bg = okHex(t.bg) ? t.bg.toUpperCase() : '#08080A';
    const fg = okHex(t.fg) ? t.fg.toUpperCase() : '#F2EFE9';
    if (bg !== '#08080A' || fg !== '#F2EFE9') {
      const [br, bgg, bb] = rgbOf(bg);
      const [fr, fgg, fb] = rgbOf(fg);
      root.setProperty('--bg', bg);
      root.setProperty('--bg-rgb', `${br}, ${bgg}, ${bb}`);
      root.setProperty('--bg2', `color-mix(in srgb, ${bg} 93%, ${fg})`);
      root.setProperty('--fg', fg);
      root.setProperty('--fg2', `color-mix(in srgb, ${fg} 76%, ${bg})`);
      root.setProperty('--mute', `color-mix(in srgb, ${fg} 52%, ${bg})`);
      root.setProperty('--line', `rgba(${fr}, ${fgg}, ${fb}, .12)`);
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = bg;
    }
    body.classList.toggle('no-grain', t.grain === false);
    return hex;
  }

  /* ══════════ SEÇÕES EXTRAS ══════════ */
  function renderSections(C, startNum) {
    const host = $('#customSections');
    const secs = (C.sections || []).filter(s => s && !s.hidden && (s.title || s.text || (s.images && s.images.length)));
    if (!host) return { n: startNum, list: [] };
    const used = new Set(['inicio', 'trabalhos', 'sobre', 'contato']);
    let n = startNum;
    const list = secs.map(s => {
      let id = slug(s.title) || 'secao';
      let k = 2;
      while (used.has(id)) id = `${slug(s.title) || 'secao'}-${k++}`;
      used.add(id);
      return { s, id, num: n++ };
    });
    host.innerHTML = list.map(({ s, id, num }) => {
      const layout = ['texto-imagem', 'imagem-texto', 'texto', 'galeria'].includes(s.layout) ? s.layout : 'texto-imagem';
      const paras = String(s.text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
        .map(p => `<p data-reveal>${rich(p).replace(/\n/g, '<br>')}</p>`).join('');
      const imgs = (s.images || []).map(asset).filter(Boolean);
      const ext = /^https?:/i.test(s.cta && s.cta.url || '');
      const cta = s.cta && s.cta.label && s.cta.url
        ? `<div data-reveal><a class="btn btn--ghost xsec__cta" href="${esc(s.cta.url)}"${ext ? ' target="_blank" rel="noopener"' : ''} data-magnet><span>${esc(s.cta.label)}</span></a></div>`
        : '';
      let media = '';
      if (layout === 'galeria' && imgs.length) {
        media = `<div class="xsec__gallery">${imgs.map(u => `<figure data-reveal><img src="${esc(u)}" alt="" loading="lazy"></figure>`).join('')}</div>`;
      } else if (layout !== 'texto' && layout !== 'galeria' && imgs[0]) {
        media = `<figure class="xsec__media" data-reveal><img src="${esc(imgs[0])}" alt="" loading="lazy"></figure>`;
      }
      const side = layout === 'galeria' ? '' : media;
      return `<section class="xsec xsec--${layout}${side ? '' : ' xsec--nomedia'}" id="${id}">
        <div class="sec-head">
          <div class="sec-head__l"><span class="sec-num mono">${pad(num)}</span><h2 class="sec-title" data-scramble-in>${esc(s.title || '')}</h2></div>
          ${s.kicker ? `<div class="sec-head__r"><p class="mono muted">${esc(s.kicker)}</p></div>` : ''}
        </div>
        <div class="xsec__body"><div class="xsec__text">${paras}${cta}</div>${side}</div>
        ${layout === 'galeria' ? media : ''}
      </section>`;
    }).join('');

    // links no menu
    const navC = $('.nav__menu a[href="#contato"]');
    const drC = $('.drawer a[href="#contato"]');
    list.filter(x => x.s.nav).forEach(({ s, id }) => {
      const label = esc(s.navLabel || s.title);
      navC && navC.insertAdjacentHTML('beforebegin', `<a href="#${id}" class="nav__link mono" data-scramble>${label}</a>`);
      drC && drC.insertAdjacentHTML('beforebegin', `<a href="#${id}" class="drawer__link">${label}</a>`);
    });
    return { n, list };
  }

  /* ══════════ TEXTOS / LISTAS DO content.json ══════════ */
  function applyContent(C, P, accent) {
    const S = C.site;
    const L = C.labels;
    const show = C.show || {};
    const words = String(S.name || '').trim().split(/\s+/).filter(Boolean);
    const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || 'LG').slice(0, 2)).toUpperCase();

    document.title = `${S.name} — ${S.role}`;
    const md = $('meta[name="description"]');
    if (md && S.description) md.content = S.description;
    $('.nav__mark').textContent = initials;
    $('.nav__logotext').textContent = S.name;
    const icon = $('link[rel="icon"]');
    if (icon) icon.href = 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#08080A"/><text y="73" x="50" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="62" fill="${accent}">${esc(initials)}</text></svg>`);

    const heroLines = $$('.hero__title .line');
    heroLines[0].textContent = words[0] || '';
    heroLines[1].textContent = words.slice(1).join(' ');
    heroLines[1].hidden = words.length < 2;

    $$('[data-c]').forEach(el => { const v = get(C, el.dataset.c); if (v != null && v !== '') el.textContent = v; });
    $$('[data-c-rich]').forEach(el => { const v = get(C, el.dataset.cRich); if (v != null) el.innerHTML = rich(v); });

    // seções ligadas/desligadas
    $$('[data-show]').forEach(el => { el.hidden = show[el.dataset.show] === false; });
    if (show.about === false) $$('a[href="#sobre"]').forEach(a => { a.hidden = true; });

    const rot = $('#rotator');
    if (rot && C.hero.specialties.length) rot.innerHTML = C.hero.specialties.map(s => `<span>${esc(s)}</span>`).join('');
    $('.live').classList.toggle('is-off', !C.hero.available);

    const sr = C.showreel || {};
    $$('[data-showreel]').forEach(b => {
      b.hidden = !sr.id && !sr.file;
      b.dataset.video = sr.id || '';
      b.dataset.h = sr.h || '';
      b.dataset.file = sr.id ? '' : asset(sr.file);
      b.dataset.title = sr.title || 'Showreel';
    });

    $('#projCount').textContent = `${P.length} PROJETOS`;
    const years = P.map(p => +p.y).filter(Boolean);
    $('#archiveLine').textContent = years.length
      ? `Arquivo ${Math.min(...years)} — ${Math.max(...years)}. Clique para assistir.`
      : 'Clique para assistir.';

    // filtros = categorias
    const filters = $('#filters');
    filters.innerHTML = `<button class="filter is-on mono" data-filter="all">${esc(L.all || 'Todos')} <sup></sup></button>` +
      C.categories.filter(c => c && c.key).map(c => `<button class="filter mono" data-filter="${esc(c.key)}">${esc(c.label || c.key)} <sup></sup></button>`).join('');

    const ticker = $('#ticker');
    if (C.ticker.length) ticker.innerHTML = C.ticker.map(w => `<span>${esc(w)}</span><i>◆</i>`).join('');

    $('#aboutParas').innerHTML = C.about.paragraphs.map(p => `<p data-reveal>${rich(p)}</p>`).join('');
    const photo = $('#aboutPhoto');
    if (photo) {
      const src = asset(C.about.photo);
      photo.hidden = !src;
      if (src) { const img = $('img', photo); img.src = src; img.alt = S.name; }
    }
    $('#stats').innerHTML = C.about.stats.map(s => {
      const n = s.auto ? P.length : (parseInt(s.n, 10) || 0);
      return `<div class="stat" data-reveal>
          <span class="stat__n" data-count="${n}" data-suffix="${esc(s.suffix || '')}">0</span>
          <span class="stat__l mono">${esc(s.label)}</span>
        </div>`;
    }).join('');
    $('#stats').hidden = !C.about.stats.length;
    $('#toolsList').innerHTML = C.about.tools.map(t => `<li><span>${esc(t.name)}</span><b>${esc(t.desc)}</b></li>`).join('');
    $('#toolsList').closest('.kit').hidden = !C.about.tools.length;
    $('#servicesList').innerHTML = C.about.services.map((s, i) => `<li><span>${esc(s)}</span><b>${pad(i + 1)}</b></li>`).join('');
    $('#servicesList').closest('.kit').hidden = !C.about.services.length;

    // numeração das seções: 01 trabalhos, 02 sobre, extras…, contato por último
    let n = 1;
    $('#worksNum').textContent = pad(n++);
    if (show.about !== false) $('#aboutNum').textContent = pad(n++);
    n = renderSections(C, n).n;
    $('#contactNum').textContent = pad(n);
    $('#onairCh').textContent = `CH ${pad(n)} · ${String(L.navContact || 'Contato').toUpperCase()}`;

    const mail = $('.contact__mail');
    mail.href = 'mailto:' + C.contact.email;
    mail.textContent = C.contact.email;
    mail.hidden = !C.contact.email;

    const handle = s => String(s || '').trim().replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/^@/, '').replace(/\/+$/, '');
    const ig = handle(C.contact.instagram), vm = handle(C.contact.vimeo);
    $$('[data-link="instagram"]').forEach(a => { a.href = `https://www.instagram.com/${ig}/`; a.hidden = !ig; });
    $$('[data-link="vimeo"]').forEach(a => { a.href = `https://vimeo.com/${vm}`; a.hidden = !vm; });
    $$('[data-handle="instagram"]').forEach(el => { el.textContent = `@${ig} ↗`; });
    $$('[data-handle="vimeo"]').forEach(el => { el.textContent = `/${vm} ↗`; });

    const links = $('#contactLinks');
    (C.contact.links || []).filter(l => l && l.label && l.url).forEach(l => {
      let url = String(l.url).trim();
      if (!/^(https?:|mailto:|tel:)/i.test(url)) url = 'https://' + url;
      links.insertAdjacentHTML('beforeend',
        `<a href="${esc(url)}" target="_blank" rel="noopener" class="clink" data-magnet><span class="clink__t">${esc(l.label)}</span><span class="clink__h mono">${esc(l.handle || '↗')}</span></a>`);
    });

    if (body.classList.contains('is-preview')) {
      body.insertAdjacentHTML('beforeend', '<div class="preview-bar">Pré-visualização — ainda não publicado</div>');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     INIT — roda depois que o conteúdo carregou
     ═══════════════════════════════════════════════════════════ */
  function init(C) {
    const PROJECTS = C.projects.filter(p => p && !p.hidden && (p.id || p.yt || p.file));
    const CAT = Object.fromEntries(C.categories.filter(c => c && c.key).map(c => [c.key, c.label || c.key]));
    const accent = applyTheme(C.theme);
    applyContent(C, PROJECTS, accent);

    // 00:00:18:00 — timecode estilo broadcast
    const tc = s => `00:${pad(Math.floor(s / 60))}:${pad(s % 60)}:00`;

    /* ══ thumbnails com fallback: capa enviada → local → CDN ══ */
    function thumbSources(p, w) {
      const list = [];
      if (p.thumb) list.push(asset(p.thumb));
      if (THUMBS_LOCAL && p.id) list.push(`assets/thumbs/${p.id}.jpg`);
      if (p.th) list.push(`${CDN}${p.th}_${w}`, `${CDN}${p.th}_640`);
      if (p.yt) list.push(`https://i.ytimg.com/vi/${p.yt}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${p.yt}/hqdefault.jpg`);
      return [...new Set(list.filter(Boolean))];
    }
    function makeThumb(p, w = 1280, onDone) {
      const src = thumbSources(p, w);
      // vídeo enviado sem capa → usa um quadro do próprio vídeo
      if (!src.length && p.file) {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'metadata';
        v.src = asset(p.file) + '#t=0.5';
        v.onloadeddata = v.onerror = () => onDone && onDone();
        return v;
      }
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      let k = 0;
      img.onload = () => onDone && onDone();
      img.onerror = () => {
        k++;
        if (k < src.length) img.src = src[k];
        else { img.onerror = null; img.style.visibility = 'hidden'; onDone && onDone(); }
      };
      if (src.length) img.src = src[0];
      else setTimeout(() => img.onerror(), 0);
      return img;
    }

    /* ══════════ SPLIT DE LETRAS ══════════ */
    $$('[data-split]').forEach(el => {
      const heading = el.closest('h1, h2');
      if (heading && !heading.hasAttribute('aria-label')) {
        heading.setAttribute('aria-label', $$('[data-split]', heading).map(s => s.textContent.trim()).filter(Boolean).join(' '));
      }
      const offset = el.previousElementSibling && el.previousElementSibling.matches('[data-split]') ? 3 : 0;
      const txt = el.textContent.trim();
      el.textContent = '';
      [...txt].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--i', i + offset);
        s.textContent = ch === ' ' ? ' ' : ch;
        el.appendChild(s);
      });
    });

    /* ══════════ SCRAMBLE ══════════ */
    const GLYPHS = '!<>-_\\/[]{}=+*^?#0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function scramble(el, dur = 650) {
      if (reduce) return;
      const final = el.dataset.text || (el.dataset.text = el.textContent);
      cancelAnimationFrame(el._scr);
      const start = performance.now();
      const step = now => {
        const p = Math.min(1, (now - start) / dur);
        const reveal = Math.floor(p * final.length);
        let out = '';
        for (let i = 0; i < final.length; i++) {
          const c = final[i];
          out += (i < reveal || c === ' ' || c === '\n' || c === '.' || c === '@')
            ? c
            : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) el._scr = requestAnimationFrame(step);
        else el.textContent = final;
      };
      el._scr = requestAnimationFrame(step);
    }
    $$('[data-scramble]').forEach(el => el.addEventListener('mouseenter', () => scramble(el, 500)));

    /* ══════════ HERO: esteira de thumbs ══════════ */
    const half = Math.ceil(PROJECTS.length / 2);
    const fillRow = (row, items) => {
      if (!row || !items.length) return;
      [...items, ...items].forEach(p => {
        const img = makeThumb(p, 640);
        img.loading = 'lazy';
        row.appendChild(img);
      });
    };
    fillRow($('#reelRowA'), PROJECTS.slice(0, half));
    fillRow($('#reelRowB'), PROJECTS.slice(half));

    /* ══════════ ROTATOR ══════════ */
    const rot = $('#rotator');
    const rotItems = rot ? $$('span', rot) : [];
    if (rotItems.length) {
      let r = 0;
      rotItems[0].classList.add('is-on');
      if (!reduce && rotItems.length > 1) {
        setInterval(() => {
          const prev = rotItems[r];
          r = (r + 1) % rotItems.length;
          const next = rotItems[r];
          prev.classList.remove('is-on');
          prev.classList.add('is-out');
          next.classList.remove('is-out');
          // força o reposicionamento embaixo antes de subir
          next.style.transition = 'none';
          next.style.transform = 'translateY(105%)';
          void next.offsetWidth;
          next.style.transition = '';
          next.style.transform = '';
          next.classList.add('is-on');
        }, 2400);
      }
    }

    /* ══════════ TICKER / MARQUEE ══════════ */
    const ticker = $('#ticker');
    if (ticker) ticker.innerHTML += ticker.innerHTML;

    const clientTrack = $('#clientTrack');
    if (clientTrack && C.clients.length) {
      const html = C.clients.map(c => `<span>${esc(c)}</span><i>●</i>`).join('');
      clientTrack.innerHTML = html + `<div style="display:contents" aria-hidden="true">${html}</div>`;
    } else if (clientTrack) {
      clientTrack.closest('.clients').hidden = true;
    }

    /* ══════════ GRID DE TRABALHOS ══════════ */
    const grid = $('#grid');
    const cards = PROJECTS.map((p, i) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.dataset.cat = p.cat || '';
      const meta = `${esc(p.c)}${p.c && p.y ? ' · ' : ''}${esc(p.y)}`;
      el.innerHTML = `
        <button class="card__media" type="button"
          data-video="${esc(p.id || '')}" data-h="${esc(p.h || '')}" data-yt="${esc(p.yt || '')}" data-file="${esc(p.file ? asset(p.file) : '')}"
          data-title="${esc(p.t)}" data-meta="${meta}" data-ar="${+p.ar || 16 / 9}"
          aria-label="Assistir ${esc(p.t)}">
          <span class="card__tc mono"><i></i>${tc(+p.d || 0)}</span>
          ${p.cat ? `<span class="card__cat mono">${esc(CAT[p.cat] || p.cat).toUpperCase()}</span>` : ''}
          <span class="card__play" aria-hidden="true">▶</span>
        </button>
        <div class="card__info">
          <span class="card__n mono">${pad(i + 1)}</span>
          <h3 class="card__t">${esc(p.t)}</h3>
          <span class="card__c mono">${meta}</span>
        </div>`;
      const img = makeThumb(p, 1280);
      img.loading = i < 4 ? 'eager' : 'lazy';
      $('.card__media', el).prepend(img);
      grid.appendChild(el);
      return el;
    });

    // ritmo editorial: 7/5 · 5/7 · 4/4/4 — o card menor desce um pouco
    const PATTERN = [[7, 5], [5, 7], [4, 4, 4]];
    const OFFSET  = [[0, 1], [1, 0], [0, 1, 0]];
    function layout() {
      const vis = cards.filter(c => !c.classList.contains('is-hidden'));
      let i = 0, r = 0;
      while (i < vis.length) {
        const row = PATTERN[r % PATTERN.length];
        const off = OFFSET[r % OFFSET.length];
        const n = Math.min(row.length, vis.length - i);
        const spans = n === row.length ? row : (n === 1 ? [12] : [6, 6]);
        for (let k = 0; k < n; k++) {
          const c = vis[i + k];
          c.style.setProperty('--span', spans[k]);
          c.classList.toggle('card--offset', n === row.length && !!off[k]);
        }
        i += n; r++;
      }
    }
    layout();

    // contadores nos filtros (esconde filtro sem projeto)
    $$('.filter').forEach(b => {
      const f = b.dataset.filter;
      const n = f === 'all' ? PROJECTS.length : PROJECTS.filter(p => p.cat === f).length;
      $('sup', b).textContent = pad(n);
      if (f !== 'all') b.hidden = n === 0;
    });

    // filtro
    const filters = $('#filters');
    filters && filters.addEventListener('click', e => {
      const b = e.target.closest('.filter');
      if (!b || b.classList.contains('is-on')) return;
      $$('.filter', filters).forEach(x => x.classList.toggle('is-on', x === b));
      const f = b.dataset.filter;
      cards.forEach(c => {
        c.classList.toggle('is-hidden', f !== 'all' && c.dataset.cat !== f);
        c.classList.remove('is-in');
        c.style.transitionDelay = '';
      });
      layout();
      const vis = cards.filter(c => !c.classList.contains('is-hidden'));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        vis.forEach((c, k) => {
          c.style.transitionDelay = `${Math.min(k, 8) * 60}ms`;
          c.classList.add('is-in');
        });
      }));
    });

    /* ══════════ OBSERVERS (reveal, scramble-in, split, contadores) ══════════ */
    function countUp(el) {
      const to = +el.dataset.count;
      const suf = el.dataset.suffix || '';
      if (reduce) { el.textContent = to + suf; return; }
      const t0 = performance.now(), dur = 1400;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(to * e) + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        if (el.matches('.card')) {
          // pequeno atraso por coluna, pra entrar em onda
          const col = Math.round(el.getBoundingClientRect().left / innerWidth * 3);
          el.style.transitionDelay = `${col * 90}ms`;
        }
        el.classList.add('is-in');
        if (el.matches('[data-scramble-in]')) scramble(el, 900);
        $$('[data-count]', el).forEach(countUp);
        if (el.matches('[data-count]')) countUp(el);
      });
    }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });

    cards.forEach(c => io.observe(c));
    $$('[data-reveal], [data-scramble-in]').forEach(el => io.observe(el));
    $$('.contact [data-split]').forEach(el => io.observe(el));

    // stagger dos reveals irmãos
    $$('[data-reveal]').forEach(el => {
      const sibs = $$(':scope > [data-reveal]', el.parentElement);
      el.style.transitionDelay = `${sibs.indexOf(el) * 90}ms`;
    });

    /* ══════════ PRELOADER ══════════ */
    const loader = $('#loader');
    const loaderCount = $('#loaderCount');
    const loaderBar = $('#loaderBar');

    function startIntro() {
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      $$('.hero [data-split]').forEach(el => el.classList.add('is-in'));
    }

    (function runLoader() {
      if (!loader || C.show.loader === false) { loader && loader.remove(); return startIntro(); }
      const pre = PROJECTS.slice(0, 6);
      let done = 0;
      pre.forEach(p => makeThumb(p, 640, () => done++));

      const t0 = performance.now();
      const MIN = reduce ? 0 : 1300, MAX = 3500;
      let shown = 0;
      const tick = now => {
        const t = now - t0;
        const loaded = pre.length ? (done / pre.length) * 100 : 100;
        let target = Math.min(loaded, MIN ? (t / MIN) * 100 : 100);
        if (t > MAX) target = 100;
        shown = lerp(shown, target, .09);
        if (target === 100 && shown > 99.4) shown = 100;
        loaderCount.textContent = pad(Math.floor(shown), 3);
        loaderBar.style.transform = `scaleX(${shown / 100})`;
        if (shown < 100) return requestAnimationFrame(tick);
        loader.classList.add('is-done');
        setTimeout(startIntro, 250);
        setTimeout(() => loader.remove(), 1600);
      };
      requestAnimationFrame(tick);
    })();

    /* ══════════ NAV / SCROLL ══════════ */
    const nav = $('#nav');
    const progressBar = $('#progressBar');
    const heroReel = $('.hero__reel');
    const heroTitle = $('.hero__title');
    const hero = $('.hero');
    let lastY = scrollY, ticking = false;

    function onScroll() {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

      nav.classList.toggle('is-scrolled', y > 40);
      if (!body.classList.contains('menu-open')) {
        nav.classList.toggle('is-hidden', y > 500 && y > lastY + 4);
        if (y < lastY - 4) nav.classList.remove('is-hidden');
      }
      lastY = y;

      if (!reduce && y < innerHeight * 1.2) {
        if (heroReel) heroReel.style.transform = `translateY(${y * .35}px) rotate(-6deg)`;
        if (heroTitle) heroTitle.style.transform = `translateY(${y * .12}px)`;
      }
      ticking = false;
    }
    addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    // link ativo
    const links = $$('.nav__link');
    const secIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(s => secIO.observe(s));

    /* ══════════ MENU MOBILE ══════════ */
    const burger = $('#burger');
    const drawer = $('#drawer');
    function setMenu(open) {
      drawer.classList.toggle('is-open', open);
      body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      if (open) nav.classList.remove('is-hidden');
    }
    burger.addEventListener('click', () => setMenu(!drawer.classList.contains('is-open')));
    $$('a', drawer).forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('resize', () => { if (innerWidth > 820) setMenu(false); });

    /* ══════════ MODAL / PLAYER (Vimeo, YouTube ou arquivo enviado) ══════════ */
    const modal = $('#modal');
    const modalFrame = $('#modalFrame');
    const modalTitle = $('#modalTitle');
    const modalMeta = $('#modalMeta');
    const modalClose = $('#modalClose');
    let lastFocus = null, closeTimer = null;

    function openVideo(o) {
      clearTimeout(closeTimer);
      if (drawer.classList.contains('is-open')) setMenu(false);
      lastFocus = document.activeElement;
      modalTitle.textContent = o.title || '';
      modalMeta.textContent = o.meta || (o.id ? `vimeo.com/${o.id}` : '');
      modal.style.setProperty('--ar', o.ar || 16 / 9);
      const t = esc(o.title || 'Vídeo');
      if (o.id) {
        modalFrame.innerHTML =
          `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(o.id)}?${o.h ? 'h=' + encodeURIComponent(o.h) + '&' : ''}autoplay=1&title=0&byline=0&portrait=0&color=${VCOLOR}&dnt=1"
            allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${t}"></iframe>`;
      } else if (o.yt) {
        modalFrame.innerHTML =
          `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(o.yt)}?autoplay=1&rel=0"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${t}"></iframe>`;
      } else {
        modalFrame.innerHTML = `<video src="${esc(o.file)}" controls autoplay playsinline title="${t}"></video>`;
      }
      modal.classList.add('is-open');
      body.classList.add('modal-open');
      modalClose.focus({ preventScroll: true });
    }
    function closeVideo() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      body.classList.remove('modal-open');
      closeTimer = setTimeout(() => { modalFrame.innerHTML = ''; }, 450);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-video], [data-yt], [data-file]');
      if (!t) return;
      const d = t.dataset;
      if (!d.video && !d.yt && !d.file) return;
      e.preventDefault();
      openVideo({ id: d.video, h: d.h, yt: d.yt, file: d.file, title: d.title, meta: d.meta, ar: parseFloat(d.ar) });
    });
    modalClose.addEventListener('click', closeVideo);
    modal.addEventListener('click', e => { if (e.target === modal) closeVideo(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeVideo(); if (drawer.classList.contains('is-open')) setMenu(false); }
    });

    /* ══════════ CURSOR + GLOW + MAGNET ══════════ */
    const heroGlow = $('#heroGlow');
    let mx = innerWidth / 2, my = innerHeight * .4;

    if (fine && C.show.cursor !== false) {
      body.classList.add('has-cursor');
      const cursor = $('#cursor');
      const dot = $('.cursor__dot', cursor);
      const ring = $('.cursor__ring', cursor);
      let rx = mx, ry = my;

      addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        cursor.classList.remove('is-away');
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', () => cursor.classList.add('is-away'));

      document.addEventListener('mouseover', e => {
        const el = e.target;
        const play = el.closest('.card__media');
        const hover = el.closest('a, button, .kit__list li, .marquee__track span');
        cursor.classList.toggle('is-play', !!play);
        cursor.classList.toggle('is-hover', !play && !!hover);
        if (el.closest('.modal__frame')) cursor.classList.add('is-away');
      });

      const loop = () => {
        rx = lerp(rx, mx, .18);
        ry = lerp(ry, my, .18);
        dot.style.transform = `translate(${mx}px, ${my}px)`;
        ring.style.transform = `translate(${rx}px, ${ry}px)`;
        requestAnimationFrame(loop);
      };
      loop();
    } else if (fine) {
      addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    }

    // magnet
    if (fine) {
      $$('[data-magnet]').forEach(el => {
        const s = el.classList.contains('clink') ? .08 : el.classList.contains('contact__mail') ? .15 : .3;
        el.addEventListener('mousemove', e => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate(${x * s}px, ${y * s}px)`;
        });
        el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      });
    }

    // glow do hero segue o mouse (ou flutua sozinho no touch)
    if (heroGlow && !reduce) {
      let gx = mx, gy = my;
      const glowLoop = t => {
        if (fine) {
          const r = hero.getBoundingClientRect();
          gx = lerp(gx, mx, .06);
          gy = lerp(gy, my - r.top, .06);
        } else {
          gx = innerWidth * (.5 + Math.sin(t / 3200) * .25);
          gy = innerHeight * (.45 + Math.cos(t / 4100) * .15);
        }
        heroGlow.style.transform = `translate(${gx}px, ${gy}px)`;
        requestAnimationFrame(glowLoop);
      };
      requestAnimationFrame(glowLoop);
    }

    /* ══════════ HUD "NO AR": timecode rodando (30 fps) ══════════ */
    const onairTc = $('#onairTc');
    if (onairTc) {
      const t0 = performance.now();
      const tcTick = () => {
        const ms = performance.now() - t0;
        const s = Math.floor(ms / 1000);
        const f = Math.floor(ms / (1000 / 30)) % 30;
        onairTc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
        requestAnimationFrame(tcTick);
      };
      requestAnimationFrame(tcTick);
    }

    /* ══════════ RELÓGIO / ANO ══════════ */
    const clock = $('#clock');
    if (clock) {
      const fmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const tickClock = () => { clock.textContent = fmt.format(new Date()); };
      tickClock();
      setInterval(tickClock, 1000);
    }
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }
})();
