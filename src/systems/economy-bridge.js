/**
 * Câmbio entre pontos, moedas da padaria e pokécoins.
 * Taxa alta de propósito (sink + anti-exploit).
 */

const { getUserData, saveData } = require('./database');
const { ensureBakery } = require('./bakery');
const { theme } = require('./theme');

/** Taxa: você perde TAX da quantia convertida (fica 1-TAX). Sink forte. */
const TAX = 0.45;

/**
 * rates: quantas unidades de "to" por 1 de "from" (antes da taxa).
 * Farmar no sistema nativo deve valer mais que câmbio.
 */
const PAIRS = {
  'points>bakery': { from: 'points', to: 'bakery', rate: 0.35, labelFrom: 'pontos', labelTo: '🪙 padaria' },
  'bakery>points': { from: 'bakery', to: 'points', rate: 0.5, labelFrom: '🪙 padaria', labelTo: 'pontos' },
  'points>poke': { from: 'points', to: 'poke', rate: 0.3, labelFrom: 'pontos', labelTo: '🪙 poke' },
  'poke>points': { from: 'poke', to: 'points', rate: 0.45, labelFrom: '🪙 poke', labelTo: 'pontos' },
  'bakery>poke': { from: 'bakery', to: 'poke', rate: 0.3, labelFrom: '🪙 padaria', labelTo: '🪙 poke' },
  'poke>bakery': { from: 'poke', to: 'bakery', rate: 0.3, labelFrom: '🪙 poke', labelTo: '🪙 padaria' }
};

function ensurePoke(userData) {
  if (!userData.pokemon || typeof userData.pokemon !== 'object') {
    userData.pokemon = { coins: 200 };
  }
  if (!Number.isInteger(userData.pokemon.coins)) userData.pokemon.coins = 200;
  return userData.pokemon;
}

function getBal(userData, kind) {
  if (kind === 'points') return userData.points || 0;
  if (kind === 'bakery') return ensureBakery(userData).coins || 0;
  if (kind === 'poke') return ensurePoke(userData).coins || 0;
  return 0;
}

function setBal(userData, kind, value) {
  if (kind === 'points') userData.points = Math.max(0, value);
  else if (kind === 'bakery') ensureBakery(userData).coins = Math.max(0, value);
  else if (kind === 'poke') ensurePoke(userData).coins = Math.max(0, value);
}

function normalizePair(a, b) {
  const map = {
    pontos: 'points',
    pts: 'points',
    points: 'points',
    point: 'points',
    padaria: 'bakery',
    bakery: 'bakery',
    bake: 'bakery',
    g: 'bakery',
    poke: 'poke',
    pokemon: 'poke',
    pokecoins: 'poke',
    pokeCoin: 'poke'
  };
  const from = map[a?.toLowerCase()];
  const to = map[b?.toLowerCase()];
  if (!from || !to || from === to) return null;
  return PAIRS[`${from}>${to}`] || null;
}

function handleExchangeCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (!['!cambio', '!câmbio', '!exchange', '!trocar', '!converter'].includes(command)) {
    return false;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  ensureBakery(userData);
  ensurePoke(userData);

  if (args.length < 4) {
    message.reply({
      title: '💱 Câmbio Morgana',
      description: [
        `Taxa fixa de **${Math.round(TAX * 100)}%** (sink proposital).`,
        '',
        'Uso: `!cambio <de> <para> <quantidade>`',
        'Moedas: `pontos` · `padaria` · `poke`',
        '',
        'Ex: `!cambio pontos padaria 100`',
        'Ex: `!cambio padaria poke 50`',
        '',
        `Saldo: **${userData.points}** pts · **${userData.bakery.coins}** padaria · **${userData.pokemon.coins}** poke`
      ].join('\n'),
      color: theme.color
    });
    return true;
  }

  const pair = normalizePair(args[1], args[2]);
  if (!pair) {
    message.reply({
      title: '💱 Par inválido',
      description: 'Use duas moedas diferentes: `pontos`, `padaria`, `poke`.',
      color: theme.colorError
    });
    return true;
  }

  let amount = parseInt(args[3], 10);
  if (args[3]?.toLowerCase() === 'all' || args[3]?.toLowerCase() === 'tudo') {
    amount = getBal(userData, pair.from);
  }
  if (!Number.isInteger(amount) || amount < 1) {
    message.reply({
      title: '💱 Quantidade inválida',
      description: 'Informe um inteiro ≥ 1 (ou `all`).',
      color: theme.colorError
    });
    return true;
  }

  const have = getBal(userData, pair.from);
  if (have < amount) {
    message.reply({
      title: '💱 Saldo insuficiente',
      description: `Você tem **${have}** ${pair.labelFrom}, tentou **${amount}**.`,
      color: theme.colorError
    });
    return true;
  }

  const afterTax = Math.floor(amount * (1 - TAX));
  const gained = Math.max(1, Math.floor(afterTax * pair.rate));
  const lostTax = amount - afterTax;

  setBal(userData, pair.from, have - amount);
  setBal(userData, pair.to, getBal(userData, pair.to) + gained);
  saveData(data);

  message.reply({
    title: '💱 Câmbio feito',
    description: [
      `−**${amount}** ${pair.labelFrom} → +**${gained}** ${pair.labelTo}`,
      `Taxa queimada: **${lostTax}** (${Math.round(TAX * 100)}%)`,
      '',
      `Saldo: **${getBal(userData, 'points')}** pts · **${getBal(userData, 'bakery')}** padaria · **${getBal(userData, 'poke')}** poke`
    ].join('\n'),
    color: theme.color
  });
  return true;
}

module.exports = {
  handleExchangeCommand,
  TAX
};
