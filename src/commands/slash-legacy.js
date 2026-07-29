/**
 * Slash ainda não migrados pro registry (semana 3 deixa o resto aqui).
 */
const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../systems/theme');

function legacySlashJSON() {
  return [
    new SlashCommandBuilder()
      .setName('padaria')
      .setDescription('Lembrete dos comandos da padaria'),
    new SlashCommandBuilder()
      .setName('quest')
      .setDescription('Suas quests diárias/semanais'),
    new SlashCommandBuilder()
      .setName('perfil')
      .setDescription('Como ver seu perfil')
      .addUserOption((o) =>
        o.setName('user').setDescription('Membro').setRequired(false)
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
    const ch = process.env.BAKERY_CHANNEL_ID;
    const where = ch ? `Só no canal <#${ch}>` : 'Configure `BAKERY_CHANNEL_ID` no `.env`';
    await interaction.reply({
      embeds: [
        createEmbed(
          [
            where,
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
    await interaction.reply({
      content: 'Use `!quest` no chat pra ver e `!quest pegar` pra resgatar.',
      ephemeral: true
    });
    return true;
  }

  if (commandName === 'perfil') {
    const user = interaction.options.getUser('user') || interaction.user;
    await interaction.reply({
      content: `Perfil completo: digite \`!perfil\` ou mencione o user no chat.`,
      ephemeral: true
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

  return false;
}

module.exports = {
  legacySlashJSON,
  handleLegacySlash
};
