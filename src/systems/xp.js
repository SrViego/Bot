const { getUserData, saveData } = require("./database");
const { grantAchievements, notifyAchievements } = require("./achievements");
const { progressBar } = require("./theme");

const xpCooldown = 60 * 1000;

function addXpFromMessage(message, data) {
  if (!message.guild || message.author.bot || message.content.startsWith('!')) return;

  const userData = getUserData(data, message.guild.id, message.author.id);
  const now = Date.now();

  if (now - userData.lastXpAt < xpCooldown) return;

  userData.stats.messages += 1;
  const unlocked = grantAchievements(userData, ["first_message"]);

  const gainedXp = Math.floor(Math.random() * 8) + 8;
  userData.xp += gainedXp;
  userData.lastXpAt = now;

  const neededXp = getNeededXp(userData.level);
  if (userData.xp >= neededXp) {
    userData.xp -= neededXp;
    userData.level += 1;
    if (userData.level >= 5) unlocked.push(...grantAchievements(userData, ["level_5"]));
    if (userData.level >= 10) unlocked.push(...grantAchievements(userData, ["level_10"]));
    message.channel.send({
      title: '🌟 Level up!',
      description: `${message.author} alcançou o **nível ${userData.level}**!`,
      thumbnail: message.author.displayAvatarURL({ size: 128 }),
      color: 0xf1c40f
    });
  }

  notifyAchievements(message, unlocked);
  saveData(data);
}

function handleXpCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();

  if (command === '!xp' || command === '!level') {
    showXp(message, data);
    return true;
  }

  if (command === '!rankxp') {
    showXpRank(message, data);
    return true;
  }

  return false;
}

function showXp(message, data) {
  const target = message.mentions.users.first() ?? message.author;
  const userData = getUserData(data, message.guild.id, target.id);
  const neededXp = getNeededXp(userData.level);
  const bar = progressBar(userData.xp, neededXp, 12);

  message.reply({
    title: '⭐ Experiência',
    description: `${target}`,
    thumbnail: target.displayAvatarURL({ size: 128 }),
    fields: [
      { name: 'Nível', value: `**${userData.level}**`, inline: true },
      { name: 'XP', value: `**${userData.xp}** / ${neededXp}`, inline: true },
      { name: 'Progresso', value: `\`${bar}\``, inline: false }
    ]
  });
}

function showXpRank(message, data) {
  const guildUsers = data.users[message.guild.id] ?? {};
  const ranking = Object.entries(guildUsers)
    .sort(([, a], [, b]) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.xp - a.xp;
    })
    .slice(0, 10);

  if (ranking.length === 0) {
    message.reply({
      title: '🏆 Ranking de XP',
      description: 'Ainda não há ninguém no ranking.'
    });
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = ranking.map(([userId, userData], index) => {
    const medal = medals[index] ?? `**${index + 1}.**`;
    return `${medal} <@${userId}> — nv **${userData.level}** · ${userData.xp} XP`;
  });

  message.reply({
    title: '🏆 Ranking de XP',
    description: lines.join('\n')
  });
}

function getNeededXp(level) {
  return 100 + (level - 1) * 50;
}

module.exports = {
  addXpFromMessage,
  getNeededXp,
  handleXpCommand
};
