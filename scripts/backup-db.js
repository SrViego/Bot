#!/usr/bin/env node
/**
 * Backup manual consistente do SQLite (API de backup online — pode rodar com o bot ligado).
 *   node scripts/backup-db.js [motivo]
 *   docker compose exec bot node scripts/backup-db.js manual
 */
const sqlite = require('../src/systems/database-sqlite');

sqlite
  .backupData(process.argv[2] || 'manual')
  .then((dest) => {
    sqlite.closeDb();
    if (!dest) process.exit(1);
    console.log(dest);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
