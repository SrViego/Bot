/**
 * Backend SQLite (único backend em runtime) — API compatível + writes incrementais
 *
 * - getDb(): WAL + prepared statements cacheados + migração automática do JSON legado
 * - loadData(): carrega para memória (handlers legados)
 * - saveData(): transação que grava SÓ as linhas que mudaram (diff) + remove órfãs
 * - saveUser / saveUsers / mutateUser / mutateUsers / saveBucket: gravação pontual atômica
 * - saveDataSoon(): debounce p/ XP em massa
 * - backupData(): API de backup online do SQLite (better-sqlite3 .backup())
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// MORGANA_DATA_DIR permite apontar pra outro diretório (testes / deploy custom)
const dataDir = path.resolve(process.env.MORGANA_DATA_DIR || path.join(__dirname, '..', '..', 'data'));
const legacyJsonFile = path.join(dataDir, 'database.json');
const dbFile = path.join(dataDir, 'morgana.db');
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
  events: null,
  rankingChannelId: null,
  lastWeeklyRankKey: null,
  staffAlertChannelId: null
};

const defaultData = {
  users: {},
  marriages: {},
  proposals: {},
  warnings: {},
  guildConfigs: {},
  moderationLogs: {},
  tickets: {},
  betPools: {},
  starboard: {}
};

/** Buckets por guild (JSON) */
const GUILD_BUCKETS = [
  'marriages',
  'proposals',
  'warnings',
  'moderationLogs',
  'tickets',
  'betPools',
  'starboard'
];

let _db = null;

function ensureDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

