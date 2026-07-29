#!/usr/bin/env bash
# Checklist de segurança rápido (semana 1)
# Uso: ./scripts/security-check.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ok=0
warn=0
fail=0

pass() { echo "  ✅ $1"; ok=$((ok + 1)); }
warn_() { echo "  ⚠️  $1"; warn=$((warn + 1)); }
fail_() { echo "  ❌ $1"; fail=$((fail + 1)); }

echo "══════════════════════════════════════"
echo "  Morgana — security-check"
echo "══════════════════════════════════════"

# .env
if [[ -f .env ]]; then
  pass ".env existe"
  if grep -qE 'DISCORD_TOKEN=.+' .env && ! grep -q 'cole_o_token' .env; then
    pass "DISCORD_TOKEN parece preenchido"
  else
    fail_ "DISCORD_TOKEN ausente ou placeholder"
  fi
  if grep -q 'youshallnotpass' .env 2>/dev/null; then
    warn_ "LAVALINK_PASSWORD ainda é o default (ok só em rede Docker isolada)"
  else
    pass "LAVALINK_PASSWORD customizado (ou ausente)"
  fi
else
  fail_ ".env não encontrado (cp .env.example .env)"
fi

# git: .env tracked?
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env >/dev/null 2>&1; then
    fail_ ".env está no git index — remova e rotacione o token!"
  else
    pass ".env não está tracked pelo git"
  fi
  if git log --all --full-history -- .env 2>/dev/null | grep -q .; then
    fail_ ".env aparece no histórico do git — rotacione o token no portal Discord"
  else
    pass ".env não aparece no histórico recente rastreável por path"
  fi
else
  warn_ "não é um repo git"
fi

# hardcodes de canal
if grep -rnE '1529584865249464390|1530334104334237939' src/ --include='*.js' 2>/dev/null | grep -v node_modules; then
  fail_ "ainda há IDs de canal hardcoded em src/"
else
  pass "sem IDs de canal hardcoded em src/"
fi

# console.log env
if grep -rn 'console.log(.*process\.env\|console.log(.*TOKEN\|console.log(.*token' src/ --include='*.js' 2>/dev/null | grep -v node_modules; then
  fail_ "possível log de secret em src/"
else
  pass "sem console.log óbvio de token/env"
fi

# docker-compose ports
if grep -E '^\s*-\s*["'\'']?[0-9]+:2333' docker-compose.yml 2>/dev/null; then
  warn_ "Lavalink pode estar publicado no host — prefira só rede interna Docker"
else
  pass "Lavalink não expõe 2333 no host (compose)"
fi

# backups dir
if [[ -d data/backups ]]; then
  pass "data/backups/ existe"
else
  warn_ "data/backups/ ainda não existe (é criado no primeiro start)"
fi

# DATA_BACKEND
if [[ -f .env ]] && grep -qE '^DATA_BACKEND=sqlite' .env; then
  if [[ -f data/morgana.db ]]; then
    pass "DATA_BACKEND=sqlite e data/morgana.db existe"
  else
    fail_ "DATA_BACKEND=sqlite mas data/morgana.db não existe — rode migrate-json-to-sqlite.js"
  fi
else
  pass "DATA_BACKEND=json (ou não definido)"
fi

# metrics
if [[ -d data/metrics ]]; then
  pass "data/metrics/ existe"
else
  warn_ "data/metrics/ ainda não existe (é criado no primeiro evento)"
fi

# .gitignore essentials
for pat in '.env' 'data/*' 'node_modules'; do
  if grep -qF "$pat" .gitignore 2>/dev/null; then
    pass ".gitignore contém $pat"
  else
    warn_ ".gitignore pode não cobrir $pat"
  fi
done

echo
echo "Resultado: $ok ok · $warn avisos · $fail falhas"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
