# Isolde Bot

Bot de Discord em Node.js usando `discord.js`, com musica via Lavalink, economia, loja, XP, sistemas sociais, moderacao, configuracoes por servidor e respostas em embeds verdes.

## Requisitos

- Node.js 22.12 ou superior
- npm
- Um bot criado no Discord Developer Portal
- Lavalink rodando separadamente para usar musica

No Discord Developer Portal, ative:

```txt
Message Content Intent
Server Members Intent
```

## Como Rodar

1. Instale as dependencias:

```sh
npm install
```

2. Crie um arquivo `.env` na raiz do projeto:

```env
DISCORD_TOKEN=seu_token_aqui
WELCOME_CHANNEL_ID=id_do_canal_de_boas_vindas
GOODBYE_CHANNEL_ID=id_do_canal_de_despedida

LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_SEARCH_SOURCE=ytmsearch
LAVALINK_DEFAULT_VOLUME=80
```

3. Inicie o bot:

```sh
npm start
```

Para desenvolvimento com reload automatico:

```sh
npm run dev
```

## Lavalink

O bot usa `lavalink-client`, entao o servidor Lavalink precisa estar ligado antes do bot tocar musica.

A pasta `lavalink/` e local e fica fora do Git. Use ela para guardar `Lavalink.jar`, plugins e `application.yml` da sua maquina. Para YouTube funcionar no Lavalink v4, use um plugin de source como `youtube-source`.

Permissoes recomendadas para musica:

```txt
Ver canal
Conectar
Falar
```

## Visual

As respostas dos sistemas usam embeds verdes. A cor fica centralizada em:

```txt
src/systems/theme.js
```

Cor atual:

```txt
0x2ecc71
```

## Comandos

### Basicos

```txt
!ping
!help
!ajuda
```

### Musica

```txt
!play nome_ou_link
!p nome_ou_link
!queue
!fila
!np
!tocando
!pause
!resume
!continuar
!skip
!stop
!volume
!volume 1-100
```

### Perfil, XP e Conquistas

```txt
!perfil
!perfil @usuario
!profile
!xp
!xp @usuario
!level
!rankxp
!conquistas
!conquistas @usuario
!achievements
```

O XP sobe automaticamente quando alguem conversa. Existe um intervalo de 60 segundos por usuario para evitar farm.

### Pontos e Daily

```txt
!daily
!pontos
!pontos @usuario
!rankpontos
```

O `!daily` tem sequencia diaria e bonus por streak.

### Loja

```txt
!loja
!loja categoria
!shop
!item id_do_item
!comprar id_do_item
!buy id_do_item
!vender id_do_item
!sell id_do_item
!presentear @usuario id_do_item
!gift @usuario id_do_item
!inventario
!inventario @usuario
!inv
!usar id_do_item
```

Categorias atuais:

```txt
consumivel
colecionavel
raro
utilidade
```

### Minigames

```txt
!coinflip cara aposta
!coinflip coroa aposta
!moeda cara aposta
!guess numero_de_1_a_5 aposta
!adivinhar numero_de_1_a_5 aposta
!minigames
!minigames @usuario
```

As apostas usam pontos do usuario.

### Reputacao

```txt
!rep @usuario
!rankrep
!reps
```

Cada usuario tem cooldown para dar reputacao.

### Casamento

```txt
!casar @usuario
!aceitarcasamento
!recusarcasamento
!divorciar
!casamento
!casamento @usuario
```

### Utilidade

```txt
!avatar
!avatar @usuario
!userinfo
!userinfo @usuario
!serverinfo
!say mensagem
```

### Configuracoes

Use `!config` ou `!painel` para ver o painel de configuracoes do servidor.

```txt
!config
!painel
!config logs #canal
!config logs off
!config autorole @cargo
!config autorole off
!config welcome on
!config welcome off
!config goodbye on
!config goodbye off
```

Permissao necessaria para alterar configuracoes:

```txt
Gerenciar Servidor
```

### Boas-vindas, Despedida e Auto Cargo

Boas-vindas e despedidas usam os canais do `.env`:

```env
WELCOME_CHANNEL_ID=id_do_canal_de_boas_vindas
GOODBYE_CHANNEL_ID=id_do_canal_de_despedida
```

Se os IDs nao forem configurados, o bot tenta usar o canal de sistema do servidor.

O auto cargo e configurado por servidor com:

```txt
!config autorole @cargo
```

### Moderacao

```txt
!ban @usuario motivo
!unban id_do_usuario
!kick @usuario motivo
!timeout @usuario 10m motivo
!untimeout @usuario
!warn @usuario motivo
!warnings
!warnings @usuario
!clearwarns @usuario
!clear quantidade
!slowmode segundos
!lock
!unlock
!modlogs
```

Permissoes que o bot pode precisar, dependendo do comando:

```txt
Banir membros
Expulsar membros
Moderar membros
Gerenciar mensagens
Gerenciar canais
```

Para ban, kick e timeout, o cargo do bot precisa estar acima do cargo da pessoa alvo.

Os logs de moderacao ficam salvos localmente e podem ser enviados para um canal configurado com:

```txt
!config logs #canal
```

## Dados Locais

Os dados de XP, pontos, reputacao, avisos, casamentos, inventario, conquistas, configuracoes e logs ficam em:

```txt
data/database.json
```

Essa pasta fica fora do Git pelo `.gitignore`.

Tambem ficam fora do Git:

```txt
.env
node_modules/
nodejs/
java/
lavalink/
```
