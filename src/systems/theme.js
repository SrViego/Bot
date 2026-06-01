const { EmbedBuilder } = require('discord.js');

const theme = {
  color: 0x2ecc71,
  name: 'Isolde',
  footer: 'Hallownest Bots'
};

const patchedMessages = new WeakSet();
const patchedChannels = new WeakSet();

function createEmbed(description, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color ?? theme.color)
    .setDescription(description)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.footer !== false) embed.setFooter({ text: options.footer ?? theme.footer });

  return embed;
}

function asThemedPayload(payload) {
  if (typeof payload !== 'string') return payload;

  return {
    embeds: [createEmbed(payload)]
  };
}

function applyGreenTheme(message) {
  if (!message || patchedMessages.has(message)) return message;

  patchedMessages.add(message);

  const originalReply = message.reply.bind(message);
  message.reply = (payload) => originalReply(asThemedPayload(payload));

  if (message.channel && !patchedChannels.has(message.channel)) {
    patchedChannels.add(message.channel);
    const originalSend = message.channel.send.bind(message.channel);
    message.channel.send = (payload) => originalSend(asThemedPayload(payload));
  }

  return message;
}

async function sendGreen(channel, payload) {
  return channel.send(asThemedPayload(payload));
}

module.exports = {
  applyGreenTheme,
  sendGreen,
  createEmbed,
  theme
};
