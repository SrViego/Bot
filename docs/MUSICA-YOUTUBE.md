# Música: YouTube no Lavalink

Versões fixadas (out/2026): **Lavalink 4.2.2**, **youtube-source 1.18.2**, **LavaSrc 4.8.3**
(ver `Dockerfile.lavalink`). Fontes:
- https://github.com/lavalink-devs/youtube-source/releases (1.18.2) e README (tabela de clients, OAuth, remoteCipher)
- https://github.com/lavalink-devs/Lavalink/releases (4.2.2)
- https://github.com/kikkia/yt-cipher
- Issues youtube-source #240, #226, #244, #250

## Por que quebrou
O YouTube mudou o player JS e a extração interna de assinatura do plugin falha
("Must find sig function"); clients ANDROID passaram a exigir login ("login required")
e o TVHTML5 retorna "page needs reload". O mantenedor recomenda usar **servidor de cipher remoto**.

## O que esta config faz
- `sources.youtube: false` (fonte antiga do Lavalink) e plugin youtube-source ativo.
- Clients: `MUSIC` (só busca), `WEB`, `WEBEMBEDDED`, `TVHTML5_SIMPLY`, `TV`, `ANDROID_VR`.
  Não coloque `IOS` antes de `WEB` (quebra `ytsearch`, issue #250).
- `remoteCipher` → container `yt-cipher` (só rede interna) ou `YT_CIPHER_URL=https://cipher.kikkia.dev/`.
- Fallback: se uma faixa do YouTube falhar, o bot procura a mesma no SoundCloud (`MUSIC_FALLBACK_SOURCE`).
- LavaSrc: Spotify opcional (`SPOTIFY_*`).

## Subir
```sh
docker compose pull
docker compose up -d --build
docker compose logs -f lavalink
```

## OAuth (opcional, se aparecer "Sign in to confirm you're not a bot"/"login required")
> ⚠️ **Use uma conta Google DESCARTÁVEL.** Nunca a sua conta principal: o Google pode
> suspender/banir contas usadas por bots. Só o client `TV` usa OAuth.

1. No `.env`: `YOUTUBE_OAUTH_ENABLED=true` e `YOUTUBE_OAUTH_REFRESH_TOKEN=` vazio.
2. `docker compose up -d lavalink && docker compose logs -f lavalink`
3. Nos logs aparece algo como: `OAUTH INTEGRATION: To give youtube-source access to your account, go to https://www.google.com/device and enter code XXXX-XXXX`.
4. Abra o link, entre com a conta descartável e digite o código.
5. Os logs mostram `OAUTH INTEGRATION: Token retrieved successfully. Store your refresh token ...: 1//0...`.
6. Copie esse refresh token para `YOUTUBE_OAUTH_REFRESH_TOKEN=` no `.env` (nunca commite) e
   `docker compose up -d lavalink`. Agora ele não pede o código de novo.

`YOUTUBE_OAUTH_SKIP_INIT=true` só serve para não iniciar o fluxo de código quando não há token.
