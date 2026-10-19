#!/usr/bin/env node
/**
 * Migração MANUAL data/database.json → data/morgana.db
 *
 * Normalmente não precisa: o bot faz isso sozinho no primeiro start
 * (idempotente; o JSON é copiado pra data/backups/ e nunca é apagado).
 *
 * Uso:
 *   node scripts/migrate-json-to-sqlite.js                 # usa data/database.json
 *   node scripts/migrate-json-to-sqlite.js ./outro.json    # JSON específico
 *   node scripts/migrate-json-to-sqlite.js --force         # reimporta mesmo com DB já populado
 *                                                         #   (faz backup do .db antes)
 *
 * MORGANA_DATA_DIR=/caminho muda o diretório de dados (default: ./data).
 */
const fs = require('node:fs');
const path = require('node:path');

const force = process.argv.includes('--force');
const args = process.argv.slice(2).filter((a) => a !== '--force');

const sqlite = require('../src/systems/database-sqlite');
const jsonPath = path.resolve(args[0] || sqlite.legacyJsonFile);

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON não encontrado: ${jsonPath}`);
  process.exit(1);
}

(async () => {
  const dbExisted = fs.existsSync(sqlite.getDbPath());
  const db = sqlite.getDb(); // pode já ter migrado sozinho aqui (se o DB era novo)

  if (force) {
    if (dbExisted) {
      const bak = await sqlite.backupData('pre-force-migrate');
      if (!bak) {
        console.error('Backup do .db falhou — abortando --force.');
        process.exit(1);
      }
    }
    db.transaction(() => {
      db.exec('DELETE FROM user_blob; DELETE FROM guild_config; DELETE FROM guild_bucket;');
      db.prepare("DELETE FROM meta WHERE key IN ('json_migrated_at', 'json_migrated_from')").run();
    })();
    sqlite.closeDb();
    sqlite.getDb();
  }

  const r = sqlite.migrateFromJsonIfNeeded(sqlite.getDb(), jsonPath);
  const d = sqlite.getDb();
  const n = (t) => d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  const migratedAt = d.prepare("SELECT value FROM meta WHERE key = 'json_migrated_at'").get()?.value;

  console.log(`status: ${r.status}${migratedAt ? ` (json_migrated_at=${migratedAt})` : ''}`);
  if (r.status === 'preexisting-db') {
    console.log('O SQLite já tinha dados — nada importado. Use --force pra reimportar (faz backup antes).');
  }
  console.log(`  users (blobs): ${n('user_blob')}`);
  console.log(`  guild_configs: ${n('guild_config')}`);
  console.log(`  guild_buckets: ${n('guild_bucket')}`);
  console.log(`  arquivo: ${sqlite.getDbPath()}`);
  sqlite.closeDb();
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
