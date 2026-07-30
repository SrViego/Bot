const { EmbedBuilder } = require('discord.js');

// Paleta vermelha — alinhada ao wallpaper / Noctalia (coral + laranja)
const theme = {
  color: 0xe7644d,
  colorAccent: 0xf79f5b,
  colorWarn: 0xf7c767,
  colorError: 0xc6463d,
  colorInfo: 0xc46b5a,
  name: 'Morgana',
  footer: '✦ Hallownest Bots · Morgana',
  // GIFs padrao (podem ser sobrescritos no .env)
  welcomeGifs: [
    'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
    'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif'
  ],
  goodbyeGifs: [
    'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    'https://media.giphy.com/media/l2R0eYcNq9rJUsVAA/giphy.gif',
    'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif',
    'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif'
  ]
};

const patchedMessages = new WeakSet();
const patchedChannels = new WeakSet();

function pickRandom(list) {
  if (!list?.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function progressBar(current, max, size = 10) {
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, current / safeMax));
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.floor(ratio * 100)}%`;
}

/**
 * options: title, description, fields, thumbnail, image, author, footer, color, timestamp
 * description can be string or null
 */
function createEmbed(description, options = {}) {
  const embed = new EmbedBuilder().setColor(options.color ?? theme.color);

  if (description) embed.setDescription(description);
  if (options.title) embed.setTitle(options.title);
  if (options.url) embed.setURL(options.url);

  if (options.author) {
    const author =
      typeof options.author === 'string'
        ? { name: options.author }
        : options.author;
    embed.setAuthor(author);
  }

  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);

  if (Array.isArray(options.fields) && options.fields.length) {
    embed.addFields(
      options.fields.map((f) => ({
        name: f.name,
        value: String(f.value).slice(0, 1024) || '—',
        inline: Boolean(f.inline)
      }))
    );
  }

  if (options.footer !== false) {
    const footer =
      typeof options.footer === 'object' && options.footer
        ? options.footer
        : { text: options.footer ?? theme.footer };
    embed.setFooter(footer);
  }

  if (options.timestamp !== false) {
    embed.setTimestamp(options.timestamp === true || options.timestamp == null ? new Date() : options.timestamp);
  }

  return embed;
}

function buildPayload(options = {}) {
  // string curta → embed simples
  if (typeof options === 'string') {
    return { embeds: [createEmbed(options)] };
  }

  const embed = createEmbed(options.description ?? null, options);
  const payload = { embeds: [embed] };

  if (options.content) payload.content = options.content;
  if (options.components) payload.components = options.components;
  if (options.files) payload.files = options.files;
  if (options.allowedMentions) payload.allowedMentions = options.allowedMentions;
  // permitir marcar usuarios nas boas-vindas
  if (options.mentionUserId) {
    payload.content = options.content ?? `<@${options.mentionUserId}>`;
    payload.allowedMentions = options.allowedMentions ?? {
      users: [options.mentionUserId],
      roles: [],
      repliedUser: false
    };
  }

  return payload;
}

function asThemedPayload(payload) {
  if (typeof payload === 'string') {
    return buildPayload(payload);
  }

  if (!payload || typeof payload !== 'object') return payload;

  // ja e payload rico do discord.js (embeds prontos)
  if (payload.embeds || payload.components || payload.poll) {
    return payload;
  }

  // objeto de opcoes do nosso helper (pode incluir files + image attachment)
  if (
    payload.title ||
    payload.description ||
    payload.fields ||
    payload.thumbnail ||
    payload.image ||
    payload.mentionUserId ||
    payload.files
  ) {
    // se só tem files sem metadados de embed, repassa cru
    if (
      payload.files &&
      !payload.title &&
      !payload.description &&
      !payload.fields &&
      !payload.thumbnail &&
      !payload.image &&
      !payload.mentionUserId
    ) {
      return payload;
    }
    return buildPayload(payload);
  }

  return payload;
}

function applyTheme(message) {
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

async function sendThemed(channel, payload) {
  return channel.send(asThemedPayload(payload));
}

/** Atalho: message.reply com embed rico */
function replyPretty(message, options) {
  return message.reply(buildPayload(options));
}

// aliases legados (código antigo)
const applyGreenTheme = applyTheme;
const sendGreen = sendThemed;

module.exports = {
  applyTheme,
  sendThemed,
  applyGreenTheme,
  sendGreen,
  createEmbed,
  buildPayload,
  asThemedPayload,
  replyPretty,
  progressBar,
  pickRandom,
  theme
};
