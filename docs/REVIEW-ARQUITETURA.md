# Morgana — Review de arquitetura + planos

**Data:** 2026-07-29  
**Escopo:** `src/systems/*` (~10k LOC), `database.json`, slash parcial, Docker/Lavalink  
**Objetivo:** review dos sistemas, migração SQLite, registry de comandos, métricas, checklist de segurança

---

## 1. Review dos sistemas

### 1.1 Mapa por domínio

| Domínio | Arquivos | LOC (aprox.) | Maturidade | Notas |
|---------|----------|--------------|------------|--------|
| Core / routing | `index.js` | 192 | Ok | Cadeia longa de `if (handleX) return` |
| Persistência | `database.js` | 169 | Frágil em escala | JSON síncrono, sem lock/atomic write |
| Tema | `theme.js` | 197 | Bom | Identidade coral consistente |
| Música | `music.js` | 635 | Bom | Lavalink; perms Connect/Speak |
| Padaria | `bakery.js` + `bakery-render.js` | ~1.5k | Forte (produto) | Idle + pixel-art; saves frequentes |
| Pokémon | `pokemon.js` + data/shop | ~2k | Forte (produto) | Canal exclusivo; maior módulo |
| Economia | `points`, `shop`, `economy-bridge`, `bets` | ~1.2k | Médio | Várias moedas; risco de race no JSON |
| Social | `xp`, `profile`, `rep`, `marriage`, `achievements`, `cosmetics` | ~1k | Bom | Perfil rico |
| Quests / eventos | `quests`, `guild-events` | ~460 | Bom | Engajamento de servidor |
| Mod / tickets | `moderation`, `tickets`, `modlogs`, `cleanup` | ~1.1k | Bom | Perms em vários pontos |
| Meta | `help`, `config`, `slash`, `utility`, `lore`, `starboard`, `welcome` | ~1.2k | Variável | Slash ainda “ponte” pro prefix |

### 1.2 O que está bem

1. **Separação por sistema** — legível; cada arquivo tem dono de domínio.
2. **Produto com cara de guild** — padaria + Pokémon + lore Hallownest não são copypaste genérico.
3. **Docker** — bot + Lavalink com healthcheck; `data/` montado em volume.
4. **`.env` fora do git** — `.gitignore` correto; `.env.example` existe.
5. **Canal gating** — Pokémon e padaria em canais dedicados reduz spam.
6. **Tema unificado** — embeds com identidade visual.

### 1.3 Riscos / cheiros

| Problema | Impacto | Onde |
|----------|---------|------|
| `writeFileSync` em todo `saveData` (~76 calls) | Trava event loop; crash mid-write corrompe JSON | `database.js` |
| Um objeto `data` global em memória | Race entre handlers async (economia/PvP) | `index.js` + todos |
| Dispatcher linear no `MessageCreate` | Ordem importa; difícil achar comando; perf O(n) handlers | `index.js` L145–175 |
| Prefix e slash **divergentes** | Slash muitas vezes só manda “use !comando” | `slash.js` |
| Módulos monólitos | `pokemon.js` 1.6k, `bakery.js` 1k — hard de testar | systems |
| Sem métricas | Não dá pra ver o que quebra ou o que a guild usa | — |
| Intent `MessageContent` | Obrigatório pro prefix; documentar no portal | intents |

### 1.4 Prioridade de melhoria (sistemas)

1. **Persistência** (SQLite) — base de tudo  
2. **Registry de comandos** — manutenibilidade  
3. **Métricas** — feedback operacional  
4. **Unificar slash ↔ prefix** — UX mobile  
5. **Quebrar pokemon/bakery/shop** — só depois de 1–2  

---

## 2. Migração para SQLite

### 2.1 Por quê

- Escrita atômica + transações (daily, loja, PvP, assar/servir)
- Queries (`top`, inventário, quests) sem carregar o JSON inteiro
- Backup = copiar um arquivo `.db`
- Menos risco de `database.json` pela metade

### 2.2 Stack sugerida (Node)

- **`better-sqlite3`** (síncrono, simples, bom em bot single-process)  
  **ou** `sql.js` se quiser zero native compile no Docker  
- Docker: rebuild imagem com build tools se usar `better-sqlite3`

Recomendação: **better-sqlite3** no Docker Alpine/Debian com `python3 make g++`.

### 2.3 Schema inicial (esboço)

