/**
 * Starboard: reações ⭐ (ou custom) → post em canal de destaques.
 * Config: guildConfigs.starboardChannelId, starboardEmoji, starboardMin
 */

const { EmbedBuilder } = require('discord.js');
const { getGuildData, saveData } = require('./database');
const { theme } = require('./theme');

function ensureStarboardStore(data, guildId) {
  if (!data.starboard) data.starboard = {};
  if (!data.starboard[guildId]) data.starboard[guildId] = {}; // messageId -> starboardMessageId
  return data.starboard[guildId];
}

function starCount(reaction) {
  // partials may need fetch
  return reaction.count || 0;
}

async function handleStarboardReaction(reaction, user, data) {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message?.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message;
    if (!message?.guild || message.author?.bot) return;

    const guildData = getGuildData(data, message.guild.id);
    const cfg = guildData.config;
    const channelId = cfg.starboardChannelId;
    if (!channelId) return;

    const emojiWanted = cfg.starboardEmoji || '⭐';
    const emoji = reaction.emoji.name || reaction.emoji.toString();
    const idMatch = reaction.emoji.id && emojiWanted.includes(reaction.emoji.id);
    if (emoji !== emojiWanted && reaction.emoji.toString() !== emojiWanted && !idMatch) {
      // allow ⭐ and 🌟 as default aliases if config is ⭐
      if (!(emojiWanted === '⭐' && (emoji === '⭐' || emoji === '🌟'))) return;
    }

    const min = Number.isInteger(cfg.starboardMin) ? cfg.starboardMin : 3;
    const count = starCount(reaction);
    if (count < min) return;

    const map = ensureStarboardStore(data, message.guild.id);
    const starChannel = await message.guild.channels.fetch(channelId).catch(() => null);
    if (!starChannel?.isTextBased()) return;

    const jump = message.url;
    const content = message.content?.slice(0, 1500) || '*sem texto*';
    const embed = new EmbedBuilder()
      .setColor(theme.color)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ size: 64 })
      })
      .setDescription(content)
      .addFields(
        { name: 'Canal', value: `${message.channel}`, inline: true },
        { name: 'Estrelas', value: `**${count}** ${emojiWanted}`, inline: true },
        { name: 'Original', value: `[Ir à mensagem](${jump})`, inline: false }
      )
      .setFooter({ text: theme.footer })
      .setTimestamp(message.createdAt);

    const img = message.attachments.find((a) => a.contentType?.startsWith('image/'));
    if (img) embed.setImage(img.url);

    if (map[message.id]) {
      const existing = await starChannel.messages.fetch(map[message.id]).catch(() => null);
      if (existing) {
        await existing.edit({ content: `${emojiWanted} **${count}**`, embeds: [embed] });
        return;
      }
    }

    const sent = await starChannel.send({ content: `${emojiWanted} **${count}**`, embeds: [embed] });
    map[message.id] = sent.id;
    saveData(data);
  } catch (err) {
    console.error('starboard:', err.message);
  }
}

function handleStarboardConfig(message, data, args) {
  // called from config or standalone !starboard
  const sub = (args[1] || '').toLowerCase();
  const guildData = getGuildData(data, message.guild.id);
  if (!message.member?.permissions?.has?.('ManageGuild')) {
    message.reply({
      title: '🔒 Só staff',
      description: 'Precisa **Gerenciar Servidor**.',
      color: theme.colorError
    });
    return true;
  }

  if (sub === 'canal' || sub === 'channel') {
    const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[2]);
    if (!ch) {
      message.reply({
        title: '⭐ Starboard',
        description: 'Use `!starboard canal #destaques`',
        color: theme.colorWarn
      });
      return true;
    }
    guildData.config.starboardChannelId = ch.id;
    saveData(data);
    message.reply({
      title: '⭐ Starboard',
      description: `Canal definido: ${ch}`,
      color: theme.color
    });
    return true;
  }

  if (sub === 'min' || sub === 'minimo') {
    const n = parseInt(args[2], 10);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      message.reply({
        title: '⭐ Starboard',
        description: '`!starboard min 3`',
        color: theme.colorWarn
      });
      return true;
    }
    guildData.config.starboardMin = n;
    saveData(data);
    message.reply({
      title: '⭐ Starboard',
      description: `Mínimo de reações: **${n}**`,
      color: theme.color
    });
    return true;
  }

  if (sub === 'off') {
    guildData.config.starboardChannelId = null;
    saveData(data);
    message.reply({
      title: '⭐ Starboard',
      description: 'Desativado.',
      color: theme.colorWarn
    });
    return true;
  }

  message.reply({
    title: '⭐ Starboard',
    description: [
      'Mensagens com estrelas suficientes vão pro canal de destaques.',
      '`!starboard canal #canal`',
      '`!starboard min 3`',
      '`!starboard off`',
      `Atual: canal \`${guildData.config.starboardChannelId || '—'}\` · min **${guildData.config.starboardMin ?? 3}**`
    ].join('\n'),
    color: theme.color
  });
  return true;
}

function handleStarboardCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  if (args[0].toLowerCase() !== '!starboard' && args[0].toLowerCase() !== '!estrelas') return false;
  return handleStarboardConfig(message, data, args);
}

module.exports = {
  handleStarboardReaction,
  handleStarboardCommand
};
