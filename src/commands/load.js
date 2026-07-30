/**
 * Carrega registry + registra todos os slash (registry + catálogo).
 */

const { REST, Routes } = require('discord.js');
const { buildSlashJSON, listCommands, dispatchPrefix, dispatchSlash } = require('./registry');
const { buildCatalogJSON, handleCatalogSlash } = require('./slash-catalog');

// side-effect: register()
require('./ping');
require('./lore');
require('./ajuda');
require('./music');
require('./legacy-handlers');

async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !client.application?.id) return;

  const fromRegistry = buildSlashJSON(); // ping, lore, ajuda (+ slashBuilder)
  const fromCatalog = buildCatalogJSON();

  const names = new Set();
  const merged = [];
  for (const c of [...fromRegistry, ...fromCatalog]) {
    if (names.has(c.name)) continue;
    names.add(c.name);
    merged.push(c);
  }

  if (merged.length > 100) {
    console.error(`[slash] ${merged.length} comandos > limite Discord 100 — corte o catálogo`);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.application.id), { body: merged });
    console.log(
      `[slash] ${merged.length} comandos (${fromRegistry.length} registry + catálogo)`
    );
    console.log(
      `[registry] prefix: ${listCommands().map((c) => c.name).join(', ')}`
    );
  } catch (err) {
    console.error('[slash] register failed:', err.message);
    if (err.rawError) console.error(JSON.stringify(err.rawError).slice(0, 500));
  }
}

module.exports = {
  registerSlashCommands,
  dispatchPrefix,
  dispatchSlash,
  handleCatalogSlash,
  listCommands
};