```sql
-- guild
CREATE TABLE guild_config (
  guild_id TEXT PRIMARY KEY,
  json TEXT NOT NULL DEFAULT '{}'  -- campos de config flexíveis no começo
);

-- usuário por guild (economia + xp + stats)
CREATE TABLE user_profile (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  points   INTEGER NOT NULL DEFAULT 0,
  xp       INTEGER NOT NULL DEFAULT 0,
  level    INTEGER NOT NULL DEFAULT 1,
  rep      INTEGER NOT NULL DEFAULT 0,
  last_xp_at INTEGER NOT NULL DEFAULT 0,
  last_rep_at INTEGER NOT NULL DEFAULT 0,
  last_daily_at INTEGER NOT NULL DEFAULT 0,
  equipped_title TEXT,
  json_extra TEXT NOT NULL DEFAULT '{}', -- inventory, effects, minigames, stats, cosmetics…
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE marriage (
  guild_id TEXT NOT NULL,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  married_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_a, user_b)
);

CREATE TABLE warning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE ticket (
  guild_id TEXT NOT NULL,
  channel_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE bakery_state (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  json TEXT NOT NULL DEFAULT '{}', -- oven, recipes, upgrades, coins padaria
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE pokemon_state (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  json TEXT NOT NULL DEFAULT '{}', -- team, box, pokedex flags
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE quest_state (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (guild_id, user_id)
);

-- métricas (ver §4)
CREATE TABLE metrics_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  guild_id TEXT,
  user_id TEXT,
  kind TEXT NOT NULL,      -- command | error | music | oven
  name TEXT,               -- !play, bakery.assar, slash.ping
  ok INTEGER NOT NULL DEFAULT 1,
  ms INTEGER,
  detail TEXT
);

CREATE INDEX idx_metrics_ts ON metrics_event(ts);
CREATE INDEX idx_metrics_name ON metrics_event(name);
```

**Estratégia híbrida (fase 1):** colunas quentes (`points`, `xp`) + `json_extra` pro resto. Depois normaliza inventário se precisar.

### 2.4 Camada de acesso

Substituir gradualmente:

```js
// src/systems/db/index.js
// getUserData / saveUser / withTransaction
```

Manter **a mesma API** no começo:

```js
// database.js v2
function getUserData(guildId, userId) { /* SELECT */ }
function mutateUser(guildId, userId, fn) {
  const db = getDb();
  const tx = db.transaction(() => {
    const u = getUserData(guildId, userId);
    fn(u);
    upsertUser(u);
  });
  tx();
}
```

Handlers param de chamar `saveData(data)` global; usam `mutateUser` / `mutateBakery`.

### 2.5 Plano de migração (passos)

| Fase | Trabalho | Critério de pronto |
|------|----------|-------------------|
| **M0** | Backup automático de `database.json` a cada start + cron diário | Arquivo `.bak` existe |
| **M1** | `better-sqlite3` + schema + `migrateJsonToSqlite.js` | Script one-shot importa JSON → `.db` |
| **M2** | Adapter: `loadData` lê SQLite e monta objeto compatível (shim) | Bot sobe sem mudar handlers |
| **M3** | Novos writes só no SQLite; JSON vira export opcional | Zero `writeFileSync` no hot path |
| **M4** | Remover shim; APIs por domínio | Código limpo |
| **M5** | Testes de race: daily + gift + PvP em paralelo | Sem saldo negativo impossível |

**Script de import (ideia):**

```bash
node scripts/migrate-json-to-sqlite.js ./data/database.json ./data/morgana.db
```

**Rollback:** manter último `database.json.bak` por 30 dias; flag `DATA_BACKEND=json|sqlite` no `.env`.

### 2.6 Docker

```dockerfile
# build stage com python3 make g++ para better-sqlite3
# runtime: copiar node_modules nativos
```

Volume continua `./data` → grava `morgana.db` em vez de (só) JSON.

---

## 3. Registry de comandos

### 3.1 Problema atual

```js
// index.js — ordem fixa, cada sistema faz seu próprio parse
if (handlePokemonCommand(message, data)) return;
if (handleBakeryCommand(message, data)) return;
// ... 20+ linhas
```

Cada `handleX` re-parseia `message.content`, checa prefixo, etc.

### 3.2 Modelo alvo

```js
// src/commands/registry.js
const registry = {
  prefix: new Map(), // 'play' -> handler
  slash: new Map(),  // 'ping' -> handler
};

function register({ name, aliases = [], slash, execute, permission, guildOnly, channel }) {
  // ...
}

// src/commands/music/play.js
module.exports = {
  name: 'play',
  aliases: ['p'],
  slash: new SlashCommandBuilder().setName('play')...,
  async execute(ctx) { /* ctx.message | ctx.interaction */ }
};
```

