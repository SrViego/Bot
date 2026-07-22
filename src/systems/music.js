const { PermissionFlagsBits } = require("discord.js");

const MUSIC_COMMANDS = [
  "!play",
  "!p",
  "!skip",
  "!stop",
  "!queue",
  "!fila",
  "!pause",
  "!resume",
  "!continuar",
  "!np",
  "!tocando",
  "!volume"
];

const LAVALINK_HOST = process.env.LAVALINK_HOST || "127.0.0.1";
const LAVALINK_PORT = Number.parseInt(process.env.LAVALINK_PORT || "2333", 10);
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === "true";
// ytsearch costuma ser mais estável que ytmsearch para vários títulos
const LAVALINK_SEARCH_SOURCE = process.env.LAVALINK_SEARCH_SOURCE || "ytsearch";
const SEARCH_FALLBACKS = (process.env.LAVALINK_SEARCH_FALLBACKS || "ytsearch,ytmsearch,scsearch")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DEFAULT_VOLUME = Number.parseInt(process.env.LAVALINK_DEFAULT_VOLUME || "80", 10);

let lavalinkImportPromise;
let discordClient;

function getLavalinkModule() {
  if (!lavalinkImportPromise) {
    lavalinkImportPromise = import("lavalink-client");
  }
  return lavalinkImportPromise;
}

async function initLavalink(client) {
  discordClient = client;
  if (client.lavalink) return client.lavalink;

  const { LavalinkManager } = await getLavalinkModule();
  const manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host: LAVALINK_HOST,
        port: LAVALINK_PORT,
        authorization: LAVALINK_PASSWORD,
        secure: LAVALINK_SECURE,
        retryAmount: 10,
        retryDelay: 5_000
      }
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    // autoSkip: pula faixas que falham ao carregar o stream (YouTube bloqueado etc.)
    autoSkip: true,
    client: {
      id: client.user.id,
      username: client.user.username
    },
    playerOptions: {
      defaultSearchPlatform: LAVALINK_SEARCH_SOURCE,
      onEmptyQueue: {
        destroyAfterMs: 60_000
      },
      maxErrorsPerTime: {
        threshold: 3,
        maxAmount: 5
      }
    }
  });

  manager.nodeManager.on("connect", (node) => {
    console.log(`[lavalink] conectado ao node ${node.id}`);
  });

  manager.nodeManager.on("disconnect", (node, reason) => {
    console.warn(`[lavalink] node ${node.id} desconectou:`, reason?.reason ?? reason);
  });

  manager.nodeManager.on("error", (node, error) => {
    console.error(`[lavalink] erro no node ${node.id}:`, error);
  });

  manager.on("trackStart", async (player, track) => {
    await sendPlayerMessage(
      player,
      `▶️ Tocando: **${trackTitle(track)}** \`[${trackDuration(track)}]\``
    );
  });

  manager.on("trackError", async (player, track, payload) => {
    const reason = explainTrackError(payload);
    console.error("[lavalink] trackError:", trackTitle(track), reason, payload?.exception?.message || payload);
    await sendPlayerMessage(
      player,
      `❌ Não consegui tocar **${trackTitle(track)}** (${reason}). Pulando…`
    );
  });

  manager.on("trackStuck", async (player, track) => {
    await sendPlayerMessage(player, `❌ **${trackTitle(track)}** travou. Pulando…`);
  });

  manager.on("queueEnd", async (player) => {
    await sendPlayerMessage(player, "✅ Fila acabou. Vou sair do canal em instantes.");
  });

  await manager.init({ id: client.user.id, username: client.user.username });
  client.lavalink = manager;
  console.log(`[lavalink] usando ${LAVALINK_HOST}:${LAVALINK_PORT} (search: ${LAVALINK_SEARCH_SOURCE})`);
  return manager;
}

function explainTrackError(payload) {
  const msg = String(
    payload?.exception?.message || payload?.message || payload?.cause || payload || ""
  ).toLowerCase();

  if (msg.includes("all clients failed") || msg.includes("not available")) {
    return "YouTube bloqueou o stream desta faixa";
  }
  if (msg.includes("403") || msg.includes("status code")) {
    return "acesso negado pelo YouTube (403)";
  }
  if (msg.includes("age") || msg.includes("login")) {
    return "vídeo com restrição de idade/login";
  }
  if (msg.includes("region") || msg.includes("country")) {
    return "bloqueado na região";
  }
  if (msg.includes("private") || msg.includes("unavailable")) {
    return "vídeo indisponível/privado";
  }
  if (msg.includes("sig function") || msg.includes("player script")) {
    return "plugin YouTube desatualizado/quebrado";
  }
  return "erro de stream";
}

