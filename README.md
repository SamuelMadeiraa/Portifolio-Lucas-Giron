# Portfólio — Lucas Giron

Site de portfólio de **Lucas Giron**, Creative Motion Director em Florianópolis.
Motion design, vinhetas, aberturas e pacotes gráficos para broadcast.

Site estático (HTML + CSS + JS puro, sem build). Todo o conteúdo — textos, projetos,
fotos, seções e cores — fica em [`content.json`](content.json) e é editado pelo painel em **`/admin`**.

## Estrutura

```
index.html            página do site
content.json          todo o conteúdo (editado pelo painel)
assets/css/style.css  visual do site
assets/js/main.js     animações, grid de projetos, player
admin/                painel de administração
uploads/              fotos e vídeos enviados pelo painel (criada ao publicar)
assets/thumbs/        thumbnails locais opcionais (ver baixar-thumbs.ps1)
```

## Publicar no GitHub Pages

1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
3. Em ~1 minuto o site fica em `https://samuelmadeiraa.github.io/Portifolio-Lucas-Giron/`.

## Usar o painel admin

1. Abra `https://samuelmadeiraa.github.io/Portifolio-Lucas-Giron/admin/`.
2. Na primeira vez, informe usuário (`SamuelMadeiraa`), repositório (`Portifolio-Lucas-Giron`), branch (`main`)
   e um **token do GitHub** com permissão *Contents: Read and write* só neste repositório
   (o próprio painel mostra o passo a passo). Crie uma senha — o token fica guardado
   criptografado com ela, só naquele navegador.
3. Edite o que quiser e clique em **Publicar**. O site atualiza em cerca de 1 minuto.

O painel permite:

- **Projetos** — adicionar por link do Vimeo/YouTube ou vídeo do computador, editar, excluir, ocultar, reordenar; criar categorias (filtros).
- **Seções** — criar seções novas além do "Sobre", com texto, imagem, galeria e botão.
- **Textos** — todos os textos do site, foto do "Sobre", números, ferramentas, serviços, clientes, contato e links.
- **Visual** — cores (destaque, fundo, texto), textura, ligar/desligar partes do site.
- **Mídia** — enviar e excluir arquivos (imagens grandes são otimizadas automaticamente).

Nos textos longos, use `*itálico*` e `**negrito**`.

## Rodar localmente

Qualquer servidor estático na pasta do projeto, por exemplo:

```bash
npx serve .
```
