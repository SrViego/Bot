# Checklist de segurança — Morgana

Rode o script (automático):

```bash
./scripts/security-check.sh
```

## Manual (marque na operação)

### Segredos
- [ ] `DISCORD_TOKEN` só no `.env` / secret do host
- [ ] Token **nunca** colado em issue/Discord/print
- [ ] Se o token vazou: [Portal Discord](https://discord.com/developers/applications) → Reset Token
- [ ] `LAVALINK_PASSWORD` forte (obrigatório; o Lavalink lê a mesma via `LAVALINK_SERVER_PASSWORD`, sem default no código)

### Discord
- [ ] Intents: Message Content, Server Members (só o necessário)
- [ ] Cargo do bot **sem** Administrator se não precisar
- [ ] Hierarquia: bot abaixo da staff, acima dos canais de ticket

### Deploy
- [ ] `docker compose` sem publicar `2333` na WAN
- [ ] Volume `./data` com backup (pasta `data/backups/` no start)
- [ ] Container reinicia com `unless-stopped`
- [ ] Usuário non-root na imagem do bot (`node`)

### Dados
- [ ] `data/backups/` com cópias recentes
- [ ] `data/metrics/` sem conteúdo de mensagens (só nomes de comando)
- [ ] `.env`, `morgana.db*` e `database.json` fora do git

### Operação
- [ ] Staff usa `!metrics` / `!metrics errors` após incidentes
- [ ] `npm audit` de vez em quando
- [ ] 2FA na conta dona do bot / do servidor

## Comandos úteis

```bash
# backup manual (online, pode ser com o bot ligado)
docker compose exec bot node scripts/backup-db.js manual   # ou: node scripts/backup-db.js manual

# ver métricas do dia
tail -n 20 data/metrics/*.jsonl
```
