function handleUtilityCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!avatar') {
    showAvatar(message);
    return true;
  }

  if (command === '!userinfo') {
    showUserInfo(message);
    return true;
  }

  if (command === '!serverinfo') {
    showServerInfo(message);
    return true;
  }

  if (command === '!say') {
    say(message, args);
    return true;
  }

  if (command === '!help' || command === '!ajuda') {
    showHelp(message);
    return true;
  }

  return false;
}

function showAvatar(message) {
  const target = message.mentions.users.first() ?? message.author;
  const url = target.displayAvatarURL({ size: 1024, extension: 'png' });

  message.reply({
    title: `🖼️ Avatar de ${target.username}`,
    description: `[Abrir em tamanho cheio](${url})`,
    image: url,
    thumbnail: target.displayAvatarURL({ size: 128 })
  });
}

function showUserInfo(message) {
  const member = message.mentions.members.first() ?? message.member;
  const user = member.user;
  const roles = member.roles.cache
    .filter((role) => role.id !== message.guild.id)
    .sort((a, b) => b.position - a.position)
    .first(10)
    .map((role) => `${role}`)
    .join(', ') || '*nenhum*';

  message.reply({
    title: `👤 ${user.tag}`,
    thumbnail: user.displayAvatarURL({ size: 256 }),
    fields: [
      { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
      { name: '🤖 Bot?', value: user.bot ? 'Sim' : 'Não', inline: true },
      {
        name: '📅 Conta criada',
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
        inline: false
      },
      {
        name: '🚪 Entrou no servidor',
        value: member.joinedTimestamp
          ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
          : '—',
        inline: false
      },
      { name: '🎭 Cargos', value: roles.slice(0, 1000), inline: false }
    ],
    color: member.displayColor || undefined
  });
}

function showServerInfo(message) {
  const guild = message.guild;
  const icon = guild.iconURL({ size: 256 });

  message.reply({
    title: `🏰 ${guild.name}`,
    thumbnail: icon ?? undefined,
    image: guild.bannerURL({ size: 512 }) ?? undefined,
    fields: [
      { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
      { name: '👑 Dono', value: `<@${guild.ownerId}>`, inline: true },
      { name: '👥 Membros', value: String(guild.memberCount), inline: true },
      { name: '💬 Canais', value: String(guild.channels.cache.size), inline: true },
      { name: '🎭 Cargos', value: String(guild.roles.cache.size), inline: true },
      { name: '😀 Emojis', value: String(guild.emojis.cache.size), inline: true },
      {
        name: '📅 Criado em',
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
        inline: false
      }
    ]
  });
}

function say(message, args) {
  const text = args.slice(1).join(' ');

  if (!text) {
    message.reply({
      title: '💬 !say',
      description: 'Use: `!say mensagem`\nEu apago seu comando e repito a mensagem no canal.'
    });
    return;
  }

  message.delete().catch(() => null);
  message.channel.send({
    title: '📢 Anúncio',
    description: text.slice(0, 1800),
    footer: { text: `pedido por ${message.author.tag}` }
  });
}

function showHelp(message) {
  message.reply({
    title: '📗 Guia da Isolde',
    description: 'Comandos principais — digite com `!` no começo.',
    fields: [
      {
        name: '🌿 Perfil & social',
        value: '`!perfil` `!conquistas` `!rep @user` `!rankrep` `!casar` `!casamento`',
        inline: false
      },
      {
        name: '💰 Economia',
        value: '`!pontos` `!daily` `!loja` `!comprar id` `!inventario` `!usar id` `!rankpontos`',
        inline: false
      },
      {
        name: '⭐ XP',
        value: '`!xp` `!level` `!rankxp`',
        inline: false
      },
      {
        name: '🎲 Minigames',
        value: '`!coinflip cara|coroa aposta` `!guess 1-5 aposta` `!minigames`',
        inline: false
      },
      {
        name: '🎵 Música',
        value: '`!play` `!skip` `!stop` `!queue` `!pause` `!resume` `!volume` `!np`',
        inline: false
      },
      {
        name: '🛠️ Utilidade',
        value: '`!avatar` `!userinfo` `!serverinfo` `!say` `!ping` `!ajuda`',
        inline: false
      },
      {
        name: '⚙️ Config (Gerenciar Servidor)',
        value: '`!config` · `!config logs #canal` · `!config autorole @cargo` · `!config welcome on|off` · `!config goodbye on|off`',
        inline: false
      },
      {
        name: '🛡️ Moderação',
        value: '`!ban` `!kick` `!timeout` `!warn` `!clear` `!lock` `!unlock` `!modlogs`',
        inline: false
      }
    ],
    thumbnail: message.client.user.displayAvatarURL({ size: 128 })
  });
}

module.exports = {
  handleUtilityCommand
};
