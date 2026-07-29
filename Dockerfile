# Bot Morgana — Node no container (sem Node no NixOS)
FROM node:22-bookworm-slim

WORKDIR /app

# better-sqlite3 precisa de toolchain nativa no build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Dependencias primeiro (cache de layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY assets ./assets
COPY scripts ./scripts
# Pokédex estática (runtime database.json / morgana.db vem do volume)
COPY data/pokemon-data.json ./data/pokemon-data.json
COPY data/pokemon-evolutions.json ./data/pokemon-evolutions.json
RUN mkdir -p /app/data /app/data/backups /app/data/metrics \
  && chown -R node:node /app

ENV NODE_ENV=production
# json | sqlite
ENV DATA_BACKEND=json
# Segurança: não rodar como root
USER node
CMD ["node", "src/index.js"]