function getDb() {
  if (_db) return _db;
  ensureDirs();
  _db = new Database(dbFile);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  initSchema(_db);
  _stmts = null;
  _lastJson.clear();
  try {
    migrateFromJsonIfNeeded(_db);
  } catch (err) {
    closeDb();
    throw err;
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS user_blob (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS guild_bucket (
      guild_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (guild_id, bucket)
    );

    CREATE TABLE IF NOT EXISTS metrics_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      guild_id TEXT,
      user_id TEXT,
      kind TEXT NOT NULL,
      name TEXT,
      ok INTEGER NOT NULL DEFAULT 1,
      ms INTEGER,
      detail TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_user_blob_guild ON user_blob(guild_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics_event(ts);
  `);

  const ver = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
  if (!ver) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '2');
  } else if (ver.value === '1') {
    db.prepare('UPDATE meta SET value = ? WHERE key = ?').run('2', 'schema_version');
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let _saveTimer = null;
/** @type {object | null} */
let _pendingSave = null;
const SAVE_DEBOUNCE_MS = Number(process.env.SQLITE_SAVE_DEBOUNCE_MS || 1500);

function closeDb() {
  _stmts = null;
  _lastJson.clear();
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
  }
}

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Backup online (consistente mesmo com WAL e o bot rodando) via better-sqlite3 .backup().
 * @returns {Promise<string|null>} caminho do backup
 */
async function backupData(reason = 'manual') {
  ensureDirs();
  if (!fs.existsSync(dbFile)) {
    console.log('[backup-sqlite] morgana.db ainda não existe — skip');
    return null;
  }
  const dest = path.join(backupDir, `morgana-${reason}-${backupStamp()}.db`);
  try {
    await getDb().backup(dest);
    console.log(`[backup-sqlite] ${reason} → ${path.basename(dest)}`);
    pruneBackups();
    return dest;
  } catch (err) {
    console.error('[backup-sqlite] falhou:', err.message);
    return null;
  }
}

/** @returns {Promise<string|null>} */
async function backupDataDailyIfNeeded() {
  ensureDirs();
  if (!fs.existsSync(dbFile)) return null;
  const day = new Date().toISOString().slice(0, 10);
  const existing = fs.readdirSync(backupDir).some((f) => f.includes(`daily-${day}`) && f.endsWith('.db'));
  if (existing) return null;
  const dest = path.join(backupDir, `morgana-daily-${day}.db`);
  try {
    await getDb().backup(dest);
    console.log(`[backup-sqlite] daily → ${path.basename(dest)}`);
    pruneBackups();
    return dest;
  } catch (err) {
    console.error('[backup-sqlite] daily falhou:', err.message);
    return null;
  }
}

function pruneBackups() {
  try {
    ensureDirs();
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('morgana-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        full: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const f of files.slice(MAX_START_BACKUPS)) {
      fs.unlinkSync(f.full);
      for (const ext of ['-wal', '-shm']) {
        const side = f.full + ext;
        if (fs.existsSync(side)) fs.unlinkSync(side);
      }
      console.log(`[backup-sqlite] removido antigo: ${f.name}`);
    }
  } catch (err) {
    console.error('[backup-sqlite] prune falhou:', err.message);
  }
}

function emptyData() {
  return structuredClone(defaultData);
}

/** Lê SQLite → objeto compatível com o JSON antigo */
function loadData() {
  ensureDirs();
  const db = getDb();

  // backup do .db no start (assíncrono, não bloqueia o boot)
  if (fs.existsSync(dbFile)) {
    backupData('start').catch(() => {});
  }

  const data = emptyData();

  for (const row of db.prepare('SELECT guild_id, json FROM guild_config').all()) {
    _lastJson.set(`c\0${row.guild_id}`, row.json);
    try {
      data.guildConfigs[row.guild_id] = {
        ...structuredClone(defaultGuildConfig),
        ...JSON.parse(row.json)
      };
    } catch {
      data.guildConfigs[row.guild_id] = structuredClone(defaultGuildConfig);
    }
  }

  for (const row of db.prepare('SELECT guild_id, user_id, json FROM user_blob').all()) {
    _lastJson.set(`u\0${row.guild_id}\0${row.user_id}`, row.json);
    if (!data.users[row.guild_id]) data.users[row.guild_id] = {};
    try {
      data.users[row.guild_id][row.user_id] = JSON.parse(row.json);
    } catch {
      data.users[row.guild_id][row.user_id] = {};
    }
  }

  for (const row of db.prepare('SELECT guild_id, bucket, json FROM guild_bucket').all()) {
    _lastJson.set(`b\0${row.guild_id}\0${row.bucket}`, row.json);
    if (!data[row.bucket] || typeof data[row.bucket] !== 'object') {
      data[row.bucket] = {};
    }
    try {
      data[row.bucket][row.guild_id] = JSON.parse(row.json);
    } catch {
      data[row.bucket][row.guild_id] = row.bucket === 'moderationLogs' ? [] : {};
    }
  }

  // garante chaves default
  for (const k of Object.keys(defaultData)) {
    if (data[k] === undefined) data[k] = structuredClone(defaultData[k]);
  }

  return data;
}

/** cache de prepared statements (preparados 1x por conexão) */
let _stmts = null;
/** último JSON gravado por linha → saveData só grava o que mudou */
const _lastJson = new Map();

function stmts() {
  const db = getDb();
  if (_stmts) return _stmts;
  _stmts = {
    upsertConfig: db.prepare(
      `INSERT INTO guild_config (guild_id, json) VALUES (@guild_id, @json)
       ON CONFLICT(guild_id) DO UPDATE SET json = excluded.json`
    ),
    upsertUser: db.prepare(
      `INSERT INTO user_blob (guild_id, user_id, json) VALUES (@guild_id, @user_id, @json)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET json = excluded.json`
    ),
    upsertBucket: db.prepare(
      `INSERT INTO guild_bucket (guild_id, bucket, json) VALUES (@guild_id, @bucket, @json)
       ON CONFLICT(guild_id, bucket) DO UPDATE SET json = excluded.json`
    ),
    delUser: db.prepare('DELETE FROM user_blob WHERE guild_id = ? AND user_id = ?'),
    delConfig: db.prepare('DELETE FROM guild_config WHERE guild_id = ?'),
    delBucket: db.prepare('DELETE FROM guild_bucket WHERE guild_id = ? AND bucket = ?'),
    listUsers: db.prepare('SELECT guild_id, user_id FROM user_blob'),
    listConfigs: db.prepare('SELECT guild_id FROM guild_config'),
    listBuckets: db.prepare('SELECT guild_id, bucket FROM guild_bucket'),
    touch: db.prepare(
      `INSERT INTO meta (key, value) VALUES ('updated_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ),
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ),
    countRows: db.prepare(
      `SELECT (SELECT COUNT(*) FROM user_blob) + (SELECT COUNT(*) FROM guild_config)
            + (SELECT COUNT(*) FROM guild_bucket) AS n`
    )
  };
  return _stmts;
}

/* ── gravação com diff ─────────────────────────────────────────── */

function putUser(s, guildId, userId, u) {
  const json = JSON.stringify(u ?? {});
  const key = `u\0${guildId}\0${userId}`;
  if (_lastJson.get(key) === json) return false;
  s.upsertUser.run({ guild_id: guildId, user_id: userId, json });
  _lastJson.set(key, json);
  return true;
}

function putConfig(s, guildId, cfg) {
  const json = JSON.stringify(cfg ?? {});
  const key = `c\0${guildId}`;
  if (_lastJson.get(key) === json) return false;
  s.upsertConfig.run({ guild_id: guildId, json });
  _lastJson.set(key, json);
  return true;
}

function putBucket(s, guildId, bucket, payload) {
  const json = JSON.stringify(payload ?? (bucket === 'moderationLogs' ? [] : {}));
  const key = `b\0${guildId}\0${bucket}`;
  if (_lastJson.get(key) === json) return false;
  s.upsertBucket.run({ guild_id: guildId, bucket, json });
  _lastJson.set(key, json);
  return true;
}

/** Escreve um objeto data inteiro (formato JSON legado) nas tabelas — usado na migração */
function writeAllRows(s, data) {
  let users = 0;
  let configs = 0;
  let buckets = 0;
  for (const [guildId, cfg] of Object.entries(data.guildConfigs || {})) {
    putConfig(s, guildId, cfg);
    configs += 1;
  }
  for (const [guildId, map] of Object.entries(data.users || {})) {
    if (!map || typeof map !== 'object') continue;
    for (const [userId, u] of Object.entries(map)) {
      putUser(s, guildId, userId, u);
      users += 1;
    }
  }
  const skip = new Set(['users', 'guildConfigs']);
  for (const [key, val] of Object.entries(data)) {
    if (skip.has(key)) continue;
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    for (const [guildId, payload] of Object.entries(val)) {
      putBucket(s, guildId, key, payload);
      buckets += 1;
    }
  }
  return { users, configs, buckets };
}

/* ── migração única do JSON legado ─────────────────────────────── */

/**
 * Importa data/database.json → SQLite UMA vez (idempotente).
 * - Marca meta.json_migrated_at; nas próximas inicializações não faz nada.
 * - Se o DB já tem dados (ex.: migrado na mão antes), só marca e não sobrescreve.
 * - Antes de importar copia o JSON para backups/database-premigration-*.json.
 * - NUNCA apaga o database.json original.
 * @returns {{ status: string, counts?: object, backup?: string }}
 */
function migrateFromJsonIfNeeded(db, jsonPath = legacyJsonFile) {
  const s = stmts();
  if (s.getMeta.get('json_migrated_at')) return { status: 'already' };

  if (!fs.existsSync(jsonPath)) {
    s.setMeta.run('json_migrated_at', `none:${Date.now()}`);
    return { status: 'no-json' };
  }

  if (s.countRows.get().n > 0) {
    s.setMeta.run('json_migrated_at', `preexisting-db:${Date.now()}`);
    console.warn(
      `[database] ${path.basename(jsonPath)} encontrado, mas o SQLite já tem dados — não importei (o JSON foi mantido).`
    );
    return { status: 'preexisting-db' };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    // Não sobe com banco vazio por cima de dados que não conseguimos ler
    throw new Error(
      `[database] ${jsonPath} é inválido (${err.message}). Corrija ou restaure um backup antes de iniciar.`
    );
  }

  ensureDirs();
  const backup = path.join(backupDir, `database-premigration-${backupStamp()}.json`);
  fs.copyFileSync(jsonPath, backup);

  const counts = db.transaction(() => {
    const c = writeAllRows(s, { ...emptyData(), ...parsed });
    s.setMeta.run('json_migrated_at', `${Date.now()}`);
    s.setMeta.run('json_migrated_from', jsonPath);
    s.touch.run(String(Date.now()));
    return c;
  })();

  console.log(
    `[database] migração JSON → SQLite ok: ${counts.users} users, ${counts.configs} configs, ${counts.buckets} buckets ` +
      `(backup do JSON: ${path.basename(backup)}; database.json mantido)`
  );
  return { status: 'migrated', counts, backup };
}

/**
 * Persistência completa: UPSERT de tudo + remove órfãos.
 * Sem DELETE * em massa no início.
 */
function saveData(data) {
  _pendingSave = null;
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }

  const db = getDb();
  const s = stmts();

  const tx = db.transaction((data) => {
    const keepUsers = new Set();
    const keepConfigs = new Set();
    const keepBuckets = new Set();
    let changed = 0;

    for (const [guildId, cfg] of Object.entries(data.guildConfigs || {})) {
      if (putConfig(s, guildId, cfg)) changed += 1;
      keepConfigs.add(guildId);
    }

    for (const [guildId, map] of Object.entries(data.users || {})) {
      if (!map || typeof map !== 'object') continue;
      for (const [userId, u] of Object.entries(map)) {
        if (putUser(s, guildId, userId, u)) changed += 1;
        keepUsers.add(`${guildId}\0${userId}`);
      }
    }

    const skip = new Set(['users', 'guildConfigs']);
    for (const [key, val] of Object.entries(data)) {
      if (skip.has(key)) continue;
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      for (const [guildId, payload] of Object.entries(val)) {
        if (putBucket(s, guildId, key, payload)) changed += 1;
        keepBuckets.add(`${guildId}\0${key}`);
      }
    }

    // remove órfãos (ex.: user/bucket apagado em memória)
    for (const row of s.listUsers.all()) {
      if (!keepUsers.has(`${row.guild_id}\0${row.user_id}`)) {
        s.delUser.run(row.guild_id, row.user_id);
        _lastJson.delete(`u\0${row.guild_id}\0${row.user_id}`);
        changed += 1;
      }
    }
    for (const row of s.listConfigs.all()) {
      if (!keepConfigs.has(row.guild_id)) {
        s.delConfig.run(row.guild_id);
        _lastJson.delete(`c\0${row.guild_id}`);
        changed += 1;
      }
    }
    for (const row of s.listBuckets.all()) {
      if (!keepBuckets.has(`${row.guild_id}\0${row.bucket}`)) {
        s.delBucket.run(row.guild_id, row.bucket);
        _lastJson.delete(`b\0${row.guild_id}\0${row.bucket}`);
        changed += 1;
      }
    }

    if (changed) s.touch.run(String(Date.now()));
  });

  try {
    tx(data);
  } catch (err) {
    // transação desfeita → cache pode ter ficado à frente do disco; força regravação total na próxima
    _lastJson.clear();
    throw err;
  }
}

function runTx(fn) {
  try {
    return getDb().transaction(fn)();
  } catch (err) {
    _lastJson.clear();
    throw err;
  }
}

/** Grava só um usuário (hot path: daily, XP, padaria) */
function saveUser(data, guildId, userId) {
  const u = data?.users?.[guildId]?.[userId];
  if (!u) return;
  runTx(() => {
    const s = stmts();
    if (putUser(s, guildId, userId, u)) s.touch.run(String(Date.now()));
  });
}

/** Grava vários usuários na MESMA transação (troca/presente/PvP: tudo ou nada) */
function saveUsers(data, guildId, userIds) {
  runTx(() => {
    const s = stmts();
    let changed = false;
    for (const id of userIds) {
      const u = id && data?.users?.[guildId]?.[id];
      if (u && putUser(s, guildId, id, u)) changed = true;
    }
    if (changed) s.touch.run(String(Date.now()));
  });
}

function saveGuildConfig(data, guildId) {
  const cfg = data?.guildConfigs?.[guildId];
  if (!cfg) return;
  runTx(() => {
    const s = stmts();
    if (putConfig(s, guildId, cfg)) s.touch.run(String(Date.now()));
  });
}

function saveBucket(data, bucket, guildId) {
  const payload = data?.[bucket]?.[guildId];
  if (payload === undefined) return;
  runTx(() => {
    const s = stmts();
    if (putBucket(s, guildId, bucket, payload)) s.touch.run(String(Date.now()));
  });
}

function replaceContents(target, source) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, source);
}

