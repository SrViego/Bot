#!/usr/bin/env bash
# Sobe o bot Isolde com o Node do sistema (NixOS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: node nao encontrado. No NixOS: programs/node no systemPackages."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "ERRO: falta .env — copie .env.example e coloque o DISCORD_TOKEN."
  exit 1
fi

# Token ainda placeholder / vazio?
if grep -qE 'DISCORD_TOKEN=(seu_token|coloque_|$)' .env 2>/dev/null; then
  echo "AVISO: DISCORD_TOKEN parece nao configurado no .env"
fi

# Garante deps
if [[ ! -d node_modules/discord.js ]]; then
  echo "Instalando dependencias (npm install)..."
  npm install
fi

echo "Node: $(node -v)"
echo "Iniciando Isolde..."
exec npm start
