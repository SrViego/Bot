/**
 * Padaria idle (inspirado no loop do bake.gg — não é clone).
 * Fluxo: assar → servir → moedas/xp → subir nível → fornos + upgrades.
 *
 * Comandos:
 *   !padaria / !bakery     status da padaria
 *   !assar [receita]       começa a assar (forno livre)
 *   !servir                serve o que está pronto → moedas + xp
 *   !receitas              lista receitas desbloqueadas
 *   !forno                 compra forno extra (moedas da padaria)
 *   !upgrade [id]          loja de melhorias (moedas da padaria)
 *   !rankpadaria           ranking do servidor
 *   !phelp / !ajuda padaria
 */

const { AttachmentBuilder } = require('discord.js');
const { getUserData, getGuildData, saveData, saveUser } = require('./database');

function persistAuthor(data, message) {
  saveUser(data, message.guild.id, message.author.id);
}
const { theme, progressBar } = require('./theme');
const { renderBakeryPng } = require('./bakery-render');
const { trackQuest } = require('./quests');
const {
  getBakeryCoinMultiplier,
  contributeBakeryBoss
} = require('./guild-events');

/** Canal exclusivo da padaria — defina BAKERY_CHANNEL_ID no .env (sem fallback hardcoded). */
const BAKERY_CHANNEL_ID = process.env.BAKERY_CHANNEL_ID || null;
if (!BAKERY_CHANNEL_ID) {
  console.warn('[bakery] BAKERY_CHANNEL_ID não definido no .env — comandos da padaria ficam desativados.');
}

/** @typedef {{ id: string, name: string, emoji: string, cookMs: number, coins: number, xp: number, unlockLevel: number }} Recipe */

/**
 * Economia: ~0.25–0.35 🪙/s base (antes de upgrades).
 * Late game paga melhor por tempo, mas upgrades custam bem mais.
 * @type {Recipe[]}
 */
const RECIPES = [
  { id: 'pao', name: 'Pão simples', emoji: '🍞', cookMs: 45_000, coins: 8, xp: 6, unlockLevel: 1 },
  { id: 'croissant', name: 'Croissant', emoji: '🥐', cookMs: 75_000, coins: 16, xp: 11, unlockLevel: 1 },
  { id: 'cookie', name: 'Cookie', emoji: '🍪', cookMs: 60_000, coins: 12, xp: 9, unlockLevel: 2 },
  { id: 'muffin', name: 'Muffin', emoji: '🧁', cookMs: 100_000, coins: 28, xp: 18, unlockLevel: 3 },
  { id: 'torta', name: 'Torta de maçã', emoji: '🥧', cookMs: 140_000, coins: 42, xp: 26, unlockLevel: 4 },
  { id: 'bolo', name: 'Bolo de chocolate', emoji: '🎂', cookMs: 200_000, coins: 70, xp: 40, unlockLevel: 5 },
  { id: 'donut', name: 'Donut glaceado', emoji: '🍩', cookMs: 90_000, coins: 26, xp: 17, unlockLevel: 6 },
  { id: 'cafe', name: 'Café especial', emoji: '☕', cookMs: 50_000, coins: 14, xp: 16, unlockLevel: 7 },
  { id: 'macaron', name: 'Macaron', emoji: '🍪', cookMs: 160_000, coins: 58, xp: 34, unlockLevel: 8 },
  { id: 'pretzel', name: 'Pretzel salgado', emoji: '🥨', cookMs: 110_000, coins: 38, xp: 24, unlockLevel: 9 },
  { id: 'baguete', name: 'Baguete real', emoji: '🥖', cookMs: 280_000, coins: 110, xp: 55, unlockLevel: 10 }
];

/**
 * Upgrades permanentes (gastam moedas da padaria).
 * level = quantas vezes já comprou (0 = sem upgrade).
 * @type {Record<string, {
 *   id: string,
 *   name: string,
 *   emoji: string,
 *   aliases: string[],
 *   maxLevel: number,
 *   cost: (level: number) => number,
 *   effectLine: (level: number) => string
 * }>}
 */
