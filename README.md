# Morgana Bot

Bot de Discord em **Node.js** (`discord.js`) para a comunidade Hallownest.  
Tema visual dos embeds: **vermelho coral** (`#E7644D` / `#F79F5B`).

### O que tem

| Sistema | Descrição |
|---------|-----------|
| 🎵 Música | Lavalink + YouTube (`!play`, fila, volume…) |
| 💰 Economia | Pontos, daily, loja de Dirtmouth, inventário, efeitos |
| ⭐ XP / perfil | Níveis, conquistas, reputação, casamento, minigames |
| 🛡️ Moderação | Ban, kick, timeout, warns, clear, logs |
| 🧹 Limpeza | `!limpeza` — canal, msgs da bot, efeitos expirados |
| 🎫 Tickets | Pedir ajuda → canal privado com a staff |
| 🥖 Padaria | Idle assar → servir (estilo bake.gg, arte própria) + **pixel-art** |
| 🔥 Welcome | Boas-vindas e despedida com **menção** + **GIF** |
| 📕 Pokémon | Pokédex (~1025 spp.), captura, loja 🪙, time e **PvP** (canal exclusivo) |

| 📋 Quests | Diárias/semanais com recompensas mistas |
| 💱 Câmbio | Pontos ↔ padaria ↔ poke (taxa 45%) |
| ✨ Cosméticos | Títulos, molduras e badges no perfil |
| 🎪 Eventos | Happy Hour, festival padaria, raid, chefe |
| ⭐ Starboard | Destaques por reação |
| 📜 Lore | Citações Hallownest |


