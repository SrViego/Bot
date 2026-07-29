#!/usr/bin/env node
/**
 * Importa data/database.json → data/morgana.db
 *
 * Uso:
 *   node scripts/migrate-json-to-sqlite.js
 *   node scripts/migrate-json-to-sqlite.js ./data/database.json ./data/morgana.db
 *   DATA_BACKEND=sqlite node scripts/migrate-json-to-sqlite.js --force
 *
 * Depois, no .env:
 *   DATA_BACKEND=sqlite
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2).filter((a) => a !== '--force');
const force = process.argv.includes('--force');

const jsonPath = path.resolve(args[0] || path.join(root, 'data', 'database.json'));
const dbPath = path.resolve(args[1] || path.join(root, 'data', 'morgana.db'));

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON não encontrado: ${jsonPath}`);
  process.exit(1);
}

if (fs.existsSync(dbPath) && !force) {
  console.error(`SQLite já existe: ${dbPath}`);
  console.error('Use --force para sobrescrever (faça backup antes).');
  process.exit(1);
}

// aponta o módulo sqlite para o path desejado via env
process.env.DATA_BACKEND = 'sqlite';

// se --force, remove db antigo
if (force && fs.existsSync(dbPath)) {
  for (const p of [dbPath, dbPath + '-wal', dbPath + '-shm']) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log('Removido DB anterior.');
}

const raw = fs.readFileSync(jsonPath, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('JSON inválido:', err.message);
  process.exit(1);
}

// Garante que database-sqlite use data/ no root do projeto
const sqlite = require('../src/systems/database-sqlite');

// Se o path customizado for diferente, avisamos — o módulo usa data/morgana.db fixo
const expected = sqlite.getDbPath();
if (path.resolve(expected) !== dbPath) {
  console.warn(`Nota: o backend grava em ${expected}`);
  console.warn(`Você pediu ${dbPath} — copie depois se necessário.`);
}

console.log(`Importando ${jsonPath} …`);
sqlite.importDataObject(data);

// verifica contagens
const db = sqlite.getDb();
const users = db.prepare('SELECT COUNT(*) AS n FROM user_blob').get().n;
const configs = db.prepare('SELECT COUNT(*) AS n FROM guild_config').get().n;
const buckets = db.prepare('SELECT COUNT(*) AS n FROM guild_bucket').get().n;

console.log('OK.');
console.log(`  users (blobs): ${users}`);
console.log(`  guild_configs: ${configs}`);
console.log(`  guild_buckets: ${buckets}`);
console.log(`  arquivo: ${sqlite.getDbPath()}`);
console.log('');
console.log('Ative no .env:');
console.log('  DATA_BACKEND=sqlite');
console.log('Reinicie o bot.');

sqlite.closeDb();
