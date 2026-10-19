#!/usr/bin/env node
/**
 * Exporta data/morgana.db → JSON (rollback para versão antiga do bot / inspeção)
 *
 * Uso:
 *   node scripts/export-sqlite-to-json.js                     # data/database.from-sqlite.json
 *   node scripts/export-sqlite-to-json.js ./data/database.json
 */
const fs = require('node:fs');
const path = require('node:path');

const sqlite = require('../src/systems/database-sqlite');

const out = path.resolve(process.argv[2] || path.join(sqlite.dataDir, 'database.from-sqlite.json'));
const data = sqlite.loadData();
if (fs.existsSync(out)) {
  const bak = `${out}.bak-${Date.now()}`;
  fs.copyFileSync(out, bak);
  console.log(`(arquivo existente salvo em ${path.basename(bak)})`);
}
const tmp = `${out}.${process.pid}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
fs.renameSync(tmp, out);
console.log(`Exportado → ${out}`);
// espera o backup 'start' assíncrono do loadData terminar antes de fechar
setTimeout(() => sqlite.closeDb(), 500);
