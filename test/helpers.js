const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Diretório de dados temporário; precisa ser chamado ANTES de require do database */
function tempDataDir(prefix = 'morgana-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.MORGANA_DATA_DIR = dir;
  return dir;
}

function freshRequire(mod) {
  const id = require.resolve(mod);
  delete require.cache[id];
  return require(mod);
}

module.exports = { tempDataDir, freshRequire };
