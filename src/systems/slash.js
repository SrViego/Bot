/**
 * Slash commands básicos (descoberta no mobile).
 * Registrados em ClientReady; handlers em InteractionCreate.
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { theme, createEmbed } = require('./theme');

const slashDefs = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Latência do bot'),
  new SlashCommandBuilder()
    .setName('padaria')
    .setDescription('Lembrete dos comandos da padaria'),
  new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Suas quests diárias/semanais'),
  new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Como ver seu perfil')
    .addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(false)),
  new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Citação aleatória de Hallownest'),
  new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Status dos eventos do servidor'),
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Guia rápido da Morgana')
].map((c) => c.toJSON());

async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !client.application?.id) return;
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    // global — pode demorar até 1h pra propagar; ok pra subset
    await rest.put(Routes.applicationCommands(client.application.id), { body: slashDefs });
    console.log(`[slash] ${slashDefs.length} comandos registrados`);
  } catch (err) {
    console.error('[slash] register failed:', err.message);
  }
}

async function handleSlashInteraction(interaction, data, handlers) {
  if (!interaction.isChatInputCommand()) return false;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    const t = Date.now();
    await interaction.reply({
      embeds: [
        createEmbed(`💓 WS: \`${interaction.client.ws.ping}ms\`\n⏱ agora: \`${Date.now() - t}ms\``, {
          title: '🏓 Pong!'
        })
      ]
    });
    return true;
  }

  if (commandName === 'padaria') {
    const ch = process.env.BAKERY_CHANNEL_ID || '1530334104334237939';
    await interaction.reply({
      embeds: [
        createEmbed(
          [
            `Só no canal <#${ch}>`,
            '`!padaria` · `!assar` · `!servir` · `!upgrade` · `!pedido` · `!forno`',
            'Moedas da padaria ≠ pontos do servidor.'
          ].join('\n'),
          { title: '🥖 Padaria' }
        )
      ],
      ephemeral: true
    });
    return true;
  }

  if (commandName === 'quest') {
    // reutiliza texto pedindo o prefix command
    await interaction.reply({
      content: 'Use `!quest` no chat pra ver e `!quest pegar` pra resgatar.',
      ephemeral: true
    });
    // tenta espelhar lista se handlers.quest
    if (handlers?.showQuests) {
      try {
        await handlers.showQuests(interaction, data);
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  if (commandName === 'perfil') {
    const user = interaction.options.getUser('user') || interaction.user;
    await interaction.reply({
      content: `Perfil completo: digite \`!perfil ${user}\` no chat.`,
      ephemeral: true
    });
    return true;
  }

  if (commandName === 'lore') {
    const { QUOTES } = require('./lore');
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    await interaction.reply({
      embeds: [
        createEmbed(`*“${quote.q}”*`, { title: `📜 ${quote.t}` })
      ]
    });
    return true;
  }

  if (commandName === 'evento') {
    await interaction.reply({
      content: 'Veja `!evento status` no chat. Staff: `!evento happyhour 60`',
      ephemeral: true
    });
    return true;
  }

  if (commandName === 'ajuda') {
    await interaction.reply({
      embeds: [
        createEmbed(
          [
            '**Prefixo:** `!`',
            '`!ajuda` · `!quest` · `!padaria` · `!cambio` · `!cosmetico`',
            '`!lore` · `!apostar` · `!serverstats` · `!evento`',
            'Pokémon no canal configurado · Música `!play`'
          ].join('\n'),
          { title: '📕 Morgana' }
        )
      ],
      ephemeral: true
    });
    return true;
  }

  return false;
}

module.exports = {
  registerSlashCommands,
  handleSlashInteraction,
  theme
};
