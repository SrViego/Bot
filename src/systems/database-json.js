/**
 * Backend JSON — data/database.json
 * DATA_BACKEND=json (default se não for sqlite)
 */
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'database.json');
const backupDir = path.join(dataDir, 'backups');
const MAX_START_BACKUPS = Number(process.env.DATA_BACKUP_KEEP || 14);

const defaultGuildConfig = {
  logChannelId: null,
  autoRoleId: null,
  welcomeEnabled: true,
  goodbyeEnabled: true,
  ticketEnabled: true,
  ticketCategoryId: null,
  ticketStaffRoleId: null,
  ticketCounter: 0,
  starboardChannelId: null,
  starboardEmoji: '⭐',
  starboardMin: 3,
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

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function ensureBackupDir() {
  ensureDataDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

function backupData(reason = 'manual') {
  ensureBackupDir();
  if (!fs.existsSync(dataFile)) {
    console.log('[backup] database.json ainda não existe — skip');
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `database-${reason}-${stamp}.json`);
  try {
    fs.copyFileSync(dataFile, dest);
    console.log(`[backup] ${reason} → ${path.basename(dest)}`);
    pruneBackups();
    return dest;
  } catch (err) {
    console.error('[backup] falhou:', err.message);
    return null;
  }
}

function backupDataDailyIfNeeded() {
  ensureBackupDir();
  if (!fs.existsSync(dataFile)) return null;
  const day = new Date().toISOString().slice(0, 10);
  const existing = fs.readdirSync(backupDir).some((f) => f.includes(`daily-${day}`));
  if (existing) return null;
  const dest = path.join(backupDir, `database-daily-${day}.json`);
  try {
    fs.copyFileSync(dataFile, dest);
    console.log(`[backup] daily → ${path.basename(dest)}`);
    pruneBackups();
    return dest;
  } catch (err) {
    console.error('[backup] daily falhou:', err.message);
    return null;
  }
}

function pruneBackups() {
  try {
    ensureBackupDir();
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('database-') && f.endsWith('.json'))
      .map((f) => ({
        name: f,
        full: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(MAX_START_BACKUPS)) {
      fs.unlinkSync(f.full);
      console.log(`[backup] removido antigo: ${f.name}`);
    }
  } catch (err) {
    console.error('[backup] prune falhou:', err.message);
  }
}

function tryRestoreLatestBackup() {
  ensureBackupDir();
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      name: f,
      full: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const f of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(f.full, 'utf8'));
      console.warn(`[database] restaurado de ${f.name}`);
      saveData({ ...structuredClone(defaultData), ...parsed });
      return { ...structuredClone(defaultData), ...parsed };
    } catch {
      /* next */
    }
  }
  return null;
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(dataFile)) {
    saveData(defaultData);
    return structuredClone(defaultData);
  }
  backupData('start');
  try {
    const rawData = fs.readFileSync(dataFile, 'utf8');
    return { ...structuredClone(defaultData), ...JSON.parse(rawData) };
  } catch (err) {
    console.error('[database] JSON inválido — tentando backup…', err.message);
    const restored = tryRestoreLatestBackup();
    if (restored) return restored;
    throw err;
  }
}

function saveData(data) {
  ensureDataDir();
  const tmp = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile);
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
      minigames: { lastCoinflipAt: 0, lastGuessAt: 0, wins: 0, losses: 0 },
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

function hasActiveEffect(userData, key) {
  const until = userData.effects?.[key];
  return typeof until === 'number' && until > Date.now();
}

function getEffectRemainingMs(userData, key) {
  const until = userData.effects?.[key];
  if (typeof until !== 'number') return 0;
  return Math.max(0, until - Date.now());
}

function saveUser(data) {
  saveData(data);
}
function saveGuildConfig(data) {
  saveData(data);
}
function saveBucket(data) {
  saveData(data);
}
function mutateUser(data, guildId, userId, fn) {
  const userData = getUserData(data, guildId, userId);
  fn(userData);
  saveData(data);
  return userData;
}
function withTransaction(fn) {
  return fn();
}
function saveDataSoon(data) {
  saveData(data);
}
function flushSave() {}
function closeDb() {}
function getDb() {
  return null;
}
function getDbPath() {
  return dataFile;
}

module.exports = {
  defaultGuildConfig,
  getGuildData,
  getUserData,
  hasActiveEffect,
  getEffectRemainingMs,
  loadData,
  saveData,
  saveDataSoon,
  saveUser,
  saveGuildConfig,
  saveBucket,
  mutateUser,
  withTransaction,
  flushSave,
  backupData,
  backupDataDailyIfNeeded,
  pruneBackups,
  closeDb,
  getDb,
  getDbPath,
  dataDir,
  dataFile,
  backupDir
};
