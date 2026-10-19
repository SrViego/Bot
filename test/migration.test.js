const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tempDataDir } = require('./helpers');

const fixture = path.join(__dirname, 'fixtures', 'database.sample.json');

const dir = tempDataDir('morgana-migr-');
fs.copyFileSync(fixture, path.join(dir, 'database.json'));
const db = require('../src/systems/database-sqlite');

test('migração automática JSON → SQLite no 1º start', () => {
  const data = db.loadData();
  assert.equal(data.users.g1.u1.points, 500);
  assert.deepEqual(data.users.g1.u1.inventory, { cafe: 2 });
  assert.equal(data.users.g2.u3.bakery.coins, 42);
  assert.equal(data.marriages.g1.u1, 'u2');
  assert.equal(data.warnings.g1.u2[0].reason, 'spam');
  assert.equal(data.guildConfigs.g1.starboardMin, 5);
  // defaults preenchidos na config
  assert.equal(data.guildConfigs.g1.welcomeEnabled, true);
  assert.ok(Array.isArray(data.moderationLogs.g1));
  assert.equal(data.betPools.g1[0].amount, 10);

  const meta = db.getDb().prepare("SELECT value FROM meta WHERE key='json_migrated_at'").get();
  assert.ok(meta && /^\d+$/.test(meta.value), 'meta json_migrated_at gravado');
});

test('JSON original mantido + backup premigration criado', () => {
  assert.ok(fs.existsSync(path.join(dir, 'database.json')), 'database.json não pode ser apagado');
  const backups = fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.startsWith('database-premigration-'));
  assert.equal(backups.length, 1);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(dir, 'backups', backups[0]), 'utf8')),
    JSON.parse(fs.readFileSync(fixture, 'utf8'))
  );
});

test('idempotente: reabrir não reimporta nem sobrescreve', () => {
  const data = db.loadData();
  data.users.g1.u1.points = 777;
  db.saveData(data);

  // JSON legado "muda" depois — não pode ser reimportado
  const legacy = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  legacy.users.g1.u1.points = 1;
  fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify(legacy));

  db.closeDb();
  const again = db.loadData();
  assert.equal(again.users.g1.u1.points, 777);
  const backups = fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.startsWith('database-premigration-'));
  assert.equal(backups.length, 1, 'não cria novo backup de migração');
});

test('DB já populado sem flag: não importa por cima', () => {
  const d = db.getDb();
  d.prepare("DELETE FROM meta WHERE key='json_migrated_at'").run();
  const r = db.migrateFromJsonIfNeeded(d);
  assert.equal(r.status, 'preexisting-db');
  assert.equal(db.loadData().users.g1.u1.points, 777);
});

test('saveData só grava linhas alteradas e remove órfãs', () => {
  const data = db.loadData();
  const before = db.getDb().prepare("SELECT value FROM meta WHERE key='updated_at'").get()?.value;
  db.saveData(data); // nada mudou
  const after = db.getDb().prepare("SELECT value FROM meta WHERE key='updated_at'").get()?.value;
  assert.equal(after, before, 'sem mudanças → sem escrita');

  delete data.users.g1.u2;
  db.saveData(data);
  const row = db.getDb().prepare("SELECT 1 FROM user_blob WHERE guild_id='g1' AND user_id='u2'").get();
  assert.equal(row, undefined);
});

test('backup online gera .db legível', async () => {
  const dest = await db.backupData('test');
  assert.ok(dest && fs.existsSync(dest));
  const Database = require('better-sqlite3');
  const copy = new Database(dest, { readonly: true });
  const n = copy.prepare('SELECT COUNT(*) AS n FROM user_blob').get().n;
  copy.close();
  assert.ok(n >= 2);
});

test('JSON inválido no 1º start: aborta sem criar banco vazio por cima', () => {
  const dir2 = tempDataDir('morgana-bad-');
  fs.writeFileSync(path.join(dir2, 'database.json'), '{ quebrado');
  const id = require.resolve('../src/systems/database-sqlite');
  db.closeDb();
  delete require.cache[id];
  const db2 = require('../src/systems/database-sqlite');
  assert.throws(() => db2.loadData(), /inválido/);
  assert.ok(fs.existsSync(path.join(dir2, 'database.json')));
  db2.closeDb();
});
