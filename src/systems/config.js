const { PermissionsBitField } = require('discord.js');
const { getGuildData, saveData } = require('./database');

function handleConfigCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command !== '!config' && command !== '!painel') return false;

  if (!hasManageGuild(message)) return true;

  const subcommand = args[1]?.toLowerCase();

  if (!subcommand) {
    showConfigPanel(message, data);
    return true;
  }

  if (subcommand === 'logs') {
    setLogChannel(message, args, data);
    return true;
  }

  if (subcommand === 'autorole') {
    setAutoRole(message, args, data);
    return true;
  }

  if (subcommand === 'welcome') {
    toggleConfig(message, args, data, 'welcomeEnabled', 'boas-vindas');
    return true;
  }

  if (subcommand === 'goodbye') {
    toggleConfig(message, args, data, 'goodbyeEnabled', 'despedidas');
    return true;
  }

  message.reply('Use: !config, !config logs #canal, !config autorole @cargo, !config welcome on|off, !config goodbye on|off');
  return true;
}

function showConfigPanel(message, data) {
  const guildData = getGuildData(data, message.guild.id);
  const config = guildData.config;
  const lines = [
    '**Painel de configuracoes**',
    `Logs: ${config.logChannelId ? `<#${config.logChannelId}>` : 'desativado'}`,
    `Auto cargo: ${config.autoRoleId ? `<@&${config.autoRoleId}>` : 'desativado'}`,
    `Boas-vindas: ${config.welcomeEnabled ? 'on' : 'off'}`,
    `Despedidas: ${config.goodbyeEnabled ? 'on' : 'off'}`,
    '',
    'Comandos:',
    '!config logs #canal | off',
    '!config autorole @cargo | off',
    '!config welcome on|off',
    '!config goodbye on|off'
  ];

  message.reply(lines.join('\n'));
}

function setLogChannel(message, args, data) {
  const guildData = getGuildData(data, message.guild.id);

  if (args[2]?.toLowerCase() === 'off') {
    guildData.config.logChannelId = null;
    saveData(data);
    message.reply('Canal de logs desativado.');
    return;
  }

  const channel = message.mentions.channels.first();
  if (!channel || !channel.isTextBased()) {
    message.reply('Use: !config logs #canal ou !config logs off');
    return;
  }

  guildData.config.logChannelId = channel.id;
  saveData(data);
  message.reply(`Canal de logs definido para ${channel}.`);
}

function setAutoRole(message, args, data) {
  const guildData = getGuildData(data, message.guild.id);

  if (args[2]?.toLowerCase() === 'off') {
    guildData.config.autoRoleId = null;
    saveData(data);
    message.reply('Auto cargo desativado.');
    return;
  }

  const role = message.mentions.roles.first();
  if (!role) {
    message.reply('Use: !config autorole @cargo ou !config autorole off');
    return;
  }

  guildData.config.autoRoleId = role.id;
  saveData(data);
  message.reply(`Auto cargo definido para ${role}.`);
}

function toggleConfig(message, args, data, field, label) {
  const value = args[2]?.toLowerCase();

  if (value !== 'on' && value !== 'off') {
    message.reply(`Use: !config ${field === 'welcomeEnabled' ? 'welcome' : 'goodbye'} on|off`);
    return;
  }

  const guildData = getGuildData(data, message.guild.id);
  guildData.config[field] = value === 'on';
  saveData(data);
  message.reply(`${label} agora esta ${value}.`);
}

function hasManageGuild(message) {
  if (message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
  message.reply('Voce precisa da permissao Gerenciar Servidor para alterar configuracoes.');
  return false;
}

module.exports = {
  handleConfigCommand
};
