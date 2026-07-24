/**
 * Padaria idle (inspirado no loop do bake.gg — não é clone).
 * Fluxo: assar → servir → moedas/xp → subir nível → mais fornos/receitas.
 *
 * Comandos:
 *   !padaria / !bakery     status da padaria
 *   !assar [receita]       começa a assar (forno livre)
 *   !servir                serve o que está pronto → moedas + xp
 *   !receitas              lista receitas desbloqueadas
 *   !forno                 upgrade de fornos (custa moedas da padaria)
 *   !rankpadaria           ranking do servidor
 *   !phelp / !ajuda padaria
 */

const { AttachmentBuilder } = require('discord.js');
const { getUserData, getGuildData, saveData } = require('./database');
const { theme, progressBar } = require('./theme');
const { renderBakeryPng } = require('./bakery-render');

/** @typedef {{ id: string, name: string, emoji: string, cookMs: number, coins: number, xp: number, unlockLevel: number }} Recipe */

/** @type {Recipe[]} */
const RECIPES = [
  { id: 'pao', name: 'Pão simples', emoji: '🍞', cookMs: 30_000, coins: 12, xp: 8, unlockLevel: 1 },
  { id: 'croissant', name: 'Croissant', emoji: '🥐', cookMs: 60_000, coins: 28, xp: 16, unlockLevel: 1 },
  { id: 'cookie', name: 'Cookie', emoji: '🍪', cookMs: 45_000, coins: 20, xp: 12, unlockLevel: 2 },
  { id: 'muffin', name: 'Muffin', emoji: '🧁', cookMs: 90_000, coins: 45, xp: 24, unlockLevel: 3 },
  { id: 'torta', name: 'Torta de maçã', emoji: '🥧', cookMs: 120_000, coins: 70, xp: 36, unlockLevel: 4 },
  { id: 'bolo', name: 'Bolo de chocolate', emoji: '🎂', cookMs: 180_000, coins: 120, xp: 55, unlockLevel: 5 },
  { id: 'donut', name: 'Donut glaceado', emoji: '🍩', cookMs: 75_000, coins: 40, xp: 22, unlockLevel: 6 },
  { id: 'cafe', name: 'Café especial', emoji: '☕', cookMs: 40_000, coins: 25, xp: 30, unlockLevel: 7 },
  { id: 'macaron', name: 'Macaron', emoji: '🍪', cookMs: 150_000, coins: 100, xp: 50, unlockLevel: 8 },
  { id: 'pretzel', name: 'Pretzel salgado', emoji: '🥨', cookMs: 100_000, coins: 65, xp: 35, unlockLevel: 9 },
  { id: 'baguete', name: 'Baguete real', emoji: '🥖', cookMs: 240_000, coins: 200, xp: 90, unlockLevel: 10 }
];

const COMMANDS = new Set([
  '!padaria',
  '!bakery',
  '!assar',
  '!prepare',
  '!servir',
  '!serve',
  '!receitas',
  '!recipes',
  '!forno',
  '!oven',
  '!rankpadaria',
  '!bakeryrank',
  '!padariahelp',
  '!bakeryhelp'
]);

function handleBakeryCommand(message, data) {
  const raw = message.content.trim();
  const args = raw.split(/\s+/);
  const command = args[0].toLowerCase();

  // !ajuda padaria / !help bakery
  if (
    (command === '!ajuda' || command === '!help') &&
    args[1] &&
    ['padaria', 'bakery', 'forno', 'assar'].includes(args[1].toLowerCase())
  ) {
    showBakeryHelp(message);
    return true;
  }

  if (!COMMANDS.has(command)) return false;

  ensureBakery(getUserData(data, message.guild.id, message.author.id));

  if (command === '!padaria' || command === '!bakery') {
    showBakery(message, data).catch((err) => {
      console.error('padaria render:', err);
      message.reply({
        title: '🥖 Erro ao renderizar',
        description: 'Não consegui gerar a imagem da padaria. O status em texto ainda funciona no log.',
        color: theme.colorError
      }).catch(() => null);
    });
    return true;
  }
  if (command === '!assar' || command === '!prepare') {
    startBake(message, args, data);
    return true;
  }
  if (command === '!servir' || command === '!serve') {
    serveReady(message, data);
    return true;
  }
  if (command === '!receitas' || command === '!recipes') {
    showRecipes(message, data);
    return true;
  }
  if (command === '!forno' || command === '!oven') {
    upgradeOven(message, data);
    return true;
  }
  if (command === '!rankpadaria' || command === '!bakeryrank') {
    showRank(message, data);
    return true;
  }
  if (command === '!padariahelp' || command === '!bakeryhelp') {
    showBakeryHelp(message);
    return true;
  }

  return false;
}

