const { SlashCommandBuilder } = require('discord.js');
const { QUOTES, FACTS } = require('../systems/lore');
const { theme } = require('../systems/theme');
const { register } = require('./registry');

function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

function pickFact() {
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}

register({
  name: 'lore',
  aliases: ['hallownest', 'citacao', 'citação', 'hk'],
  description: 'Citação ou fato de Hallownest',
  category: 'fun',
  slash: true,
  slashBuilder: new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Citação aleatória de Hallownest')
    .addStringOption((o) =>
      o
        .setName('tipo')
        .setDescription('quote ou fato')
        .setRequired(false)
        .addChoices(
          { name: 'Citação', value: 'quote' },
          { name: 'Fato', value: 'fato' }
        )
    ),
  async execute(ctx) {
    let sub = (ctx.args[0] || '').toLowerCase();
    if (ctx.isSlash) {
      sub = (ctx.options.getString('tipo') || 'quote').toLowerCase();
    }

    if (sub === 'fato' || sub === 'fact') {
      await ctx.reply({
        title: '📜 Lore · Hallownest',
        description: pickFact(),
        color: theme.color
      });
      return;
    }

    const quote = pickQuote();
    await ctx.reply({
      title: `📜 ${quote.t}`,
      description: `*“${quote.q}”*`,
      footer: { text: `${theme.footer} · !lore fato` },
      color: theme.color
    });
  }
});
