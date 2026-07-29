/**
 * Facade de persistência.
 * DATA_BACKEND=json (default) | sqlite
 *
 * Semana 1: JSON + backup atômico
 * Semana 2: SQLite load/save
 * Semana 4: saveUser / mutateUser / saveDataSoon (upsert incremental no SQLite)
 */

const backend = (process.env.DATA_BACKEND || 'json').toLowerCase();

if (backend === 'sqlite') {
  console.log('[database] backend = sqlite (data/morgana.db)');
  module.exports = require('./database-sqlite');
} else {
  if (backend !== 'json') {
    console.warn(`[database] DATA_BACKEND="${backend}" desconhecido — usando json`);
  }
  console.log('[database] backend = json (data/database.json)');
  module.exports = require('./database-json');
}
