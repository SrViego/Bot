#!/usr/bin/env bash
# Sobe Lavalink + bot. Ctrl+C encerra os dois.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  if [[ -n "${LAVA_PID:-}" ]] && kill -0 "$LAVA_PID" 2>/dev/null; then
    kill "$LAVA_PID" 2>/dev/null || true
    wait "$LAVA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Lavalink..."
bash "$ROOT/scripts/start-lavalink.sh" &
LAVA_PID=$!

# Espera a porta 2333
for i in $(seq 1 30); do
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ':2333'; then
    break
  fi
  if ! kill -0 "$LAVA_PID" 2>/dev/null; then
    echo "ERRO: Lavalink morreu ao iniciar. Veja o log acima."
    exit 1
  fi
  sleep 1
done

echo "==> Bot Morgana..."
bash "$ROOT/scripts/start-bot.sh"
