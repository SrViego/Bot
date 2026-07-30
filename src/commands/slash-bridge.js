/**
 * Adapta Interaction → objeto "message" mínimo para reutilizar handlers de prefixo.
 */

const { asThemedPayload } = require('../systems/theme');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} content - ex. "!quest pegar"
 * @param {{ mentionUser?: import('discord.js').User|null }} [opts]
 */
function messageFromInteraction(interaction, content, opts = {}) {
  const mentionUser =
    opts.mentionUser !== undefined
      ? opts.mentionUser
      : interaction.options?.getUser?.('user') ||
        interaction.options?.getUser?.('alvo') ||
        interaction.options?.getUser?.('membro') ||
        null;

  const mentionMember =
    (mentionUser && interaction.options?.getMember?.('user')) ||
    (mentionUser && interaction.options?.getMember?.('alvo')) ||
    (mentionUser && interaction.options?.getMember?.('membro')) ||
    null;

  const users = {
    first: () => mentionUser,
    get: (id) => (mentionUser && mentionUser.id === id ? mentionUser : null),
    has: (id) => Boolean(mentionUser && mentionUser.id === id),
    get size() {
      return mentionUser ? 1 : 0;
    }
  };

  const members = {
    first: () => mentionMember,
    get: (id) => (mentionMember && mentionMember.id === id ? mentionMember : null),
    has: (id) => Boolean(mentionMember && mentionMember.id === id),
    get size() {
      return mentionMember ? 1 : 0;
    }
  };

  let firstResponseDone = false;

  async function respond(payload) {
    const p = asThemedPayload(payload);
    // deferred: primeira resposta = editReply; depois followUp
    if (interaction.deferred && !firstResponseDone) {
      firstResponseDone = true;
      return interaction.editReply(p);
    }
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(p);
    }
    firstResponseDone = true;
    return interaction.reply(p);
  }

  async function reply(payload) {
    return respond(payload);
  }

  // canal real com send → mesma fila de resposta da interaction
  const baseChannel = interaction.channel;
  const channelProxy = baseChannel
    ? new Proxy(baseChannel, {
        get(target, prop, receiver) {
          if (prop === 'send') {
            return async (payload) => respond(payload);
          }
          return Reflect.get(target, prop, receiver);
        }
      })
    : null;

  return {
    client: interaction.client,
    guild: interaction.guild,
    member: interaction.member,
    author: interaction.user,
    user: interaction.user,
    channel: channelProxy,
    channelId: interaction.channelId,
    content: content || `!${interaction.commandName}`,
    mentions: { users, members },
    reply,
    // alguns handlers leem permissions no member
    react: async () => null
  };
}

module.exports = { messageFromInteraction };
