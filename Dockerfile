# ═══════════════════════════════════════════════════════════
#  Portfólio Lucas Giron — imagem para servidor próprio (VPS)
#  Site + painel admin + API, com os dados no volume /data.
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app

# dependências primeiro (aproveita o cache do Docker)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# código do site, do painel e da API
COPY . .

RUN mkdir -p /data/uploads /data/content && chown -R node:node /data
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server/server.js"]