Repo: [SrViego/Bot](https://github.com/SrViego/Bot)

Arquitetura / SQLite / segurança / registry / métricas:  
→ [`docs/REVIEW-ARQUITETURA.md`](docs/REVIEW-ARQUITETURA.md)  
Roadmap (3 sprints): [`docs/ROADMAP.md`](docs/ROADMAP.md)  
Segurança: [`docs/SECURITY-CHECKLIST.md`](docs/SECURITY-CHECKLIST.md) · `./scripts/security-check.sh`  
Métricas (staff): `!metrics` · `!metrics errors`  
DB: `DATA_BACKEND=json|sqlite` · migrar: `node scripts/migrate-json-to-sqlite.js`  
Chegada: `!inicio` / `/inicio` — trilho da 1ª semana  
Economia: `!economia` · `!ofrenda` · `!ranking` · `!config ranking #canal`  

Comandos (registry): `src/commands/` — `!ping` `!lore` `!ajuda` `!play`…  
SQLite: `saveUser` / `mutateUser` / `saveDataSoon` (semana 4)

---

## Começar do zero (recomendado: Docker)

Não precisa instalar Node nem Java no sistema.

### 1. Clonar

```sh
git clone https://github.com/SrViego/Bot.git
cd Bot
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
   - Enviar mensagens / embeds / anexos (padaria pixel-art)
   - Conectar e falar (música)
   - Moderação (ban/kick/etc.)
   - **Gerenciar canais** (tickets de ajuda)
   - **Gerenciar mensagens** (`!limpeza` / `!clear`)

### 4. Subir com Docker

```sh
./scripts/docker-up.sh
# ou:
docker compose up -d --build
```

Isso também builda o **Lavalink com o plugin YouTube embutido** (`Dockerfile.lavalink`), evitando erro de permissão ao baixar o plugin.

Sobe dois containers:

- `morgana-lavalink` — áudio / YouTube  
- `morgana-bot` — o bot  

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
| `assets/bakery/` (pixel-art) | ✅ | ✅ |
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
Morgana/
  src/
    index.js
    systems/              # módulos do bot
      bakery.js           # padaria idle
      bakery-render.js    # pixel-art PNG
      tickets.js          # canais de ajuda
      cleanup.js          # limpeza
      theme.js            # embeds (vermelho)
      ...
  assets/
    bakery/               # sprites PNG da padaria
      bg.png, oven_*.png, items/, README.md
  data/
    database.json         # runtime (local)
    pokemon-data.json     # Pokédex (no Git)
  lavalink/
    application.yml
  scripts/
  Dockerfile
  docker-compose.yml
  .env.example
  .env                    # local
  README.md
```

---

## Comandos

### Ajuda (paginada)

```txt
!ajuda
!help
!ajuda 3
!ajuda padaria
```

**6 páginas** com botões **Anterior / Próxima** (Geral, Economia, Padaria, Música, Config, Pokémon).

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

#### Minigames

| Comando | Função |
|---------|--------|
| `!coinflip cara\|coroa <aposta>` | Cara ou coroa (odds 1:1) |
| `!coinflip <aposta> cara` | Ordem flexível |
| `!coinflip h 50` / `all` | Aliases `h/t`, `heads/tails`, aposta `all`/`tudo` |
| `!guess 1-5 <aposta>` | Adivinhe (prêmio 4×) |
| `!minigames [@user]` | Placar de vitórias/derrotas |

Categorias da loja: `consumivel`, `colecionavel`, `raro`, `utilidade`, `titulo`.

---

### 🥖 Padaria (idle + pixel-art)

Moeda **separada** das 🪙 pokécoins e dos pontos do servidor.

Loop: **assar → esperar → servir → XP/nível → mais fornos**.

| Comando | Função |
|---------|--------|
| `!padaria` | Status + **imagem pixel-art** (só no canal da padaria) |
| `!assar [receita]` | Usa um forno livre (`pao`, `croissant`…) |
| `!servir` | Vende o que ficou pronto |
| `!receitas` | Lista desbloqueadas / bloqueadas |
| `!forno` | Compra forno extra (moedas da padaria) |
| `!upgrade` | Loja de melhorias (gasta 🪙 da padaria) |
| `!upgrade <id>` | Compra: `speed` `profit` `mastery` `luck` `charm` |
| `!rankpadaria` | Ranking do servidor |
| `!padariahelp` / `!ajuda padaria` | Guia rápido |

**Canal:** só `BAKERY_CHANNEL_ID` (padrão `1530334104334237939`).

**Upgrades da padaria** (permanentes, com moedas da padaria):

| id | Efeito |
|----|--------|
| `speed` | −4% tempo de forno por nível (máx 8 → −32%) |
| `profit` | +4% moedas ao servir (máx 8 → +32%) |
| `mastery` | +4% XP da padaria (máx 8 → +32%) |
| `luck` | +3% chance de 2× moedas (máx 5 → 15%) |
| `charm` | +2 🪙 fixos por item servido (máx 5 → +10) |

Sprites em `assets/bakery/` (já vem um pack no tema Morgana).  
Troque os PNGs e reinicie o bot — ver `assets/bakery/README.md`.

---

### 🎫 Tickets (canal de ajuda)

Membro pede ajuda → bot cria canal privado com a staff.

| Comando | Quem | Função |
|---------|------|--------|
| `!ticket [motivo]` | Qualquer um | Abre canal de ajuda |
| `!suporte` / `!pedirajuda` | Qualquer um | Idem |
| `!fechar [motivo]` | Autor ou staff | Fecha e apaga o canal (~10s) |
| Botão **Fechar ticket** | Autor ou staff | Idem |
| `!addticket @user` | Staff / dono | Adiciona alguém no canal |
| `!tickets` | Staff | Lista tickets abertos |

#### Config (Gerenciar Servidor)

```txt
!config ticket on|off
!config ticketcategoria #categoria   (ou ID)
!config ticketcargo @cargo           (staff que vê todos os tickets)
```

**Permissão do bot:** Gerenciar Canais.

---

### 🧹 Limpeza

| Comando | Função |
|---------|--------|
| `!limpeza` | Ajuda |
| `!limpeza <1-100>` | Apaga N mensagens do canal |
| `!limpeza bot [50]` | Só mensagens da Morgana |
| `!limpeza efeitos` | Remove buffs expirados da database |

Precisa de **Gerenciar Mensagens** (canal) ou **Gerenciar Servidor** (efeitos).  
Aliases: `!cleanup`, `!clean`.

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
| `!config` / `!painel` | Painel (logs, autorole, welcome, tickets…) |
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
| Música pula faixas | Bloqueio do YouTube; tente nome+artista; veja `docker logs morgana-lavalink` |
| Pokémon não responde | Só no canal do `POKEMON_CHANNEL_ID` |
| Ticket não abre | Bot precisa de **Gerenciar Canais**; configure categoria/cargo com `!config ticket*` |
| `!padaria` sem imagem | Reinicie o bot; confira `assets/bakery/` no container (`Dockerfile` copia `assets/`) |
| Push com “Large files” | Remova `nodejs/`, `java/`, jars do commit (já no `.gitignore`) |
| Bot sobe antes do Lavalink | O compose espera o healthcheck; se falhar: `docker compose restart bot` |

---

## Créditos

- Hallownest Bots · **Morgana**  
- Sprites Pokémon via [PokeAPI](https://pokeapi.co/)  
- Pixel-art da padaria: pack original tema Morgana (`assets/bakery/`)  
- Áudio: [Lavalink](https://github.com/lavalink-devs/Lavalink) + [youtube-source](https://github.com/lavalink-devs/youtube-source)  
- Padaria idle inspirada no *loop* de jogos tipo bake.gg (conteúdo e arte próprios)
