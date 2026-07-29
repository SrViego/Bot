/**
 * Registry de comandos (semana 3)
 * Prefixo `!` e slash compartilham o mesmo execute(ctx).
 */

const { PermissionFlagsBits } = require('discord.js');
const { trackCommand, trackError } = require('../systems/metrics');
const { createEmbed } = require('../systems/theme');

const PREFIX = process.env.COMMAND_PREFIX || '!';

/** @type {Map<string, object>} */
const byName = new Map();
/** @type {Map<string, string>} nameOrAlias -> primary name */
const aliasToName = new Map();

/**
 * @param {object} cmd
 * @param {string} cmd.name - nome primário sem !
 * @param {string[]} [cmd.aliases]
 * @param {string} [cmd.description]
 * @param {string} [cmd.category]
 * @param {import('discord.js').SlashCommandBuilder|object|boolean} [cmd.slash]
 * @param {bigint|import('discord.js').PermissionsBitField} [cmd.permission]
 * @param {(ctx: object) => Promise<any>|any} cmd.execute
 */
function register(cmd) {
  if (!cmd?.name) {
    throw new Error('register: name é obrigatório');
  }
  if (typeof cmd.execute !== 'function' && typeof cmd.legacyMessageHandler !== 'function') {
    throw new Error('register: execute ou legacyMessageHandler é obrigatório');
  }
  const name = cmd.name.toLowerCase().replace(/^!/, '');
  if (byName.has(name)) {
    console.warn(`[registry] sobrescrevendo comando: ${name}`);
  }
  const entry = {
    ...cmd,
    name,
    aliases: (cmd.aliases || []).map((a) => String(a).toLowerCase().replace(/^!/, ''))
  };
  byName.set(name, entry);
  aliasToName.set(name, name);
  for (const a of entry.aliases) {
    aliasToName.set(a, name);
  }
  return entry;
}

function get(name) {
  const key = aliasToName.get(String(name).toLowerCase().replace(/^!/, ''));
  return key ? byName.get(key) : undefined;
}

function listCommands() {
  return [...byName.values()];
}

function parsePrefix(content) {
  if (!content || !content.startsWith(PREFIX)) return null;
  const body = content.slice(PREFIX.length).trim();
  if (!body) return null;
  const parts = body.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { name, args, raw: body };
}

/**
 * Contexto unificado message | interaction
 */
function createContext({ message, interaction, data, args = [] }) {
  const isSlash = Boolean(interaction);
  const client = message?.client || interaction?.client;
  const guild = message?.guild || interaction?.guild;
  const member = message?.member || interaction?.member;
  const channel = message?.channel || interaction?.channel;
  const user = message?.author || interaction?.user;

  return {
    client,
    data,
    message: message || null,
    interaction: interaction || null,
    isSlash,
    guild,
    guildId: guild?.id,
    member,
    channel,
    user,
    userId: user?.id,
    args,
    options: interaction?.options || null,
    clientPing: () => client?.ws?.ping ?? -1,

    async reply(payload) {
      // payload: string | { title, description, embeds, content, ephemeral, ... }
      if (isSlash) {
        const p = normalizeReply(payload, true);
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(p);
        }
        return interaction.reply(p);
      }
      const p = normalizeReply(payload, false);
      return message.reply(p);
    },

    async defer(ephemeral = false) {
      if (isSlash && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral });
      }
    }
  };
}

function normalizeReply(payload, forSlash) {
  if (typeof payload === 'string') {
    return forSlash ? { content: payload } : { content: payload };
  }
  if (payload?.embeds || payload?.components || payload?.files) {
    return payload;
  }
  // estilo antigo message.reply({ title, description })
  if (payload?.title || payload?.description || payload?.color) {
    const embed = createEmbed(payload.description || '', {
      title: payload.title,
      color: payload.color,
      footer: payload.footer,
      fields: payload.fields,
      image: payload.image,
      thumbnail: payload.thumbnail
    });
    const out = { embeds: [embed] };
    if (forSlash && payload.ephemeral) out.ephemeral = true;
    return out;
  }
  return payload;
}

