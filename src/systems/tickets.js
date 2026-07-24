/**
 * Sistema de canais de ajuda (tickets).
 *
 * Usuário:  !ticket [motivo]  |  !suporte  |  !pedirajuda
 * Staff:    !fechar [motivo]  (no canal do ticket)
 *           !addticket @user
 *           !tickets          (lista abertos)
 *
 * Config (Gerenciar Servidor):
 *   !config ticket on|off
 *   !config ticketcategoria #categoria | off
 *   !config ticketcargo @cargo | off
 */

const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { getGuildData, saveData } = require('./database');
const { createEmbed, theme } = require('./theme');

const OPEN_CMDS = new Set(['!ticket', '!suporte', '!pedirajuda', '!ajuda-canal']);
const CLOSE_CMDS = new Set(['!fechar', '!closeticket', '!fecharticket']);
const ADD_CMDS = new Set(['!addticket', '!ticketadd']);
const LIST_CMDS = new Set(['!tickets', '!listatickets']);

const COOLDOWN_MS = 60_000;
const openCooldown = new Map(); // userId -> ts

function handleTicketCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (OPEN_CMDS.has(command)) {
    openTicket(message, args, data).catch((err) => {
      console.error('ticket open:', err);
      message.reply({
        title: '🎫 Erro',
        description:
          'Não consegui abrir o canal. Confira se eu tenho **Gerenciar Canais** e se a categoria/cargo estão configurados (`!config`).',
        color: theme.colorError
      });
    });
    return true;
  }

  if (CLOSE_CMDS.has(command)) {
    closeTicket(message, args, data).catch((err) => {
      console.error('ticket close:', err);
      message.reply({
        title: '🎫 Erro',
        description: 'Não consegui fechar este ticket.',
        color: theme.colorError
      });
    });
    return true;
  }

  if (ADD_CMDS.has(command)) {
    addToTicket(message, data).catch((err) => {
      console.error('ticket add:', err);
      message.reply({
        title: '🎫 Erro',
        description: 'Não consegui adicionar a pessoa.',
        color: theme.colorError
      });
    });
    return true;
  }

  if (LIST_CMDS.has(command)) {
    listTickets(message, data);
    return true;
  }

  return false;
}

function ensureTickets(data, guildId) {
  if (!data.tickets) data.tickets = {};
  if (!data.tickets[guildId]) data.tickets[guildId] = {};
  return data.tickets[guildId];
}

function getConfig(data, guildId) {
  return getGuildData(data, guildId).config;
}

function findOpenTicketForUser(tickets, userId) {
  return Object.entries(tickets).find(
    ([, t]) => t.open && t.userId === userId
  );
}

