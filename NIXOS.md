# Isolde no NixOS

## Forma recomendada: Docker (sem Node/Java no sistema)

Precisa so do Docker (ja no teu NixOS) e de um `.env` com token valido.

```bash
cd ~/Documentos/HallownestBots/Isolde

# token no .env (obrigatorio)
# DISCORD_TOKEN=...

./scripts/docker-up.sh
# ou: docker compose up -d --build

docker compose logs -f bot
./scripts/docker-down.sh   # parar
```

Sobe **dois** containers: `isolde-lavalink` + `isolde-bot`.  
Dados em `./data`, config Lavalink em `./lavalink/`.

---

## O que já funciona neste PC

- **Node** do sistema (`node` v22+ / v24) — ok
- **npm** e `node_modules` — deps carregam
- **Lavalink.jar** + plugin YouTube em `lavalink/`
- Scripts em `scripts/`

## O que NÃO funciona (veio do outro sistema)

As pastas portáteis **não rodam no NixOS** (binários sem permissão/ELF de distro genérica):

- `nodejs/` — ignore; use o `node` do sistema
- `java/` — ignore; use `jre_headless` do Nix

Pode apagar `nodejs/` e `java/` para liberar espaço se quiser.

## O que falta configurar

### 1. Java (música / Lavalink)

No staging já entrou `jre_headless` em `modules/dev.nix`. Aplique:

```bash
bash ~/nixos-staging/APLICAR.sh
```

Sem rebuild, dá para testar assim:

```bash
nix-shell -p jre_headless --run './scripts/start-lavalink.sh'
```

### 2. Token do Discord (obrigatório)

O bot falhou com **TokenInvalid**. O valor no `.env` existe, mas o Discord não aceita
(token resetado, bot apagado, ou copiado errado).

1. https://discord.com/developers/applications
2. Seu bot → **Bot** → **Reset Token** / copiar token
3. Cole no `.env`:

```env
DISCORD_TOKEN=cole_o_token_novo_aqui
```

Intents no portal:

- Message Content Intent
- Server Members Intent

### 3. (Opcional) canais de welcome/goodbye

```env
WELCOME_CHANNEL_ID=...
GOODBYE_CHANNEL_ID=...
```

## Como rodar

```bash
cd ~/Documentos/HallownestBots/Isolde

# Terminal 1 — musica
./scripts/start-lavalink.sh

# Terminal 2 — bot
./scripts/start-bot.sh
```

Ou os dois juntos:

```bash
./scripts/start.sh
```

## Checklist rápido

| Item | Status neste notebook |
|------|------------------------|
| Node >= 22 | OK (sistema) |
| npm install / deps | OK |
| Java / Lavalink | falta `jre_headless` no PATH (rebuild) |
| DISCORD_TOKEN válido | **inválido agora** — regenerar |
| Plugin YouTube | OK (`lavalink/plugins/`) |
