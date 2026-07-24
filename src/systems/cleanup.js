const { PermissionsBitField } = require('discord.js');
const { getGuildData, saveData } = require('./database');
const { createEmbed, theme } = require('./theme');

/**
 * !limpeza — manutenção do canal / dados da Morgana
 *
 *   !limpeza [1-100]       apaga N mensagens recentes do canal
 *   !limpeza bot [1-100]   apaga só mensagens da Morgana (até N, padrão 50)
 *   !limpeza efeitos       remove efeitos expirados da database do servidor
 *   !limpeza ajuda         mostra esta ajuda
 */
function handleCleanupCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command !== '!limpeza' && command !== '!cleanup' && command !== '!clean') {
    return false;
  }

  const sub = (args[1] || '').toLowerCase();

  if (!sub || sub === 'ajuda' || sub === 'help') {
    showHelp(message);
    return true;
  }

  if (sub === 'efeitos' || sub === 'effects') {
    cleanExpiredEffects(message, data);
    return true;
  }

  if (sub === 'bot' || sub === 'morgana') {
    const amount = parseAmount(args[2], 50);
    if (amount == null) {
      message.reply({
        title: '🧹 Uso',
        description: '`!limpeza bot [1-100]` — padrão **50**',
        color: theme.colorWarn
      });
      return true;
    }
    cleanBotMessages(message, amount).catch((err) => {
      console.error('limpeza bot:', err);
      message.reply({
        title: '🧹 Erro',
        description:
          'Não consegui apagar as mensagens da bot. Confira a permissão **Gerenciar Mensagens**.',
        color: theme.colorError
      });
    });
    return true;
  }

  // !limpeza 25  |  !limpeza mensagens 25
  let amount;
  if (sub === 'mensagens' || sub === 'msgs' || sub === 'canal') {
    amount = parseAmount(args[2], null);
  } else {
    amount = parseAmount(args[1], null);
  }

  if (amount == null) {
    showHelp(message);
    return true;
  }

  cleanChannelMessages(message, amount).catch((err) => {
    console.error('limpeza canal:', err);
    message.reply({
      title: '🧹 Erro',
      description:
        'Não consegui apagar as mensagens. Preciso de **Gerenciar Mensagens** e as msgs devem ter menos de 14 dias.',
      color: theme.colorError
    });
  });
  return true;
}

function showHelp(message) {
  message.reply({
    title: '🧹 Limpeza · Morgana',
    description: 'Comandos de limpeza do canal e da database do servidor.',
    fields: [
      {
        name: '💬 Canal',
        value: [
          '`!limpeza <1-100>` — apaga N mensagens recentes',
          '`!limpeza bot [1-100]` — só mensagens da Morgana (padrão 50)'
        ].join('\n'),
        inline: false
      },
      {
        name: '🗄️ Dados',
        value: '`!limpeza efeitos` — remove buffs/efeitos já expirados',
        inline: false
      },
      {
        name: '🔐 Permissão',
        value:
          '**Gerenciar Mensagens** (canal) · **Gerenciar Servidor** ou **Gerenciar Mensagens** (efeitos).',
        inline: false
      }
    ],
    color: theme.color
  });
}

function parseAmount(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) return null;
  return n;
}

function memberCanManageMessages(message) {
  return Boolean(message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages));
}

function memberCanManageGuild(message) {
  return Boolean(message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild));
}

function botCanManageMessages(message) {
  return Boolean(
    message.guild?.members?.me?.permissionsIn(message.channel)?.has(
      PermissionsBitField.Flags.ManageMessages
    )
  );
}

async function cleanChannelMessages(message, amount) {
  if (!memberCanManageMessages(message)) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Você precisa de **Gerenciar Mensagens** para limpar o canal.',
      color: theme.colorError
    });
    return;
  }

  if (!botCanManageMessages(message)) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Eu preciso de **Gerenciar Mensagens** neste canal.',
      color: theme.colorError
    });
    return;
  }

  // inclui o comando na contagem
  const fetched = await message.channel.messages.fetch({ limit: Math.min(100, amount + 1) });
  const deleted = await message.channel.bulkDelete(fetched, true);

  const sent = await message.channel.send({
    embeds: [
      createEmbed(`Apaguei **${deleted.size}** mensagem(ns) em ${message.channel}.`, {
        title: '🧹 Canal limpo',
        color: theme.color
      })
    ]
  });
  setTimeout(() => sent.delete().catch(() => null), 5000);
}

async function cleanBotMessages(message, amount) {
  if (!memberCanManageMessages(message)) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Você precisa de **Gerenciar Mensagens**.',
      color: theme.colorError
    });
    return;
  }

  if (!botCanManageMessages(message)) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Eu preciso de **Gerenciar Mensagens** neste canal.',
      color: theme.colorError
    });
    return;
  }

  const botId = message.client.user.id;
  const fetched = await message.channel.messages.fetch({ limit: 100 });
  const mine = [...fetched.filter((m) => m.author.id === botId).values()].slice(0, amount);

  if (!mine.length) {
    await message.reply({
      title: '🧹 Nada pra limpar',
      description: 'Não achei mensagens minhas recentes neste canal.',
      color: theme.colorWarn
    });
    return;
  }

  let removed = 0;
  try {
    const res = await message.channel.bulkDelete(mine, true);
    removed = res.size;
  } catch {
    for (const m of mine) {
      try {
        await m.delete();
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  }

  await message.reply({
    title: '🧹 Mensagens da bot',
    description: `Apaguei **${removed}** mensagem(ns) minha(s) em ${message.channel}.`,
    color: theme.color
  });
}

function cleanExpiredEffects(message, data) {
  if (!memberCanManageGuild(message) && !memberCanManageMessages(message)) {
    message.reply({
      title: '🔒 Sem permissão',
      description: 'Você precisa de **Gerenciar Servidor** ou **Gerenciar Mensagens**.',
      color: theme.colorError
    });
    return;
  }

  const guildData = getGuildData(data, message.guild.id);
  const now = Date.now();
  let usersTouched = 0;
  let effectsRemoved = 0;

  for (const userId of Object.keys(guildData.users)) {
    const user = guildData.users[userId];
    if (!user?.effects || typeof user.effects !== 'object') continue;

    let changed = false;
    for (const [key, until] of Object.entries(user.effects)) {
      if (typeof until === 'number' && until <= now) {
        delete user.effects[key];
        effectsRemoved += 1;
        changed = true;
      }
    }
    if (changed) usersTouched += 1;
  }

  if (effectsRemoved > 0) saveData(data);

  message.reply({
    title: '🧹 Efeitos expirados',
    description:
      effectsRemoved === 0
        ? 'Nenhum efeito vencido pra limpar neste servidor.'
        : `Removi **${effectsRemoved}** efeito(s) expirado(s) de **${usersTouched}** usuário(s).`,
    color: theme.color
  });
}

module.exports = {
  handleCleanupCommand
};
