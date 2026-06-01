const { getGuildData, getUserData } = require('./database');
const { getAchievementProgress } = require('./achievements');
const { shopItems } = require('./shop');
const { getNeededXp } = require('./xp');

function handleProfileCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (command !== '!perfil' && command !== '!profile') return false;

  const target = message.mentions.users.first() ?? message.author;
  const guildData = getGuildData(data, message.guild.id);
  const userData = getUserData(data, message.guild.id, target.id);
  const partnerId = guildData.marriages[target.id];
  const neededXp = getNeededXp(userData.level);
  const inventory = formatInventory(userData.inventory);
  const stats = userData.stats ?? {};
  const minigames = userData.minigames ?? {};

  const lines = [
    `**Perfil de ${target.tag}**`,
    `Nivel: **${userData.level}** (${userData.xp}/${neededXp} XP)`,
    `Pontos: **${userData.points}**`,
    `Reputacao: **${userData.rep ?? 0}**`,
    `Daily: sequencia **${stats.dailyStreak ?? 0}** | melhor **${stats.bestDailyStreak ?? 0}**`,
    `Minigames: **${minigames.wins ?? 0}** vitoria(s) | **${minigames.losses ?? 0}** derrota(s)`,
    `Conquistas: **${getAchievementProgress(userData)}**`,
    `Casamento: ${partnerId ? `<@${partnerId}>` : 'solteiro(a)'}`,
    `Inventario: ${inventory}`
  ];

  message.reply(lines.join('\n'));
  return true;
}

function formatInventory(inventory = {}) {
  const entries = Object.entries(inventory)
    .filter(([, amount]) => amount > 0)
    .slice(0, 6);

  if (entries.length === 0) return 'vazio';

  return entries
    .map(([itemId, amount]) => {
      const item = shopItems.find((shopItem) => shopItem.id === itemId);
      return `${item?.name ?? itemId} x${amount}`;
    })
    .join(', ');
}

module.exports = {
  handleProfileCommand
};
