const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'database.json');

const defaultGuildConfig = {
  logChannelId: null,
  autoRoleId: null,
  welcomeEnabled: true,
  goodbyeEnabled: true,
  // tickets / canais de ajuda
  ticketEnabled: true,
  ticketCategoryId: null,
  ticketStaffRoleId: null,
  ticketCounter: 0,
  // starboard
  starboardChannelId: null,
  starboardEmoji: '⭐',
  starboardMin: 3,
  // eventos (happy hour, etc.)
  events: null
};

const defaultData = {
  users: {},
  marriages: {},
  proposals: {},
  warnings: {},
  guildConfigs: {},
  moderationLogs: {},
  tickets: {}
};

function loadData() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    saveData(defaultData);
    return structuredClone(defaultData);
  }

  const rawData = fs.readFileSync(dataFile, 'utf8');
  return {
    ...structuredClone(defaultData),
    ...JSON.parse(rawData)
  };
}

function saveData(data) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function getGuildData(data, guildId) {
  if (!data.users[guildId]) data.users[guildId] = {};
  if (!data.marriages[guildId]) data.marriages[guildId] = {};
  if (!data.proposals[guildId]) data.proposals[guildId] = {};
  if (!data.warnings[guildId]) data.warnings[guildId] = {};
  if (!data.guildConfigs) data.guildConfigs = {};
  if (!data.moderationLogs) data.moderationLogs = {};
  if (!data.tickets) data.tickets = {};
  if (!data.guildConfigs[guildId]) data.guildConfigs[guildId] = structuredClone(defaultGuildConfig);
  if (!data.moderationLogs[guildId]) data.moderationLogs[guildId] = [];
  if (!data.tickets[guildId]) data.tickets[guildId] = {};

  data.guildConfigs[guildId] = {
    ...structuredClone(defaultGuildConfig),
    ...data.guildConfigs[guildId]
  };

  return {
    users: data.users[guildId],
    marriages: data.marriages[guildId],
    proposals: data.proposals[guildId],
    warnings: data.warnings[guildId],
    config: data.guildConfigs[guildId],
    moderationLogs: data.moderationLogs[guildId]
  };
}

function getUserData(data, guildId, userId) {
  const guildData = getGuildData(data, guildId);

  if (!guildData.users[userId]) {
    guildData.users[userId] = {
      points: 0,
      xp: 0,
      level: 1,
      lastXpAt: 0,
      lastRepAt: 0,
      rep: 0,
      inventory: {},
      effects: {},
      equippedTitle: null,
      achievements: [],
      minigames: {
        lastCoinflipAt: 0,
        lastGuessAt: 0,
        wins: 0,
        losses: 0
      },
      stats: {
        messages: 0,
        dailies: 0,
        dailyStreak: 0,
        bestDailyStreak: 0,
        purchases: 0,
        itemsUsed: 0,
        giftsSent: 0
      }
    };
  }

  const userData = guildData.users[userId];

  if (!userData.inventory) userData.inventory = {};
  if (!userData.effects || typeof userData.effects !== 'object') userData.effects = {};
  if (userData.equippedTitle === undefined) userData.equippedTitle = null;
  if (!Array.isArray(userData.achievements)) userData.achievements = [];
  if (!userData.stats) userData.stats = {};
  if (!userData.minigames) userData.minigames = {};
  if (!Number.isInteger(userData.points)) userData.points = 0;
  if (!Number.isInteger(userData.xp)) userData.xp = 0;
  if (!Number.isInteger(userData.level)) userData.level = 1;
  if (!Number.isInteger(userData.lastXpAt)) userData.lastXpAt = 0;
  if (!Number.isInteger(userData.lastRepAt)) userData.lastRepAt = 0;
  if (!Number.isInteger(userData.rep)) userData.rep = 0;
  if (!Number.isInteger(userData.minigames.lastCoinflipAt)) userData.minigames.lastCoinflipAt = 0;
  if (!Number.isInteger(userData.minigames.lastGuessAt)) userData.minigames.lastGuessAt = 0;
  if (!Number.isInteger(userData.minigames.wins)) userData.minigames.wins = 0;
  if (!Number.isInteger(userData.minigames.losses)) userData.minigames.losses = 0;
  if (!Number.isInteger(userData.stats.messages)) userData.stats.messages = 0;
  if (!Number.isInteger(userData.stats.dailies)) userData.stats.dailies = 0;
  if (!Number.isInteger(userData.stats.dailyStreak)) userData.stats.dailyStreak = 0;
  if (!Number.isInteger(userData.stats.bestDailyStreak)) userData.stats.bestDailyStreak = 0;
  if (!Number.isInteger(userData.stats.purchases)) userData.stats.purchases = 0;
  if (!Number.isInteger(userData.stats.itemsUsed)) userData.stats.itemsUsed = 0;
  if (!Number.isInteger(userData.stats.giftsSent)) userData.stats.giftsSent = 0;

  return userData;
}

/** Efeito ativo se timestamp no futuro */
function hasActiveEffect(userData, key) {
  const until = userData.effects?.[key];
  return typeof until === 'number' && until > Date.now();
}

function getEffectRemainingMs(userData, key) {
  const until = userData.effects?.[key];
  if (typeof until !== 'number') return 0;
  return Math.max(0, until - Date.now());
}

module.exports = {
  defaultGuildConfig,
  getGuildData,
  getUserData,
  hasActiveEffect,
  getEffectRemainingMs,
  loadData,
  saveData
};
