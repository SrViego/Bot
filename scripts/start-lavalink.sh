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

echo "Java: $(java -version 2>&1 | head -1)"
echo "Lavalink em $(pwd) (porta 2333)..."
exec java -jar Lavalink.jar
