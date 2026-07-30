/**
 * Carrega registry + registra slash (catálogo agrupado + ping/lore/ajuda).
 *
 * SLASH_REGISTER no .env:
 *   guild  — só no servidor (na hora; não aparece em DM)
 *   global — só global (pode demorar até ~1h; funciona em todo lugar)
 *   both   — guild + global (default; se duplicar, use guild)
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

async function putGuildCommands(rest, appId, guildId, body, label) {
  // limpa e reescreve — ajuda o client Discord a largar lista antiga
  await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] });
  await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
  console.log(`[slash] guild ${label}: ${body.length} comandos (refresh)`);
}

async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !client.application?.id) return;

  const { merged, fromRegistry } = buildMergedSlashBody();
  const mode = (process.env.SLASH_REGISTER || 'both').toLowerCase();

  if (merged.length > 100) {
    console.error(`[slash] ${merged.length} > 100 — Discord vai recusar`);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const appId = client.application.id;

  const envGuilds = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const guildIds = envGuilds.length
    ? envGuilds
    : [...client.guilds.cache.keys()];

  try {
    const doGuild = mode === 'guild' || mode === 'both';
    const doGlobal = mode === 'global' || mode === 'both' || guildIds.length === 0;

    if (doGuild && guildIds.length) {
      for (const guildId of guildIds) {
        try {
          const g = client.guilds.cache.get(guildId);
          await putGuildCommands(
            rest,
            appId,
            guildId,
            merged,
            g?.name || guildId
          );
        } catch (err) {
          console.error(`[slash] guild ${guildId} failed:`, err.message);
          if (err.rawError) {
            console.error(JSON.stringify(err.rawError).slice(0, 800));
          }
        }
      }
    } else if (doGuild && !guildIds.length) {
      console.warn('[slash] modo guild sem servidores em cache');
    }

    if (doGlobal) {
      await rest.put(Routes.applicationCommands(appId), { body: merged });
      console.log(
        `[slash] global: ${merged.length} comandos (pode demorar a atualizar no app)`
      );
    } else {
      // limpa global para não misturar com lista antiga de 100
      await rest.put(Routes.applicationCommands(appId), { body: [] });
      console.log('[slash] global limpo (SLASH_REGISTER=guild)');
    }

    console.log(
      `[slash] modo=${mode} · total ${merged.length} (${fromRegistry.length} registry + catálogo)`
    );
    console.log(
      `[slash] nomes: ${merged.map((c) => c.name).join(', ')}`
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