async function runCommand(cmd, ctx) {
  const t0 = Date.now();
  const label = ctx.isSlash ? `/${cmd.name}` : `${PREFIX}${cmd.name}`;
  try {
    if (cmd.permission && ctx.member) {
      const bit = cmd.permission;
      if (!ctx.member.permissions?.has(bit)) {
        await ctx.reply({
          title: '🔒 Sem permissão',
          description: 'Você não pode usar este comando.'
        });
        trackCommand(label, {
          guildId: ctx.guildId,
          userId: ctx.userId,
          ok: false,
          ms: Date.now() - t0,
          detail: 'permission'
        });
        return true;
      }
    }
    const result = await cmd.execute(ctx);
    trackCommand(label, {
      guildId: ctx.guildId,
      userId: ctx.userId,
      ok: true,
      ms: Date.now() - t0
    });
    return result !== false;
  } catch (err) {
    console.error(`[registry] ${label}:`, err);
    trackError(label, err, { guildId: ctx.guildId, userId: ctx.userId });
    try {
      await ctx.reply({
        title: '⚠️ Erro',
        description: 'Algo deu errado ao executar o comando.'
      });
    } catch {
      /* ignore */
    }
    return true;
  }
}

/**
 * @returns {Promise<boolean>} true se consumiu a mensagem
 */
async function dispatchPrefix(message, data) {
  const parsed = parsePrefix(message.content);
  if (!parsed) return false;
  const cmd = get(parsed.name);
  if (!cmd) return false;
  // comandos que ainda usam o handler legado completo (ex: music)
  if (cmd.legacyMessageHandler) {
    const t0 = Date.now();
    try {
      const handled = await cmd.legacyMessageHandler(message, data);
      if (handled) {
        trackCommand(`${PREFIX}${parsed.name}`, {
          guildId: message.guild?.id,
          userId: message.author.id,
          ms: Date.now() - t0,
          ok: true
        });
      }
      return Boolean(handled);
    } catch (err) {
      trackError(`${PREFIX}${parsed.name}`, err, {
        guildId: message.guild?.id,
        userId: message.author.id
      });
      throw err;
    }
  }
  const ctx = createContext({ message, data, args: parsed.args });
  return runCommand(cmd, ctx);
}

/**
 * @returns {Promise<boolean>}
 */
async function dispatchSlash(interaction, data) {
  if (!interaction.isChatInputCommand()) return false;
  const cmd = get(interaction.commandName);
  if (!cmd) return false;

  const args = [];
  // optional string option "query" / subcommands as args[0]
  if (interaction.options) {
    const sub = interaction.options.getSubcommand(false);
    if (sub) args.push(sub);
    const q = interaction.options.getString('query') || interaction.options.getString('texto');
    if (q) args.push(...q.split(/\s+/));
    const page = interaction.options.getInteger('pagina');
    if (page != null) args.push(String(page));
  }

  const ctx = createContext({ interaction, data, args });
  return runCommand(cmd, ctx);
}

function buildSlashJSON() {
  const { SlashCommandBuilder } = require('discord.js');
  const out = [];
  for (const cmd of byName.values()) {
    if (cmd.prefixOnly) continue;
    if (cmd.slash === false) continue;
    if (cmd.slashBuilder) {
      out.push(
        typeof cmd.slashBuilder.toJSON === 'function' ? cmd.slashBuilder.toJSON() : cmd.slashBuilder
      );
      continue;
    }
    if (cmd.slash === true) {
      const b = new SlashCommandBuilder()
        .setName(cmd.name)
        .setDescription((cmd.description || cmd.name).slice(0, 100));
      if (typeof cmd.configureSlash === 'function') cmd.configureSlash(b);
      out.push(b.toJSON());
    }
  }
  return out;
}

module.exports = {
  PREFIX,
  register,
  get,
  listCommands,
  parsePrefix,
  createContext,
  dispatchPrefix,
  dispatchSlash,
  buildSlashJSON,
  runCommand,
  PermissionFlagsBits
};
