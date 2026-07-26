require('dotenv').config();

const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const { getGuildData, loadData } = require('./systems/database');
const { handleMarriageCommand } = require('./systems/marriage');
const { handlePointsCommand } = require('./systems/points');
const { handleShopCommand } = require('./systems/shop');
const { addXpFromMessage, handleXpCommand } = require('./systems/xp');
const { handleModerationCommand } = require('./systems/moderation');
const { handleAchievementsCommand } = require('./systems/achievements');
const { handleProfileCommand } = require('./systems/profile');
const { handleReputationCommand } = require('./systems/reputation');
const { handleMinigameCommand } = require('./systems/minigames');
const { handleUtilityCommand } = require('./systems/utility');
const { handleHelpCommand } = require('./systems/help');
const { handleConfigCommand } = require('./systems/config');
const { applyAutoRole } = require('./systems/autoroles');
const { handleModLogCommand } = require('./systems/modlogs');
const { applyTheme, createEmbed } = require('./systems/theme');
const { sendWelcome, sendGoodbye } = require('./systems/welcome');
const { handleLavalinkRawData, handleMusicCommand, initLavalink } = require('./systems/music');
const { handlePokemonCommand } = require('./systems/pokemon');
const { handleCleanupCommand } = require('./systems/cleanup');
const { handleBakeryCommand, processOvenNotifications } = require('./systems/bakery');
const { handleTicketCommand, handleTicketButton } = require('./systems/tickets');
const { handleQuestCommand } = require('./systems/quests');
const { handleEventCommand } = require('./systems/guild-events');
const { handleExchangeCommand } = require('./systems/economy-bridge');
const { handleCosmeticsCommand } = require('./systems/cosmetics');
const { handleLoreCommand } = require('./systems/lore');
const { handleStarboardCommand, handleStarboardReaction } = require('./systems/starboard');
const { handleBetCommand } = require('./systems/bets');
const { handleServerStatsCommand } = require('./systems/server-stats');
const { registerSlashCommands, handleSlashInteraction } = require('./systems/slash');

const token = process.env.DISCORD_TOKEN;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID;
const data = loadData();

if (!token) {
  console.error('Erro: coloque o token do bot no arquivo .env como DISCORD_TOKEN=seu_token');
  process.exit(1);
}

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
  await initLavalink(readyClient);
  await registerSlashCommands(readyClient);
  // forno pronto (DM) a cada 45s
  setInterval(() => {
    processOvenNotifications(readyClient, data).catch((err) =>
      console.error('oven notify:', err.message)
    );
  }, 45_000);
});

client.on('raw', (packet) => {
  handleLavalinkRawData(client, packet);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (await handleTicketButton(interaction, data)) return;
    if (await handleSlashInteraction(interaction, data)) return;
  } catch (err) {
    console.error('interaction:', err);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    await handleStarboardReaction(reaction, user, data);
  } catch (err) {
    console.error('reaction:', err);
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
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  applyTheme(message);
  addXpFromMessage(message, data);

  if (message.content === '!ping') {
    const sent = await message.reply({
      title: '🏓 Pong!',
      description: 'Medindo latência…'
    });
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const ws = client.ws.ping;
    await sent.edit({
      embeds: [
        createEmbed(
          [`📡 **Round-trip:** \`${roundtrip}ms\``, `💓 **WebSocket:** \`${ws}ms\``].join('\n'),
          { title: '🏓 Pong!' }
        )
      ]
    });
    return;
  }

  // Pokémon: só no canal configurado (checa dentro do handler)
  if (handlePokemonCommand(message, data)) return;

  // Padaria antes do !ajuda geral (pra `!ajuda padaria` funcionar)
  if (handleBakeryCommand(message, data)) return;

  if (handleQuestCommand(message, data)) return;
  if (handleEventCommand(message, data)) return;
  if (handleExchangeCommand(message, data)) return;
  if (handleCosmeticsCommand(message, data)) return;
  if (handleLoreCommand(message)) return;
  if (handleStarboardCommand(message, data)) return;
  if (handleBetCommand(message, data)) return;
  if (handleServerStatsCommand(message, data)) return;

  if (handleHelpCommand(message)) return;
  if (handleTicketCommand(message, data)) return;
  if (handleConfigCommand(message, data)) return;
  if (handleCleanupCommand(message, data)) return;
  if (handleUtilityCommand(message)) return;
  if (handleProfileCommand(message, data)) return;
  if (handleAchievementsCommand(message, data)) return;
  if (handleReputationCommand(message, data)) return;
  if (handleMinigameCommand(message, data)) return;
  if (handleModLogCommand(message, data)) return;
  if (await handleModerationCommand(message, data)) return;
  if (handleMarriageCommand(message, data)) return;
  if (handlePointsCommand(message, data)) return;
  if (handleShopCommand(message, data)) return;
  if (handleXpCommand(message, data)) return;
  if (await handleMusicCommand(message, data)) return;
});

async function getTextChannel(guild, channelId) {
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased() ? channel : null;
  }

  return guild.systemChannel?.isTextBased() ? guild.systemChannel : null;
}

(async () => {
  await client.login(token);
})().catch((err) => {
  console.error('Falha ao iniciar o bot:', err);
  process.exit(1);
});
