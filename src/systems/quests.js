/**
 * Quests diárias e semanais.
 * Progresso em userData.quests
 */

const { getUserData, saveUser } = require('./database');
const { theme } = require('./theme');

const DAY_MS = 24 * 60 * 60 * 1000;

/** @typedef {{ id: string, name: string, emoji: string, target: number, reward: { points?: number, bakery?: number, poke?: number, xp?: number }, track: string }} QuestDef */

/** @type {QuestDef[]} */
const DAILY_POOL = [
  { id: 'bake_serve', name: 'Servir na padaria', emoji: '🥖', target: 4, track: 'bakery_serve', reward: { points: 20, bakery: 14 } },
  { id: 'bake_once', name: 'Assar algo', emoji: '🔥', target: 3, track: 'bakery_bake', reward: { bakery: 10, points: 12 } },
  { id: 'catch_poke', name: 'Capturar Pokémon', emoji: '🔴', target: 2, track: 'poke_catch', reward: { poke: 25, points: 18 } },
  { id: 'chat_msgs', name: 'Conversar no chat', emoji: '💬', target: 20, track: 'messages', reward: { points: 30, xp: 20 } },
  { id: 'play_music', name: 'Tocar músicas', emoji: '🎵', target: 3, track: 'music_play', reward: { points: 22 } },
  { id: 'minigame', name: 'Jogar minigame', emoji: '🎲', target: 2, track: 'minigame', reward: { points: 18 } },
  { id: 'upgrade_buy', name: 'Comprar upgrade/forno', emoji: '⬆️', target: 1, track: 'bakery_upgrade', reward: { bakery: 8, points: 15 } }
];

/** @type {QuestDef[]} */
const WEEKLY_POOL = [
  { id: 'w_serve', name: 'Servir 20 itens', emoji: '📦', target: 20, track: 'bakery_serve', reward: { points: 90, bakery: 45 } },
  { id: 'w_catch', name: 'Capturar 8 Pokémon', emoji: '🔴', target: 8, track: 'poke_catch', reward: { poke: 100, points: 70 } },
  { id: 'w_chat', name: '80 mensagens', emoji: '💬', target: 80, track: 'messages', reward: { points: 120, xp: 60 } },
  { id: 'w_music', name: '12 músicas', emoji: '🎵', target: 12, track: 'music_play', reward: { points: 80 } },
  { id: 'w_pvp', name: '3 duelos PvP', emoji: '⚔️', target: 3, track: 'poke_pvp', reward: { poke: 80, points: 60 } }
];

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  // ISO-ish week: Thursday-based
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t - new Date(Date.UTC(y, 0, 1))) / DAY_MS + 1) / 7);
  return `${y}-W${week}`;
}