const UPGRADES = {
  speed: {
    id: 'speed',
    name: 'Forno veloz',
    emoji: '⚡',
    aliases: ['velocidade', 'veloz', 'rapido', 'rápido', 'fornoveloz'],
    maxLevel: 8,
    /** @param {number} level nível atual (custo do próximo) */
    cost: (level) => Math.floor(80 * Math.pow(1.72, level)),
    effectLine: (level) =>
      level <= 0 ? '−0% tempo de forno' : `−${4 * level}% tempo de forno (máx −32%)`
  },
  profit: {
    id: 'profit',
    name: 'Preço premium',
    emoji: '💰',
    aliases: ['lucro', 'preco', 'preço', 'moedas', 'dinheiro'],
    maxLevel: 8,
    cost: (level) => Math.floor(95 * Math.pow(1.72, level)),
    effectLine: (level) =>
      level <= 0 ? '+0% moedas ao servir' : `+${4 * level}% moedas ao servir (máx +32%)`
  },
  mastery: {
    id: 'mastery',
    name: 'Receita de mestre',
    emoji: '📚',
    aliases: ['xp', 'exp', 'experiencia', 'experiência', 'mestre', 'receita'],
    maxLevel: 8,
    cost: (level) => Math.floor(85 * Math.pow(1.72, level)),
    effectLine: (level) =>
      level <= 0 ? '+0% XP da padaria' : `+${4 * level}% XP da padaria (máx +32%)`
  },
  luck: {
    id: 'luck',
    name: 'Cliente generoso',
    emoji: '🍀',
    aliases: ['sorte', 'lucky', 'crit', 'critico', 'crítico', 'generoso'],
    maxLevel: 5,
    cost: (level) => Math.floor(140 * Math.pow(1.85, level)),
    effectLine: (level) =>
      level <= 0 ? '0% chance de 2× moedas' : `${3 * level}% chance de 2× moedas (máx 15%)`
  },
  charm: {
    id: 'charm',
    name: 'Vitrine charmosa',
    emoji: '✨',
    aliases: ['vitrine', 'charme', 'marketing', 'propaganda'],
    maxLevel: 5,
    cost: (level) => Math.floor(110 * Math.pow(1.8, level)),
    effectLine: (level) =>
      level <= 0
        ? 'sem bônus de “combo”'
        : `+${2 * level}🪙 fixos por item servido (máx +10)`
  }
};

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
  '!upgrade',
  '!upgrades',
  '!melhoria',
  '!melhorias',
  '!pedido',
  '!pedidos',
  '!order',
  '!orders',
  '!fornonotify',
  '!padarianotify',
  '!rankpadaria',
  '!bakeryrank',
  '!padariahelp',
  '!bakeryhelp'
]);

/** Pedidos de NPC — bônus calibrado */
const ORDER_POOL = [
  { items: { pao: 2 }, bonus: 12, name: 'Café da manhã do Elderbug' },
  { items: { croissant: 1, cafe: 1 }, bonus: 22, name: 'Pedido da Iselda' },
  { items: { cookie: 3 }, bonus: 18, name: 'Doces pro Quirrel' },
  { items: { muffin: 2 }, bonus: 28, name: 'Lanche da Cloth' },
  { items: { torta: 1 }, bonus: 32, name: 'Torta pro Sly' },
  { items: { pao: 1, croissant: 1 }, bonus: 20, name: 'Combo do Cornifer' },
  { items: { donut: 2 }, bonus: 30, name: 'Donuts do Tiso' },
  { items: { baguete: 1 }, bonus: 55, name: 'Baguete real da White Lady' },
  { items: { cafe: 2, cookie: 1 }, bonus: 24, name: 'Pausa do Nailsmith' },
  { items: { pretzel: 1, cafe: 1 }, bonus: 30, name: 'Lanche do Lemm' }
];

function inBakeryChannel(message) {
  if (!BAKERY_CHANNEL_ID) return false;
  return message.channel?.id === BAKERY_CHANNEL_ID;
}

