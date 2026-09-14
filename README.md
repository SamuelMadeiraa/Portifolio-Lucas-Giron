# Portfólio — Lucas Giron

Site de portfólio de **Lucas Giron**, Creative Motion Director em Florianópolis.
Motion design, vinhetas, aberturas e pacotes gráficos para broadcast.

Site estático (HTML + CSS + JS puro, sem build) com um **painel admin com login por usuário e senha**
em `/admin`. Roda de dois jeitos, com o mesmo código:

- **Vercel** — as funções em `api/` cuidam do login e o **Vercel Blob** guarda conteúdo e arquivos.
- **Servidor próprio (VPS Ubuntu) com Docker** — um servidor Node pequeno serve tudo e guarda
  conteúdo e arquivos numa pasta de dados (volume do Docker), com HTTPS automático pelo Caddy.

## Estrutura

```
index.html            página do site
content.json          conteúdo inicial (usado até a primeira publicação pelo painel)
assets/               visual (css) e animações (js) do site
admin/                painel de administração
api/                  rotas: login, logout, me, content, media, upload (Vercel) e upload-file (Docker)
api/_lib/             login (auth.js) e armazenamento (storage.js: Vercel Blob ou disco)
server/server.js      servidor para Docker/VPS (sem dependências extras)
Dockerfile            imagem do servidor
docker-compose.yml    servidor + Caddy (HTTPS)
Caddyfile             configuração do HTTPS
.env.example          modelo das configurações da VPS
vercel.json           cabeçalhos na Vercel
```

---

## Opção 1 — Vercel

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

**Trocar a senha:** mude `ADMIN_PASSWORD` na Vercel e faça **Redeploy**.

---

## Opção 2 — VPS Ubuntu com Docker

Precisa de uma VPS com Ubuntu e, de preferência, um domínio.
No painel do seu domínio, crie um registro **A** apontando para o **IP da VPS**.

**1. Instalar o Docker** (uma vez só, logado na VPS por SSH):

```bash
curl -fsSL https://get.docker.com | sudo sh
```

**2. Baixar o projeto:**

```bash
git clone https://github.com/SamuelMadeiraa/Portifolio-Lucas-Giron.git portfolio && cd portfolio
```

**3. Configurar** — copie o modelo e edite (domínio, usuário e senha do painel):

```bash
cp .env.example .env && nano .env
```

Para gerar o `SESSION_SECRET`:

```bash
openssl rand -hex 32
```

**4. Subir:**

```bash
sudo docker compose up -d --build
```

Pronto: o site fica em `https://seudominio.com.br` e o painel em `https://seudominio.com.br/admin/`.
O Caddy gera o certificado HTTPS sozinho na primeira visita (as portas 80 e 443 precisam estar liberadas).

**Sem domínio (só para testar pelo IP):** no `.env`, use `DOMAIN=:80` e `COOKIE_SECURE=false`,
e acesse `http://IP-DA-VPS`. Não use assim em produção — a senha trafega sem criptografia.

### No dia a dia

Atualizar o site depois de mudanças no código:

```bash
git pull && sudo docker compose up -d --build
```

Ver os logs:

```bash
sudo docker compose logs -f site
```

Trocar a senha: edite o `.env` e rode `sudo docker compose up -d`.

**Backup** — tudo o que o painel salva (conteúdo, fotos e vídeos) fica no volume `portfolio_dados`:

```bash
sudo docker run --rm -v portfolio_dados:/data -v "$PWD":/backup alpine tar czf /backup/backup-portfolio.tgz -C /data .
```

Restaurar um backup:

```bash
sudo docker run --rm -v portfolio_dados:/data -v "$PWD":/backup alpine sh -c "cd /data && tar xzf /backup/backup-portfolio.tgz"
```

---

## Como funciona o painel

- **Publicar** salva o conteúdo; as 20 últimas publicações ficam guardadas como histórico.
  Na Vercel o site mostra a versão nova em até 1 minuto; na VPS, na hora.
- **Fotos e vídeos** sobem direto do navegador (até 500 MB por arquivo; na VPS o limite é o `MAX_UPLOAD_MB`).
  Imagens grandes são reduzidas e convertidas para WebP antes de subir.
- **Pré-visualizar** abre o site com as alterações antes de publicar.
- Alterações não publicadas ficam salvas como rascunho no navegador.

O painel permite:

- **Projetos** — adicionar por link do Vimeo/YouTube (vídeo, Shorts, live), link de outro site (Behance, Instagram, Drive… com capa) ou vídeo do computador; editar, excluir, ocultar, reordenar; trocar capas; criar categorias (filtros). Cada projeto pode ter **descrição, galeria de fotos e antes e depois**.
- **Design** — seção própria para trabalhos que não são vídeo (fica entre os vídeos e o “Sobre”): galeria de fotos, antes e depois com barra de arrastar, **modelo 3D** girável (GLB — a capa é gerada sozinha) e PDF.
- **Seções** — criar seções novas além do "Sobre", com texto, imagem, galeria e botão.
- **Textos** — todos os textos do site, foto do "Sobre", números, ferramentas, serviços, clientes, showreel (Vimeo, YouTube ou arquivo), contato e redes (Instagram, Vimeo, canal do YouTube, WhatsApp e outros links). As redes aparecem no contato, no rodapé e no menu do celular com **ícone automático** pelo endereço.
- **Visual** — cores (destaque, fundo, texto), textura, ligar/desligar partes do site.
- **Mídia** — enviar e excluir arquivos.

Nos textos longos, use `*itálico*` e `**negrito**`.

## Rodar no seu computador

Com Node 20+ instalado, na pasta do projeto (os dados ficam na pasta `data/`):

```bash
npm install
```

```bash
ADMIN_USER=lucas ADMIN_PASSWORD=teste COOKIE_SECURE=false node server/server.js
```

Depois abra `http://localhost:3000` e `http://localhost:3000/admin/`.
