/**
 * Câmbio entre pontos, moedas da padaria e pokécoins.
 * Taxa alta de propósito (sink + anti-exploit).
 */

const { getUserData, saveData, saveUser } = require('./database');
const { ensureBakery } = require('./bakery');
const { theme, pickRandom } = require('./theme');

/** Taxa: você perde TAX da quantia convertida (fica 1-TAX). Sink forte. */
const TAX = 0.45;

const OFRENDA_MIN = 10;
const OFRENDA_MAX = 5000;

const OFRENDA_FLAVOR = [
  'A oferenda some na escuridão do Abismo — Hallownest lembra.',
  'O Elderbug acena: “generoso… como nos velhos tempos”.',
  'Sly conta as moedas e sorri. O hall fica um pouco mais rico em espírito.',
  'A Radiância não recebe isto — mas o povo de Dirtmouth agradece.',
  'Geo imaginário cai no poço. Seu nome ecoa no salão.'
];

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

  if (['!economia', '!economy', '!moedas'].includes(command)) {
    showEconomyHelp(message, data);
    return true;
  }

  if (['!ofrenda', '!doar', '!offer', '!offering'].includes(command)) {
    handleOfrenda(message, args, data);
    return true;
  }

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
        '`!economia` — guia completo · `!ofrenda <pts>` — sink de pontos',
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
  saveUser(data, message.guild.id, message.author.id);

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

function showEconomyHelp(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  ensureBakery(userData);
  ensurePoke(userData);

  message.reply({
    title: '💰 Economia Morgana',
    description: 'Três moedas **separadas**. Farmar no sistema nativo costuma valer mais que câmbio.',
    fields: [
      {
        name: '🪙 Moedas',
        value: [
          '**Pontos** — daily, quests, minigames, chat (indireto via XP/loja)',
          '**Padaria** — assar/servir no canal da padaria',
          '**Poke** — captura, daily poke, loja Pokémon'
        ].join('\n'),
        inline: false
      },
      {
        name: `💱 Câmbio (taxa ${Math.round(TAX * 100)}%)`,
        value: [
          '`!cambio <de> <para> <qtd>`',
          'Parte da quantia **queima** de propósito (anti-exploit + sink).',
          'Ex: `!cambio pontos padaria 100`'
        ].join('\n'),
        inline: false
      },
      {
        name: '🔥 Sinks (gastar / queimar)',
        value: [
          '`!loja` · `!cosmetico` · upgrades da padaria · `!ploja`',
          '`!ofrenda <pts>` — doa pontos ao hall (some do seu saldo)',
          'Apostas / minigames com risco'
        ].join('\n'),
        inline: false
      },
      {
        name: '📊 Seu saldo',
        value: `**${userData.points || 0}** pts · **${userData.bakery?.coins || 0}** padaria · **${userData.pokemon?.coins || 0}** poke`,
        inline: false
      }
    ],
    color: theme.color
  });
}

function handleOfrenda(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const raw = args[1];
  let amount = parseInt(raw, 10);
  if (raw?.toLowerCase() === 'all' || raw?.toLowerCase() === 'tudo') {
    amount = userData.points || 0;
  }
  if (!Number.isInteger(amount) || amount < OFRENDA_MIN) {
    message.reply({
      title: '🕯️ Oferenda',
      description: [
        `Doe pontos ao hall (somem do seu saldo — sink).`,
        `Uso: \`!ofrenda <${OFRENDA_MIN}–${OFRENDA_MAX}>\` ou \`!ofrenda tudo\``,
        `Você tem **${userData.points || 0}** pts.`
      ].join('\n'),
      color: theme.color
    });
    return;
  }
  amount = Math.min(OFRENDA_MAX, amount);
  if ((userData.points || 0) < amount) {
    message.reply({
      title: '🕯️ Saldo insuficiente',
      description: `Precisa de **${amount}** pts · tem **${userData.points || 0}**.`,
      color: theme.colorError
    });
    return;
  }

  userData.points -= amount;
  if (!userData.stats || typeof userData.stats !== 'object') userData.stats = {};
  userData.stats.offeredPoints = (userData.stats.offeredPoints || 0) + amount;
  saveUser(data, message.guild.id, message.author.id);

  message.reply({
    title: '🕯️ Oferenda aceita',
    description: [
      `Você doou **${amount}** pontos ao hall.`,
      `*${pickRandom(OFRENDA_FLAVOR)}*`,
      '',
      `Total doado (histórico): **${userData.stats.offeredPoints}** pts`,
      `Saldo agora: **${userData.points}** pts`
    ].join('\n'),
    color: theme.color
  });
}

module.exports = {
  handleExchangeCommand,
  showEconomyHelp,
  handleOfrenda,
  TAX
};