function denyWrongChannel(message) {
  const desc = BAKERY_CHANNEL_ID
    ? `Os comandos da padaria só funcionam em <#${BAKERY_CHANNEL_ID}>.`
    : 'Padaria desativada: defina `BAKERY_CHANNEL_ID` no arquivo `.env`.';
  message
    .reply({
      title: '🥖 Canal da padaria',
      description: desc,
      color: theme.colorWarn
    })
    .catch(() => null);
}

function handleBakeryCommand(message, data) {
  const raw = message.content.trim();
  const args = raw.split(/\s+/);
  const command = args[0].toLowerCase();

  // !ajuda padaria / !help bakery
  if (
    (command === '!ajuda' || command === '!help') &&
    args[1] &&
    ['padaria', 'bakery', 'forno', 'assar', 'upgrade', 'pedido'].includes(args[1].toLowerCase())
  ) {
    if (!inBakeryChannel(message)) {
      denyWrongChannel(message);
      return true;
    }
    showBakeryHelp(message);
    return true;
  }

  if (!COMMANDS.has(command)) return false;

  if (!inBakeryChannel(message)) {
    denyWrongChannel(message);
    return true;
  }

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
  if (
    command === '!upgrade' ||
    command === '!upgrades' ||
    command === '!melhoria' ||
    command === '!melhorias'
  ) {
    handleUpgradeCommand(message, args, data);
    return true;
  }
  if (command === '!pedido' || command === '!pedidos' || command === '!order' || command === '!orders') {
    handleOrderCommand(message, args, data);
    return true;
  }
  if (command === '!fornonotify' || command === '!padarianotify') {
    toggleOvenNotify(message, data);
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
    coins: 25,
    ovens: 1,
    totalServed: 0,
    totalEarned: 0,
    upgrades: emptyUpgrades(),
    cooking: [], // { recipeId, readyAt, slot }
    order: null, // { id, name, need: {recipeId: n}, progress: {}, bonus, expiresAt }
    notifyReady: false,
    lastNotifyAt: 0,
    createdAt: Date.now()
  };
}

function emptyUpgrades() {
  /** @type {Record<string, number>} */
  const u = {};
  for (const id of Object.keys(UPGRADES)) u[id] = 0;
  return u;
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
  if (!b.upgrades || typeof b.upgrades !== 'object') b.upgrades = emptyUpgrades();
  for (const id of Object.keys(UPGRADES)) {
    const lv = b.upgrades[id];
    if (!Number.isInteger(lv) || lv < 0) b.upgrades[id] = 0;
    else if (lv > UPGRADES[id].maxLevel) b.upgrades[id] = UPGRADES[id].maxLevel;
  }
  if (b.order !== null && typeof b.order !== 'object') b.order = null;
  if (typeof b.notifyReady !== 'boolean') b.notifyReady = false;
  if (!Number.isFinite(b.lastNotifyAt)) b.lastNotifyAt = 0;
  // limpa entradas inválidas
  b.cooking = b.cooking.filter(
    (c) => c && typeof c.recipeId === 'string' && Number.isFinite(c.readyAt)
  );
  // pedido expirado
  if (b.order && b.order.expiresAt && b.order.expiresAt < Date.now()) {
    b.order = null;
  }
  return b;
}

function upgradeLevel(b, id) {
  return b.upgrades?.[id] || 0;
}

/** Multiplicador de tempo de forno (0.68 = −32% no max speed). */
function cookTimeMultiplier(b) {
  const lv = upgradeLevel(b, 'speed');
  return Math.max(0.68, 1 - 0.04 * lv);
}

function findUpgrade(query) {
  if (!query) return null;
  const q = query.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (UPGRADES[q]) return UPGRADES[q];
  for (const u of Object.values(UPGRADES)) {
    if (u.id === q) return u;
    if (u.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(q)) return u;
    if (u.aliases.some((a) => a.normalize('NFD').replace(/\p{M}/gu, '') === q || a.includes(q))) {
      return u;
    }
  }
  return null;
}

