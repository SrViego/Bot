const { getUserData, saveUser } = require('./database');

const repCooldown = 12 * 60 * 60 * 1000;

function handleReputationCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!rep') {
    giveReputation(message, data);
    return true;
  }

  if (command === '!reps' || command === '!rankrep') {
    showReputationRank(message, data);
    return true;
  }

  return false;
}

function giveReputation(message, data) {
  const target = message.mentions.users.first();

  if (!target) {
    message.reply('Use: !rep @usuario');
    return;
  }

  if (target.bot) {
    message.reply('Voce nao pode dar reputacao para bot.');
    return;
  }

  if (target.id === message.author.id) {
    message.reply('Voce nao pode dar reputacao para voce mesmo.');
    return;
  }

  const authorData = getUserData(data, message.guild.id, message.author.id);
  const now = Date.now();

  if (authorData.lastRepAt && now - authorData.lastRepAt < repCooldown) {
    const remaining = repCooldown - (now - authorData.lastRepAt);
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    message.reply(`Voce ja deu reputacao recentemente. Tente de novo em cerca de ${hours}h.`);
    return;
  }

  const targetData = getUserData(data, message.guild.id, target.id);
  targetData.rep += 1;
  authorData.lastRepAt = now;
  saveUser(data, message.guild.id, message.author.id);
  saveUser(data, message.guild.id, target.id);

  message.channel.send(`${message.author} deu +1 reputacao para ${target}. Total: ${targetData.rep}.`);
}

function showReputationRank(message, data) {
  const guildUsers = data.users[message.guild.id] ?? {};
  const ranking = Object.entries(guildUsers)
    .sort(([, a], [, b]) => (b.rep ?? 0) - (a.rep ?? 0))
    .slice(0, 10);

  if (ranking.length === 0) {
    message.reply('Ainda nao tem ranking de reputacao.');
    return;
  }

  const lines = ranking.map(([userId, userData], index) => {
    return `${index + 1}. <@${userId}> - ${userData.rep ?? 0} reputacao`;
  });

  message.reply(`Ranking de reputacao:\n${lines.join('\n')}`);
}

module.exports = {
  handleReputationCommand
};
