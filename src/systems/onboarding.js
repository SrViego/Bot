/**
 * Trilho de chegada (Sprint 1) — checklist da 1ª semana.
 * Progresso é inferido do estado real do user (sem tracking paralelo frágil).
 */

const { getUserData, saveUser } = require('./database');
const { ensureQuests } = require('./quests');
const { theme } = require('./theme');

const REWARD_POINTS = 80;
const REWARD_BAKERY = 25;

/**
 * @param {object} userData
 * @param {string} userId
 */
function buildSteps(userData, userId) {
  const bakery = userData.bakery || {};
  const poke = userData.pokemon || {};
  const stats = userData.stats || {};
  const q = ensureQuests(userData, userId);

  const questTouched =
    [...(q.daily || []), ...(q.weekly || [])].some(
      (x) => (x.progress || 0) > 0 || x.claimed
    ) || false;

  const bakeryCh = process.env.BAKERY_CHANNEL_ID;
  const pokeCh = process.env.POKEMON_CHANNEL_ID;

  return [
    {
      id: 'daily',
      emoji: '🎁',
      title: 'Resgatar daily',
      done: Boolean(userData.lastDailyAt),
      how: '`!daily` ou `/daily`',
      tip: 'Pontos todo dia — base da economia.'
    },
    {
      id: 'chat',
      emoji: '💬',
      title: 'Conversar no chat',
      done: (stats.messages || 0) >= 5 || (userData.level || 1) >= 2,
      how: 'Manda **5 mensagens** (sem `!`)',
      tip: 'Ganha XP e sobe de nível.'
    },
    {
      id: 'quest',
      emoji: '📋',
      title: 'Olhar as quests',
      done: questTouched,
      how: '`!quest` · depois `!quest pegar`',
      tip: 'Diárias e semanais com recompensa mista.'
    },
    {
      id: 'bakery',
      emoji: '🥖',
      title: 'Assar e servir na padaria',
      done:
        (bakery.totalServed || 0) >= 1 ||
        (Array.isArray(bakery.history) && bakery.history.length > 0),
      how: bakeryCh
        ? `No canal <#${bakeryCh}>: \`!assar pao\` → \`!servir\``
        : '`!assar pao` → `!servir` (configure `BAKERY_CHANNEL_ID`)',
      tip: 'Moedas da padaria ≠ pontos. Use `!repetir` e `!historico`.'
    },
    {
      id: 'poke',
      emoji: '🔴',
      title: 'Começar a aventura Pokémon',
      done: Boolean(poke.started),
      how: pokeCh
        ? `No canal <#${pokeCh}>: \`!pstart\` / \`/pstart\``
        : '`!pstart` (configure `POKEMON_CHANNEL_ID`)',
      tip: 'Captura, time e PvP no canal exclusivo.'
    },
    {
      id: 'perfil',
      emoji: '📜',
      title: 'Ver o próprio perfil',
      done: Boolean(userData.onboarding?.sawProfile),
      how: '`!perfil` ou `/perfil`',
      tip: 'Nível, pontos, inventário e cosméticos.'
    }
  ];
}

function ensureOnboarding(userData) {
  if (!userData.onboarding || typeof userData.onboarding !== 'object') {
    userData.onboarding = {
      startedAt: null,
      completedAt: null,
      rewardClaimed: false,
      sawProfile: false
    };
  }
  const o = userData.onboarding;
  if (typeof o.rewardClaimed !== 'boolean') o.rewardClaimed = false;
  if (typeof o.sawProfile !== 'boolean') o.sawProfile = false;
  return o;
}

function summarize(steps) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done >= steps.length };
}

/**
 * Marca “viu o perfil” quando usa !perfil (hook leve).
 */
function markProfileSeen(data, guildId, userId) {
  if (!guildId || !userId) return;
  const userData = getUserData(data, guildId, userId);
  const o = ensureOnboarding(userData);
  if (o.sawProfile) return;
  o.sawProfile = true;
  if (!o.startedAt) o.startedAt = Date.now();
  saveUser(data, guildId, userId);
}

function handleOnboardingCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (
    ![
      '!inicio',
      '!começar',
      '!comecar',
      '!onboarding',
      '!start',
      '!trilho',
      '!tutorial'
    ].includes(command)
  ) {
    return false;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const o = ensureOnboarding(userData);
  if (!o.startedAt) o.startedAt = Date.now();

  const steps = buildSteps(userData, message.author.id);
  const { done, total, complete } = summarize(steps);

  const lines = steps.map((s) => {
    const box = s.done ? '✅' : '⬜';
    return `${box} ${s.emoji} **${s.title}**\n  ${s.how}`;
  });

  const bar =
    '█'.repeat(done) + '░'.repeat(Math.max(0, total - done));

  const fields = [
    {
      name: `Progresso · ${done}/${total}`,
      value: `\`${bar}\` **${Math.round((done / total) * 100)}%**`,
      inline: false
    }
  ];

  // dica do próximo passo
  const next = steps.find((s) => !s.done);
  if (next) {
    fields.push({
      name: '➡️ Próximo passo',
      value: `${next.emoji} **${next.title}**\n${next.how}\n_${next.tip}_`,
      inline: false
    });
  }

  let rewardLine = null;
  if (complete && !o.rewardClaimed) {
    userData.points = (userData.points || 0) + REWARD_POINTS;
    if (!userData.bakery || typeof userData.bakery !== 'object') {
      userData.bakery = { coins: 0 };
    }
    userData.bakery.coins = (userData.bakery.coins || 0) + REWARD_BAKERY;
    o.rewardClaimed = true;
    o.completedAt = Date.now();
    rewardLine = `🎉 **Trilho completo!** +**${REWARD_POINTS}** pts + **${REWARD_BAKERY}** 🪙 padaria`;
  } else if (complete && o.rewardClaimed) {
    rewardLine =
      '🏅 Trilho já concluído. Explora `!quest`, `!loja` e `!cosmetico`!';
  }

  saveUser(data, message.guild.id, message.author.id);

  message.reply({
    title: '🌿 Trilho da Morgana · 1ª semana',
    description: [
      `Olá, ${message.author}! Segue o caminho — cada ✅ vem do que você **já fez** no servidor.`,
      '',
      lines.join('\n\n'),
      rewardLine ? `\n${rewardLine}` : '',
      '',
      '_Slash: `/inicio` · Ajuda completa: `!ajuda`_'
    ]
      .filter(Boolean)
      .join('\n'),
    fields,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
    color: complete ? theme.color : theme.colorInfo || theme.color
  });

  return true;
}

module.exports = {
  handleOnboardingCommand,
  markProfileSeen,
  buildSteps,
  ensureOnboarding,
  REWARD_POINTS,
  REWARD_BAKERY
};
