/**
 * Carrega comandos da semana 3+ e registra slash a partir do registry.
 */

const { REST, Routes } = require('discord.js');
const { buildSlashJSON, listCommands, dispatchPrefix, dispatchSlash } = require('./registry');

// side-effect: register()
require('./ping');
require('./lore');
require('./ajuda');
require('./music');
require('./legacy-handlers');

async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !client.application?.id) return;

  // registry week3 + legado (padaria, quest, perfil, evento) ainda em slash-legacy
  const { legacySlashJSON } = require('./slash-legacy');
  const fromRegistry = buildSlashJSON();
  // evita duplicar nomes
  const names = new Set(fromRegistry.map((c) => c.name));
  const merged = [
    ...fromRegistry,
    ...legacySlashJSON().filter((c) => !names.has(c.name))
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.application.id), { body: merged });
    console.log(
      `[slash] ${merged.length} comandos (${fromRegistry.length} registry + ${merged.length - fromRegistry.length} legacy)`
    );
    console.log(
      `[registry] prefix: ${listCommands().map((c) => c.name).join(', ')}`
    );
  } catch (err) {
    console.error('[slash] register failed:', err.message);
  }
}

module.exports = {
  registerSlashCommands,
  dispatchPrefix,
  dispatchSlash,
  listCommands
};
