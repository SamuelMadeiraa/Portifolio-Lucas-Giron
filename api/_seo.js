/* Renderização no servidor para buscadores.
   O site continua sendo montado no navegador; aqui devolvemos o MESMO
   HTML já preenchido, para o Google ler o conteúdo sem depender de JS. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// **negrito** e *itálico* viram HTML; para meta tags usamos texto puro
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
const plain = s => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\s+/g, ' ').trim();
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
const time = s => {
  s = Math.max(0, Math.round(+s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const iso8601 = s => {
  s = Math.max(0, Math.round(+s || 0));
  if (!s) return undefined;
  const m = Math.floor(s / 60);
  return `PT${m ? m + 'M' : ''}${s % 60}S`;
};
const abs = (u, origin) => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return origin + (s.startsWith('/') ? s : '/' + s);
};
const safeUrl = u => {
  const s = String(u || '').trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^(https?|mailto|tel):/i.test(s) ? '#' : s;
};
const slug = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const ANCHORS = { ticker: 'faixa', works: 'trabalhos', design: 'design', about: 'sobre', clients: 'clientes', contact: 'contato' };

/* capa do card: a enviada, a do YouTube ou a primeira imagem dos blocos */
const ytId = s => {
  const v = String(s || '').trim();
  const m = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : '';
};
const posterOf = p => {
  if (p.poster) return p.poster;
  if (ytId(p.youtube)) return `https://i.ytimg.com/vi/${ytId(p.youtube)}/hqdefault.jpg`;
  for (const b of (Array.isArray(p.blocks) ? p.blocks : [])) {
    if (!b) continue;
    const src = b.type === 'image' ? b.src : b.type === 'gallery' ? (b.images || []).find(x => x && x.src)?.src
      : b.type === 'compare' ? b.after : (b.type === 'video' || b.type === 'model') ? b.poster : '';
    if (src) return src;
  }
  return '';
};

/* O conteúdo padrão mora em assets/js/content.js — o mesmo arquivo que o
   navegador usa — para nunca existirem duas versões da verdade. */
let defaultsCache;
export async function readDefaults() {
  if (defaultsCache !== undefined) return defaultsCache;
  defaultsCache = null;
  try {
    const { readFile } = await import('node:fs/promises');
    const path = (await import('node:path')).default;
    const src = await readFile(path.join(process.cwd(), 'assets', 'js', 'content.js'), 'utf8');
    const win = {};
    new Function('window', src + '; return window.SITE_DEFAULT;')(win);
    defaultsCache = win.SITE_DEFAULT || null;
  } catch { defaultsCache = null; }
  return defaultsCache;
}

function migrate(c) {
  if (!c || typeof c !== 'object') return c;
  if (c.nav && !Array.isArray(c.nav.items)) {
    const n = c.nav;
    n.items = [
      { label: n.works ?? 'TRABALHOS', target: '#trabalhos' },
      { label: n.about ?? 'SOBRE', target: '#sobre' },
      { label: n.contact ?? 'CONTATO', target: '#contato' },
    ].filter(i => i.label);
  }
  return c;
}

