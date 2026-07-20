# Isolde Bot

Bot de Discord em Node.js (`discord.js`), com música via Lavalink, economia, loja, XP, sistemas sociais, moderação, configurações por servidor e embeds verdes.

Repositório: [SrViego/Isolde-bot](https://github.com/SrViego/Isolde-bot)

---

## Segurança (importante)

**Nunca** coloque no Git / GitHub:

| Arquivo | Motivo |
|---------|--------|
| `.env` | Token do bot e IDs sensíveis |
| `data/` | XP, pontos, avisos, inventário do servidor |
| `node_modules/` | Dependências (instala com npm) |
| `lavalink/*.jar` e `plugins/*.jar` | Binários grandes / locais |
| Pastas `nodejs/` e `java/` | Runtime portátil de outro SO |

O que **pode** ir pro Git: código em `src/`, `package.json`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `lavalink/application.yml` (senha padrão de exemplo).

Se o token vazar: [Discord Developer Portal](https://discord.com/developers/applications) → Bot → **Reset Token**.

---

## Requisitos no Discord

No [Developer Portal](https://discord.com/developers/applications), ative:

```txt
Message Content Intent
Server Members Intent
```

Permissões úteis no servidor: Ver canal, Conectar, Falar, Banir/Expulsar/Moderar membros, Gerenciar mensagens/canais (conforme os comandos que for usar).

---

## Forma recomendada: Docker

Não precisa instalar Node nem Java no sistema. Só **Docker** + arquivo `.env`.

### 1. Clone e configure

```sh
git clone https://github.com/SrViego/Isolde-bot.git
cd Isolde-bot

cp .env.example .env
# edite .env e coloque o DISCORD_TOKEN real
```

### 2. Plugin YouTube do Lavalink (música)

O compose usa a imagem oficial do Lavalink e a pasta `lavalink/plugins/`.  
Coloque o JAR do plugin (ex.: `youtube-plugin-….jar`) em:

```txt
lavalink/plugins/
```

A config está em `lavalink/application.yml` (senha padrão: `youshallnotpass`, igual ao `.env.example`).

### 3. Subir

```sh
./scripts/docker-up.sh
# ou:
docker compose up -d --build
```

### 4. Logs e parar

```sh
docker compose logs -f bot
docker compose logs -f lavalink

./scripts/docker-down.sh
# ou: docker compose down
```

O Compose força `LAVALINK_HOST=lavalink` (rede interna). O valor `127.0.0.1` no `.env` só vale fora do Docker.

---

## Forma alternativa: Node local (+ Lavalink separado)

### Requisitos

- Node.js **22.12+** e npm  
- Java (só se for rodar o Lavalink na máquina, sem Docker)

### Passos

```sh
npm install
cp .env.example .env
# preencha DISCORD_TOKEN

# Terminal 1 — música (Java + lavalink/Lavalink.jar local, se tiver)
./scripts/start-lavalink.sh

# Terminal 2 — bot
./scripts/start-bot.sh
```

Ou só o bot (sem música):

```sh
npm start
```

Desenvolvimento com reload:

```sh
npm run dev
```

### NixOS

Veja [NIXOS.md](./NIXOS.md). Resumo: use **Docker**, ou `nix-shell -p nodejs_22 jre_headless` se for rodar nativo. Binários em `nodejs/` e `java/` de outro Linux **não** funcionam bem no NixOS.

---

## Variáveis de ambiente (`.env`)

Copie de `.env.example`:

```env
DISCORD_TOKEN=seu_token_aqui
WELCOME_CHANNEL_ID=          # opcional
GOODBYE_CHANNEL_ID=          # opcional

LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_SEARCH_SOURCE=ytmsearch
LAVALINK_DEFAULT_VOLUME=80
```

---

## Como versionar no Git (commit e push)

```sh
cd ~/Documentos/HallownestBots/Isolde   # ou a pasta do clone

git status
git add -A
# confira que .env NÃO aparece:
git status

git commit -m "Descreva a mudança"
git push origin teste    # ou main, conforme a branch
```

Antes do push, confira:

```sh
git status
# não deve listar .env nem data/
```

Branch atual do repositório remoto costuma ser `teste` (veja com `git branch -vv`).

---

## Dados locais

Ficam em `data/database.json` (fora do Git): XP, pontos, reputação, avisos, casamentos, inventário, conquistas, configs e logs.

---

## Visual

Embeds verdes — cor em `src/systems/theme.js` (`0x2ecc71`).

---

## Comandos

### Básicos

```txt
!ping
!help
!ajuda
```

### Música

```txt
!play nome_ou_link
!p nome_ou_link
!queue / !fila
!np / !tocando
!pause
!resume / !continuar
!skip
!stop
!volume
!volume 1-100
```

### Perfil, XP e conquistas

```txt
!perfil / !profile [@usuario]
!xp / !level [@usuario]
!rankxp
!conquistas / !achievements [@usuario]
```

XP sobe ao conversar (cooldown de 60s por usuário).

### Pontos e daily

```txt
!daily
!pontos [@usuario]
!rankpontos
```

### Loja

```txt
!loja / !shop [categoria]
!item id
!comprar / !buy id
!vender / !sell id
!presentear / !gift @usuario id
!inventario / !inv [@usuario]
!usar id
```

Categorias: `consumivel`, `colecionavel`, `raro`, `utilidade`.

### Minigames

```txt
!coinflip cara|coroa aposta
!moeda …
!guess / !adivinhar 1-5 aposta
!minigames [@usuario]
```

### Reputação e casamento

```txt
!rep @usuario
!rankrep / !reps
!casar @usuario
!aceitarcasamento / !recusarcasamento
!divorciar
!casamento [@usuario]
```

### Utilidade

```txt
!avatar [@usuario]
!userinfo [@usuario]
!serverinfo
!say mensagem
```

### Configurações (Gerenciar Servidor)

```txt
!config / !painel
!config logs #canal | off
!config autorole @cargo | off
!config welcome on|off
!config goodbye on|off
```

### Moderação

```txt
!ban @usuario motivo
!unban id
!kick @usuario motivo
!timeout @usuario 10m motivo
!untimeout @usuario
!warn @usuario motivo
!warnings [@usuario]
!clearwarns @usuario
!clear quantidade
!slowmode segundos
!lock / !unlock
!modlogs
```

---

## Estrutura do projeto

```txt
Isolde/
  src/                 # código do bot
  scripts/             # start local e docker-up/down
  lavalink/            # application.yml (+ jars locais, ignorados no git)
  data/                # runtime (gitignored)
  Dockerfile
  docker-compose.yml
  .env.example         # modelo sem segredos
  .env                 # SEUS segredos (gitignored)
```