async function openTicket(message, args, data) {
  const guild = message.guild;
  const config = getConfig(data, guild.id);
  const tickets = ensureTickets(data, guild.id);

  if (config.ticketEnabled === false) {
    await message.reply({
      title: '🎫 Tickets desativados',
      description: 'O sistema de ajuda está desligado neste servidor.',
      color: theme.colorWarn
    });
    return;
  }

  const now = Date.now();
  const last = openCooldown.get(message.author.id) || 0;
  if (now - last < COOLDOWN_MS) {
    const s = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    await message.reply({
      title: '⏳ Calma',
      description: `Espere **${s}s** para abrir outro pedido.`,
      color: theme.colorWarn
    });
    return;
  }

  const existing = findOpenTicketForUser(tickets, message.author.id);
  if (existing) {
    const [channelId] = existing;
    await message.reply({
      title: '🎫 Você já tem um ticket',
      description: `Continue a conversa em <#${channelId}>.\nStaff pode fechar com \`!fechar\`.`,
      color: theme.colorWarn
    });
    return;
  }

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Eu preciso de **Gerenciar Canais** para criar o canal de ajuda.',
      color: theme.colorError
    });
    return;
  }

  const reason = args.slice(1).join(' ').trim().slice(0, 200) || 'Sem motivo informado';
  const counter = (config.ticketCounter || 0) + 1;
  config.ticketCounter = counter;

  const safeName = message.author.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12) || 'user';
  const channelName = `ajuda-${safeName}-${counter}`.slice(0, 100);

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: message.author.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks
      ]
    },
    {
      id: me.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.EmbedLinks
      ]
    }
  ];

  if (config.ticketStaffRoleId) {
    overwrites.push({
      id: config.ticketStaffRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ManageMessages
      ]
    });
  }

  // quem tem ManageGuild também vê (opcional: não necessário se staff role ok)

  const createOpts = {
    name: channelName,
    type: ChannelType.GuildText,
    topic: `Ajuda de ${message.author.tag} (${message.author.id}) · ${reason}`,
    permissionOverwrites: overwrites,
    reason: `Ticket de ajuda #${counter} por ${message.author.tag}`
  };

  if (config.ticketCategoryId) {
    const parent = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
    if (parent && parent.type === ChannelType.GuildCategory) {
      createOpts.parent = parent.id;
    }
  }

  const channel = await guild.channels.create(createOpts);

  tickets[channel.id] = {
    open: true,
    userId: message.author.id,
    number: counter,
    reason,
    createdAt: new Date().toISOString(),
    channelId: channel.id
  };
  saveData(data);
  openCooldown.set(message.author.id, now);

  const staffPing = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : 'Staff';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${channel.id}`)
      .setLabel('Fechar ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${message.author} · ${staffPing}`,
    embeds: [
      createEmbed(
        [
          `Olá ${message.author}! Descreva o problema com o máximo de detalhes.`,
          `A equipe foi avisada e responde por aqui.`,
          '',
          `**Motivo:** ${reason}`,
          `**Ticket:** \`#${counter}\``,
          '',
          'Staff: `!fechar` · `!addticket @user` · botão abaixo'
        ].join('\n'),
        {
          title: `🎫 Canal de ajuda #${counter}`,
          color: theme.color,
          footer: { text: theme.footer }
        }
      )
    ],
    components: [row]
  });

  await message.reply({
    title: '🎫 Canal aberto',
    description: `Seu pedido de ajuda está em ${channel}.\nExplique o problema por lá — a staff vai te atender.`,
    color: theme.color
  });

  // log se houver canal de logs
  const logId = config.logChannelId;
  if (logId) {
    const logCh = await guild.channels.fetch(logId).catch(() => null);
    if (logCh?.isTextBased()) {
      await logCh
        .send({
          embeds: [
            createEmbed(
              `**Novo ticket #${counter}**\nUsuário: ${message.author}\nCanal: ${channel}\nMotivo: ${reason}`,
              { title: '🎫 Ticket aberto', color: theme.color }
            )
          ]
        })
        .catch(() => null);
    }
  }
}

async function closeTicket(message, args, data) {
  const tickets = ensureTickets(data, message.guild.id);
  const ticket = tickets[message.channel.id];

  if (!ticket || !ticket.open) {
    await message.reply({
      title: '🎫 Não é um ticket',
      description: 'Este comando só funciona **dentro** de um canal de ajuda aberto.',
      color: theme.colorWarn
    });
    return;
  }

  const config = getConfig(data, message.guild.id);
  const isOwner = message.author.id === ticket.userId;
  const isStaff =
    message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
    message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    (config.ticketStaffRoleId && message.member.roles.cache.has(config.ticketStaffRoleId));

  if (!isOwner && !isStaff) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Só o autor do ticket ou a staff podem fechar.',
      color: theme.colorError
    });
    return;
  }

  const closeReason = args.slice(1).join(' ').trim().slice(0, 200) || 'Fechado';
  ticket.open = false;
  ticket.closedAt = new Date().toISOString();
  ticket.closedBy = message.author.id;
  ticket.closeReason = closeReason;
  saveData(data);

  await message.channel.send({
    embeds: [
      createEmbed(
        `Ticket **#${ticket.number}** fechado por ${message.author}.\nMotivo: ${closeReason}\n\nCanal será apagado em **10 segundos**…`,
        { title: '🔒 Ticket fechado', color: theme.colorError }
      )
    ]
  });

  const channelId = message.channel.id;
  setTimeout(async () => {
    try {
      const ch = await message.guild.channels.fetch(channelId).catch(() => null);
      if (ch) await ch.delete(`Ticket #${ticket.number} fechado`);
    } catch (err) {
      console.error('ticket delete channel:', err);
    }
    // limpa registro antigo opcionalmente mantém closed
    delete tickets[channelId];
    saveData(data);
  }, 10_000);
}

