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
  message.reply(target.displayAvatarURL({ size: 1024, extension: 'png' }));
}

function showUserInfo(message) {
  const member = message.mentions.members.first() ?? message.member;
  const joinedAt = member.joinedAt ? member.joinedAt.toLocaleDateString('pt-BR') : 'desconhecido';
  const createdAt = member.user.createdAt.toLocaleDateString('pt-BR');
  const roles = member.roles.cache
    .filter((role) => role.id !== message.guild.id)
    .sort((a, b) => b.position - a.position)
    .first(8)
    .map((role) => `${role}`)
    .join(', ') || 'nenhum';

  message.reply([
    `**Usuario:** ${member.user.tag}`,
    `ID: ${member.id}`,
    `Conta criada: ${createdAt}`,
    `Entrou no servidor: ${joinedAt}`,
    `Cargos: ${roles}`
  ].join('\n'));
}

function showServerInfo(message) {
  const guild = message.guild;
  const createdAt = guild.createdAt.toLocaleDateString('pt-BR');

  message.reply([
    `**Servidor:** ${guild.name}`,
    `ID: ${guild.id}`,
    `Dono: <@${guild.ownerId}>`,
    `Membros: ${guild.memberCount}`,
    `Canais: ${guild.channels.cache.size}`,
    `Cargos: ${guild.roles.cache.size}`,
    `Criado em: ${createdAt}`
  ].join('\n'));
}

function say(message, args) {
  const text = args.slice(1).join(' ');

  if (!text) {
    message.reply('Use: !say mensagem');
    return;
  }

  message.delete().catch(() => null);
  message.channel.send(text.slice(0, 1800));
}

function showHelp(message) {
  message.reply([
    '**Comandos principais**',
    'Perfil: !perfil, !conquistas, !rep @usuario, !rankrep',
    'Economia: !pontos, !daily, !loja, !comprar id, !inventario, !usar id',
    'Minigames: !coinflip cara|coroa aposta, !guess 1-5 aposta, !minigames',
    'Utilidade: !avatar, !userinfo, !serverinfo, !say, !ping',
    'Musica: !play, !skip, !stop, !queue, !pause, !resume',
    'Config: !config, !config logs #canal, !config autorole @cargo',
    'Moderacao: !ban, !kick, !timeout, !warn, !clear, !modlogs'
  ].join('\n'));
}

module.exports = {
  handleUtilityCommand
};
