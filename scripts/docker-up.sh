#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERRO: falta .env — cp .env.example .env e coloque DISCORD_TOKEN"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERRO: docker nao encontrado"
  exit 1
fi

mkdir -p data/backups lavalink/plugins

# Backup antes do deploy (o volume ./data é do host)
if docker compose ps --status running bot 2>/dev/null | grep -q morgana-bot; then
  echo "==> Backup online do SQLite (bot rodando)..."
  docker compose exec -T bot node scripts/backup-db.js pre-deploy || echo "AVISO: backup online falhou"
fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -f data/database.json && ! -f data/morgana.db ]]; then
  cp data/database.json "data/backups/database-predeploy-$STAMP.json"
  echo "==> Backup do JSON legado: data/backups/database-predeploy-$STAMP.json (migração automática no start)"
fi

echo "==> Build + up (bot + lavalink)..."
docker compose up -d --build

echo
echo "OK. Comandos uteis:"
echo "  docker compose logs -f        # ver logs"
echo "  docker compose logs -f bot    # so o bot"
echo "  docker compose ps"
echo "  docker compose down           # parar"
echo
echo "Se o bot cair com TokenInvalid: atualize DISCORD_TOKEN no .env e:"
echo "  docker compose up -d --force-recreate bot"
