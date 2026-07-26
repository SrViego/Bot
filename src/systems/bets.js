/**
 * Apostas de espectador no próximo coinflip do canal.
 * !apostar cara|coroa <pontos> → entra no pool
 * Quando alguém roda !coinflip, settlePendingBets resolve.
 */

const { getUserData, getGuildData, saveData } = require('./database');
const { theme } = require('./theme');

function ensurePool(data, guildId) {
  if (!data.betPools) data.betPools = {};
  if (!data.betPools[guildId]) data.betPools[guildId] = [];
  return data.betPools[guildId];
}

function handleBetCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (!['!apostar', '!bet', '!aposta'].includes(command)) return false;

  const userData = getUserData(data, message.guild.id, message.author.id);
  const pool = ensurePool(data, message.guild.id);

  if (args.length < 3) {
    const preview = pool.length
      ? pool
          .slice(0, 8)
          .map((b) => `• <@${b.userId}> → **${b.choice}** (${b.amount})`)
          .join('\n')
      : '*nenhuma aposta aberta*';
    message.reply({
      title: '🎲 Apostas · próximo coinflip',
      description: [
        'Aposte no resultado do **próximo** `!coinflip` do servidor.',
        '`!apostar cara|coroa <pontos>`',
        'Odds ~1:1 entre o lado vencedor (pote dos perdedores dividido).',
        '',
        '**Fila atual:**',
        preview
      ].join('\n'),
      color: theme.color
    });
    return true;
  }

  const choiceRaw = args[1].toLowerCase();
  const choice =
    ['cara', 'heads', 'h', 'c'].includes(choiceRaw)
      ? 'cara'
      : ['coroa', 'tails', 't', 'k'].includes(choiceRaw)
        ? 'coroa'
        : null;
  if (!choice) {
    message.reply({
      title: '🎲 Lado inválido',
      description: 'Use **cara** ou **coroa**.',
      color: theme.colorError
    });
    return true;
  }

  let amount = parseInt(args[2], 10);
  if (args[2]?.toLowerCase() === 'all' || args[2]?.toLowerCase() === 'tudo') amount = userData.points;
  if (!Number.isInteger(amount) || amount < 1) {
    message.reply({
      title: '🎲 Aposta inválida',
      description: 'Quantidade inteira ≥ 1.',
      color: theme.colorError
    });
    return true;
  }
  if (userData.points < amount) {
    message.reply({
      title: '🎲 Sem pontos',
      description: `Você tem **${userData.points}**.`,
      color: theme.colorError
    });
    return true;
  }

  // remove aposta anterior do mesmo user
  const existing = pool.findIndex((b) => b.userId === message.author.id);
  if (existing >= 0) {
    const old = pool[existing];
    const oldUser = getUserData(data, message.guild.id, old.userId);
    oldUser.points += old.amount;
    pool.splice(existing, 1);
  }

  userData.points -= amount;
  pool.push({
    userId: message.author.id,
    choice,
    amount,
    channelId: message.channel.id,
    at: Date.now()
  });
  saveData(data);

  message.reply({
    title: '🎲 Aposta registrada',
    description: [
      `${message.author} → **${choice}** com **${amount}** pts`,
      `Saldo: **${userData.points}**`,
      'Vale pro próximo `!coinflip` de qualquer um neste servidor.'
    ].join('\n'),
    color: theme.color
  });
  return true;
}

/**
 * Resolve pool após um coinflip real.
 * @returns {string|null} texto pra anexar na mensagem do coinflip
 */
function settlePendingBets(data, guildId, result) {
  const pool = ensurePool(data, guildId);
  if (!pool.length) return null;

  const bets = pool.splice(0, pool.length);
  const winners = bets.filter((b) => b.choice === result);
  const losers = bets.filter((b) => b.choice !== result);
  const pot = losers.reduce((s, b) => s + b.amount, 0);
  const winStake = winners.reduce((s, b) => s + b.amount, 0);

  const lines = [];

  if (!winners.length) {
    // ninguém ganhou — devolve apostas dos perdedores? ou casa fica com tudo
    // fairer: devolve tudo se não há vencedor
    for (const b of bets) {
      const u = getUserData(data, guildId, b.userId);
      u.points += b.amount;
    }
    lines.push('🎲 Apostas: ninguém no lado certo — **devolvido**.');
  } else if (!losers.length) {
    // todos no mesmo lado — devolve
    for (const b of winners) {
      const u = getUserData(data, guildId, b.userId);
      u.points += b.amount;
    }
    lines.push('🎲 Apostas: todos no mesmo lado — **devolvido**.');
  } else {
    for (const b of winners) {
      const u = getUserData(data, guildId, b.userId);
      const share = Math.floor((b.amount / winStake) * pot);
      const total = b.amount + share;
      u.points += total;
      lines.push(`• <@${b.userId}> **+${share}** (total ${total})`);
    }
    lines.unshift(`🎲 Pote das apostas (**${pot}** pts) pros que acertaram **${result}**:`);
  }

  saveData(data);
  return lines.join('\n');
}

module.exports = {
  handleBetCommand,
  settlePendingBets
};