function xpToNext(level) {
  // progresso mais lento: nv1→2 ~70 XP, escala com o nível
  return 55 + level * 48;
}

function ovenUpgradeCost(ovens) {
  // 1→2: 150, 2→3: 360, 3→4: 864, ...
  return Math.floor(150 * Math.pow(2.4, ovens - 1));
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
          '`!forno` — compra mais forno',
          '`!upgrade` — loja de melhorias (gasta 🪙 da padaria)',
          '`!upgrade <id>` — compra um upgrade',
          '`!pedido` — pedidos de NPC (bônus extra)',
          '`!fornonotify` — DM quando o forno fica pronto',
          '`!rankpadaria` — ranking do servidor'
        ].join('\n')
      },
      {
        name: '⬆️ Upgrades (moedas da padaria)',
        value: Object.values(UPGRADES)
          .map((u) => `${u.emoji} \`${u.id}\` **${u.name}**`)
          .join('\n')
      },
      {
        name: '📍 Canal',
        value: `Tudo da padaria só neste canal: <#${BAKERY_CHANNEL_ID}>`
      },
      {
        name: '💡 Dica',
        value:
          'Comece com `!assar pao`. Upgrades e fornos são o sink principal de 🪙. Moedas da padaria **não** misturam com pontos/pokécoins (câmbio tem taxa alta).'
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
  const upgradeSummary = Object.values(UPGRADES)
    .map((u) => {
      const lv = upgradeLevel(b, u.id);
      return `${u.emoji} ${u.name} **${lv}/${u.maxLevel}**`;
    })
    .join('\n');

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
        name: '⬆️ Melhorias',
        value: upgradeSummary + '\n`!upgrade` pra gastar 🪙',
        inline: false
      },
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

  const cookMs = Math.max(5_000, Math.floor(recipe.cookMs * cookTimeMultiplier(b)));
  const readyAt = now + cookMs;
  b.cooking.push({ recipeId: recipe.id, readyAt });
  trackQuest(data, message.guild.id, message.author.id, 'bakery_bake', 1, false);
  persistAuthor(data, message);

  const speedLv = upgradeLevel(b, 'speed');
  const speedNote =
    speedLv > 0
      ? ` ⚡ −${4 * speedLv}% (${formatDuration(recipe.cookMs)} → ${formatDuration(cookMs)})`
      : '';

  message.reply({
    title: `${recipe.emoji} Assando…`,
    description: [
      `**${recipe.name}** entrou no forno!`,
      `Pronto <t:${Math.floor(readyAt / 1000)}:R> · \`${formatDuration(cookMs)}\`${speedNote}`,
      `Fornos: **${b.cooking.length}/${b.ovens}** em uso`,
      b.notifyReady ? '🔔 Aviso por DM ativado (`!fornonotify`)' : '',
      '',
      'Quando acabar: `!servir`'
    ]
      .filter(Boolean)
      .join('\n'),
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
  let luckHits = 0;
  let orderBonus = 0;
  const lines = [];
  const servedIds = [];

  const profitLv = upgradeLevel(b, 'profit');
  const masteryLv = upgradeLevel(b, 'mastery');
  const luckLv = upgradeLevel(b, 'luck');
  const charmLv = upgradeLevel(b, 'charm');
  const profitMult = 1 + 0.04 * profitLv;
  const xpMult = 1 + 0.04 * masteryLv;
  const luckChance = 0.03 * luckLv;
  const charmFlat = 2 * charmLv;
  const eventMult = getBakeryCoinMultiplier(data, message.guild.id);

  for (const job of ready) {
    const recipe = RECIPES.find((r) => r.id === job.recipeId);
    if (!recipe) continue;
    servedIds.push(recipe.id);
    // bônus leve por nível da padaria + upgrades + evento
    const lvlBonus = 1 + (b.level - 1) * 0.025;
    let c = Math.floor(recipe.coins * lvlBonus * profitMult * eventMult) + charmFlat;
    const x = Math.floor(recipe.xp * lvlBonus * xpMult);
    let lucky = false;
    if (luckChance > 0 && Math.random() < luckChance) {
      c *= 2;
      lucky = true;
      luckHits += 1;
    }
    coinsGain += c;
    xpGain += x;
    lines.push(
      `${recipe.emoji} **${recipe.name}** · +${c}🪙 +${x}XP${lucky ? ' 🍀 **2×**' : ''}${
        eventMult > 1 ? ' 🎉' : ''
      }`
    );
  }

  // progresso de pedido NPC
  if (b.order && b.order.need) {
    if (!b.order.progress) b.order.progress = {};
    for (const id of servedIds) {
      if (b.order.need[id]) {
        b.order.progress[id] = (b.order.progress[id] || 0) + 1;
      }
    }
    const complete = Object.keys(b.order.need).every(
      (id) => (b.order.progress[id] || 0) >= b.order.need[id]
    );
    if (complete) {
      orderBonus = b.order.bonus || 0;
      coinsGain += orderBonus;
      lines.push(`📋 **Pedido completo:** ${b.order.name} · +**${orderBonus}** 🪙 bônus!`);
      b.order = null;
    }
  }

  b.cooking = b.cooking.filter((j) => j.readyAt > now);
  b.coins += coinsGain;
  b.totalEarned += coinsGain;
  b.totalServed += ready.length;

  trackQuest(data, message.guild.id, message.author.id, 'bakery_serve', ready.length, false);

  const boss = contributeBakeryBoss(data, message.guild.id, message.author.id, ready.length);
  if (boss?.completed) {
    b.coins += boss.bakery || 0;
    const ud = getUserData(data, message.guild.id, message.author.id);
    ud.points = (ud.points || 0) + (boss.points || 0);
    lines.push(
      `👹 **Chefe derrotado!** +**${boss.points}** pts + **${boss.bakery}** 🪙 padaria (você ajudou no golpe final)`
    );
  } else if (boss && !boss.completed) {
    lines.push(`👹 Chefe da padaria: **${boss.progress}/${boss.goal}**`);
  }

  // level ups
  b.xp += xpGain;
  let leveled = 0;
  while (b.xp >= xpToNext(b.level)) {
    b.xp -= xpToNext(b.level);
    b.level += 1;
    leveled += 1;
    // desbloqueia forno slot cap por nível (não dá forno grátis, só aumenta o teto)
  }

  persistAuthor(data, message);

  const fields = [
    { name: '🪙 Moedas', value: `**+${coinsGain}** → saldo **${b.coins}**`, inline: true },
    { name: '⭐ XP padaria', value: `**+${xpGain}**`, inline: true },
    { name: '📦 Total servido', value: `**${b.totalServed}**`, inline: true }
  ];

  if (luckHits > 0) {
    fields.push({
      name: '🍀 Cliente generoso',
      value: `Proc **2×** em **${luckHits}** item(ns)!`,
      inline: false
    });
  }

  if (leveled) {
    fields.push({
      name: '🎉 Level up!',
      value: `Padaria agora nível **${b.level}**! Confira \`!receitas\`, \`!forno\` e \`!upgrade\`.`,
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

function handleUpgradeCommand(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const query = args.slice(1).join(' ').trim();

  if (!query) {
    showUpgradeShop(message, b);
    return;
  }

  const upgrade = findUpgrade(query);
  if (!upgrade) {
    message.reply({
      title: '❓ Upgrade desconhecido',
      description: `Não achei **${query}**.\nUse \`!upgrade\` pra ver a loja (ids: ${Object.keys(UPGRADES)
        .map((id) => `\`${id}\``)
        .join(', ')}).`,
      color: theme.colorError
    });
    return;
  }

  buyUpgrade(message, data, b, upgrade);
}

function showUpgradeShop(message, b) {
  const lines = Object.values(UPGRADES).map((u) => {
    const lv = upgradeLevel(b, u.id);
    const maxed = lv >= u.maxLevel;
    const cost = maxed ? '—' : `${u.cost(lv)}🪙`;
    const next = maxed ? '**MAX**' : `→ nv.${lv + 1} por **${cost}**`;
    return [
      `${u.emoji} \`${u.id}\` **${u.name}** · ${lv}/${u.maxLevel} ${next}`,
      `└ ${u.effectLine(lv)}${maxed ? '' : ` · depois: ${u.effectLine(lv + 1)}`}`
    ].join('\n');
  });

  message.reply({
    title: '⬆️ Melhorias da padaria',
    description: [
      `Saldo: **${b.coins}** 🪙 da padaria`,
      'Compre com `!upgrade <id>` — ex: `!upgrade speed`',
      '',
      lines.join('\n\n')
    ].join('\n'),
    fields: [
      {
        name: '🔥 Também',
        value: '`!forno` — forno extra (paralelo, não é desta lista)',
        inline: false
      }
    ],
    color: theme.color
  });
}

function buyUpgrade(message, data, b, upgrade) {
  const lv = upgradeLevel(b, upgrade.id);
  if (lv >= upgrade.maxLevel) {
    message.reply({
      title: '✨ Já no máximo',
      description: `${upgrade.emoji} **${upgrade.name}** já está **${lv}/${upgrade.maxLevel}**.\n${upgrade.effectLine(lv)}`,
      color: theme.colorWarn
    });
    return;
  }

  const cost = upgrade.cost(lv);
  if (b.coins < cost) {
    message.reply({
      title: '🪙 Moedas insuficientes',
      description: [
        `${upgrade.emoji} **${upgrade.name}** nv.${lv + 1} custa **${cost}** 🪙`,
        `Você tem **${b.coins}** — falta **${cost - b.coins}**.`,
        'Asse e sirva (`!assar` / `!servir`) pra juntar mais!'
      ].join('\n'),
      color: theme.colorError
    });
    return;
  }

  b.coins -= cost;
  b.upgrades[upgrade.id] = lv + 1;
  trackQuest(data, message.guild.id, message.author.id, 'bakery_upgrade', 1, false);
  persistAuthor(data, message);

  const newLv = b.upgrades[upgrade.id];
  message.reply({
    title: `${upgrade.emoji} Upgrade comprado!`,
    description: [
      `**${upgrade.name}** → nível **${newLv}/${upgrade.maxLevel}**`,
      `Custo: **${cost}** 🪙 · saldo **${b.coins}** 🪙`,
      '',
      upgrade.effectLine(newLv)
    ].join('\n'),
    color: theme.color
  });
}

function handleOrderCommand(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  const sub = (args[1] || 'ver').toLowerCase();

  if (sub === 'novo' || sub === 'new' || sub === 'pegar') {
    if (b.order && b.order.expiresAt > Date.now()) {
      message.reply({
        title: '📋 Pedido em andamento',
        description: formatOrder(b.order) + '\nCancele com `!pedido cancelar` se quiser outro.',
        color: theme.colorWarn
      });
      return;
    }
    const template = ORDER_POOL[Math.floor(Math.random() * ORDER_POOL.length)];
    // filtra itens que o jogador pode fazer (nível)
    const need = {};
    for (const [id, n] of Object.entries(template.items)) {
      const recipe = RECIPES.find((r) => r.id === id);
      if (recipe && recipe.unlockLevel <= b.level) need[id] = n;
    }
    if (!Object.keys(need).length) {
      // fallback pão
      need.pao = 2;
    }
    b.order = {
      name: template.name,
      need,
      progress: {},
      bonus: template.bonus + Math.floor(b.level * 1.5),
      expiresAt: Date.now() + 40 * 60_000
    };
    persistAuthor(data, message);
    message.reply({
      title: '📋 Novo pedido!',
      description: [
        formatOrder(b.order),
        '',
        'Asse e `!servir` os itens pedidos. Expira em **40 min**.',
        'Bônus cai na moeda da padaria ao completar.'
      ].join('\n'),
      color: theme.color
    });
    return;
  }

  if (sub === 'cancelar' || sub === 'cancel') {
    if (!b.order) {
      message.reply({
        title: '📋 Sem pedido',
        description: 'Use `!pedido novo` pra pegar um.',
        color: theme.colorWarn
      });
      return;
    }
    b.order = null;
    persistAuthor(data, message);
    message.reply({
      title: '📋 Pedido cancelado',
      description: 'Pode pegar outro com `!pedido novo`.',
      color: theme.color
    });
    return;
  }

  if (!b.order) {
    message.reply({
      title: '📋 Pedidos de NPC',
      description: [
        'Clientes de Hallownest pedem combos com **bônus de 🪙**.',
        '`!pedido novo` — pegar pedido (45 min)',
        '`!pedido` — ver progresso',
        '`!pedido cancelar` — desistir'
      ].join('\n'),
      color: theme.color
    });
    return;
  }

  message.reply({
    title: '📋 Pedido atual',
    description: formatOrder(b.order),
    color: theme.color
  });
}

function formatOrder(order) {
  if (!order) return '*nenhum*';
  const lines = Object.entries(order.need || {}).map(([id, n]) => {
    const recipe = RECIPES.find((r) => r.id === id);
    const have = order.progress?.[id] || 0;
    const label = recipe ? `${recipe.emoji} ${recipe.name}` : id;
    const ok = have >= n ? '✅' : '⬜';
    return `${ok} ${label} · **${have}/${n}**`;
  });
  return [
    `**${order.name}**`,
    ...lines,
    `Bônus: **${order.bonus}** 🪙`,
    order.expiresAt ? `Expira <t:${Math.floor(order.expiresAt / 1000)}:R>` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function toggleOvenNotify(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const b = ensureBakery(userData);
  b.notifyReady = !b.notifyReady;
  persistAuthor(data, message);
  message.reply({
    title: b.notifyReady ? '🔔 Avisos ligados' : '🔕 Avisos desligados',
    description: b.notifyReady
      ? 'Vou tentar te mandar **DM** quando algo no forno ficar pronto.\n(Precisa permitir DMs do servidor/bot.)'
      : 'Não vou mais avisar por DM.',
    color: theme.color
  });
}

/**
 * Loop: notifica usuários com notifyReady e forno pronto.
 * @param {import('discord.js').Client} client
 * @param {object} data
 */
async function processOvenNotifications(client, data) {
  if (!data?.users) return;
  const now = Date.now();
  for (const [guildId, users] of Object.entries(data.users)) {
    if (!users || typeof users !== 'object') continue;
    for (const [userId, userData] of Object.entries(users)) {
      if (!userData?.bakery?.notifyReady) continue;
      const b = userData.bakery;
      if (!Array.isArray(b.cooking) || !b.cooking.length) continue;
      const ready = b.cooking.filter((j) => j.readyAt <= now);
      if (!ready.length) continue;
      if (b.lastNotifyAt && now - b.lastNotifyAt < 60_000) continue;
      // só notifica se algum ficou pronto "agora" (readyAt nos últimos 2 min) ou nunca notificou
      const fresh = ready.some((j) => now - j.readyAt < 120_000 || !b.lastNotifyAt);
      if (!fresh && b.lastNotifyAt) continue;
      b.lastNotifyAt = now;
      try {
        const user = await client.users.fetch(userId);
        const names = ready
          .map((j) => {
            const r = RECIPES.find((x) => x.id === j.recipeId);
            return r ? `${r.emoji} ${r.name}` : j.recipeId;
          })
          .join(', ');
        await user.send({
          embeds: [
            {
              title: '🔔 Forno pronto!',
              description: `Sua padaria tem algo pronto: **${names}**\nUse \`!servir\` no servidor.`,
              color: theme.color
            }
          ]
        });
      } catch {
        // DMs fechadas — desliga pra não spammer erro
        b.notifyReady = false;
      }
    }
  }
  saveData(data); // batch multi-user (forno notify)
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
  trackQuest(data, message.guild.id, message.author.id, 'bakery_upgrade', 1, false);
  persistAuthor(data, message);

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
  showBakery,
  showBakeryHelp,
  RECIPES,
  UPGRADES,
  ensureBakery,
  processOvenNotifications,
  BAKERY_CHANNEL_ID
};
