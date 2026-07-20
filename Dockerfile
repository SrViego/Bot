# Bot Isolde — Node no container (sem Node no NixOS)
FROM node:22-bookworm-slim

WORKDIR /app

# Dependencias primeiro (cache de layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# data/ montado por volume no compose
RUN mkdir -p /app/data

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
