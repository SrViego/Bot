const { getUserData, saveData } = require("./database");
const { grantAchievements, notifyAchievements } = require("./achievements");

function handlePointsCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!pontos') {
    showPoints(message, data);
    return true;
  }

  if (command === '!daily') {
    claimDaily(message, data);
    return true;
  }

  if (command === '!rankpontos') {
    showPointsRank(message, data);
    return true;
  }

  return false;
}

function showPoints(message, data) {
  const target = message.mentions.users.first() ?? message.author;
  const userData = getUserData(data, message.guild.id, target.id);

  message.reply(`${target} tem ${userData.points} pontos.`);
}

function claimDaily(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const twoDays = 2 * oneDay;

  if (userData.lastDailyAt && now - userData.lastDailyAt < oneDay) {
    const remaining = oneDay - (now - userData.lastDailyAt);
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    message.reply(`Voce ja pegou seus pontos diarios. Tente de novo em cerca de ${hours}h.`);
    return;
  }

  const keptStreak = userData.lastDailyAt && now - userData.lastDailyAt <= twoDays;
  userData.stats.dailyStreak = keptStreak ? userData.stats.dailyStreak + 1 : 1;
  userData.stats.bestDailyStreak = Math.max(userData.stats.bestDailyStreak, userData.stats.dailyStreak);
  userData.stats.dailies += 1;

  const streakBonus = Math.min((userData.stats.dailyStreak - 1) * 20, 200);
  const reward = 100 + streakBonus;
  userData.points += reward;
  userData.lastDailyAt = now;

  const unlocked = grantAchievements(userData, ["first_daily"]);
  if (userData.stats.dailyStreak >= 3) unlocked.push(...grantAchievements(userData, ["daily_3"]));
  if (userData.stats.dailyStreak >= 7) unlocked.push(...grantAchievements(userData, ["daily_7"]));
  if (userData.points >= 1000) unlocked.push(...grantAchievements(userData, ["wealthy"]));

  saveData(data);
  message.reply(
    `Voce recebeu ${reward} pontos diarios. Sequencia atual: ${userData.stats.dailyStreak} dia(s).`
  );
  notifyAchievements(message, unlocked);
}

function showPointsRank(message, data) {
  const guildUsers = data.users[message.guild.id] ?? {};
  const ranking = Object.entries(guildUsers)
    .sort(([, a], [, b]) => b.points - a.points)
    .slice(0, 10);

  if (ranking.length === 0) {
    message.reply('Ainda nao tem ranking de pontos.');
    return;
  }

  const lines = ranking.map(([userId, userData], index) => {
    return `${index + 1}. <@${userId}> - ${userData.points} pontos`;
  });

  message.reply(`Ranking de pontos:
${lines.join('\n')}`);
}

module.exports = {
  handlePointsCommand
};
