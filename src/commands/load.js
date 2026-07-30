/**
 * Carrega registry + registra todos os slash (registry + catálogo).
 *
 * Registro em cada guild = aparece na hora (global pode demorar até ~1h).
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

function buildMergedSlashBody() {
  const fromRegistry = buildSlashJSON();
  const fromCatalog = buildCatalogJSON();

  const names = new Set();
  const merged = [];
  for (const c of [...fromRegistry, ...fromCatalog]) {
    if (names.has(c.name)) continue;
    names.add(c.name);
    merged.push(c);
  }
  return { merged, fromRegistry, fromCatalog };
}

async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !client.application?.id) return;

  const { merged, fromRegistry } = buildMergedSlashBody();

  if (merged.length > 100) {
    console.error(`[slash] ${merged.length} comandos > limite Discord 100 — corte o catálogo`);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const appId = client.application.id;

  // Guilds explícitas no .env (vírgula) ou todas em que o bot está
  const envGuilds = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const guildIds = envGuilds.length
    ? envGuilds
    : [...client.guilds.cache.keys()];

  try {
    // 1) Por guild — instantâneo no app Discord
    for (const guildId of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(appId, guildId), {
          body: merged
        });
        const g = client.guilds.cache.get(guildId);
        console.log(
          `[slash] guild ${g?.name || guildId}: ${merged.length} comandos (na hora)`
        );
      } catch (err) {
        console.error(`[slash] guild ${guildId} failed:`, err.message);
        if (err.rawError) {
          console.error(JSON.stringify(err.rawError).slice(0, 800));
        }
      }
    }

    // 2) Global — propaga devagar (outros servers / fallback)
    await rest.put(Routes.applicationCommands(appId), { body: merged });
    console.log(
      `[slash] global: ${merged.length} comandos (${fromRegistry.length} registry + catálogo) — pode demorar a aparecer`
    );
    console.log(
      `[registry] prefix: ${listCommands().map((c) => c.name).join(', ')}`
    );
  } catch (err) {
    console.error('[slash] register failed:', err.message);
    if (err.rawError) console.error(JSON.stringify(err.rawError).slice(0, 800));
  }
}

module.exports = {
  registerSlashCommands,
  dispatchPrefix,
  dispatchSlash,
  handleCatalogSlash,
  listCommands
};