function pickN(pool, n, seed) {
  const arr = [...pool];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function ensureQuests(userData, userId) {
  if (!userData.quests || typeof userData.quests !== 'object') {
    userData.quests = { dailyKey: '', weeklyKey: '', daily: [], weekly: [] };
  }
  const q = userData.quests;
  const dk = dayKey();
  const wk = weekKey();

  if (q.dailyKey !== dk || !Array.isArray(q.daily) || !q.daily.length) {
    q.dailyKey = dk;
    const defs = pickN(DAILY_POOL, 3, hashSeed(`${userId}-${dk}`));
    q.daily = defs.map((d) => ({
      id: d.id,
      track: d.track,
      name: d.name,
      emoji: d.emoji,
      target: d.target,
      progress: 0,
      claimed: false,
      reward: d.reward
    }));
  }

  if (q.weeklyKey !== wk || !Array.isArray(q.weekly) || !q.weekly.length) {
    q.weeklyKey = wk;
    const defs = pickN(WEEKLY_POOL, 2, hashSeed(`${userId}-w-${wk}`));
    q.weekly = defs.map((d) => ({
      id: d.id,
      track: d.track,
      name: d.name,
      emoji: d.emoji,
      target: d.target,
      progress: 0,
      claimed: false,
      reward: d.reward
    }));
  }

  return q;
}

/**
 * Incrementa progresso. Não salva sozinho se save=false (caller salva).
 * @returns {string[]} linhas de quest completadas agora
 */
function trackQuest(data, guildId, userId, track, amount = 1, save = true) {
  if (!guildId || !userId || !track || amount <= 0) return [];
  const userData = getUserData(data, guildId, userId);
  const q = ensureQuests(userData, userId);
  const done = [];

  for (const list of [q.daily, q.weekly]) {
    for (const quest of list) {
      if (quest.track !== track || quest.claimed) continue;
      const before = quest.progress;
      quest.progress = Math.min(quest.target, quest.progress + amount);
      if (before < quest.target && quest.progress >= quest.target) {
        done.push(`${quest.emoji} **${quest.name}** pronta — \`!quest pegar\``);
      }
    }
  }

  if (save) saveUser(data, guildId, userId);
  return done;
}

function applyReward(userData, reward) {
  const lines = [];
  if (reward.points) {
    userData.points = (userData.points || 0) + reward.points;
    lines.push(`+**${reward.points}** pts`);
  }
  if (reward.xp) {
    userData.xp = (userData.xp || 0) + reward.xp;
    lines.push(`+**${reward.xp}** XP`);
  }
  if (reward.bakery) {
    if (!userData.bakery) userData.bakery = { coins: 0 };
    userData.bakery.coins = (userData.bakery.coins || 0) + reward.bakery;
    lines.push(`+**${reward.bakery}** 🪙 padaria`);
  }
  if (reward.poke) {
    if (!userData.pokemon) userData.pokemon = { coins: 0 };
    userData.pokemon.coins = (userData.pokemon.coins || 0) + reward.poke;
    lines.push(`+**${reward.poke}** 🪙 poke`);
  }
  return lines;
}

function handleQuestCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (!['!quest', '!quests', '!missao', '!missão', '!missoes', '!missões'].includes(command)) {
    return false;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const q = ensureQuests(userData, message.author.id);
  const sub = (args[1] || 'lista').toLowerCase();

  if (sub === 'pegar' || sub === 'claim' || sub === 'resgatar') {
    const claimed = [];
    for (const list of [q.daily, q.weekly]) {
      for (const quest of list) {
        if (quest.claimed || quest.progress < quest.target) continue;
        quest.claimed = true;
        const parts = applyReward(userData, quest.reward || {});
        claimed.push(`${quest.emoji} **${quest.name}** → ${parts.join(', ')}`);
      }
    }
    saveUser(data, message.guild.id, message.author.id);
    if (!claimed.length) {
      message.reply({
        title: '📋 Nada pra resgatar',
        description: 'Complete quests e use `!quest pegar` de novo.\nVeja: `!quest`',
        color: theme.colorWarn
      });
      return true;
    }
    message.reply({
      title: '🎁 Recompensas',
      description: claimed.join('\n'),
      color: theme.color
    });
    return true;
  }

  const fmt = (list, label) =>
    list
      .map((quest) => {
        const bar =
          quest.progress >= quest.target
            ? quest.claimed
              ? '✅'
              : '🎁 pronta'
            : `**${quest.progress}/${quest.target}**`;
        return `${quest.emoji} **${quest.name}** · ${bar}`;
      })
      .join('\n') || '—';

  message.reply({
    title: '📋 Quests',
    description: 'Resgate com `!quest pegar` quando estiver 🎁 pronta.',
    fields: [
      { name: `📅 Diárias (${q.dailyKey})`, value: fmt(q.daily), inline: false },
      { name: `📆 Semanais (${q.weeklyKey})`, value: fmt(q.weekly), inline: false }
    ],
    color: theme.color
  });
  return true;
}

module.exports = {
  handleQuestCommand,
  trackQuest,
  ensureQuests
};
