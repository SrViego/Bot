const { pickRandom, theme, buildPayload } = require('./theme');

function resolveGif(envKey, fallbackList) {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  return pickRandom(fallbackList);
}

/**
 * Boas-vindas: marca a pessoa + embed + GIF
 */
async function sendWelcome(channel, member) {
  const guild = member.guild;
  const user = member.user;
  const memberCount = guild.memberCount;
  const gif = resolveGif('WELCOME_GIF_URL', theme.welcomeGifs);

  const payload = buildPayload({
    mentionUserId: user.id,
    content: `✨ ${member} chegou em **${guild.name}**!`,
    title: '🌿 Bem-vindo(a) ao hall!',
    description: [
      `Olá, ${member}! 🍃`,
      '',
      'Fique à vontade, leia as regras e aproveite o servidor.',
      'Use `!ajuda` para ver os comandos da Isolde.'
    ].join('\n'),
    thumbnail: user.displayAvatarURL({ size: 256, extension: 'png' }),
    image: gif,
    fields: [
      { name: '👤 Membro', value: `${user.tag}`, inline: true },
      { name: '📊 Contagem', value: `Você é o **#${memberCount}**`, inline: true },
      { name: '📅 Conta criada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
    ],
    author: {
      name: guild.name,
      iconURL: guild.iconURL({ size: 64 }) ?? undefined
    },
    color: theme.color,
    footer: { text: `${theme.footer} · boas-vindas` }
  });

  return channel.send(payload);
}

/**
 * Despedida: marca (se possível) + embed + GIF
 */
async function sendGoodbye(channel, member) {
  const guild = member.guild;
  const user = member.user;
  const gif = resolveGif('GOODBYE_GIF_URL', theme.goodbyeGifs);
  // member pode ser partial; tag/avatar ainda costumam existir
  const tag = user?.tag ?? 'Usuário';
  const avatar = user?.displayAvatarURL?.({ size: 256, extension: 'png' });

  const payload = buildPayload({
    mentionUserId: user?.id,
    content: user?.id ? `💨 ${member} partiu...` : '💨 Alguém saiu do servidor...',
    title: '🍂 Até logo!',
    description: [
      `**${tag}** saiu de **${guild.name}**.`,
      '',
      'As portas do hall ficam abertas se quiser voltar. 🕯️'
    ].join('\n'),
    thumbnail: avatar,
    image: gif,
    fields: [
      { name: '👥 Membros agora', value: String(guild.memberCount), inline: true },
      {
        name: '⏱️ Esteve aqui',
        value: member.joinedTimestamp
          ? `desde <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
          : '—',
        inline: true
      }
    ],
    author: {
      name: guild.name,
      iconURL: guild.iconURL({ size: 64 }) ?? undefined
    },
    color: 0x95a5a6,
    footer: { text: `${theme.footer} · despedida` }
  });

  return channel.send(payload);
}

module.exports = {
  sendWelcome,
  sendGoodbye
};
