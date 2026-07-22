const ACHIEVEMENTS = {
  first_message: {
    name: "Primeiro Eco",
    description: "Ganhou XP pela primeira vez conversando."
  },
  first_daily: {
    name: "Ritual Diario",
    description: "Resgatou o daily pela primeira vez."
  },
  daily_3: {
    name: "Tres Dias de Foco",
    description: "Manteve uma sequencia de 3 dailies."
  },
  daily_7: {
    name: "Semana Completa",
    description: "Manteve uma sequencia de 7 dailies."
  },
  level_5: {
    name: "Aprendiz de Hallownest",
    description: "Chegou ao nivel 5."
  },
  level_10: {
    name: "Veterano de Hallownest",
    description: "Chegou ao nivel 10."
  },
  first_purchase: {
    name: "Cliente de Dirtmouth",
    description: "Comprou um item na loja."
  },
  collector: {
    name: "Colecionador",
    description: "Guardou 3 tipos de itens no inventario."
  },
  married: {
    name: "Laco Selado",
    description: "Casou com alguem no servidor."
  },
  wealthy: {
    name: "Bolso Cheio",
    description: "Juntou 1000 pontos."
  }
};

function ensureAchievementState(userData) {
  if (!Array.isArray(userData.achievements)) userData.achievements = [];
  if (!userData.stats) userData.stats = {};
  if (!Number.isInteger(userData.stats.messages)) userData.stats.messages = 0;
  if (!Number.isInteger(userData.stats.dailies)) userData.stats.dailies = 0;
  if (!Number.isInteger(userData.stats.dailyStreak)) userData.stats.dailyStreak = 0;
  if (!Number.isInteger(userData.stats.bestDailyStreak)) userData.stats.bestDailyStreak = 0;
  if (!Number.isInteger(userData.stats.purchases)) userData.stats.purchases = 0;
  return userData;
}

function grantAchievement(userData, achievementId) {
  ensureAchievementState(userData);
  if (!ACHIEVEMENTS[achievementId] || userData.achievements.includes(achievementId)) {
    return false;
  }

  userData.achievements.push(achievementId);
  return true;
}

function grantAchievements(userData, achievementIds) {
  return achievementIds.filter((achievementId) => grantAchievement(userData, achievementId));
}

function achievementLine(achievementId) {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return achievementId;
  return `**${achievement.name}** - ${achievement.description}`;
}

function notifyAchievements(message, achievementIds) {
  if (!achievementIds.length) return;

  const lines = achievementIds.map((id) => {
    const a = ACHIEVEMENTS[id];
    return a ? `🏅 **${a.name}**\n*${a.description}*` : id;
  });

  message.channel
    .send({
      title: "🎉 Nova conquista!",
      description: `${message.author}\n\n${lines.join("\n\n")}`,
      thumbnail: message.author.displayAvatarURL({ size: 128 }),
      color: 0xf1c40f
    })
    .catch(() => null);
}

function getAchievementList(userData) {
  ensureAchievementState(userData);
  return userData.achievements
    .filter((achievementId) => ACHIEVEMENTS[achievementId])
    .map((achievementId) => ({
      id: achievementId,
      ...ACHIEVEMENTS[achievementId]
    }));
}

function getAchievementProgress(userData) {
  ensureAchievementState(userData);
  return `${userData.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`;
}

function handleAchievementsCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (command !== "!conquistas" && command !== "!achievements") return false;

  const target = message.mentions.users.first() ?? message.author;
  const { getUserData } = require("./database");
  const userData = getUserData(data, message.guild.id, target.id);
  const achievements = getAchievementList(userData);

  if (achievements.length === 0) {
    message.reply({
      title: "🏅 Conquistas",
      description: `${target} ainda não desbloqueou conquistas.\nProgresso: **${getAchievementProgress(userData)}**`,
      thumbnail: target.displayAvatarURL({ size: 128 })
    });
    return true;
  }

  const lines = achievements
    .slice(0, 12)
    .map((a) => `🏅 **${a.name}**\n*${a.description}*`);

  if (achievements.length > 12) {
    lines.push(`… e mais **${achievements.length - 12}**`);
  }

  message.reply({
    title: `🏅 Conquistas de ${target.username}`,
    description: `${target} · progresso **${getAchievementProgress(userData)}**\n\n${lines.join("\n\n")}`,
    thumbnail: target.displayAvatarURL({ size: 128 })
  });
  return true;
}

module.exports = {
  ACHIEVEMENTS,
  achievementLine,
  ensureAchievementState,
  getAchievementList,
  getAchievementProgress,
  grantAchievement,
  grantAchievements,
  handleAchievementsCommand,
  notifyAchievements
};
