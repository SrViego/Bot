/**
 * Alertas de staff (Sprint 3) — Lavalink / saúde do bot.
 * Staff: !config alerta #canal | off
 */

const { getGuildData, saveData } = require('./database');
const { createEmbed, theme } = require('./theme');

/** @type {Map<string, boolean>} guildId -> last lavalink ok sent */
const lastAlertState = new Map();

function pickAlertChannel(client, data) {
  const channels = [];
  for (const [guildId, config] of Object.entries(data.guildConfigs || {})) {
    if (!config?.staffAlertChannelId) continue;
    channels.push({ guildId, channelId: config.staffAlertChannelId });
  }
  return channels;
}

async function sendToAlertChannels(client, data, embed) {
  for (const { guildId, channelId } of pickAlertChannel(client, data)) {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (!ch?.isTextBased?.()) continue;
      await ch.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[health] alerta guild ${guildId}:`, err.message);
    }
  }
}

/**
 * Chamado pelos eventos do Lavalink (music.js).
 * @param {import('discord.js').Client} client
 * @param {boolean} ok
 * @param {string} [detail]
 */
function notifyLavalinkState(client, ok, detail) {
  // precisa do `data` global — usa client.morganaData se index setar
  const data = client.morganaData;
  if (!data) return;

  const key = 'lavalink';
  const prev = lastAlertState.get(key);
  if (prev === ok) return;
  lastAlertState.set(key, ok);

  const embed = createEmbed(
    ok
      ? 'Node Lavalink **conectado** de novo. Música deve voltar a funcionar.'
      : [
          'Node Lavalink **caiu** ou não responde.',
          detail ? `Detalhe: \`${String(detail).slice(0, 120)}\`` : null,
          'Confira: `docker compose ps` · container `morgana-lavalink`.'
        ]
          .filter(Boolean)
          .join('\n'),
    {
      title: ok ? '🎵 Lavalink OK' : '⚠️ Lavalink offline',
      color: ok ? theme.color : theme.colorError
    }
  );

  sendToAlertChannels(client, data, embed).catch((err) => {
    console.error('[health] send alert:', err.message);
  });
}

/**
 * Heartbeat periódico (opcional) — re-checa estado do Lavalink.
 */
async function processHealthAlerts(client, data) {
  if (!client?.isReady?.()) return;
  client.morganaData = data;

  let ok = false;
  try {
    const { isLavalinkHealthy } = require('./music');
    ok = isLavalinkHealthy();
  } catch {
    ok = false;
  }

  // só alerta se já houve um estado e mudou (notifyLavalinkState faz o debounce)
  // aqui forçamos re-sync se staff acabou de configurar canal e lavalink está down
  const key = 'lavalink';
  if (!lastAlertState.has(key) && !ok) {
    // no boot, não spamma "offline" — só quando cai depois de ter estado
    lastAlertState.set(key, ok);
    return;
  }
  if (lastAlertState.get(key) !== ok) {
    notifyLavalinkState(client, ok);
  }
}

module.exports = {
  notifyLavalinkState,
  processHealthAlerts,
  pickAlertChannel
};
