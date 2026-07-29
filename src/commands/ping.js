const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../systems/theme');
const { register } = require('./registry');

register({
  name: 'ping',
  description: 'Latência do bot',
  category: 'util',
  slash: true,
  slashBuilder: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Latência do bot'),
  async execute(ctx) {
    if (ctx.isSlash) {
      const t = Date.now();
      await ctx.reply({
        embeds: [
          createEmbed(
            `💓 WS: \`${ctx.clientPing()}ms\`\n⏱ agora: \`${Date.now() - t}ms\``,
            { title: '🏓 Pong!' }
          )
        ]
      });
      return;
    }

    const sent = await ctx.message.reply({
      title: '🏓 Pong!',
      description: 'Medindo latência…'
    });
    const roundtrip = sent.createdTimestamp - ctx.message.createdTimestamp;
    const ws = ctx.clientPing();
    await sent.edit({
      embeds: [
        createEmbed(
          [`📡 **Round-trip:** \`${roundtrip}ms\``, `💓 **WebSocket:** \`${ws}ms\``].join('\n'),
          { title: '🏓 Pong!' }
        )
      ]
    });
  }
});
