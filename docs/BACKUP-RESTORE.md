# Backup e restore — Morgana

## O que é guardado

| Arquivo vivo | Backups |
|--------------|---------|
| `data/morgana.db` (+ `-wal`/`-shm` com WAL) | `data/backups/morgana-*.db` |

O SQLite é o **único** backend. O antigo `data/database.json` só é lido **uma vez**:
no primeiro start sem dados no SQLite ele é importado automaticamente, copiado para
`data/backups/database-premigration-*.json` e **mantido** no lugar (nunca é apagado).

Também existem: métricas em `data/metrics/` e pokédex estática em `data/pokemon-*.json`
(não é progresso de jogador).

No **Docker**, o volume `./data:/app/data` mantém tudo no host. Nada disso vai pro git
(`data/*` está no `.gitignore`).

> ⚠️ Não copie só `morgana.db` com o bot ligado: com WAL, dados recentes ficam no
> `-wal`. Use o backup online abaixo (ou pare o bot antes de copiar).

## Backup automático

Usa a **API de backup online do SQLite** (`better-sqlite3 .backup()`), consistente
mesmo com o bot rodando:

- **No start** — `morgana-start-*.db`
- **Diário** — `morgana-daily-YYYY-MM-DD.db` (checado a cada 6h)
- Retenção: `DATA_BACKUP_KEEP` (padrão 14) — os `database-premigration-*.json` **não** são apagados

## Backup manual

```sh
# com o bot rodando (Docker)
docker compose exec bot node scripts/backup-db.js manual
# local
node scripts/backup-db.js manual
```

`./scripts/docker-up.sh` já faz um backup `pre-deploy` se o bot estiver rodando.

## Restore (SQLite)

1. Pare o bot: `docker compose stop bot`
2. Guarde o atual e restaure:
   ```sh
   mkdir -p data/restore-old && mv data/morgana.db* data/restore-old/
   cp data/backups/morgana-daily-AAAA-MM-DD.db data/morgana.db
   ```
3. Suba: `docker compose start bot`

## Migração JSON → SQLite

Automática no primeiro start. Para rodar na mão (bot parado):

```sh
node scripts/migrate-json-to-sqlite.js            # idempotente: não reimporta
node scripts/migrate-json-to-sqlite.js --force    # reimporta (faz backup do .db antes)
```

Se o `database.json` estiver corrompido, o bot **não sobe** (para não criar um banco
vazio por cima). Restaure um `data/backups/database-*.json` válido e tente de novo.

## Rollback para a versão antiga (JSON)

```sh
docker compose stop bot
node scripts/export-sqlite-to-json.js data/database.json   # salva o JSON existente como .bak-*
git checkout <commit-anterior>   # versão que ainda tinha DATA_BACKEND=json
# no .env: DATA_BACKEND=json
docker compose up -d --build
```

## Checklist se “sumiu progresso”

1. `docker compose ps` — bot up?
2. `ls -lt data/backups | head` — há backup recente?
3. O volume `./data` ainda é o mesmo path do host?
4. Restore a partir do `morgana-daily-*` do dia anterior.
5. `!metrics errors` (staff) se o bot estiver online.

## Alertas

`!config alerta #canal` — avisa se o **Lavalink** cair (música).
Isso **não** substitui backup de dados.