/**
 * Mutação atômica de vários users: fn recebe CÓPIAS; se fn lançar erro ou o
 * SQLite falhar, nada muda (nem em memória, nem no disco). fn deve ser síncrona.
 * @param {(drafts: object[]) => any} fn
 * @returns {any} retorno de fn
 */
function mutateUsers(data, guildId, userIds, fn) {
  const live = userIds.map((id) => getUserData(data, guildId, id));
  const drafts = live.map((u) => structuredClone(u));
  const result = fn(drafts);
  if (result && typeof result.then === 'function') {
    throw new Error('mutateUsers: fn deve ser síncrona (sem await dentro da transação)');
  }
  runTx(() => {
    const s = stmts();
    userIds.forEach((id, i) => putUser(s, guildId, id, drafts[i]));
    s.touch.run(String(Date.now()));
  });
  // só aplica em memória depois do commit
  live.forEach((u, i) => replaceContents(u, drafts[i]));
  return result;
}

/**
 * Mutação atômica de um user + persistência pontual.
 * @param {(userData: object) => void} fn
 */
function mutateUser(data, guildId, userId, fn) {
  mutateUsers(data, guildId, [userId], ([u]) => fn(u));
  return getUserData(data, guildId, userId);
}

function withTransaction(fn) {
  return runTx(fn);
}