function handleLavalinkRawData(client, packet) {
  client.lavalink?.sendRawData(packet);
}

function memberVoiceChannel(message) {
  return message.member?.voice?.channel ?? null;
}

function botCanJoin(channel) {
  const me = channel.guild.members.me;
  if (!me) return { ok: false, reason: "Não consegui verificar as minhas permissões neste servidor." };

  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.Connect)) {
    return { ok: false, reason: "Não tenho permissão para **conectar** neste canal de voz." };
  }
  if (!perms.has(PermissionFlagsBits.Speak)) {
    return { ok: false, reason: "Não tenho permissão para **falar** neste canal de voz." };
  }
  return { ok: true };
}

function getManager(message) {
  return message.client.lavalink ?? null;
}

function getPlayer(message) {
  const manager = getManager(message);
  return manager?.getPlayer(message.guild.id) ?? manager?.players?.get(message.guild.id) ?? null;
}

function extractAfterPrefix(content, prefix) {
  return content.slice(prefix.length).trim();
}

function isUrl(query) {
  try {
    const parsed = new URL(query);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normaliza links do YouTube Music / shorts / params extras */
function sanitizeQuery(raw) {
  let q = String(raw || "").trim();
  if (!q) return q;

  // remove zero-width / lixo de copiar-colar
  q = q.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  if (!isUrl(q)) return q;

  try {
    const u = new URL(q);
    const host = u.hostname.replace(/^www\./, "");

    // music.youtube.com → youtube.com (mais estável no plugin)
    if (host === "music.youtube.com") {
      u.hostname = "www.youtube.com";
    }

    // youtu.be/ID
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }

    // shorts
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }

    // limpa params de tracking (si, feature, pp…)
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      const list = u.searchParams.get("list");
      if (u.pathname === "/playlist" && list) {
        return `https://www.youtube.com/playlist?list=${list}`;
      }
      if (v) {
        return `https://www.youtube.com/watch?v=${v}`;
      }
    }

    return u.toString();
  } catch {
    return q;
  }
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "??:??";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trackTitle(track) {
  return track?.info?.title ?? track?.title ?? "Sem título";
}

function trackUri(track) {
  return track?.info?.uri ?? track?.uri ?? "";
}

function trackDuration(track) {
  if (track?.info?.isStream) return "ao vivo";
  return formatDurationMs(track?.info?.duration ?? track?.duration);
}

function queuedTracks(player) {
  const tracks = player?.queue?.tracks;
  if (!tracks) return [];
  if (Array.isArray(tracks)) return tracks;
  if (typeof tracks.toArray === "function") return tracks.toArray();
  if (typeof tracks.values === "function") return Array.from(tracks.values());
  return [];
}

async function sendPlayerMessage(player, content) {
  const channelId = player?.textChannelId;
  if (!channelId || !discordClient?.channels) return;

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send(content).catch(() => null);
  }
}

/**
 * Busca com fallbacks: URL limpa → sources de texto (ytsearch, ytmsearch, scsearch)
 */
