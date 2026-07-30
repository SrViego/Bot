const { getGuildData, getUserData } = require('./database');
const { getAchievementProgress } = require('./achievements');
const { shopItems } = require('./shop');
const { getNeededXp } = require('./xp');
const { progressBar } = require('./theme');
const { profileCosmeticLines, ensureCosmetics } = require('./cosmetics');
const { markProfileSeen } = require('./onboarding');

function handleProfileCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (command !== '!perfil' && command !== '!profile') return false;

  const target = message.mentions.users.first() ?? message.author;
  // trilho de chegada: só conta se olhou o próprio perfil
  if (target.id === message.author.id) {
    markProfileSeen(data, message.guild.id, message.author.id);
  }
  const guildData = getGuildData(data, message.guild.id);
  const userData = getUserData(data, message.guild.id, target.id);
  const partnerId = guildData.marriages[target.id];
  const neededXp = getNeededXp(userData.level);
  const inventory = formatInventory(userData.inventory);
  const stats = userData.stats ?? {};
  const minigames = userData.minigames ?? {};
  const bar = progressBar(userData.xp, neededXp, 12);
  const cos = ensureCosmetics(userData);
  const cosLine = profileCosmeticLines(userData);

  const titleLine = userData.equippedTitle || cos.title
    ? `\n**${userData.equippedTitle || cos.title}**`
    : '';

  const bakeryCoins = userData.bakery?.coins;
  const pokeCoins = userData.pokemon?.coins;

  message.reply({
    title: `📜 Perfil de ${target.username}`,
    description: `${target}${titleLine}${cosLine ? `\n${cosLine}` : ''}`,
    thumbnail: target.displayAvatarURL({ size: 256 }),
    fields: [
      {
        name: '⭐ Nível',
        value: `**${userData.level}**\n\`${bar}\`\n${userData.xp}/${neededXp} XP`,
        inline: true
      },
      {
        name: '💰 Pontos',
        value: `**${userData.points}**`,
        inline: true
      },
      {
        name: '💎 Reputação',
        value: `**${userData.rep ?? 0}**`,
        inline: true
      },
      {
        name: '🪙 Outras moedas',
        value: `Padaria **${bakeryCoins ?? 0}** · Poke **${pokeCoins ?? 0}**`,
        inline: true
      },
      {
        name: '📅 Daily',
        value: `Sequência **${stats.dailyStreak ?? 0}**\nMelhor **${stats.bestDailyStreak ?? 0}**`,
        inline: true
      },
      {
        name: '🎮 Minigames',
        value: `🏆 ${minigames.wins ?? 0} · 💀 ${minigames.losses ?? 0}`,
        inline: true
      },
      {
        name: '🏅 Conquistas',
        value: `**${getAchievementProgress(userData)}**`,
        inline: true
      },
      {
        name: '💍 Casamento',
        value: partnerId ? `<@${partnerId}>` : '*solteiro(a)*',
        inline: false
      },
      {
        name: '🎒 Inventário',
        value: inventory,
        inline: false
      }
    ]
  });
  return true;
}

function formatInventory(inventory = {}) {
  const entries = Object.entries(inventory)
    .filter(([, amount]) => amount > 0)
    .slice(0, 8);

  if (entries.length === 0) return '*vazio*';

  return entries
    .map(([itemId, amount]) => {
      const item = shopItems.find((shopItem) => shopItem.id === itemId);
      return `• **${item?.name ?? itemId}** ×${amount}`;
    })
    .join('\n');
}

module.exports = {
  handleProfileCommand
};
