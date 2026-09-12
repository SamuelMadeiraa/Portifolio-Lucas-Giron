# Lucas Giron — Portfólio

Site one-page com **painel de administração** em `/admin`. Pelo painel dá para mudar
tudo do site sem mexer em código — com criar / editar / reordenar / excluir para:

- **Projetos** (upload de vídeo que toca direto no site, ou link do Vimeo) e **categorias**
- **Seções**: reordenar, ocultar e criar novas (texto, galeria, vídeo em destaque, cards,
  chamada com botão, faixa de palavras)
- **Menu**: links para qualquer seção ou link externo
- Textos, números, ferramentas, serviços, clientes, contato, rodapé, SEO
- **Aparência**: cores (com paletas prontas), fontes do Google Fonts e efeitos

Publicar de uma aba/aparelho desatualizado não apaga nada: o painel detecta que o site
mudou e junta só o que você alterou por cima da versão mais nova.

```
index.html              ← estrutura da página (os textos vêm do conteúdo)
assets/
  css/style.css
  js/content.js         ← conteúdo PADRÃO (usado até a primeira publicação)
  js/schema.js          ← fontes disponíveis + migração de conteúdos antigos
  js/main.js            ← carrega o conteúdo e monta o site
  thumbs/*.jpg          ← capas originais dos projetos do Vimeo
admin/                  ← painel (index.html, admin.css, admin.js)
api/                    ← funções da Vercel (login, conteúdo, upload, mídias, histórico)
tools/dev-server.ps1    ← servidor local que imita a API (não vai para o deploy)
```

## Como funciona

- O conteúdo do site inteiro é um JSON salvo no **Vercel Blob**. O painel edita um
  rascunho; **Publicar** grava o JSON e guarda uma cópia no histórico (últimas 30).
- Vídeos e imagens enviados pelo painel vão direto do navegador para o Blob
  (sem limite de tamanho das funções) e tocam num `<video>` nativo no site.
  Projetos antigos do Vimeo continuam funcionando — cada projeto pode ter arquivo
  próprio **ou** link do Vimeo (o arquivo tem prioridade).
- Se a API estiver fora do ar, o site usa `assets/js/content.js` — ele nunca fica em branco.

## Colocar no ar (Vercel) — uma vez só

1. **Blob:** no projeto `lucas-giron` na Vercel → **Storage** → **Create** → **Blob**,
   acesso **Public**, e conecte ao projeto. Isso cria a variável `BLOB_READ_WRITE_TOKEN`.
2. **Senha:** **Settings → Environment Variables** → adicione `ADMIN_PASSWORD` com uma
   senha forte (Production). Opcional: `SESSION_SECRET` com um texto aleatório longo.
3. Faça um novo deploy (as variáveis só valem para deploys feitos depois).
4. Acesse `https://SEU-DOMINIO/admin` e entre com a senha.

Trocar a `ADMIN_PASSWORD` desconecta todas as sessões abertas.

## Trocar a senha

Depois de entrar, o painel tem a aba **Senha**: informe a senha atual, a nova (mínimo de
8 caracteres) e confirme. Vale na hora, sem precisar publicar.

- A `ADMIN_PASSWORD` é só a **senha inicial**. Depois da primeira troca pelo painel, vale
  a senha nova (a variável deixa de funcionar para entrar).
- A senha nova fica no Blob embaralhada (HMAC com o segredo do servidor), nunca em texto
  puro — e o arquivo tem nome derivado desse segredo.
- Trocar a senha derruba as sessões abertas em outros aparelhos.
- **Esqueceu?** Apague o arquivo que começa com `site/auth-` em **Vercel → Storage → Blob**.
  A senha volta a ser a da variável `ADMIN_PASSWORD`.

## Rodar localmente (sem Node)

```
powershell -ExecutionPolicy Bypass -File tools/dev-server.ps1
```

- Site: http://localhost:5500 · Painel: http://localhost:5500/admin (senha local: `admin`)
- O servidor local imita a API e guarda tudo em `.dev-data/` (ignorado pelo git e pelo deploy).

## Dicas para os vídeos

- Prefira **MP4 (H.264)**: toca em todos os navegadores e celulares.
- Exporte já comprimido (ex.: 1080p, 6–10 Mbps). Arquivos menores carregam mais rápido e
  consomem menos da cota de transferência do Blob.
- Ao enviar, a duração e a capa (frame do segundo 1) são preenchidas sozinhas. A capa pode
  ser trocada por uma imagem ou capturada em outro segundo.
- Na aba **Mídias** dá para ver o espaço usado e apagar arquivos que ninguém usa mais.

## Custos

O Vercel Blob tem cota gratuita de armazenamento e transferência que depende do plano.
Vídeos consomem transferência a cada visualização — acompanhe o uso em
**Vercel → Storage → Blob** e confira os limites do seu plano.
