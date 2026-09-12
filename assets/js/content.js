/* ═══════════════════════════════════════════════
   CONTEÚDO PADRÃO DO SITE
   Usado quando ainda não há nada salvo pelo painel
   (/admin) ou quando a API está fora do ar.
   Tudo aqui pode ser editado pelo painel — este
   arquivo é só o ponto de partida.
   ═══════════════════════════════════════════════ */
window.SITE_DEFAULT = {
  schema: 1,

  theme: {
    ink:   '#08080A',   // fundo
    ink2:  '#0E0E11',   // fundo de faixas / menu
    ink3:  '#16161A',   // fundo de cards
    paper: '#F2F0EA',   // texto
    hi:    '#FFFFFF',   // texto em destaque
    flare: '#FF3B00',   // cor de destaque
    flareSoft: '#FF6B3D', // destaque suave (itálicos)
    onFlare: '#FFFFFF', // texto sobre o destaque
    live:  '#4ADE80',   // bolinha "disponível"
  },

  effects: { loader: true, grain: true, scanlines: true, vignette: true, cursor: true },

  typography: { display: 'Archivo', mono: 'IBM Plex Mono' },

  /* Ordem das seções abaixo do topo.
     Fixas: ticker, works, about, clients, contact (podem ser ocultadas).
     Criadas pelo painel: text, gallery, video, cards, cta, band. */
  layout: [
    { id: 'ticker',  type: 'ticker',  hidden: false },
    { id: 'works',   type: 'works',   hidden: false },
    { id: 'about',   type: 'about',   hidden: false },
    { id: 'clients', type: 'clients', hidden: false },
    { id: 'contact', type: 'contact', hidden: false },
  ],

  seo: {
    title: 'Lucas Giron — Creative Motion Director',
    description: 'Lucas Giron — Creative Motion Director em Florianópolis. Motion design, vinhetas, aberturas e pacotes gráficos para broadcast. NBA Brasil, Amazon Prime Video, ALESC, Rede Jesuíta.',
    ogImage: 'assets/thumbs/764150238.jpg',
  },

  brand: { mark: 'LG', name: 'LUCAS GIRON' },

  nav: {
    reel: 'SHOWREEL',
    items: [
      { label: 'TRABALHOS', target: '#trabalhos' },
      { label: 'SOBRE',     target: '#sobre' },
      { label: 'CONTATO',   target: '#contato' },
    ],
  },

  showreel: { title: 'Showreel 2024', vimeo: '535644122', video: '', poster: 'assets/thumbs/535644122.jpg' },

  hero: {
    loaderLabel: 'CARREGANDO PROJETOS',
    eyebrow: ['CREATIVE MOTION DIRECTOR', 'FLORIANÓPOLIS — BR'],
    line1: 'LUCAS',
    line2: 'GIRON',
    rotatorLabel: 'ESPECIALIDADE',
    rotator: ['ABERTURAS DE TV', 'VINHETAS', 'MOTION 2D', 'PACOTE GRÁFICO', 'EXPLAINERS'],
    lede: 'Dez anos desenhando movimento para telas grandes e pequenas. Do *opening* da NBA no Amazon Prime Video às vinhetas do NBA Brasil — construo identidades que **entram no ar** e ficam na memória.',
    ctaPrimary: 'VER SHOWREEL',
    ctaSecondary: '{n} PROJETOS',
    showStatus: true,
    status: 'DISPONÍVEL PARA PROJETOS',
    scrollLabel: 'ROLE',
    clockLabel: 'FLORIPA (BRT)',
    timezone: 'America/Sao_Paulo',
  },

  ticker: ['MOTION DESIGN', 'BROADCAST', 'VINHETAS', 'ABERTURAS', 'ANIMAÇÃO 2D', 'DIREÇÃO', 'EXPLAINER', 'PÓS-PRODUÇÃO'],

  works: {
    num: '01',
    title: 'TRABALHOS\nSELECIONADOS',
    subtitle: 'Arquivo 2020 — 2025. Clique para assistir.',
    allLabel: 'TODOS',
  },

  categories: [
    { id: 'broadcast', label: 'BROADCAST' },
    { id: 'motion',    label: 'MOTION' },
    { id: 'filme',     label: 'FILME' },
  ],

  /* vimeo = número final da URL do Vimeo  ·  video = arquivo enviado pelo painel
     Se os dois existirem, o arquivo enviado tem prioridade. */
  projects: [
    { id:'764150238', title:'NBA — Amazon Prime Video', year:2022, duration:18, category:'broadcast', tag:'Abertura',
      description:'Sequência de abertura das transmissões da NBA no Amazon Prime. Produzido com a Madruga Films.',
      vimeo:'764150238', video:'', poster:'assets/thumbs/764150238.jpg', hidden:false },
    { id:'584999486', title:'Dicionário NBA', year:2021, duration:34, category:'broadcast', tag:'Pacote gráfico',
      description:'Abertura e pacote gráfico do programa Dicionário NBA, no NBA Brasil.',
      vimeo:'584999486', video:'', poster:'assets/thumbs/584999486.jpg', hidden:false },
    { id:'581918148', title:'Vinheta Viralizou', year:2021, duration:5, category:'broadcast', tag:'Vinheta',
      description:'Vinheta de abertura criada para o programa Viralizou, do NBA Brasil.',
      vimeo:'581918148', video:'', poster:'assets/thumbs/581918148.jpg', hidden:false },
    { id:'567049229', title:'Em Pauta — ALESC', year:2021, duration:30, category:'broadcast', tag:'Programa',
      description:'Gravação, direção, edição e finalização do programa Em Pauta, da Assembleia Legislativa de SC.',
      vimeo:'567049229', video:'', poster:'assets/thumbs/567049229.jpg', hidden:false },
    { id:'952132088', title:'ETH — Passeio Sapiens', year:2024, duration:135, category:'motion', tag:'Institucional',
      description:'Peça institucional com direção de arte e animação para o Passeio Sapiens.',
      vimeo:'952132088', video:'', poster:'assets/thumbs/952132088.jpg', hidden:false },
    { id:'924797684', title:'Selfit Trindade', year:2024, duration:77, category:'filme', tag:'Inauguração',
      description:'Cobertura e finalização da inauguração da unidade Trindade da Selfit.',
      vimeo:'924797684', video:'', poster:'assets/thumbs/924797684.jpg', hidden:false },
    { id:'924449405', title:'Aline Manfro — Odontopediatra', year:2024, duration:92, category:'filme', tag:'Branded',
      description:'Vídeo de apresentação da clínica: direção, captação e finalização.',
      vimeo:'924449405', video:'', poster:'assets/thumbs/924449405.jpg', hidden:false },
    { id:'855040781', title:'Olimpíadas Catarinense 2023', year:2023, duration:124, category:'filme', tag:'Institucional',
      description:'Vídeo institucional das Olimpíadas 2023 do Colégio Catarinense.',
      vimeo:'855040781', video:'', poster:'assets/thumbs/855040781.jpg', hidden:false },
    { id:'847440801', title:'Acessa Agro — Explainers', year:2023, duration:119, category:'motion', tag:'Explainer',
      description:'Dois vídeos instrucionais sobre acesso e recuperação de pontos no portal Acessa Agro.',
      vimeo:'847440801', video:'', poster:'assets/thumbs/847440801.jpg', hidden:false },
    { id:'639502539', title:'CORE-SC', year:2021, duration:162, category:'filme', tag:'Série',
      description:'Um dos vários programas criados para o Conselho Regional dos Representantes Comerciais de SC.',
      vimeo:'639502539', video:'', poster:'assets/thumbs/639502539.jpg', hidden:false },
    { id:'535644122', title:'Compilado de Animação', year:2024, duration:42, category:'motion', tag:'Reel',
      description:'Compilado de trabalhos e estudos de animação.',
      vimeo:'535644122', video:'', poster:'assets/thumbs/535644122.jpg', hidden:false },
    { id:'567038935', title:'Engenharia do Corpo', year:2021, duration:60, category:'motion', tag:'Animação',
      description:'Peça animada com construção gráfica e ritmo próprios.',
      vimeo:'567038935', video:'', poster:'assets/thumbs/567038935.jpg', hidden:false },
    { id:'468518303', title:'Rede Jesuíta', year:2020, duration:131, category:'motion', tag:'Motion 2D',
      description:'Animação 2D para a Rede Jesuíta de Educação.',
      vimeo:'468518303', video:'', poster:'assets/thumbs/468518303.jpg', hidden:false },
    { id:'535655695', title:'Websérie Mãe — Ep. 03', year:2021, duration:201, category:'filme', tag:'Websérie',
      description:'Episódio 3 da websérie "Mãe — Todas as Formas de Amor".',
      vimeo:'535655695', video:'', poster:'assets/thumbs/535655695.jpg', hidden:false },
    { id:'492201849', title:'VT Escola Internacional', year:2020, duration:30, category:'filme', tag:'VT',
      description:'Edição e finalização do vídeo promocional de lançamento.',
      vimeo:'492201849', video:'', poster:'assets/thumbs/492201849.jpg', hidden:false },
    { id:'458179585', title:'Institucional Prime', year:2020, duration:60, category:'filme', tag:'Institucional',
      description:'Vídeo institucional da Prime Academy, em Florianópolis.',
      vimeo:'458179585', video:'', poster:'assets/thumbs/458179585.jpg', hidden:false },
    { id:'458174695', title:'PRIME — Short Film', year:2020, duration:35, category:'filme', tag:'Short film',
      description:'Curta motivacional para a Prime Academy: captação, edição e direção.',
      vimeo:'458174695', video:'', poster:'assets/thumbs/458174695.jpg', hidden:false },
    { id:'446616864', title:'O P U N T I A', year:2020, duration:108, category:'filme', tag:'Autoral',
      description:'Peça autoral, filmada em Canon T2i com lente 18-55mm.',
      vimeo:'446616864', video:'', poster:'assets/thumbs/446616864.jpg', hidden:false },
    { id:'417768221', title:'SC Odonto 03', year:2020, duration:24, category:'motion', tag:'Social',
      description:'Peça animada da série SC Odonto.',
      vimeo:'417768221', video:'', poster:'assets/thumbs/417768221.jpg', hidden:false },
    { id:'417767531', title:'SC Odonto 02', year:2020, duration:26, category:'motion', tag:'Social',
      description:'Peça animada da série SC Odonto.',
      vimeo:'417767531', video:'', poster:'assets/thumbs/417767531.jpg', hidden:false },
  ],

  about: {
    num: '02',
    title: 'SOBRE',
    lead: 'Sou **Lucas Giron**, motion director em Florianópolis. Trabalho na fronteira entre design gráfico e cinema: pego uma marca, um conceito ou um jogo de basquete e transformo em *movimento*.',
    paragraphs: [
      'Comecei em produtora, passei por direção e finalização de programas de TV e hoje concentro o trabalho em pacotes gráficos completos — abertura, GCs, transições, encerramento — para emissoras, agências e marcas.',
      'Já assinei aberturas para a **NBA no Amazon Prime Video** (com a Madruga Films), vinhetas para o **NBA Brasil**, a identidade do programa **Em Pauta** da Assembleia Legislativa de SC e animações 2D para a **Rede Jesuíta de Educação**.',
    ],
    signature: 'Lucas Giron',
    stats: [
      { value: '10',  suffix: '+', label: 'ANOS DE ESTRADA' },
      { value: '{n}', suffix: '',  label: 'PROJETOS PUBLICADOS' },
      { value: '3',   suffix: '',  label: 'EMISSORAS / STREAMINGS' },
    ],
    lists: [
      { title: 'FERRAMENTAS', items: [
        { name: 'After Effects',           detail: 'Motion / Composição' },
        { name: 'Cinema 4D',               detail: '3D / Render' },
        { name: 'Premiere Pro',            detail: 'Edição' },
        { name: 'DaVinci Resolve',         detail: 'Cor / Finalização' },
        { name: 'Illustrator · Photoshop', detail: 'Design' },
      ]},
      { title: 'SERVIÇOS', items: [
        { name: 'Pacote gráfico de TV',   detail: '01' },
        { name: 'Abertura & vinheta',     detail: '02' },
        { name: 'Animação de logo',       detail: '03' },
        { name: 'Vídeo explainer',        detail: '04' },
        { name: 'Direção & finalização',  detail: '05' },
      ]},
    ],
  },

  clients: {
    label: 'NO AR PARA',
    items: ['NBA Brasil','Amazon Prime Video','Madruga Films','ALESC','Colégio Catarinense',
      'Rede Jesuíta','Selfit','CORE-SC','Acessa Agro','Prime Academy','Escola Internacional'],
  },

  contact: {
    num: '03',
    kicker: 'TEM UM PROJETO PARA COLOCAR NO AR?',
    line1: 'VAMOS',
    line2: 'ANIMAR',
    email: 'email@exemplo.com',
    links: [
      { label: 'Instagram', handle: '@lucasgiron.aep ↗', url: 'https://www.instagram.com/lucasgiron.aep/' },
      { label: 'Vimeo',     handle: '/gironlucas ↗',     url: 'https://vimeo.com/gironlucas' },
    ],
  },

  footer: {
    name: 'LUCAS GIRON',
    note: 'FLORIANÓPOLIS · SANTA CATARINA · BRASIL',
    backToTop: 'VOLTAR AO TOPO ↑',
  },
};