function defaultBakery() {
  return {
    level: 1,
    xp: 0,
    coins: 50,
    ovens: 1,
    totalServed: 0,
    totalEarned: 0,
    cooking: [], // { recipeId, readyAt, slot }
    createdAt: Date.now()
  };
}

function ensureBakery(userData) {
  if (!userData.bakery || typeof userData.bakery !== 'object') {
    userData.bakery = defaultBakery();
  }
  const b = userData.bakery;
  if (!Number.isInteger(b.level) || b.level < 1) b.level = 1;
  if (!Number.isInteger(b.xp) || b.xp < 0) b.xp = 0;
  if (!Number.isInteger(b.coins) || b.coins < 0) b.coins = 0;
  if (!Number.isInteger(b.ovens) || b.ovens < 1) b.ovens = 1;
  if (!Number.isInteger(b.totalServed)) b.totalServed = 0;
  if (!Number.isInteger(b.totalEarned)) b.totalEarned = 0;
  if (!Array.isArray(b.cooking)) b.cooking = [];
  // limpa entradas inválidas
  b.cooking = b.cooking.filter(
    (c) => c && typeof c.recipeId === 'string' && Number.isFinite(c.readyAt)
  );
  return b;
}

function xpToNext(level) {
  return 40 + level * 35;
}

function ovenUpgradeCost(ovens) {
  // 1→2: 80, 2→3: 200, 3→4: 450, ...
  return Math.floor(60 * Math.pow(2.2, ovens - 1));
}

function maxOvensForLevel(level) {
  return Math.min(5, 1 + Math.floor((level - 1) / 2));
}

function findRecipe(query) {
  if (!query) return null;
  const q = query.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return (
    RECIPES.find((r) => r.id === q) ||
    RECIPES.find((r) => r.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(q)) ||
    null
  );
}

function unlockedRecipes(level) {
  return RECIPES.filter((r) => r.unlockLevel <= level);
}

function formatDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

function showBakeryHelp(message) {
  message.reply({
    title: '🥖 Padaria da Morgana',
    description:
      'Mini-jogo idle no estilo *assar → servir → evoluir* (inspirado no bake.gg, conteúdo original).',
    fields: [
      {
        name: '🔁 Loop',
        value: '`!assar receita` → espera → `!servir` → moedas 🪙 + XP da padaria'
      },
      {
        name: '📋 Comandos',
        value: [
          '`!padaria` — status',
          '`!assar [receita]` — usa um forno livre',
          '`!servir` — vende o que ficou pronto',
          '`!receitas` — o que você pode assar',
          '`!forno` — compra mais forno (moedas da padaria)',
          '`!rankpadaria` — ranking do servidor'
        ].join('\n')
      },
      {
        name: '💡 Dica',
        value: 'Comece com `!assar pao` ou `!assar croissant`. Moedas da padaria **não** misturam com pontos do servidor.'
      },
      {
        name: '🎨 Pixel-art',
        value:
          '`!padaria` gera uma imagem da loja. Coloque sprites em `assets/bakery/` (ver README lá) — sem arte, usa placeholders.'
      }
    ],
    color: theme.color
  });
}

async function showBakery(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const now = Date.now();
  const need = xpToNext(b.level);
  const bar = progressBar(b.xp, need, 12);

  const ready = [];
  const cooking = [];
  for (const job of b.cooking) {
    const recipe = RECIPES.find((r) => r.id === job.recipeId);
    const label = recipe ? `${recipe.emoji} ${recipe.name}` : job.recipeId;
    if (job.readyAt <= now) ready.push(label);
    else cooking.push(`${label} · <t:${Math.floor(job.readyAt / 1000)}:R>`);
  }

  const freeOvens = Math.max(0, b.ovens - b.cooking.length);
  const maxOvens = maxOvensForLevel(b.level);

  let files;
  let image;
  try {
    const png = renderBakeryPng(b, {
      displayName: message.author.username,
      now
    });
    files = [new AttachmentBuilder(png, { name: 'padaria.png' })];
    image = 'attachment://padaria.png';
  } catch (err) {
    console.error('bakery png:', err);
  }

  await message.reply({
    title: `🥖 Padaria de ${message.author.username}`,
    description: `${bar}\nNível **${b.level}** · XP **${b.xp}/${need}**`,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
    image,
    files,
    fields: [
      { name: '🪙 Moedas', value: `**${b.coins}**`, inline: true },
      { name: '🔥 Fornos', value: `**${b.ovens}**/${maxOvens} (livres: ${freeOvens})`, inline: true },
      { name: '📦 Servidos', value: `**${b.totalServed}**`, inline: true },
      {
        name: '⏳ Assando',
        value: cooking.length ? cooking.join('\n') : '*vazio — use `!assar`*',
        inline: false
      },
      {
        name: '✅ Pronto pra servir',
        value: ready.length ? ready.join('\n') : '*nada ainda*',
        inline: false
      }
    ],
    color: theme.color
  });
}