/* ── blocos de conteúdo ───────────────────────────────── */
const cards = projects => projects.map((p, i) => {
  const href = p.video || (p.vimeo ? `https://vimeo.com/${p.vimeo}` : ytId(p.youtube) ? `https://youtu.be/${ytId(p.youtube)}` : '#');
  const poster = posterOf(p);
  return `<div class="cardwrap" data-cat="${esc(p.category)}">
      <a class="card is-in" href="${esc(safeUrl(href))}" target="_blank" rel="noopener"
         data-play="${esc(p.id)}"${p.video ? ` data-preview="${esc(safeUrl(p.video))}"` : ''} aria-label="Assistir ${esc(p.title)}">
        <div class="card__media">
          ${poster ? `<img class="card__img" src="${esc(safeUrl(poster))}" alt="${esc(p.title)}" width="1280" height="720" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : ''}
          <span class="card__glitch"></span><span class="card__scan"></span>
          ${p.tag ? `<span class="card__tag">${esc(p.tag)}</span>` : ''}
          ${p.duration ? `<span class="card__dur">${time(p.duration)}</span>` : ''}
          <span class="card__bar"></span>
        </div>
        <div class="card__meta"><h3 class="card__t">${esc(p.title)}</h3><span class="card__y">${esc(p.year)}</span></div>
        ${p.description ? `<p class="card__d">${esc(p.description)}</p>` : ''}
      </a></div>`;
}).join('');

const aboutBlock = a => (a.lead ? `<p class="about__big is-in" data-reveal>${rich(a.lead)}</p>` : '')
  + (a.paragraphs || []).filter(Boolean).map(t => `<p class="is-in" data-reveal>${rich(t)}</p>`).join('')
  + (a.signature ? `<div class="about__sign is-in" data-reveal aria-hidden="true">${esc(a.signature)}</div>` : '');

const listsBlock = a => (a.lists || []).filter(l => l && (l.title || l.items?.length)).map(l => `
  <div class="kit is-in" data-reveal><h3 class="kit__t mono">${esc(l.title)}</h3>
    <ul class="kit__list">${(l.items || []).filter(i => i && (i.name || i.detail))
      .map(i => `<li><span>${esc(i.name)}</span><b>${esc(i.detail)}</b></li>`).join('')}</ul></div>`).join('');

/* seções criadas no painel — marcadas com data-ssr para o JS trocar depois */
const extraSections = c => (c.layout || []).filter(s => s && !s.hidden && !ANCHORS[s.type]).map(s => {
  const head = (s.title || s.num) ? `<div class="sec-head"><div class="sec-head__l">
      ${s.num ? `<span class="sec-num mono">${esc(s.num)}</span>` : ''}
      <h2 class="sec-title">${esc(s.title)}</h2></div>
      ${s.subtitle ? `<div class="sec-head__r"><p class="mono muted">${esc(s.subtitle)}</p></div>` : ''}</div>` : '';
  const id = slug(s.anchor) || s.id;
  if (s.type === 'text') {
    const paras = String(s.body || '').split(/\n\s*\n/).filter(p => p.trim());
    return `<section class="xsec xsec--text" id="${esc(id)}" data-ssr="1">${head}
      <div class="xtext${s.image ? ' has-img' : ''}"><div class="xtext__body is-in">${paras.map(p => `<p>${rich(p.trim())}</p>`).join('')}</div>
      ${s.image ? `<figure class="xtext__img is-in"><img src="${esc(safeUrl(s.image))}" alt="" loading="lazy"></figure>` : ''}</div></section>`;
  }
  if (s.type === 'cards') {
    return `<section class="xsec xsec--cards" id="${esc(id)}" data-ssr="1">${head}
      <div class="xcards">${(s.items || []).filter(x => x && (x.title || x.text)).map((x, k) => `
        <article class="xcard is-in"><span class="xcard__n mono">${String(k + 1).padStart(2, '0')}</span>
        <h3 class="xcard__t">${esc(x.title)}</h3>${x.text ? `<p class="xcard__d">${rich(x.text)}</p>` : ''}</article>`).join('')}</div></section>`;
  }
  if (s.type === 'gallery') {
    return `<section class="xsec xsec--gallery" id="${esc(id)}" data-ssr="1">${head}
      <div class="xgal">${(s.images || []).filter(x => x && x.src).map(x => `
        <figure class="xgal__item is-in"><img src="${esc(safeUrl(x.src))}" alt="${esc(x.caption || s.title)}" loading="lazy">
        ${x.caption ? `<figcaption class="mono muted">${esc(x.caption)}</figcaption>` : ''}</figure>`).join('')}</div></section>`;
  }
  if (s.type === 'cta') {
    return `<section class="xsec xsec--cta" id="${esc(id)}" data-ssr="1"><div class="xcta is-in">
      ${s.kicker ? `<p class="mono xcta__k">${esc(s.kicker)}</p>` : ''}<h2 class="xcta__t">${esc(s.title)}</h2>
      ${s.text ? `<p class="xcta__p">${rich(s.text)}</p>` : ''}
      ${s.button && s.url ? `<a class="btn btn--flare" href="${esc(safeUrl(s.url))}"><span>${esc(s.button)}</span></a>` : ''}</div></section>`;
  }
  return '';
}).join('');

/* ── dados estruturados (schema.org) ──────────────────── */
const hostOf = u => { try { return new URL(u).host; } catch { return ''; } };
// aceita tanto o código puro quanto a tag inteira colada do Search Console
const verifyCode = v => {
  const m = String(v || '').match(/content=["']([^"']+)["']/);
  return (m ? m[1] : String(v || '')).trim();
};
const keywordList = v => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(s => String(s).trim()).filter(Boolean);

function jsonLd(c, canonical) {
  const person = c.person || {};
  const name = person.name || c.brand?.name;
  const url = `${canonical}/`;
  const ids = { person: `${canonical}/#pessoa`, site: `${canonical}/#site`, page: `${canonical}/#pagina` };
  const image = c.seo?.ogImage ? abs(c.seo.ogImage, canonical) : undefined;
  const desc = plain(c.seo?.description) || plain(c.hero?.lede);
  const modified = c.savedAt ? String(c.savedAt) : undefined;
  // sameAs é só para perfis (Instagram, Vimeo, LinkedIn…), não para links de conversa
  const isProfile = u => /^https?:\/\//i.test(u || '') && !/(^|\.)(whatsapp\.com|wa\.me|t\.me)$/i.test(hostOf(u));
  const links = [...new Set((c.contact?.links || []).map(l => l && l.url).filter(isProfile))];
  const services = [...new Set((c.about?.lists || []).flatMap(l => (l.items || []).map(i => i && i.name)).filter(Boolean))];

  const personNode = {
    '@type': 'Person',
    '@id': ids.person,
    name,
    alternateName: person.alternateName || undefined,
    jobTitle: person.jobTitle || undefined,
    description: desc || undefined,
    url,
    image,
    email: c.contact?.email ? `mailto:${c.contact.email}` : undefined,
    sameAs: links.length ? links : undefined,
    knowsAbout: services.length ? services : undefined,
    hasOccupation: person.jobTitle ? {
      '@type': 'Occupation',
      name: person.jobTitle,
      occupationLocation: person.city ? { '@type': 'City', name: person.city } : undefined,
      skills: services.length ? services.join(', ') : undefined,
    } : undefined,
    address: (person.city || person.state) ? {
      '@type': 'PostalAddress',
      addressLocality: person.city || undefined,
      addressRegion: person.state || undefined,
      addressCountry: person.country || 'BR',
    } : undefined,
  };

  // o Google só aproveita vídeos com nome, capa, data e endereço do vídeo
  const video = p => {
    const thumb = posterOf(p);
    const yt = ytId(p.youtube);
    const contentUrl = p.video ? abs(p.video, canonical) : undefined;
    const embedUrl = p.video ? undefined
      : p.vimeo ? `https://player.vimeo.com/video/${p.vimeo}`
      : yt ? `https://www.youtube.com/embed/${yt}` : undefined;
    const uploadDate = p.year ? `${p.year}-01-01` : modified ? modified.slice(0, 10) : undefined;
    if (!p.title || !thumb || !uploadDate || !(contentUrl || embedUrl)) return null;
    return {
      '@type': 'VideoObject',
      name: p.title,
      description: plain(p.description) || p.title,
      thumbnailUrl: abs(thumb, canonical),
      uploadDate,
      duration: iso8601(p.duration),
      contentUrl,
      embedUrl,
      genre: p.tag || undefined,
      creator: { '@id': ids.person },
    };
  };
  const artwork = p => {
    const img = posterOf(p);
    if (!p.title || !img) return null;
    return {
      '@type': 'CreativeWork',
      name: p.title,
      description: plain(p.description) || undefined,
      image: abs(img, canonical),
      dateCreated: p.year ? String(p.year) : undefined,
      genre: p.tag || undefined,
      creator: { '@id': ids.person },
    };
  };
  const list = (id, title, items) => items.length ? {
    '@type': 'ItemList',
    '@id': `${canonical}/#${id}`,
    name: title,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 30).map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })),
  } : null;

  const videos = (c.projects || []).filter(p => p && !p.hidden).map(video).filter(Boolean);
  const artworks = (c.designs || []).filter(p => p && !p.hidden).map(artwork).filter(Boolean);

  const graph = [
    {
      '@type': 'WebSite',
      '@id': ids.site,
      url,
      name: name || c.seo?.title,
      alternateName: [c.seo?.title, hostOf(canonical)].filter(Boolean),
      description: desc || undefined,
      inLanguage: 'pt-BR',
      publisher: { '@id': ids.person },
    },
    {
      // página de perfil: diz ao Google que este site É a apresentação dessa pessoa
      '@type': 'ProfilePage',
      '@id': ids.page,
      url,
      name: c.seo?.title || name,
      description: desc || undefined,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': ids.site },
      dateModified: modified,
      primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
      mainEntity: personNode,
    },
    list('trabalhos', plain(c.works?.title) || 'Trabalhos', videos),
    list('design', plain(c.design?.title) || 'Design & 3D', artworks),
  ].filter(Boolean);

  // "</" dentro do JSON fecharia a tag <script> antes da hora
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

