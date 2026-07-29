const { SlashCommandBuilder } = require('discord.js');
const { showHelp, HELP_PAGES } = require('../systems/help');
const { createEmbed } = require('../systems/theme');
const { register } = require('./registry');

register({
  name: 'ajuda',
  aliases: ['help'],
  description: 'Guia da Morgana',
  category: 'util',
  slash: true,
  slashBuilder: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Guia rápido da Morgana')
    .addIntegerOption((o) =>
      o
        .setName('pagina')
        .setDescription(`Página 1–${HELP_PAGES.length}`)
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(HELP_PAGES.length)
    ),
  async execute(ctx) {
    if (ctx.isSlash) {
      const page = ctx.options.getInteger('pagina') || 1;
      const idx = Math.min(HELP_PAGES.length, Math.max(1, page)) - 1;
      const p = HELP_PAGES[idx];
      await ctx.interaction.reply({
        embeds: [
          createEmbed(
            [
              p.description,
              '',
              p.fields.map((f) => `**${f.name}**\n${f.value}`).join('\n\n'),
              '',
              '_No chat: `!ajuda` com botões de página._'
            ].join('\n'),
            { title: p.title }
          )
        ],
        ephemeral: true
      });
      return;
    }

    // `!ajuda padaria` é tratado pela padaria (antes do registry no index)
    await showHelp(ctx.message, ctx.args[0]);
  }
});
