# Portfólio — Lucas Giron

Site de portfólio de **Lucas Giron**, Creative Motion Director em Florianópolis.
Motion design, vinhetas, aberturas e pacotes gráficos para broadcast.

Site estático (HTML + CSS + JS puro, sem build) com um **painel admin com login por usuário e senha**
em `/admin`. Hospedado na **Vercel**: as funções em `api/` cuidam do login e o **Vercel Blob**
guarda o conteúdo e os arquivos enviados.

## Estrutura

```
index.html            página do site
content.json          conteúdo inicial (usado até a primeira publicação pelo painel)
assets/css/style.css  visual do site
assets/js/main.js     animações, grid de projetos, player
admin/                painel de administração
api/                  funções da Vercel: login, conteúdo, envio e mídia
vercel.json           cabeçalhos (admin fora do Google, sem cache)
```

## Colocar no ar na Vercel (uma vez só)

1. **Importar o projeto** — em [vercel.com/new](https://vercel.com/new), escolha o repositório
   `Portifolio-Lucas-Giron`. Em *Framework Preset* deixe **Other** e clique em **Deploy**.
2. **Ligar o armazenamento** — no projeto: **Storage → Create → Blob**.
   Escolha acesso **Public**, dê um nome (ex.: `portfolio`) e conecte ao projeto.
   Isso cria sozinho a variável `BLOB_READ_WRITE_TOKEN`.
3. **Criar o login** — em **Settings → Environment Variables**, adicione:

   | Nome             | Valor                                   |
   |------------------|-----------------------------------------|
   | `ADMIN_USER`     | o usuário do painel (ex.: `lucas`)      |
   | `ADMIN_PASSWORD` | uma senha forte (12+ caracteres)        |

4. **Deploy de novo** — em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**
   (as variáveis só valem a partir de um deploy novo).
5. Abra `https://SEU-SITE.vercel.app/admin/` e entre com o usuário e a senha.

**Trocar a senha:** mude `ADMIN_PASSWORD` na Vercel e faça **Redeploy**. Isso também desconecta
quem estiver logado.

## Como funciona o painel

- **Publicar** salva o conteúdo no Vercel Blob. O site mostra a versão nova em até 1 minuto.
  As 20 últimas publicações ficam guardadas como histórico.
- **Fotos e vídeos** sobem direto do navegador para o Blob (até 500 MB por arquivo).
  Imagens grandes são reduzidas e convertidas para WebP antes de subir.
- **Pré-visualizar** abre o site com as alterações antes de publicar.
- Alterações não publicadas ficam salvas como rascunho no navegador.

O painel permite:

- **Projetos** — adicionar por link do Vimeo/YouTube ou vídeo do computador, editar, excluir, ocultar, reordenar; criar categorias (filtros).
- **Seções** — criar seções novas além do "Sobre", com texto, imagem, galeria e botão.
- **Textos** — todos os textos do site, foto do "Sobre", números, ferramentas, serviços, clientes, contato e links.
- **Visual** — cores (destaque, fundo, texto), textura, ligar/desligar partes do site.
- **Mídia** — enviar e excluir arquivos.

Nos textos longos, use `*itálico*` e `**negrito**`.

## Rodar localmente

Com a [Vercel CLI](https://vercel.com/docs/cli) (precisa do Node 20+), na pasta do projeto:

```bash
npm install
```

```bash
vercel dev
```

Sem a CLI, qualquer servidor estático mostra o site; o painel abre em **modo de teste**
(edita e baixa o `content.json`, sem login e sem envio de arquivos).