/* ── monta a página ───────────────────────────────────── */
export function renderPage(shell, published, origin, defaults) {
  const c = migrate(merge(defaults || {}, published || {}));
  const canonical = String(c.seo?.siteUrl || origin).replace(/\/+$/, '');
  const title = c.seo?.title || c.brand?.name || 'Portfólio';
  const desc = plain(c.seo?.description);
  const img = c.seo?.ogImage ? abs(c.seo.ogImage, canonical) : '';
  const projects = (c.projects || []).filter(p => !p.hidden);

  let html = shell;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(img)}$2`);
  if (c.theme?.ink) html = html.replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${esc(c.theme.ink)}$2`);

  const person = c.person || {};
  const who = person.name || c.brand?.name || title;
  const imgAlt = person.jobTitle ? `${who} — ${person.jobTitle}` : who;
  const ownOg = /(^|\/)assets\/og\//.test(String(c.seo?.ogImage || ''));
  const keywords = keywordList(c.seo?.keywords);
  const google = verifyCode(c.seo?.googleVerification);
  const bing = verifyCode(c.seo?.bingVerification);
  const region = person.state ? `${person.country || 'BR'}-${person.state}` : '';
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}/">`,
    `<link rel="alternate" hreflang="pt-BR" href="${esc(canonical)}/">`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}/">`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`,
    `<meta name="author" content="${esc(who)}">`,
    keywords.length && `<meta name="keywords" content="${esc(keywords.join(', '))}">`,
    region && `<meta name="geo.region" content="${esc(region)}">`,
    person.city && `<meta name="geo.placename" content="${esc(person.city)}">`,
    google && `<meta name="google-site-verification" content="${esc(google)}">`,
    bing && `<meta name="msvalidate.01" content="${esc(bing)}">`,
    `<meta property="og:url" content="${esc(canonical)}/">`,
    `<meta property="og:site_name" content="${esc(who)}">`,
    `<meta property="og:locale" content="pt_BR">`,
    img && `<meta property="og:image:alt" content="${esc(imgAlt)}">`,
    img && ownOg && `<meta property="og:image:width" content="1200">`,
    img && ownOg && `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    img && `<meta name="twitter:image" content="${esc(img)}">`,
    img && `<meta name="twitter:image:alt" content="${esc(imgAlt)}">`,
    `<script type="application/ld+json">${jsonLd(c, canonical)}</script>`,
    `<noscript><style>.loader{display:none}.card,[data-reveal]{opacity:1!important;transform:none!important}</style></noscript>`,
  ].filter(Boolean);
  const headExtra = '\n' + tags.join('\n') + '\n';
  html = html.replace('</head>', headExtra + '</head>');

  const navItems = (c.nav?.items || []).filter(i => i && i.label);
  html = html.replace('<nav class="nav__menu" id="navMenu"></nav>',
    `<nav class="nav__menu" id="navMenu">${navItems.map(i =>
      `<a href="${esc(safeUrl(i.target))}" class="nav__link mono">${esc(i.label)}</a>`).join('')}</nav>`);

  html = html.replace('<div class="grid" id="grid"></div>', `<div class="grid" id="grid">${cards(projects)}</div>`);
  const designs = (c.designs || []).filter(p => p && !p.hidden);
  html = html.replace('<div class="grid" id="designGrid"></div>', `<div class="grid" id="designGrid">${cards(designs)}</div>`);
  html = html.replace('<div class="about__col about__col--text" id="aboutText"></div>',
    `<div class="about__col about__col--text" id="aboutText">${aboutBlock(c.about || {})}</div>`);
  html = html.replace('<div id="aboutLists"></div>', `<div id="aboutLists">${listsBlock(c.about || {})}</div>`);
  html = html.replace('<div class="marquee__track" id="clientTrack"></div>',
    `<div class="marquee__track" id="clientTrack">${(c.clients?.items || []).filter(Boolean).map(s => `<span>${esc(s)}</span>`).join('')}</div>`);
  if (c.contact?.email) {
    html = html.replace('<a class="contact__mail" id="contactMail" href="#" data-magnet data-scramble></a>',
      `<a class="contact__mail" id="contactMail" href="mailto:${esc(c.contact.email)}" data-magnet data-scramble>${esc(c.contact.email)}</a>`);
  }
  html = html.replace('</main>', extraSections(c) + '</main>');

  // textos simples ligados por data-k
  html = html.replace(/(<[^>]*\sdata-k="([\w.]+)"[^>]*>)([^<]*)/g, (m, open, path) => {
    const v = path.split('.').reduce((a, k) => (a == null ? a : a[k]), c);
    return v == null ? m : open + esc(String(v));
  });

  return html;
}

export { merge, plain, esc, posterOf, migrate };
