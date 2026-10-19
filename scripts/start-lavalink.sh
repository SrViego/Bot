#!/usr/bin/env bash
# Sobe o Lavalink (musica) — precisa de Java no PATH (jre_headless no NixOS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/lavalink"

if ! command -v java >/dev/null 2>&1; then
  echo "ERRO: java nao encontrado."
  echo "No NixOS, adicione jre_headless e rebuild, ou rode:"
  echo "  nix-shell -p jre_headless --run './scripts/start-lavalink.sh'"
  exit 1
fi

if [[ ! -f Lavalink.jar ]]; then
  echo "ERRO: lavalink/Lavalink.jar nao encontrado."
  exit 1
fi

# Senha: application.yml lê ${LAVALINK_SERVER_PASSWORD}; reaproveita LAVALINK_PASSWORD do .env
if [[ -z "${LAVALINK_SERVER_PASSWORD:-}" && -f "$ROOT/.env" ]]; then
  LAVALINK_SERVER_PASSWORD="$(grep -E '^LAVALINK_PASSWORD=' "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r')"
fi
if [[ -z "${LAVALINK_SERVER_PASSWORD:-}" ]]; then
  echo "ERRO: defina LAVALINK_PASSWORD no .env (ou LAVALINK_SERVER_PASSWORD no ambiente)."
  exit 1
fi
export LAVALINK_SERVER_PASSWORD

echo "Java: $(java -version 2>&1 | head -1)"
echo "Lavalink em $(pwd) (porta 2333)..."
exec java -jar Lavalink.jar
