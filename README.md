# Isolde Bot

Bot de Discord em **Node.js** (`discord.js`) com:

- Música (Lavalink + YouTube)
- Economia, loja, XP, social, minigames e moderação
- Boas-vindas / despedida com menção e GIF
- **Pokémon** (Pokédex nacional ~1025 spp., loja 🪙, captura e PvP em **canal exclusivo**)

Repo: [SrViego/Isolde-bot](https://github.com/SrViego/Isolde-bot)

---

## O que NÃO vai no Git (fica só no teu PC)

| Pasta / arquivo | Por quê |
|-----------------|---------|
| `.env` | Token e segredos |
| `data/database.json` | Dados dos usuários (XP, inventário, times…) |
| `nodejs/` e `java/` | Binários portáteis grandes (não use no NixOS) |
| `lavalink/*.jar` e plugins `.jar` | Binários grandes; Docker baixa o Lavalink |
| `node_modules/` | Instala com `npm install` |

**Sim:** esses arquivos podem continuar no teu computador. Só **não são enviados** ao GitHub (`.gitignore`).

---

## Estrutura

```txt
Isolde/
  src/                 # código do bot
    systems/           # loja, XP, pokemon.js, help.js, music.js…
  data/
    database.json      # runtime (local, não versionado)
    pokemon-data.json  # Pokédex (versionada no Git)
  lavalink/
    application.yml    # config (no Git)
    Lavalink.jar       # só se rodar Lavalink local (não no Git)
    plugins/           # jar do YouTube local (opcional; não no Git)
  scripts/             # docker-up, start-bot…
  Dockerfile
  docker-compose.yml
  .env.example         # modelo
  .env                 # teus segredos (local)
```

---

## Forma recomendada: Docker

Não precisa instalar Node/Java no sistema. Só **Docker**.

### 1. Clonar e configurar

```sh
git clone https://github.com/SrViego/Isolde-bot.git
cd Isolde-bot

cp .env.example .env
```

Edite o `.env`:

```env
DISCORD_TOKEN=cole_o_token_do_bot

# opcional
WELCOME_CHANNEL_ID=
GOODBYE_CHANNEL_ID=
WELCOME_GIF_URL=
GOODBYE_GIF_URL=

# Lavalink (no Docker o compose força host=lavalink)
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

### 2. Discord Developer Portal

1. [applications](https://discord.com/developers/applications) → seu bot  
2. **Bot** → ative:
   - **Message Content Intent**
   - **Server Members Intent**
3. Convide o bot com permissões de mensagens, voz (conectar/falar) e as de moderação que for usar.

### 3. Subir

```sh
./scripts/docker-up.sh
# ou:
docker compose up -d --build
```

Isso sobe:
- `isolde-lavalink` — servidor de áudio  
- `isolde-bot` — o bot  

### 4. Logs e parar

```sh
docker compose logs -f bot
docker compose logs -f lavalink

./scripts/docker-down.sh
# ou: docker compose down
```

### 5. Atualizar o bot depois de mudar código

```sh
docker compose up -d --build
```

---

## Alternativa: Node no PC (sem Docker do bot)

### Requisitos
- Node.js **22.12+** e npm  
- Java (só se for rodar Lavalink na máquina)  
- **Não** use as pastas `nodejs/` e `java/` portáteis no NixOS — não funcionam bem.

```sh
npm install
cp .env.example .env
# preencha o token

# Terminal 1 — música (opcional)
./scripts/start-lavalink.sh

# Terminal 2 — bot
./scripts/start-bot.sh
# ou: npm start
```

---

## Comandos principais

### Ajuda (paginada)
```txt
!ajuda
!help
!ajuda 3
```
Botões **Anterior / Próxima** (5 páginas).

### Utilidade & social
`!ping` `!perfil` `!conquistas` `!rep` `!casar` `!avatar` `!userinfo` `!serverinfo` `!say`

### Economia (pontos do servidor)
`!daily` `!pontos` `!loja` `!item` `!comprar` `!vender` `!inventario` `!usar` `!efeitos` `!rankpontos`

### Música
`!play` / `!p` · `!skip` · `!stop` · `!queue` · `!pause` · `!resume` · `!np` · `!volume`

Se alguma faixa for **pulada**, o YouTube bloqueou o stream (idade/região/DRM). Tente nome+artista em vez de link, ou outra fonte.

### Config / moderação (staff)
`!config` · `!ban` `!kick` `!timeout` `!warn` `!clear` `!modlogs`

### Pokémon (só no canal do `POKEMON_CHANNEL_ID`)
| Comando | O que faz |
|---------|-----------|
| `!phelp` | Ajuda Pokémon |
| `!pstart` | Escolher inicial |
| `!pwild` | Encontro selvagem |
| `!pcatch [ball]` | Capturar |
| `!pdex nome\|nº` | Pokédex |
| `!pteam` / `!pbox` | Time e caixa |
| `!ploja` / `!pbuy` | Loja em **pokécoins** 🪙 |
| `!pbag` / `!puse` | Mochila / itens |
| `!pbattle @user` | PvP |
| `!paccept` / `!pmove 1-4` | Aceitar / atacar |
| `!pdaily` | Daily de coins |

A loja Pokémon (**🪙**) é **separada** da loja de pontos (`!loja`).

---

## Git (para quem contribui)

```sh
git status
# NÃO deve listar: .env, data/database.json, nodejs/, java/, *.jar

git add -A
git commit -m "sua mensagem"
git push origin main
```

Precisa estar logado (`gh auth login` ou token SSH/HTTPS).

Arquivos grandes (`nodejs/`, `java/`, jars) **não devem** ir pro Git (limite do GitHub: 100 MB).

---

## NixOS

Use **Docker** (recomendado). Detalhes: [NIXOS.md](./NIXOS.md).

---

## Problemas comuns

| Problema | O que fazer |
|----------|-------------|
| `TokenInvalid` | Token errado/resetado → novo token no `.env` e `docker compose up -d --force-recreate bot` |
| Música não toca / pula faixa | YouTube bloqueou; tente `!play nome artista`. Confira logs: `docker logs isolde-lavalink` |
| Comandos Pokémon não respondem | Só no canal do `POKEMON_CHANNEL_ID` |
| Push rejeitado por arquivo grande | Não commite `nodejs/`, `java/`, jars |

---

## Licença / créditos

Projeto pessoal · Hallownest Bots · Isolde  
Sprites Pokémon via [PokeAPI](https://pokeapi.co/) (URLs oficiais de artwork).