**Dispatcher único:**

```js
client.on(MessageCreate, async (message) => {
  if (!message.content.startsWith(PREFIX)) {
    addXpFromMessage(...);
    return;
  }
  const { name, args } = parse(message);
  const cmd = registry.prefix.get(name);
  if (!cmd) return;
  await runWithMetrics(cmd, { message, args, data });
});
```

### 3.3 Benefícios

- Help gerado do registry (`!ajuda` / `/ajuda`)
- Slash e prefix **mesmo** `execute`
- Cooldown / permissão centralizados
- Métricas automáticas por `cmd.name`
- Testes unitários por comando

### 3.4 Migração incremental

1. Criar `registry.js` + `runCommand(ctx)`  
2. Migrar 3 comandos simples: `ping`, `lore`, `ajuda`  
3. Música (grupo `!play`…)  
4. Economia / padaria / pokémon por último (mais estado)  
5. Apagar cadeia de `if` no `index.js`  

**Não** reescrever tudo de uma vez.

### 3.5 Exemplo de API de contexto

```js
{
  client,
  guildId,
  userId,
  member,
  channel,
  reply(embedOrString),
  defer(),
  isSlash: boolean,
  args: string[],
  options: /* slash options helper */,
  db, // API SQLite
}
```

---

## 4. Métricas simples

### 4.1 O que medir (MVP)

| Métrica | Como |
|---------|------|
| Comandos/hora | `kind=command`, `name=!play` |
| Erros/hora | `kind=error`, `detail=stack curta` |
| Latência comando | `ms` no handler |
| Lavalink down | `kind=music`, `name=lavalink_error` |
| Forno notifica | `kind=oven` |

### 4.2 Implementação mínima

**A) Tabela `metrics_event` (SQLite)** — §2.3  

**B) Helper:**

```js
// src/systems/metrics.js
function track(db, { guildId, userId, kind, name, ok = true, ms, detail }) {
  db.prepare(
    `INSERT INTO metrics_event (ts, guild_id, user_id, kind, name, ok, ms, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(Date.now(), guildId ?? null, userId ?? null, kind, name, ok ? 1 : 0, ms ?? null, detail ?? null);
}
```

**C) Comando admin:**

```
!metrics          → top 10 comandos 24h, erros, ping médio
!metrics errors   → últimos 10 erros
```

**D) Log estruturado (opcional):**

```js
console.log(JSON.stringify({ t: Date.now(), kind, name, ms, ok }));
```

Docker: `docker compose logs -f bot` + grep.

### 4.3 Retenção

- Apagar eventos `> 14 dias` no start do bot (job simples)
- Não guardar conteúdo de mensagens (privacidade)

### 4.4 Dashboard (fase 2)

- Export CSV / endpoint local `127.0.0.1` só em dev  
- Ou Grafana + SQLite exporter — overkill no início  

---

## 5. Checklist de segurança

### 5.1 Segredos e acesso

| Item | Status atual | Ação |
|------|--------------|------|
| `DISCORD_TOKEN` no `.env` | Ok se não commitado | `git log -S DISCORD_TOKEN` e rotacionar se vazar |
| `.env` no `.gitignore` | Ok | Manter |
| `LAVALINK_PASSWORD` default `youshallnotpass` | Fraco se porta exposta | Trocar; **não publicar** 2333 na internet |
| Token em logs | — | Nunca `console.log(process.env)` |
| Repo público | `SrViego/Bot` | Auditar se `database.json` ou token já entraram no histórico |

### 5.2 Discord / permissões

| Item | Ação |
|------|------|
| Message Content Intent | Só se prefix for necessário; documentar |
| Hierarquia de cargos | Mod não age em quem tem cargo ≥ staff |
| `ManageChannels` tickets | Validar bot role acima dos canais criados |
| Slash ephemeral em erros | Evitar vazar stack pro canal |
| IDs de canal no código | Preferir só `.env` (`BAKERY_CHANNEL_ID` hardcoded como fallback — remover hardcode) |

### 5.3 Input e abuso

| Item | Ação |
|------|------|
| Args de usuário em embeds | Escapar / truncar (length limits) |
| URLs em `!play` | Já há parse; bloquear `file://`, IPs internos se houver fetch |
| Rate limit | Cooldown global por user no registry (anti-spam) |
| Economia | Transações SQLite; validar saldo **dentro** da tx |
| Upload / PNG padaria | Limitar tamanho; não executar dados de usuário |