/** Debounce de saveData completo (XP de mensagens) */
function saveDataSoon(data) {
  _pendingSave = data;
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    const d = _pendingSave;
    _pendingSave = null;
    if (d) {
      try {
        saveData(d);
      } catch (err) {
        console.error('[sqlite] saveDataSoon failed:', err.message);
      }
    }
  }, SAVE_DEBOUNCE_MS);
}

function flushSave() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (_pendingSave) {
    const d = _pendingSave;
    _pendingSave = null;
    saveData(d);
  }
}

// flush em shutdown
for (const sig of ['SIGINT', 'SIGTERM', 'beforeExit']) {
  process.on(sig, () => {
    try {
      flushSave();
    } catch {
      /* ignore */
    }
  });
}

function getGuildData(data, guildId) {
  if (!data.users[guildId]) data.users[guildId] = {};
  if (!data.marriages[guildId]) data.marriages[guildId] = {};
  if (!data.proposals[guildId]) data.proposals[guildId] = {};
  if (!data.warnings[guildId]) data.warnings[guildId] = {};
  if (!data.guildConfigs) data.guildConfigs = {};
  if (!data.moderationLogs) data.moderationLogs = {};
  if (!data.tickets) data.tickets = {};
  if (!data.betPools) data.betPools = {};
  if (!data.starboard) data.starboard = {};
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

function hasActiveEffect(userData, key) {
  const until = userData.effects?.[key];
  return typeof until === 'number' && until > Date.now();
}

function getEffectRemainingMs(userData, key) {
  const until = userData.effects?.[key];
  if (typeof until !== 'number') return 0;
  return Math.max(0, until - Date.now());
}

/** Importa objeto data (JSON) para o SQLite (usado pelo script de migração e save) */
function importDataObject(data) {
  saveData({ ...emptyData(), ...data });
  stmts().setMeta.run('json_migrated_at', `${Date.now()}`);
}

function getDbPath() {
  return dbFile;
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
  saveUsers,
  saveGuildConfig,
  saveBucket,
  mutateUser,
  mutateUsers,
  withTransaction,
  migrateFromJsonIfNeeded,
  flushSave,
  backupData,
  backupDataDailyIfNeeded,
  pruneBackups,
  importDataObject,
  getDb,
  closeDb,
  getDbPath,
  dataDir,
  dataFile: dbFile,
  legacyJsonFile,
  backupDir,
  GUILD_BUCKETS
};
