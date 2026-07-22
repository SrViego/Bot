# Isolde Bot

Bot de Discord em **Node.js** (`discord.js`) para a comunidade Hallownest.

### O que tem

| Sistema | Descrição |
|---------|-----------|
| 🎵 Música | Lavalink + YouTube (`!play`, fila, volume…) |
| 💰 Economia | Pontos, daily, loja de Dirtmouth, inventário, efeitos |
| ⭐ XP / perfil | Níveis, conquistas, reputação, casamento, minigames |
| 🛡️ Moderação | Ban, kick, timeout, warns, clear, logs |
| 🌿 Welcome | Boas-vindas e despedida com **menção** + **GIF** |
| 📕 Pokémon | Pokédex (~1025 spp.), captura, loja 🪙, time e **PvP** (canal exclusivo) |

Repo: [SrViego/Isolde-bot](https://github.com/SrViego/Isolde-bot)

---

## Começar do zero (recomendado: Docker)

Não precisa instalar Node nem Java no sistema.

### 1. Clonar

```sh
git clone https://github.com/SrViego/Isolde-bot.git
cd Isolde-bot
```

### 2. Arquivo `.env`

```sh
cp .env.example .env
```

Edite o `.env` (obrigatório o token):

```env
DISCORD_TOKEN=cole_o_token_do_bot_aqui

# Opcional — canais de boas-vindas / despedida
WELCOME_CHANNEL_ID=
GOODBYE_CHANNEL_ID=
# WELCOME_GIF_URL=https://...
# GOODBYE_GIF_URL=https://...

# Lavalink (música)
# No Docker o compose usa o host interno "lavalink" automaticamente
LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_SEARCH_SOURCE=ytsearch
LAVALINK_SEARCH_FALLBACKS=ytsearch,ytmsearch,scsearch
LAVALINK_DEFAULT_VOLUME=80

# Canal onde os comandos Pokémon funcionam
POKEMON_CHANNEL_ID=1529584865249464390
```

### 3. Discord Developer Portal

1. Abra [Discord Applications](https://discord.com/developers/applications)
2. Seu app → **Bot**
3. Ative:
   - **Message Content Intent**
   - **Server Members Intent**
4. Copie o token para o `.env`
5. Convide o bot com permissões de:
   - Enviar mensagens / embeds
   - Conectar e falar (música)
   - Moderação (se for usar ban/kick/etc.)

### 4. Subir com Docker

```sh
./scripts/docker-up.sh
# ou:
docker compose up -d --build
```

Sobe dois containers:

- `isolde-lavalink` — áudio / YouTube  
- `isolde-bot` — o bot  

### 5. Logs e parar

```sh
docker compose logs -f bot
docker compose logs -f lavalink

./scripts/docker-down.sh
# ou: docker compose down
```

### 6. Depois de mudar o código

```sh
docker compose up -d --build
```

---

## Alternativa: Node no PC (sem Docker do bot)

### Requisitos

- **Node.js 22.12+** e npm  
- **Java** só se for rodar o Lavalink localmente  

> **NixOS / Linux “portátil”:** as pastas `nodejs/` e `java/` que às vezes vêm no PC **não** devem ser commitadas e **não** rodam bem no NixOS. Use Docker ou Node/Java do sistema.

```sh
npm install
cp .env.example .env
# preencha DISCORD_TOKEN

# Terminal 1 (música, opcional)
./scripts/start-lavalink.sh

# Terminal 2
./scripts/start-bot.sh
# ou: npm start
```

---

## O que fica no PC e o que vai pro GitHub

| Item | No teu PC | No GitHub |
|------|-----------|-----------|
| Código (`src/`) | ✅ | ✅ |
| `Dockerfile` / `docker-compose.yml` | ✅ | ✅ |
| `data/pokemon-data.json` (Pokédex) | ✅ | ✅ |
| `.env` (token) | ✅ | ❌ |
| `data/database.json` (progresso dos players) | ✅ | ❌ |
| `nodejs/`, `java/`, jars do Lavalink | ✅ (se existirem) | ❌ |
| `node_modules/` | ✅ após `npm install` | ❌ |

**Resumo:** coisas grandes e segredos **continuam no seu computador**; só não sobem no Git (limite de 100 MB e segurança).

---

## Estrutura do projeto

```txt
Isolde/
  src/
    index.js
    systems/           # módulos do bot
  data/
    database.json      # runtime (local)
    pokemon-data.json  # Pokédex (no Git)
  lavalink/
    application.yml
  scripts/
  Dockerfile
  docker-compose.yml
  .env.example
  .env                 # local
  README.md
```

---

## Comandos

### Ajuda (paginada)

```txt
!ajuda
!help
!ajuda 3
```

5 páginas com botões **Anterior / Próxima**.

---

### Utilidade e social

| Comando | Função |
|---------|--------|
| `!ping` | Latência |
| `!perfil [@user]` | Perfil (XP, pontos, título, inventário) |
| `!conquistas [@user]` | Conquistas |
| `!rep @user` | Dar reputação |
| `!rankrep` | Ranking de rep |
| `!casar @user` / `!casamento` | Sistema de casamento |
| `!avatar` `!userinfo` `!serverinfo` | Infos |
| `!say texto` | Fala como o bot (apaga o comando) |

---

### Economia (pontos do servidor)

| Comando | Função |
|---------|--------|
| `!daily` | Pontos diários (+ streak) |
| `!pontos [@user]` | Saldo |
| `!rankpontos` | Ranking |
| `!loja [categoria]` | Loja de Dirtmouth |
| `!item id` | Detalhe do item |
| `!comprar id [qtd]` / `!vender id [qtd]` | Compra / venda |
| `!inventario` `!usar id` | Inventário e uso |
| `!presentear @user id` | Presente |
| `!efeitos` | Buffs ativos (XP, daily…) |
| `!coinflip` / `!guess` | Minigames |

Categorias da loja: `consumivel`, `colecionavel`, `raro`, `utilidade`, `titulo`.

---

### Música

| Comando | Função |
|---------|--------|
| `!play` / `!p` | Tocar ou enfileirar (nome ou link) |
| `!skip` `!stop` | Pular / parar e sair |
| `!queue` / `!fila` | Fila |
| `!pause` `!resume` | Pausar / continuar |
| `!np` | Agora tocando |
| `!volume 1-100` | Volume |

**Dica:** se uma faixa for **pulada**, o YouTube costuma ter bloqueado o stream (região, idade, live). Tente `!play nome da música artista` em vez do link.

---

### Config e moderação (staff)

| Comando | Função |
|---------|--------|
| `!config` / `!painel` | Painel |
| `!config logs #canal \| off` | Canal de logs |
| `!config autorole @cargo \| off` | Auto cargo |
| `!config welcome on\|off` | Boas-vindas |
| `!config goodbye on\|off` | Despedidas |
| `!ban` `!kick` `!timeout` `!warn` | Moderação |
| `!clear` `!lock` `!unlock` `!modlogs` | Utilitários staff |

---

### Pokémon (só no canal do `POKEMON_CHANNEL_ID`)

Moeda **separada**: 🪙 **pokécoins** (não usa a loja de pontos).

| Comando | Função |
|---------|--------|
| `!phelp` | Ajuda Pokémon |
| `!pstart [id]` | Escolher inicial |
| `!pwild` | Encontro selvagem |
| `!pcatch [ball]` | Capturar (`pokeball`, `greatball`…) |
| `!pdex nome\|número` | Pokédex (~1025 espécies) |
| `!pteam` | Ver time (⭐ = principal) |
| `!pmain N` / `!plider N` | **Trocar o Pokémon principal** (líder) |
| `!pmon` | Detalhes do principal (stats + golpes) |
| `!pbox [página]` | Caixa |
| `!padd #` / `!premove #` | Caixa ↔ time |
| `!pswap A B` | Trocar posições no time |
| `!ploja` / `!pbuy id` | Loja Pokémon |
| `!pbag` / `!puse id` | Mochila / usar item |
| `!pdaily` | Daily de coins + balls |
| `!pstatus` | Resumo (coins, capturas, PvP) |
| `!pbattle @user` | Desafiar PvP |
| `!paccept` / `!pdeny` | Aceitar / recusar |
| `!pmove 1-4` | Atacar no duelo |
| `!pforfeit` | Desistir |

#### Pokémon principal (líder)

O **slot 1 (⭐)** é o principal: luta no PvP, recebe XP de captura e usa itens de cura/boost.

```txt
!pteam              # ver o time
!pmain 2            # torna o #2 o principal
!plider 3           # igual
!pmon               # ficha do líder
```

---

## Git (contribuir / enviar mudanças)

```sh
git status
# NÃO deve aparecer: .env, data/database.json, nodejs/, java/, *.jar

git add -A
git commit -m "descreva a mudança"
git push origin main
```

Login no GitHub: `gh auth login` (ou SSH / Personal Access Token).

**Não commite** pastas `nodejs/` ou `java/` — o GitHub rejeita arquivos &gt; 100 MB.

---

## NixOS

Prefira **Docker**. Detalhes extras: [NIXOS.md](./NIXOS.md).

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| `TokenInvalid` | Token inválido → reset no Portal → atualize `.env` → `docker compose up -d --force-recreate bot` |
| Música pula faixas | Bloqueio do YouTube; tente nome+artista; veja `docker logs isolde-lavalink` |
| Pokémon não responde | Só no canal do `POKEMON_CHANNEL_ID` |
| Push com “Large files” | Remova `nodejs/`, `java/`, jars do commit (já no `.gitignore`) |
| Bot sobe antes do Lavalink | O compose espera o healthcheck; se falhar: `docker compose restart bot` |

---

## Créditos

- Hallownest Bots · Isolde  
- Sprites / artwork via [PokeAPI](https://pokeapi.co/)  
- Áudio: [Lavalink](https://github.com/lavalink-devs/Lavalink) + [youtube-source](https://github.com/lavalink-devs/youtube-source)
