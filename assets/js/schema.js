/* ═══════════════════════════════════════════════
   ESQUEMA DO CONTEÚDO
   Compartilhado entre o site e o painel: fontes
   disponíveis, endereços das seções fixas e a
   migração de conteúdos salvos em versões antigas.
   ═══════════════════════════════════════════════ */
(() => {
'use strict';

// nome da fonte → trecho da URL do Google Fonts
const FONTS = {
  display: {
    'Archivo':          'Archivo:wdth,wght@62..125,100..900',
    'Inter':            'Inter:wght@100..900',
    'Space Grotesk':    'Space+Grotesk:wght@300..700',
    'Syne':             'Syne:wght@400..800',
    'Unbounded':        'Unbounded:wght@200..900',
    'Manrope':          'Manrope:wght@200..800',
    'Montserrat':       'Montserrat:wght@100..900',
    'Oswald':           'Oswald:wght@200..700',
    'Bebas Neue':       'Bebas+Neue',
    'Anton':            'Anton',
    'Playfair Display': 'Playfair+Display:wght@400..900',
    'DM Serif Display': 'DM+Serif+Display',
  },
  mono: {
    'IBM Plex Mono':  'IBM+Plex+Mono:wght@400;500',
    'JetBrains Mono': 'JetBrains+Mono:wght@100..800',
    'Space Mono':     'Space+Mono:wght@400;700',
    'DM Mono':        'DM+Mono:wght@300;400;500',
    'Roboto Mono':    'Roboto+Mono:wght@100..700',
    'Fira Code':      'Fira+Code:wght@300..700',
  },
};

// id no HTML de cada seção fixa (usado pelos links do menu)
const ANCHORS = { ticker: 'faixa', works: 'trabalhos', about: 'sobre', clients: 'clientes', contact: 'contato' };

const slug = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function migrate(c) {
  if (!c || typeof c !== 'object') return c;
  const D = window.SITE_DEFAULT || {};

  // antes: sections {ticker:true,...} → agora: layout ordenável
  if (!Array.isArray(c.layout)) {
    const s = c.sections || {};
    c.layout = (D.layout || []).map(x => ({ ...x, hidden: s[x.type] === false }));
  }
  // as seções fixas sempre existem (podem ser ocultadas, não excluídas)
  (D.layout || []).forEach(b => {
    if (!c.layout.some(x => x && x.type === b.type)) c.layout.push({ ...b });
  });
  delete c.sections;

  // antes: nav {works, about, contact} → agora: lista de links
  if (c.nav && !Array.isArray(c.nav.items)) {
    const n = c.nav;
    n.items = [
      { label: n.works ?? 'TRABALHOS', target: '#trabalhos' },
      { label: n.about ?? 'SOBRE', target: '#sobre' },
      { label: n.contact ?? 'CONTATO', target: '#contato' },
    ].filter(i => i.label);
    delete n.works; delete n.about; delete n.contact;
  }
  return c;
}

window.SITE_FONTS = FONTS;
window.SITE_ANCHORS = ANCHORS;
window.SITE_SLUG = slug;
window.SITE_MIGRATE = migrate;
})();
