/**
 * Ranking semanal automático (Sprint 2).
 * Staff: !config ranking #canal | off
 * Manual: !ranking
 */

const { getGuildData, saveData } = require('./database');
const { theme, createEmbed } = require('./theme');
const { ensureEvents, isActive } = require('./guild-events');

function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t - new Date(Date.UTC(y, 0, 1))) / 86400000 + 1) / 7);
  return `${y}-W${week}`;
}

function topN(entries, n = 10) {
  return entries.slice(0, n);
}

function formatTop(lines) {
  if (!lines.length) return '*ninguém ainda*';
  return lines
    .map((l, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
      return `${medal} ${l}`;
    })
    .join('\n');
}

function buildRankings(guildData) {
  const users = Object.entries(guildData.users || {});

  const byPoints = topN(
    users
      .map(([id, u]) => ({ id, v: u.points || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
  ).map((x) => `<@${x.id}> — **${x.v}** pts`);

  const byBakery = topN(
    users
      .map(([id, u]) => ({ id, v: u.bakery?.totalServed || 0, coins: u.bakery?.coins || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || b.coins - a.coins)
  ).map((x) => `<@${x.id}> — **${x.v}** servidos`);

  const byPoke = topN(
    users
      .map(([id, u]) => ({ id, v: u.pokemon?.catches || 0, wins: u.pokemon?.wins || 0 }))
      .filter((x) => x.v > 0 || x.wins > 0)
      .sort((a, b) => b.v - a.v || b.wins - a.wins)
  ).map((x) => `<@${x.id}> — **${x.v}** capturas · ${x.wins} PvP`);

  const byOffer = topN(
    users
      .map(([id, u]) => ({ id, v: u.stats?.offeredPoints || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
  ).map((x) => `<@${x.id}> — **${x.v}** pts doados`);

  return { byPoints, byBakery, byPoke, byOffer };
}

function rankingEmbed(guild, guildData, label) {
  const { byPoints, byBakery, byPoke, byOffer } = buildRankings(guildData);
  const e = ensureEvents(guildData.config);
  const events = [];
  if (isActive(e.happyHourUntil)) events.push('🎉 Happy Hour');
  if (isActive(e.bakeryBonusUntil)) events.push('🥖 Festival');
  if (isActive(e.pokeRaidUntil)) events.push('⚔️ Raid');

  return createEmbed(
    [
      label || `Semana **${weekKey()}** · top do servidor`,
      events.length ? `Eventos: ${events.join(' · ')}` : null,
      '',
      '_Staff: `!config ranking #canal` · manual: `!ranking`_'
    ]
      .filter(Boolean)
      .join('\n'),
    {
      title: `🏆 Ranking · ${guild.name}`,
      fields: [
        { name: '💰 Pontos', value: formatTop(byPoints), inline: false },
        { name: '🥖 Padaria (servidos)', value: formatTop(byBakery), inline: false },
        { name: '🔴 Pokémon', value: formatTop(byPoke), inline: false },
        { name: '🕯️ Oferendas', value: formatTop(byOffer), inline: false }
      ],
      thumbnail: guild.iconURL({ size: 128 }),
      color: theme.color
    }
  );
}

function handleRankingCommand(message, data) {
  const command = message.content.trim().split(/\s+/)[0].toLowerCase();
  if (!['!ranking', '!rankings', '!top', '!topsemanal'].includes(command)) {
    return false;
  }

  const guildData = getGuildData(data, message.guild.id);
  const embed = rankingEmbed(message.guild, guildData, `Snapshot · semana **${weekKey()}**`);
  message.reply({ embeds: [embed] });
  return true;
}

/**
 * Posta ranking se mudou a semana ISO e há canal configurado.
 */
async function processWeeklyRankings(client, data) {
  const key = weekKey();
  if (!data.guildConfigs) return;

  for (const [guildId, config] of Object.entries(data.guildConfigs)) {
    if (!config?.rankingChannelId) continue;
    if (config.lastWeeklyRankKey === key) continue;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;
    const channel = await guild.channels.fetch(config.rankingChannelId).catch(() => null);
    if (!channel?.isTextBased?.()) continue;

    const guildData = getGuildData(data, guildId);
    const embed = rankingEmbed(
      guild,
      guildData,
      `📅 Nova semana **${key}** — ranking automático`
    );

    try {
      await channel.send({ embeds: [embed] });
      config.lastWeeklyRankKey = key;
      saveData(data);
      console.log(`[ranking] postado em ${guild.name} (${key})`);
    } catch (err) {
      console.error(`[ranking] falha ${guildId}:`, err.message);
    }
  }
}

module.exports = {
  handleRankingCommand,
  processWeeklyRankings,
  buildRankings,
  weekKey,
  rankingEmbed
};
