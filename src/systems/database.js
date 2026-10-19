/**
 * Facade de persistência — SQLite é o único backend em runtime (data/morgana.db).
 *
 * O antigo data/database.json só é lido UMA vez, na migração automática do
 * primeiro start (ver migrateFromJsonIfNeeded em database-sqlite.js).
 * Rollback: scripts/export-sqlite-to-json.js (ver docs/BACKUP-RESTORE.md).
 */

const backend = (process.env.DATA_BACKEND || 'sqlite').toLowerCase();
if (backend !== 'sqlite') {
  console.warn(
    `[database] DATA_BACKEND="${backend}" não é mais suportado em runtime — usando sqlite. ` +
      '(O JSON legado é importado automaticamente no primeiro start.)'
  );
}

// better-sqlite3 13 dá segfault em Node 22.12/22.13 (testado); 22.14+ ok
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj === 22 && min < 14) {
  console.error(`[database] Node ${process.versions.node} é incompatível com better-sqlite3 13 — use Node >= 22.14.`);
}

const sqlite = require('./database-sqlite');
console.log(`[database] backend = sqlite (${sqlite.getDbPath()})`);

module.exports = sqlite;