### 5.4 Runtime / Docker

| Item | Ação |
|------|------|
| Rodar como non-root no container | `USER node` |
| Restart policy | Já `unless-stopped` |
| Healthcheck do bot | HTTP simples ou `discord` ready file |
| Volume `data/` permissões | uid fixo |
| Atualizar deps | `npm audit` periódico; discord.js/lavalink |
| Java/Lavalink | Não expor 2333 no host além de localhost se possível |

### 5.5 Dados da comunidade

| Item | Ação |
|------|------|
| Backup | Diário de `morgana.db` / JSON |
| LGPD / privacidade | Comando `!privacidade` + apagar dados do user a pedido |
| Logs de mod | Não expôr warns em canal público sem permissão |

### 5.6 Checklist rápido pré-deploy

- [ ] Token só no `.env` / secrets do host  
- [ ] `docker compose` sem publicar Lavalink na WAN  
- [ ] Intents mínimos no portal  
- [ ] Backup de `data/` antes de migrar SQLite  
- [ ] `npm audit` sem critical  
- [ ] Conta do bot **sem** admin desnecessário (princípio do menor privilégio)  
- [ ] 2FA na conta Discord do dono do bot  
- [ ] Revisar se `.env` nunca foi commitado  

---

## 6. Roadmap sugerido (ordem)

```
Semana 1:  ✅ M0 backup JSON + metrics JSONL + checklist segurança + !metrics
Semana 2:  ✅ M1–M2 SQLite + migrate-json-to-sqlite + DATA_BACKEND=json|sqlite
Semana 3:  ✅ Registry + ping/lore/ajuda/music (+ slash ping/lore/ajuda)
Semana 4:  ✅ UPSERT incremental + saveUser/mutateUser/saveDataSoon + métricas no SQLite
Depois:    migrar mais comandos pro registry; fatiar pokemon/bakery
```

### Semana 4 — writes SQLite

| API | Uso |
|-----|-----|
| `saveData(data)` | UPSERT completo + remove órfãos (sem `DELETE *` no início) |
| `saveUser(data, guildId, userId)` | grava 1 user (XP, etc.) |
| `mutateUser(data, g, u, fn)` | mutação + save atômico do user (`!daily`) |
| `saveDataSoon(data)` | debounce ~1.5s + flush no SIGINT/SIGTERM |
| métricas | JSONL + tabela `metrics_event` se `DATA_BACKEND=sqlite` |

Handlers legados ainda usam `saveData`; hot paths (daily, XP) já usam API pontual.

### Semana 3 — registry

```
src/commands/
  registry.js      # register / dispatchPrefix / dispatchSlash
  load.js          # carrega comandos + registra slash
  slash-legacy.js  # padaria/quest/perfil/evento (ainda)
  ping.js lore.js ajuda.js music.js
```

Prefixo: `!ping` `!lore` `!ajuda` `!play`/`!p`/…  
Slash: `/ping` `/lore` `/ajuda` (+ legacy)

### Semana 2 — como usar

```bash
# migrar (já pode ter sido feito)
node scripts/migrate-json-to-sqlite.js --force

# .env
DATA_BACKEND=sqlite

# rollback
DATA_BACKEND=json
# ou exportar de volta:
# node scripts/export-sqlite-to-json.js ./data/database.json
```

Arquivos: `src/systems/database-sqlite.js`, `database-json.js`, `database.js` (facade),  
`scripts/migrate-json-to-sqlite.js`, `scripts/export-sqlite-to-json.js`.

---

## 7. Critérios de sucesso

| Meta | Medida |
|------|--------|
| Zero corrupção de DB em 30 dias | Sem restore de backup por JSON quebrado |
| Onboarding de comando novo &lt; 15 min | 1 arquivo no registry |
| Visibilidade | `!metrics` mostra top comandos e erros |
| Segurança | Checklist §5.6 100% marcado |

---

## 8. Fora de escopo (agora)

- Rewrite em TypeScript  
- Sharding (desnecessário no tamanho atual)  
- Microserviços padaria/pokémon  
- Dashboard web completo  

---

*Documento gerado a partir do estado do código em 2026-07-29. Próximo passo de implementação: M0 + esqueleto SQLite + registry mínimo.*
