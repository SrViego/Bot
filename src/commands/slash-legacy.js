/**
 * Slash que reutilizam a lógica dos comandos de prefixo (não só dicas).
 */
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, theme } = require('../systems/theme');
const { messageFromInteraction } = require('./slash-bridge');
const { handleProfileCommand } = require('../systems/profile');
const { handleQuestCommand } = require('../systems/quests');
const { showBakery, showBakeryHelp, BAKERY_CHANNEL_ID } = require('../systems/bakery');
const {
  showEventStatus,
  ensureEvents
} = require('../systems/guild-events');
const { getGuildData } = require('../systems/database');

function legacySlashJSON() {
  return [
    new SlashCommandBuilder()
      .setName('padaria')
      .setDescription('Status da sua padaria (ou guia se fora do canal)'),
    new SlashCommandBuilder()
      .setName('quest')
      .setDescription('Quests diárias e semanais')
      .addStringOption((o) =>
        o
          .setName('acao')
          .setDescription('lista ou resgatar recompensas')
          .setRequired(false)
          .addChoices(
            { name: 'Listar', value: 'lista' },
            { name: 'Resgatar (pegar)', value: 'pegar' }
          )
      ),
    new SlashCommandBuilder()
      .setName('perfil')
      .setDescription('Perfil completo de um membro')
      .addUserOption((o) =>
        o.setName('user').setDescription('Membro (padrão: você)').setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName('evento')
      .setDescription('Status dos eventos do servidor')
  ].map((c) => c.toJSON());
}

async function handleLegacySlash(interaction, data) {
  if (!interaction.isChatInputCommand()) return false;
  const { commandName } = interaction;

  if (commandName === 'padaria') {
    const msg = messageFromInteraction(interaction, '!padaria');
    const inChannel =
      BAKERY_CHANNEL_ID && interaction.channelId === BAKERY_CHANNEL_ID;

    if (!BAKERY_CHANNEL_ID) {
      await interaction.reply({
        embeds: [
          createEmbed(
            'Padaria desativada: defina `BAKERY_CHANNEL_ID` no `.env`.',
            { title: '🥖 Padaria', color: theme.colorWarn }
          )
        ],
        ephemeral: true
      });
      return true;
    }

    if (!inChannel) {
      // fora do canal: guia + link (não o status completo)
      showBakeryHelp(msg);
      return true;
    }

    try {
      await showBakery(msg, data);
    } catch (err) {
      console.error('slash padaria:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [
            createEmbed('Não consegui abrir a padaria agora.', {
              title: '🥖 Erro',
              color: theme.colorError
            })
          ],
          ephemeral: true
        });
      }
    }
    return true;
  }

  if (commandName === 'quest') {
    const acao = (interaction.options.getString('acao') || 'lista').toLowerCase();
    const content =
      acao === 'pegar' || acao === 'claim' || acao === 'resgatar'
        ? '!quest pegar'
        : '!quest';
    const msg = messageFromInteraction(interaction, content);
    handleQuestCommand(msg, data);
    return true;
  }

  if (commandName === 'perfil') {
    const target = interaction.options.getUser('user') || interaction.user;
    const msg = messageFromInteraction(interaction, '!perfil', {
      mentionUser: target.id === interaction.user.id ? null : target
    });
    // se target é outro user, mentions.first() precisa retornar target
    if (target.id !== interaction.user.id) {
      msg.mentions.users.first = () => target;
    }
    handleProfileCommand(msg, data);
    return true;
  }

  if (commandName === 'evento') {
    const guildData = getGuildData(data, interaction.guildId);
    const e = ensureEvents(guildData.config);
    const msg = messageFromInteraction(interaction, '!evento status');
    showEventStatus(msg, e);
    return true;
  }

  return false;
}

module.exports = {
  legacySlashJSON,
  handleLegacySlash
};
