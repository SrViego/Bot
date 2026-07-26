/**
 * Dashboard simples no Discord: !serverstats
 */

const { getGuildData } = require('./database');
const { theme } = require('./theme');
const { ensureEvents, isActive } = require('./guild-events');

function handleServerStatsCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (!['!serverstats', '!stats', '!servidor', '!dashboard'].includes(command)) {
    return false;
  }

  const guildData = getGuildData(data, message.guild.id);
  const users = Object.values(guildData.users || {});
  let totalPoints = 0;
  let totalBakery = 0;
  let totalPoke = 0;
  let bakeryPlayers = 0;
  let pokePlayers = 0;
  let totalServed = 0;
  let totalMsgs = 0;

  for (const u of users) {
    totalPoints += u.points || 0;
    totalMsgs += u.stats?.messages || 0;
    if (u.bakery) {
      bakeryPlayers += 1;
      totalBakery += u.bakery.coins || 0;
      totalServed += u.bakery.totalServed || 0;
    }
    if (u.pokemon) {
      pokePlayers += 1;
      totalPoke += u.pokemon.coins || 0;
    }
  }

  const e = ensureEvents(guildData.config);
  const events = [];
  if (isActive(e.happyHourUntil)) events.push('🎉 Happy Hour');
  if (isActive(e.bakeryBonusUntil)) events.push('🥖 Festival padaria');
  if (isActive(e.pokeRaidUntil)) events.push('⚔️ Raid poke');
  if (e.bakeryBoss) events.push(`👹 Chefe ${e.bakeryBoss.progress}/${e.bakeryBoss.goal}`);

  message.reply({
    title: `📊 ${message.guild.name}`,
    description: 'Resumo dos sistemas Morgana neste servidor.',
    thumbnail: message.guild.iconURL({ size: 128 }),
    fields: [
      {
        name: '👥 Membros no DB',
        value: `**${users.length}** perfis`,
        inline: true
      },
      {
        name: '💰 Economia',
        value: `**${totalPoints}** pts total`,
        inline: true
      },
      {
        name: '💬 Mensagens (xp)',
        value: `**${totalMsgs}**`,
        inline: true
      },
      {
        name: '🥖 Padaria',
        value: `**${bakeryPlayers}** donos · **${totalBakery}** 🪙 · **${totalServed}** servidos`,
        inline: false
      },
      {
        name: '🔴 Pokémon',
        value: `**${pokePlayers}** treinadores · **${totalPoke}** 🪙 poke`,
        inline: false
      },
      {
        name: '🎪 Eventos',
        value: events.length ? events.join('\n') : '*nenhum ativo*',
        inline: false
      }
    ],
    color: theme.color
  });
  return true;
}

module.exports = {
  handleServerStatsCommand
};
