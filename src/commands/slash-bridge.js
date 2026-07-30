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
  const mentionUser = opts.mentionUser ?? null;

  const users = {
    first: () => mentionUser,
    get: (id) => (mentionUser && mentionUser.id === id ? mentionUser : null),
    has: (id) => Boolean(mentionUser && mentionUser.id === id),
    get size() {
      return mentionUser ? 1 : 0;
    }
  };

  async function reply(payload) {
    const p = asThemedPayload(payload);
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(p);
    }
    return interaction.reply(p);
  }

  return {
    client: interaction.client,
    guild: interaction.guild,
    member: interaction.member,
    author: interaction.user,
    user: interaction.user,
    channel: interaction.channel,
    channelId: interaction.channelId,
    content: content || `!${interaction.commandName}`,
    mentions: {
      users,
      members: {
        first: () => null,
        get: () => null,
        has: () => false,
        size: 0
      }
    },
    reply
  };
}

module.exports = { messageFromInteraction };
