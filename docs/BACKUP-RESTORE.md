# Backup e restore — Morgana

## O que é guardado

| Backend | Arquivo vivo | Backups |
|---------|--------------|---------|
| `DATA_BACKEND=json` | `data/database.json` | `data/backups/database-*.json` |
| `DATA_BACKEND=sqlite` | `data/morgana.db` | `data/backups/morgana-*.db` |

Também existem: métricas em `data/metrics/`, pokédex estática em `data/pokemon-*.json` (não é progresso de jogador).

No **Docker**, o volume `./data:/app/data` mantém tudo no host.

## Backup automático

O bot grava:

- **No start** — snapshot `*-start-*.db` / json  
- **Diário** — `*-daily-YYYY-MM-DD.*`  
- Retenção configurável (padrão ~14) via env / código de prune  

Não depende do Discord estar “calmo”: o start backup roda ao subir o container.

## Restore manual (SQLite)

1. Pare o bot:
   ```sh
   docker compose stop bot
   ```
2. Copie o backup por cima do DB atual (guarde o atual antes):
   ```sh
   cp data/morgana.db data/morgana.db.bak-manual
   cp data/backups/morgana-daily-AAAA-MM-DD.db data/morgana.db
   ```
3. Suba de novo:
   ```sh
   docker compose start bot
   ```

## Restore manual (JSON)

```sh
docker compose stop bot
cp data/database.json data/database.json.bak-manual
cp data/backups/database-daily-….json data/database.json
docker compose start bot
```

## Migrar JSON → SQLite

```sh
# com o bot parado (recomendado)
node scripts/migrate-json-to-sqlite.js
# no .env: DATA_BACKEND=sqlite
```

Exportar SQLite → JSON: `node scripts/export-sqlite-to-json.js`.

## Checklist se “sumiu progresso”

1. `docker compose ps` — bot up?  
2. `ls -lt data/backups | head` — há backup recente?  
3. O volume `./data` ainda é o mesmo path do host?  
4. Restore a partir do `*-daily-*` do dia anterior.  
5. `!metrics errors` (staff) se o bot estiver online.

## Alertas

`!config alerta #canal` — avisa se o **Lavalink** cair (música).  
Isso **não** substitui backup de dados.