function startBake(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const now = Date.now();

  // limpa slots que já foram servidos? cooking holds both cooking and ready until serve
  if (b.cooking.length >= b.ovens) {
    const anyReady = b.cooking.some((j) => j.readyAt <= now);
    message.reply({
      title: '🔥 Fornos ocupados',
      description: anyReady
        ? 'Todos os fornos estão em uso, mas tem coisa **pronta**.\nUse `!servir` pra liberar espaço!'
        : `Todos os **${b.ovens}** forno(s) estão assando.\nVeja o tempo em \`!padaria\` ou compre outro com \`!forno\`.`,
      color: theme.colorWarn
    });
    return;
  }

  const query = args.slice(1).join(' ').trim();
  let recipe = findRecipe(query);

  if (!recipe) {
    // sugestão: primeira desbloqueada mais rápida se não passou nome
    const unlocked = unlockedRecipes(b.level);
    if (!query && unlocked.length) {
      recipe = unlocked[0];
    } else {
      const list = unlocked
        .slice(0, 8)
        .map((r) => `\`${r.id}\` ${r.emoji} ${r.name}`)
        .join('\n');
      message.reply({
        title: '🥖 O que assar?',
        description: query
          ? `Não achei a receita **${query}**.\nUse \`!receitas\` ou um id:`
          : 'Use `!assar <receita>` — exemplos:',
        fields: [{ name: 'Desbloqueadas', value: list || '*suba de nível!*' }],
        color: theme.color
      });
      return;
    }
  }

  if (recipe.unlockLevel > b.level) {
    message.reply({
      title: '🔒 Receita trancada',
      description: `${recipe.emoji} **${recipe.name}** precisa da padaria **nível ${recipe.unlockLevel}** (você é **${b.level}**).`,
      color: theme.colorError
    });
    return;
  }

  const readyAt = now + recipe.cookMs;
  b.cooking.push({ recipeId: recipe.id, readyAt });
  saveData(data);

  message.reply({
    title: `${recipe.emoji} Assando…`,
    description: [
      `**${recipe.name}** entrou no forno!`,
      `Pronto <t:${Math.floor(readyAt / 1000)}:R> · \`${formatDuration(recipe.cookMs)}\``,
      `Fornos: **${b.cooking.length}/${b.ovens}** em uso`,
      '',
      'Quando acabar: `!servir`'
    ].join('\n'),
    color: theme.color
  });
}

function serveReady(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const now = Date.now();

  const ready = b.cooking.filter((j) => j.readyAt <= now);
  if (!ready.length) {
    const next = b.cooking
      .filter((j) => j.readyAt > now)
      .sort((a, b2) => a.readyAt - b2.readyAt)[0];
    message.reply({
      title: '🍽️ Nada pronto',
      description: next
        ? `Ainda assando… próximo em <t:${Math.floor(next.readyAt / 1000)}:R>.\nUse \`!padaria\` pra ver tudo.`
        : 'Nada no forno. Comece com `!assar pao`!',
      color: theme.colorWarn
    });
    return;
  }

  let coinsGain = 0;
  let xpGain = 0;
  const lines = [];

  for (const job of ready) {
    const recipe = RECIPES.find((r) => r.id === job.recipeId);
    if (!recipe) continue;
    // bônus leve por nível da padaria
    const lvlBonus = 1 + (b.level - 1) * 0.04;
    const c = Math.floor(recipe.coins * lvlBonus);
    const x = Math.floor(recipe.xp * lvlBonus);
    coinsGain += c;
    xpGain += x;
    lines.push(`${recipe.emoji} **${recipe.name}** · +${c}🪙 +${x}XP`);
  }

  b.cooking = b.cooking.filter((j) => j.readyAt > now);
  b.coins += coinsGain;
  b.totalEarned += coinsGain;
  b.totalServed += ready.length;

  // level ups
  b.xp += xpGain;
  let leveled = 0;
  while (b.xp >= xpToNext(b.level)) {
    b.xp -= xpToNext(b.level);
    b.level += 1;
    leveled += 1;
    // desbloqueia forno slot cap por nível (não dá forno grátis, só aumenta o teto)
  }

  saveData(data);

  const fields = [
    { name: '🪙 Moedas', value: `**+${coinsGain}** → saldo **${b.coins}**`, inline: true },
    { name: '⭐ XP padaria', value: `**+${xpGain}**`, inline: true },
    { name: '📦 Total servido', value: `**${b.totalServed}**`, inline: true }
  ];

  if (leveled) {
    fields.push({
      name: '🎉 Level up!',
      value: `Padaria agora nível **${b.level}**! Confira \`!receitas\` e o teto de fornos com \`!forno\`.`,
      inline: false
    });
  }

  message.reply({
    title: '🍽️ Servido!',
    description: lines.join('\n') || 'Itens servidos.',
    fields,
    color: theme.color
  });
}