async function addToTicket(message, data) {
  const tickets = ensureTickets(data, message.guild.id);
  const ticket = tickets[message.channel.id];

  if (!ticket || !ticket.open) {
    await message.reply({
      title: '🎫 Não é um ticket',
      description: 'Use `!addticket @user` **dentro** do canal de ajuda.',
      color: theme.colorWarn
    });
    return;
  }

  const config = getConfig(data, message.guild.id);
  const isStaff =
    message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
    message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    (config.ticketStaffRoleId && message.member.roles.cache.has(config.ticketStaffRoleId));

  if (!isStaff && message.author.id !== ticket.userId) {
    await message.reply({
      title: '🔒 Sem permissão',
      description: 'Só staff (ou o dono do ticket) pode adicionar pessoas.',
      color: theme.colorError
    });
    return;
  }

  const target = message.mentions.members.first();
  if (!target) {
    await message.reply({
      title: '🎫 Uso',
      description: '`!addticket @usuario`',
      color: theme.colorWarn
    });
    return;
  }

  await message.channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true
  });

  await message.reply({
    title: '🎫 Membro adicionado',
    description: `${target} agora pode ver este canal de ajuda.`,
    color: theme.color
  });
}

function listTickets(message, data) {
  const config = getConfig(data, message.guild.id);
  const isStaff =
    message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
    message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    (config.ticketStaffRoleId && message.member.roles.cache.has(config.ticketStaffRoleId));

  if (!isStaff) {
    message.reply({
      title: '🔒 Sem permissão',
      description: 'Só a staff pode listar tickets abertos.',
      color: theme.colorError
    });
    return;
  }

  const tickets = ensureTickets(data, message.guild.id);
  const open = Object.values(tickets).filter((t) => t.open);

  if (!open.length) {
    message.reply({
      title: '🎫 Tickets',
      description: 'Nenhum ticket aberto no momento.',
      color: theme.color
    });
    return;
  }

  const lines = open
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .slice(0, 20)
    .map(
      (t) =>
        `\`#${t.number}\` <#${t.channelId}> · <@${t.userId}> · ${t.reason || '—'}`
    );

  message.reply({
    title: `🎫 Tickets abertos (${open.length})`,
    description: lines.join('\n'),
    color: theme.color
  });
}

/**
 * Botão "Fechar ticket" no canal.
 */
async function handleTicketButton(interaction, data) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('ticket:close:')) return false;

  const channelId = interaction.customId.split(':')[2];
  if (interaction.channelId !== channelId) {
    await interaction.reply({ content: 'Botão inválido neste canal.', ephemeral: true });
    return true;
  }

  const tickets = ensureTickets(data, interaction.guildId);
  const ticket = tickets[channelId];
  if (!ticket || !ticket.open) {
    await interaction.reply({ content: 'Este ticket já está fechado.', ephemeral: true });
    return true;
  }

  const config = getConfig(data, interaction.guildId);
  const member = interaction.member;
  const isOwner = interaction.user.id === ticket.userId;
  const isStaff =
    member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    (config.ticketStaffRoleId && member.roles.cache.has(config.ticketStaffRoleId));

  if (!isOwner && !isStaff) {
    await interaction.reply({
      content: 'Só o autor do ticket ou a staff podem fechar.',
      ephemeral: true
    });
    return true;
  }

  await interaction.deferUpdate();

  ticket.open = false;
  ticket.closedAt = new Date().toISOString();
  ticket.closedBy = interaction.user.id;
  ticket.closeReason = 'Fechado pelo botão';
  saveData(data);

  await interaction.channel.send({
    embeds: [
      createEmbed(
        `Ticket **#${ticket.number}** fechado por ${interaction.user}.\nCanal será apagado em **10 segundos**…`,
        { title: '🔒 Ticket fechado', color: theme.colorError }
      )
    ]
  });

  setTimeout(async () => {
    try {
      const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (ch) await ch.delete(`Ticket #${ticket.number} fechado`);
    } catch (err) {
      console.error('ticket delete channel:', err);
    }
    delete tickets[channelId];
    saveData(data);
  }, 10_000);

  return true;
}

module.exports = {
  handleTicketCommand,
  handleTicketButton
};
