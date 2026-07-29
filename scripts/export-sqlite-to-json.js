#!/usr/bin/env node
/**
 * Exporta data/morgana.db → data/database.json (rollback / inspeção)
 *
 * Uso:
 *   DATA_BACKEND=sqlite node scripts/export-sqlite-to-json.js
 *   node scripts/export-sqlite-to-json.js ./data/out.json
 */
const fs = require('node:fs');
const path = require('node:path');

process.env.DATA_BACKEND = 'sqlite';
const sqlite = require('../src/systems/database-sqlite');

const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'database.from-sqlite.json'));
const data = sqlite.loadData();
// loadData faz backup start — ok
fs.writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Exportado → ${out}`);
sqlite.closeDb();
