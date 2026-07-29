const { getUserData, mutateUser } = require("./database");
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

  message.reply({
    title: '💰 Pontos',
    description: `${target} possui **${userData.points}** pontos.`,
    thumbnail: target.displayAvatarURL({ size: 128 }),
    fields: [
      { name: '🔥 Daily streak', value: String(userData.stats?.dailyStreak ?? 0), inline: true },
      { name: '🏅 Melhor streak', value: String(userData.stats?.bestDailyStreak ?? 0), inline: true }
    ]
  });
}

function claimDaily(message, data) {
  const guildId = message.guild.id;
  const userId = message.author.id;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const twoDays = 2 * oneDay;

  let reward = 0;
  let streakBonus = 0;
  let boostNote = null;
  let unlocked = [];
  let dailyStreak = 0;
  let points = 0;
  let blocked = false;
  let hours = 0;

  mutateUser(data, guildId, userId, (userData) => {
    if (userData.lastDailyAt && now - userData.lastDailyAt < oneDay) {
      const remaining = oneDay - (now - userData.lastDailyAt);
      hours = Math.ceil(remaining / (60 * 60 * 1000));
      blocked = true;
      return;
    }

    const keptStreak = userData.lastDailyAt && now - userData.lastDailyAt <= twoDays;
    userData.stats.dailyStreak = keptStreak ? userData.stats.dailyStreak + 1 : 1;
    userData.stats.bestDailyStreak = Math.max(userData.stats.bestDailyStreak, userData.stats.dailyStreak);
    userData.stats.dailies += 1;

    streakBonus = Math.min((userData.stats.dailyStreak - 1) * 20, 200);
    reward = 100 + streakBonus;
    if (userData.effects?.dailyBoostMult) {
      const mult = Number(userData.effects.dailyBoostMult) || 1.5;
      const before = reward;
      reward = Math.floor(reward * mult);
      boostNote = `Boost da loja ×${mult}: ${before} → **${reward}**`;
      delete userData.effects.dailyBoostMult;
    }
    userData.points += reward;
    userData.lastDailyAt = now;
    dailyStreak = userData.stats.dailyStreak;
    points = userData.points;

    unlocked = grantAchievements(userData, ["first_daily"]);
    if (userData.stats.dailyStreak >= 3) unlocked.push(...grantAchievements(userData, ["daily_3"]));
    if (userData.stats.dailyStreak >= 7) unlocked.push(...grantAchievements(userData, ["daily_7"]));
    if (userData.points >= 1000) unlocked.push(...grantAchievements(userData, ["wealthy"]));
  });

  if (blocked) {
    message.reply({
      title: '⏰ Daily já resgatado',
      description: `Você já pegou seus pontos hoje.\nVolte em cerca de **${hours}h**.`,
      color: 0xf1c40f
    });
    return;
  }

  const userData = getUserData(data, guildId, userId);
  const fields = [
    { name: '💰 Recompensa', value: `**+${reward}** pontos`, inline: true },
    { name: '🔥 Sequência', value: `**${userData.stats.dailyStreak}** dia(s)`, inline: true },
    { name: '✨ Bônus streak', value: `+${streakBonus}`, inline: true },
    { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
  ];
  if (boostNote) {
    fields.push({ name: '🏪 Boost da loja', value: boostNote, inline: false });
  }

  message.reply({
    title: '🎁 Daily resgatado!',
    description: `${message.author} abriu o baú diário.`,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
    fields
  });
  notifyAchievements(message, unlocked);
}

function showPointsRank(message, data) {
  const guildUsers = data.users[message.guild.id] ?? {};
  const ranking = Object.entries(guildUsers)
    .sort(([, a], [, b]) => b.points - a.points)
    .slice(0, 10);

  if (ranking.length === 0) {
    message.reply({
      title: '🏆 Ranking de pontos',
      description: 'Ainda não há ninguém no ranking.'
    });
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = ranking.map(([userId, userData], index) => {
    const medal = medals[index] ?? `**${index + 1}.**`;
    return `${medal} <@${userId}> — **${userData.points}** pts`;
  });

  message.reply({
    title: '🏆 Ranking de pontos',
    description: lines.join('\n')
  });
}

module.exports = {
  handlePointsCommand
};
