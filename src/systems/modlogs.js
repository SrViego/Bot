const { getGuildData, saveData } = require('./database');

async function logModerationAction(message, data, action) {
  const guildData = getGuildData(data, message.guild.id);
  const entry = {
    action: action.type,
    targetId: action.targetId ?? null,
    moderatorId: message.author.id,
    reason: action.reason ?? null,
    channelId: message.channel.id,
    createdAt: new Date().toISOString()
  };

  guildData.moderationLogs.unshift(entry);
  guildData.moderationLogs.splice(50);
  saveData(data);

  const logChannelId = guildData.config.logChannelId;
  if (!logChannelId) return;

  const channel = await message.guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const lines = [
    `**Moderacao: ${action.type}**`,
    `Moderador: ${message.author}`,
    action.targetId ? `Alvo: <@${action.targetId}>` : null,
    action.reason ? `Motivo: ${action.reason}` : null,
    `Canal: ${message.channel}`
  ].filter(Boolean);

  await channel.send(lines.join('\n')).catch(() => null);
}

function handleModLogCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (command !== '!modlogs') return false;

  const guildData = getGuildData(data, message.guild.id);
  const logs = guildData.moderationLogs.slice(0, 10);

  if (logs.length === 0) {
    message.reply('Ainda nao ha logs de moderacao salvos.');
    return true;
  }

  const lines = logs.map((log, index) => {
    const target = log.targetId ? ` -> <@${log.targetId}>` : '';
    return `${index + 1}. ${log.action}${target} por <@${log.moderatorId}>`;
  });

  message.reply(`Ultimos logs de moderacao:\n${lines.join('\n')}`);
  return true;
}

module.exports = {
  handleModLogCommand,
  logModerationAction
};