async function searchWithFallbacks(player, rawQuery, requester) {
  const query = sanitizeQuery(rawQuery);
  const attempts = [];

  if (isUrl(query)) {
    attempts.push({ query, label: "link" });
    // se for youtube music já sanitizado, ok; se falhar, tenta ytsearch do título depois
  } else {
    const sources = [
      LAVALINK_SEARCH_SOURCE,
      ...SEARCH_FALLBACKS.filter((s) => s !== LAVALINK_SEARCH_SOURCE)
    ];
    for (const source of sources) {
      attempts.push({ query, source, label: source });
    }
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const result = await player.search(
        attempt.source ? { query: attempt.query, source: attempt.source } : { query: attempt.query },
        requester
      );
      const tracks = result?.tracks ?? [];
      const loadType = String(result?.loadType ?? "").toLowerCase();

      if (tracks.length > 0 && !loadType.includes("error") && !loadType.includes("empty")) {
        return { result, used: attempt.label, query };
      }

      // empty
      lastError = loadType || "empty";
    } catch (err) {
      lastError = err;
      console.warn(`[lavalink] search fail (${attempt.label}):`, err?.message || err);
    }
  }

  // URL YouTube falhou → tenta extrair id e buscar por ytsearch: (às vezes resolve)
  if (isUrl(query) && query.includes("youtube")) {
    try {
      const u = new URL(query);
      const id = u.searchParams.get("v");
      if (id) {
        for (const source of ["ytsearch", "ytmsearch"]) {
          try {
            const result = await player.search({ query: id, source }, requester);
            if (result?.tracks?.length) {
              return { result, used: `${source}:id`, query };
            }
          } catch (err) {
            lastError = err;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { result: null, used: null, query, lastError };
}

async function handlePlay(message, rawQuery) {
  const voiceChannel = memberVoiceChannel(message);
  if (!voiceChannel) {
    await message.reply("Entra em um canal de voz antes de pedir música.");
    return true;
  }

  const perm = botCanJoin(voiceChannel);
  if (!perm.ok) {
    await message.reply(`❌ ${perm.reason}`);
    return true;
  }

  const manager = getManager(message);
  if (!manager) {
    await message.reply("❌ Lavalink ainda não iniciou. Espera o bot ficar online ou sobe o container `lavalink`.");
    return true;
  }

  let player = getPlayer(message);
  if (player?.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
    await message.reply("❌ Já estou tocando em outro canal de voz neste servidor.");
    return true;
  }

  try {
    player = await manager.createPlayer({
      guildId: message.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: message.channel.id,
      selfDeaf: true,
      volume: Number.isFinite(DEFAULT_VOLUME) ? DEFAULT_VOLUME : 80
    });

    await player.connect();
  } catch (err) {
    console.error("[lavalink] connect error:", err);
    await message.reply("❌ Não consegui conectar ao canal de voz pelo Lavalink.");
    return true;
  }

  const { result, used, query } = await searchWithFallbacks(player, rawQuery, message.author);

  const tracks = result?.tracks ?? [];
  if (!result || tracks.length === 0) {
    await message.reply({
      title: "❌ Nada encontrado",
      description: [
        `Não achei / não consegui carregar: **${query}**`,
        "",
        "Dicas:",
        "• Tente o **nome da música + artista** em vez do link",
        "• Alguns vídeos são bloqueados pelo YouTube (idade, região, live)",
        "• Playlists do YouTube Music às vezes trazem faixas que o stream recusa"
      ].join("\n"),
      color: 0xe74c3c
    });
    return true;
  }

  const loadType = String(result.loadType ?? "").toLowerCase();
  const isPlaylist = loadType.includes("playlist") || Boolean(result.playlist);

  // Playlist: adiciona todas; autoSkip pula as que falharem no stream
  // Single: só a primeira
  const tracksToAdd = isPlaylist ? tracks : tracks[0];
  await player.queue.add(tracksToAdd);

  const wasPlaying = player.playing || player.paused;
  if (!wasPlaying) {
    try {
      await player.play();
    } catch (err) {
      console.error("[lavalink] play error:", err);
      await message.reply(
        "❌ Achei a faixa, mas o stream falhou ao iniciar. Tente outra busca ou link (YouTube bloqueia alguns vídeos)."
      );
      return true;
    }

    if (isPlaylist) {
      const playlistName = result.playlist?.name ?? result.playlist?.title ?? "playlist";
      await message.reply(
        `🎵 Playlist **${playlistName}** · **${tracks.length}** faixas (via \`${used}\`).\n` +
          `_Algumas podem ser puladas se o YouTube bloquear o stream._`
      );
    }
    // single: trackStart já anuncia
    return true;
  }

  if (isPlaylist) {
    const playlistName = result.playlist?.name ?? result.playlist?.title ?? "playlist";
    await message.reply(
      `🎵 Adicionei **${tracks.length}** faixas de **${playlistName}** à fila (\`${used}\`).`
    );
  } else {
    await message.reply(
      `🎵 Na fila (#${queuedTracks(player).length}): **${trackTitle(tracks[0])}** \`${used}\``
    );
  }

  return true;
}

async function handleSkip(message) {
  const player = getPlayer(message);
  if (!player?.queue?.current) {
    await message.reply("Não tem nada tocando pra pular.");
    return true;
  }

  await player.skip();
  await message.reply("⏭️ Pulado!");
  return true;
}

async function handleStop(message) {
  const player = getPlayer(message);
  if (!player) {
    await message.reply("Não tem música tocando.");
    return true;
  }

  await player.destroy();
  await message.reply("⏹️ Parei tudo e saí do canal.");
  return true;
}

async function handleQueue(message) {
  const player = getPlayer(message);
  const current = player?.queue?.current;
  const tracks = queuedTracks(player);

  if (!current && tracks.length === 0) {
    await message.reply("A fila está vazia.");
    return true;
  }

  const lines = [];
  if (current) {
    lines.push(`**Tocando agora:** ${trackTitle(current)} \`[${trackDuration(current)}]\``);
  }

  if (tracks.length > 0) {
    const preview = tracks
      .slice(0, 10)
      .map((track, index) => `${index + 1}. ${trackTitle(track)} \`[${trackDuration(track)}]\``)
      .join("\n");
    lines.push(`**Na fila (${tracks.length}):**\n${preview}`);
    if (tracks.length > 10) {
      lines.push(`... e mais ${tracks.length - 10}`);
    }
  }

  await message.reply(lines.join("\n\n"));
  return true;
}

async function handlePause(message) {
  const player = getPlayer(message);
  if (!player?.playing) {
    await message.reply("Nada está tocando agora.");
    return true;
  }

  await player.pause();
  await message.reply("⏸️ Pausado.");
  return true;
}

async function handleResume(message) {
  const player = getPlayer(message);
  if (!player?.paused) {
    await message.reply("Nada está pausado.");
    return true;
  }

  await player.resume();
  await message.reply("▶️ Continuando.");
  return true;
}

async function handleNowPlaying(message) {
  const player = getPlayer(message);
  const current = player?.queue?.current;
  if (!current) {
    await message.reply("Nada está tocando agora.");
    return true;
  }

  const volume = Math.round(player.volume ?? DEFAULT_VOLUME);
  const position = formatDurationMs(player.position ?? player.lastPosition ?? 0);
  await message.reply(
    `🎶 **${trackTitle(current)}**\n` +
      `Tempo: \`${position}/${trackDuration(current)}\` | Volume: \`${volume}%\`\n` +
      `${trackUri(current)}`
  );
  return true;
}

async function handleVolume(message, args) {
  const player = getPlayer(message);
  const raw = args[0];

  if (!raw) {
    const volume = Math.round(player?.volume ?? DEFAULT_VOLUME);
    await message.reply(`Volume atual: **${volume}%** (use \`!volume 1-100\`)`);
    return true;
  }

  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1 || value > 100) {
    await message.reply("Volume inválido. Usa um número de **1** a **100**.");
    return true;
  }

  if (!player) {
    await message.reply("Não tem música tocando para ajustar o volume.");
    return true;
  }

  await player.setVolume(value);
  await message.reply(`🔊 Volume definido para **${value}%**.`);
  return true;
}

async function handleMusicCommand(message) {
  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (!MUSIC_COMMANDS.some((cmd) => lower === cmd || lower.startsWith(`${cmd} `))) {
    return false;
  }

  if (lower.startsWith("!play")) {
    const query = extractAfterPrefix(content, content.slice(0, 5));
    if (!query) {
      await message.reply("Uso: `!play nome ou link da música`");
      return true;
    }
    return handlePlay(message, query);
  }

  if (lower.startsWith("!pause")) return handlePause(message);
  if (lower.startsWith("!skip")) return handleSkip(message);
  if (lower.startsWith("!stop")) return handleStop(message);
  if (lower.startsWith("!queue") || lower.startsWith("!fila")) return handleQueue(message);
  if (lower.startsWith("!resume") || lower.startsWith("!continuar")) return handleResume(message);
  if (lower.startsWith("!np") || lower.startsWith("!tocando")) return handleNowPlaying(message);
  if (lower.startsWith("!volume")) {
    const args = content.split(/\s+/).slice(1);
    return handleVolume(message, args);
  }

  if (lower === "!p" || lower.startsWith("!p ")) {
    const query = extractAfterPrefix(content, "!p");
    if (!query) {
      await message.reply("Uso: `!p nome ou link da música`");
      return true;
    }
    return handlePlay(message, query);
  }

  return false;
}

module.exports = {
  handleMusicCommand,
  initLavalink,
  handleLavalinkRawData
};
