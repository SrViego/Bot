require('dotenv').config();

const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const {
  getGuildData,
  loadData,
  backupDataDailyIfNeeded,
  flushSave
} = require('./systems/database');
const {
  trackCommand,
  trackError,
  pruneOldMetrics,
  prefixCommandName
} = require('./systems/metrics');
const { handleMarriageCommand } = require('./systems/marriage');
const { addXpFromMessage } = require('./systems/xp');
const { handleModerationCommand } = require('./systems/moderation');
const { handleConfigCommand } = require('./systems/config');
const { applyAutoRole } = require('./systems/autoroles');
const { handleModLogCommand } = require('./systems/modlogs');
const { applyTheme } = require('./systems/theme');
const { sendWelcome, sendGoodbye } = require('./systems/welcome');
const { handleLavalinkRawData, initLavalink } = require('./systems/music');
const { handleCleanupCommand } = require('./systems/cleanup');
const { handleBakeryCommand, processOvenNotifications } = require('./systems/bakery');
const { handleTicketCommand, handleTicketButton } = require('./systems/tickets');
const { handleEventCommand } = require('./systems/guild-events');
const { handleStarboardCommand, handleStarboardReaction } = require('./systems/starboard');
const { processWeeklyRankings } = require('./systems/weekly-rank');

// Registry + catálogo completo de slash
const {
  registerSlashCommands,
  dispatchPrefix,
  dispatchSlash,
  handleCatalogSlash
} = require('./commands/load');

const token = process.env.DISCORD_TOKEN;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID;

// Segurança: nunca logar o token
if (!token || token === 'cole_o_token_do_bot_aqui') {
  console.error('Erro: coloque o token do bot no arquivo .env como DISCORD_TOKEN=seu_token');
  process.exit(1);
}
if (token.length < 50) {
  console.warn('[security] DISCORD_TOKEN parece curto demais — confira o .env');
}

const data = loadData();
pruneOldMetrics();
backupDataDailyIfNeeded();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot online como ${readyClient.user.tag}`);
  trackCommand('system:ready', { ok: true, detail: readyClient.user.tag });
  await initLavalink(readyClient);
  await registerSlashCommands(readyClient);
  setInterval(() => {
    processOvenNotifications(readyClient, data).catch((err) => {
      console.error('oven notify:', err.message);
      trackError('oven.notify', err);
    });
  }, 45_000);
  setInterval(() => {
    try {
      backupDataDailyIfNeeded();
      pruneOldMetrics();
    } catch (err) {
      console.error('maintenance:', err.message);
    }
  }, 6 * 60 * 60 * 1000);
  // ranking semanal (checa a cada 1h se a semana ISO mudou)
  setInterval(() => {
    processWeeklyRankings(readyClient, data).catch((err) => {
      console.error('weekly rank:', err.message);
      trackError('ranking.weekly', err);
    });
  }, 60 * 60 * 1000);
  // tenta uma vez alguns minutos após o boot
  setTimeout(() => {
    processWeeklyRankings(readyClient, data).catch(() => {});
  }, 90_000);
});

client.on('raw', (packet) => {
  handleLavalinkRawData(client, packet);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (await handleTicketButton(interaction, data)) return;
    // registry com execute próprio (ping, lore, ajuda)
    if (await dispatchSlash(interaction, data)) return;
    // catálogo: resto dos slash → bridge pro handler de prefixo
    if (await handleCatalogSlash(interaction, data)) return;
  } catch (err) {
    console.error('interaction:', err);
    trackError('interaction', err, {
      guildId: interaction.guildId,
      userId: interaction.user?.id
    });
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    await handleStarboardReaction(reaction, user, data);
  } catch (err) {
    console.error('reaction:', err);
    trackError('starboard.reaction', err, {
      guildId: reaction.message?.guildId,
      userId: user?.id
    });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const guildData = getGuildData(data, member.guild.id);
  await applyAutoRole(member, data);

  if (!guildData.config.welcomeEnabled) return;

  const channel = await getTextChannel(member.guild, welcomeChannelId);
  if (!channel) return;

  try {
    await sendWelcome(channel, member);
  } catch (err) {
    console.error('Erro ao enviar boas-vindas:', err);
    trackError('welcome', err, { guildId: member.guild.id, userId: member.id });
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  const guildData = getGuildData(data, member.guild.id);
  if (!guildData.config.goodbyeEnabled) return;

  const channel = await getTextChannel(member.guild, goodbyeChannelId);
  if (!channel) return;

  try {
    await sendGoodbye(channel, member);
  } catch (err) {
    console.error('Erro ao enviar despedida:', err);
    trackError('goodbye', err, { guildId: member.guild.id, userId: member.id });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  applyTheme(message);
  addXpFromMessage(message, data);

  const t0 = Date.now();
  const cmdName = prefixCommandName(message.content);

  const trackHandled = (handled) => {
    if (!handled) return false;
    if (cmdName) {
      trackCommand(cmdName, {
        guildId: message.guild.id,
        userId: message.author.id,
        ms: Date.now() - t0,
        ok: true
      });
    }
    return true;
  };

  try {
    // Padaria ANTES do registry: captura `!ajuda padaria`
    if (handleBakeryCommand(message, data)) {
      trackHandled(true);
      return;
    }

    // Registry (economia, poke, util, music, ajuda, …)
    if (await dispatchPrefix(message, data)) return;

    // Ainda fora do registry (config/admin/eventos)
    if (trackHandled(handleEventCommand(message, data))) return;
    if (trackHandled(handleStarboardCommand(message, data))) return;
    if (trackHandled(handleTicketCommand(message, data))) return;
    if (trackHandled(handleConfigCommand(message, data))) return;
    if (trackHandled(handleCleanupCommand(message, data))) return;
    if (trackHandled(handleModLogCommand(message, data))) return;

    if (await handleModerationCommand(message, data)) {
      trackHandled(true);
      return;
    }
    if (trackHandled(handleMarriageCommand(message, data))) return;
  } catch (err) {
    console.error('message:', err);
    trackError(cmdName || 'message', err, {
      guildId: message.guild?.id,
      userId: message.author?.id
    });
  }
});

async function getTextChannel(guild, channelId) {
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased() ? channel : null;
  }

  return guild.systemChannel?.isTextBased() ? guild.systemChannel : null;
}

// semana 4: flush debounce SQLite no shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      flushSave?.();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
}

(async () => {
  await client.login(token);
})().catch((err) => {
  console.error('Falha ao iniciar o bot:', err.message || err);
  trackError('login', err);
  process.exit(1);
});