function showRecipes(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);

  const open = [];
  const locked = [];
  for (const r of RECIPES) {
    const line = `${r.emoji} \`${r.id}\` **${r.name}** · ${formatDuration(r.cookMs)} · ${r.coins}🪙 / ${r.xp}XP`;
    if (r.unlockLevel <= b.level) open.push(line);
    else locked.push(`🔒 Nv.${r.unlockLevel} — ${r.emoji} ${r.name}`);
  }

  message.reply({
    title: '📋 Receitas',
    description: `Padaria nível **${b.level}** · use \`!assar <id>\``,
    fields: [
      { name: '✅ Desbloqueadas', value: open.join('\n').slice(0, 1000) || '—' },
      {
        name: '🔒 Bloqueadas',
        value: (locked.slice(0, 8).join('\n') || '*você desbloqueou tudo!*').slice(0, 1000)
      }
    ],
    color: theme.color
  });
}

function upgradeOven(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const cap = maxOvensForLevel(b.level);

  if (b.ovens >= 5) {
    message.reply({
      title: '🔥 Fornos no máximo',
      description: 'Você já tem o máximo global de **5** fornos.',
      color: theme.colorWarn
    });
    return;
  }

  if (b.ovens >= cap) {
    message.reply({
      title: '🔒 Nível insuficiente',
      description: `No nível **${b.level}** o teto é **${cap}** forno(s).\nSuba a padaria servindo clientes pra liberar mais!`,
      color: theme.colorWarn
    });
    return;
  }

  const cost = ovenUpgradeCost(b.ovens);
  if (b.coins < cost) {
    message.reply({
      title: '🪙 Moedas insuficientes',
      description: `Próximo forno custa **${cost}** 🪙 · você tem **${b.coins}**.\nAsse e sirva mais com \`!assar\` / \`!servir\`!`,
      color: theme.colorError
    });
    return;
  }

  b.coins -= cost;
  b.ovens += 1;
  saveData(data);

  message.reply({
    title: '🔥 Novo forno!',
    description: `Comprou um forno por **${cost}** 🪙.\nAgora você tem **${b.ovens}** forno(s) · saldo **${b.coins}** 🪙`,
    color: theme.color
  });
}

function showRank(message, data) {
  const guildData = getGuildData(data, message.guild.id);
  const rows = [];

  for (const [userId, user] of Object.entries(guildData.users)) {
    if (!user?.bakery) continue;
    const b = user.bakery;
    rows.push({
      userId,
      level: b.level || 1,
      earned: b.totalEarned || 0,
      served: b.totalServed || 0
    });
  }

  rows.sort((a, b) => b.level - a.level || b.earned - a.earned || b.served - a.served);

  if (!rows.length) {
    message.reply({
      title: '🏆 Rank padaria',
      description: 'Ninguém abriu padaria ainda. Seja o primeiro com `!assar pao`!',
      color: theme.color
    });
    return;
  }

  const lines = rows.slice(0, 10).map((r, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `\`${i + 1}.\``;
    return `${medal} <@${r.userId}> · nv.**${r.level}** · ${r.earned}🪙 total · ${r.served} servidos`;
  });

  message.reply({
    title: '🏆 Rank · Padarias do servidor',
    description: lines.join('\n'),
    color: theme.color
  });
}

module.exports = {
  handleBakeryCommand,
  RECIPES,
  ensureBakery
};
