/**
 * Catálogo completo de slash commands.
 * Cada entrada vira JSON no Discord e, no uso, monta `!cmd …` + bridge pro handler.
 * Limite Discord: 100 comandos globais — ficamos bem abaixo.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { messageFromInteraction } = require('./slash-bridge');
const { trackCommand, trackError } = require('../systems/metrics');

const { handlePointsCommand } = require('../systems/points');
const { handleXpCommand } = require('../systems/xp');
const { handleProfileCommand } = require('../systems/profile');
const { handleUtilityCommand } = require('../systems/utility');
const { handleReputationCommand } = require('../systems/reputation');
const { handleQuestCommand } = require('../systems/quests');
const { handleCosmeticsCommand } = require('../systems/cosmetics');
const { handleMetricsCommand } = require('../systems/metrics');
const { handleShopCommand } = require('../systems/shop');
const { handlePokemonCommand } = require('../systems/pokemon');
const { handleMinigameCommand } = require('../systems/minigames');
const { handleExchangeCommand } = require('../systems/economy-bridge');
const { handleBetCommand } = require('../systems/bets');
const { handleAchievementsCommand } = require('../systems/achievements');
const { handleServerStatsCommand } = require('../systems/server-stats');
const { handleMusicCommand } = require('../systems/music');
const { handleBakeryCommand } = require('../systems/bakery');
const { handleEventCommand } = require('../systems/guild-events');
const { handleMarriageCommand } = require('../systems/marriage');
const { handleModerationCommand } = require('../systems/moderation');
const { handleConfigCommand } = require('../systems/config');
const { handleCleanupCommand } = require('../systems/cleanup');
const { handleTicketCommand } = require('../systems/tickets');
const { handleStarboardCommand } = require('../systems/starboard');
const { handleModLogCommand } = require('../systems/modlogs');

const str = (name, desc, required = false) => (b) =>
  b.addStringOption((o) => o.setName(name).setDescription(desc).setRequired(required));
const user = (name, desc, required = false) => (b) =>
  b.addUserOption((o) => o.setName(name).setDescription(desc).setRequired(required));
const int = (name, desc, required = false) => (b) =>
  b.addIntegerOption((o) => o.setName(name).setDescription(desc).setRequired(required));

function mentionContent(cmd, interaction, extra = '') {
  const u =
    interaction.options.getUser('user') ||
    interaction.options.getUser('alvo') ||
    interaction.options.getUser('membro');
  const rest = [u ? `<@${u.id}>` : null, extra].filter(Boolean).join(' ');
  return rest ? `!${cmd} ${rest}` : `!${cmd}`;
}

function optStr(interaction, ...names) {
  for (const n of names) {
    const v = interaction.options.getString(n);
    if (v != null && v !== '') return v;
  }
  return '';
}

function optInt(interaction, ...names) {
  for (const n of names) {
    const v = interaction.options.getInteger(n);
    if (v != null) return String(v);
  }
  return '';
}

/** @type {Array<object>} */
const ENTRIES = [
  // ── Economia ─────────────────────────────────────────────
  { name: 'pontos', description: 'Ver seus pontos (ou de alguém)', build: [user('user', 'Membro')], toContent: (i) => mentionContent('pontos', i), handler: handlePointsCommand },
  { name: 'daily', description: 'Resgatar daily de pontos', toContent: () => '!daily', handler: handlePointsCommand },
  { name: 'rankpontos', description: 'Ranking de pontos', toContent: () => '!rankpontos', handler: handlePointsCommand },
  { name: 'xp', description: 'Ver XP e nível', build: [user('user', 'Membro')], toContent: (i) => mentionContent('xp', i), handler: handleXpCommand },
  { name: 'rankxp', description: 'Ranking de XP', toContent: () => '!rankxp', handler: handleXpCommand },
  { name: 'rep', description: 'Dar +1 reputação', build: [user('user', 'Membro', true)], toContent: (i) => mentionContent('rep', i), handler: handleReputationCommand },
  { name: 'rankrep', description: 'Ranking de reputação', toContent: () => '!rankrep', handler: handleReputationCommand },
  {
    name: 'quest',
    description: 'Quests diárias/semanais',
    build: [
      (b) =>
        b.addStringOption((o) =>
          o
            .setName('acao')
            .setDescription('lista ou resgatar')
            .addChoices(
              { name: 'Listar', value: 'lista' },
              { name: 'Resgatar', value: 'pegar' }
            )
        )
    ],
    toContent: (i) => {
      const a = optStr(i, 'acao');
      return a === 'pegar' ? '!quest pegar' : '!quest';
    },
    handler: handleQuestCommand
  },
  {
    name: 'cosmetico',
    description: 'Loja e cosméticos de perfil',
    build: [
      str('acao', 'loja | comprar | equipar | perfil'),
      str('id', 'id do cosmético')
    ],
    toContent: (i) =>
      `!cosmetico ${[optStr(i, 'acao') || 'loja', optStr(i, 'id')].filter(Boolean).join(' ')}`.trim(),
    handler: handleCosmeticsCommand
  },
  { name: 'loja', description: 'Abrir a loja', toContent: () => '!loja', handler: handleShopCommand },
  { name: 'item', description: 'Detalhe de um item', build: [str('id', 'id do item', true)], toContent: (i) => `!item ${optStr(i, 'id')}`, handler: handleShopCommand },
  { name: 'comprar', description: 'Comprar item da loja', build: [str('id', 'id do item', true)], toContent: (i) => `!comprar ${optStr(i, 'id')}`, handler: handleShopCommand },
  {
    name: 'vender',
    description: 'Vender item do inventário',
    build: [str('id', 'id do item', true), int('quantidade', 'quantidade')],
    toContent: (i) => `!vender ${optStr(i, 'id')} ${optInt(i, 'quantidade')}`.trim(),
    handler: handleShopCommand
  },
  {
    name: 'presentear',
    description: 'Presentear item a alguém',
    build: [user('user', 'Membro', true), str('id', 'id do item', true)],
    toContent: (i) => mentionContent('presentear', i, optStr(i, 'id')),
    handler: handleShopCommand
  },
  { name: 'inventario', description: 'Seu inventário', toContent: () => '!inventario', handler: handleShopCommand },
  { name: 'usar', description: 'Usar item do inventário', build: [str('id', 'id do item', true)], toContent: (i) => `!usar ${optStr(i, 'id')}`, handler: handleShopCommand },
  { name: 'efeitos', description: 'Buffs ativos', toContent: () => '!efeitos', handler: handleShopCommand },
  {
    name: 'cambio',
    description: 'Câmbio entre moedas (pontos/padaria/poke)',
    build: [str('texto', 'ex: pontos padaria 100', true)],
    toContent: (i) => `!cambio ${optStr(i, 'texto')}`,
    handler: handleExchangeCommand
  },
  {
    name: 'apostar',
    description: 'Apostar no próximo coinflip',
    build: [str('texto', 'ex: cara 50', true)],
    toContent: (i) => `!apostar ${optStr(i, 'texto')}`,
    handler: handleBetCommand
  },
  {
    name: 'conquistas',
    description: 'Conquistas desbloqueadas',
    build: [user('user', 'Membro')],
    toContent: (i) => mentionContent('conquistas', i),
    handler: handleAchievementsCommand
  },

  // ── Social / util ────────────────────────────────────────
  {
    name: 'perfil',
    description: 'Perfil completo',
    build: [user('user', 'Membro')],
    toContent: (i) => mentionContent('perfil', i),
    handler: handleProfileCommand
  },
  {
    name: 'avatar',
    description: 'Avatar de um membro',
    build: [user('user', 'Membro')],
    toContent: (i) => mentionContent('avatar', i),
    handler: handleUtilityCommand
  },
  {
    name: 'userinfo',
    description: 'Info de um membro',
    build: [user('user', 'Membro')],
    toContent: (i) => mentionContent('userinfo', i),
    handler: handleUtilityCommand
  },
  { name: 'serverinfo', description: 'Info do servidor', toContent: () => '!serverinfo', handler: handleUtilityCommand },
  {
    name: 'say',
    description: 'Fazer o bot falar (staff)',
    build: [str('texto', 'Mensagem', true)],
    toContent: (i) => `!say ${optStr(i, 'texto')}`,
    handler: handleUtilityCommand
  },
  {
    name: 'metrics',
    description: 'Métricas do bot (Gerenciar servidor)',
    build: [str('acao', 'vazio ou errors')],
    toContent: (i) => `!metrics ${optStr(i, 'acao')}`.trim(),
    handler: handleMetricsCommand,
    permission: PermissionFlagsBits.ManageGuild
  },
  { name: 'serverstats', description: 'Dashboard do servidor', toContent: () => '!serverstats', handler: handleServerStatsCommand },

  // ── Minigames ────────────────────────────────────────────
  {
    name: 'coinflip',
    description: 'Cara ou coroa',
    build: [str('texto', 'ex: cara 50', true)],
    toContent: (i) => `!coinflip ${optStr(i, 'texto')}`,
    handler: handleMinigameCommand
  },
  {
    name: 'guess',
    description: 'Adivinhar número',
    build: [str('texto', 'ex: 3 50', true)],
    toContent: (i) => `!guess ${optStr(i, 'texto')}`,
    handler: handleMinigameCommand
  },
  { name: 'minigames', description: 'Lista de minigames', toContent: () => '!minigames', handler: handleMinigameCommand },

  // ── Casamento ────────────────────────────────────────────
  { name: 'casar', description: 'Pedir em casamento', build: [user('user', 'Membro', true)], toContent: (i) => mentionContent('casar', i), handler: handleMarriageCommand },
  { name: 'aceitarcasamento', description: 'Aceitar pedido', toContent: () => '!aceitarcasamento', handler: handleMarriageCommand },
  { name: 'recusarcasamento', description: 'Recusar pedido', toContent: () => '!recusarcasamento', handler: handleMarriageCommand },
  { name: 'divorciar', description: 'Divórcio', toContent: () => '!divorciar', handler: handleMarriageCommand },
  { name: 'casamento', description: 'Ver casamento', build: [user('user', 'Membro')], toContent: (i) => mentionContent('casamento', i), handler: handleMarriageCommand },

  // ── Música ───────────────────────────────────────────────
  {
    name: 'play',
    description: 'Tocar música (Lavalink)',
    build: [str('query', 'Nome ou URL', true)],
    toContent: (i) => `!play ${optStr(i, 'query')}`,
    handler: handleMusicCommand
  },
  { name: 'skip', description: 'Pular faixa', toContent: () => '!skip', handler: handleMusicCommand },
  { name: 'stop', description: 'Parar e limpar fila', toContent: () => '!stop', handler: handleMusicCommand },
  { name: 'queue', description: 'Ver fila', toContent: () => '!queue', handler: handleMusicCommand },
  { name: 'pause', description: 'Pausar', toContent: () => '!pause', handler: handleMusicCommand },
  { name: 'resume', description: 'Continuar', toContent: () => '!resume', handler: handleMusicCommand },
  { name: 'np', description: 'Tocando agora', toContent: () => '!np', handler: handleMusicCommand },
  {
    name: 'volume',
    description: 'Volume 0–100',
    build: [int('nivel', '0–100', true)],
    toContent: (i) => `!volume ${optInt(i, 'nivel')}`,
    handler: handleMusicCommand
  },

  // ── Padaria ──────────────────────────────────────────────
  { name: 'padaria', description: 'Status da padaria', toContent: () => '!padaria', handler: handleBakeryCommand },
  {
    name: 'assar',
    description: 'Assar receita em 1+ fornos',
    build: [
      str('receita', 'ex: pao'),
      int('quantidade', 'quantos fornos (ou use tudo)'),
      (b) =>
        b.addBooleanOption((o) =>
          o.setName('tudo').setDescription('Encher todos os fornos livres').setRequired(false)
        )
    ],
    toContent: (i) => {
      const r = optStr(i, 'receita');
      const q = optInt(i, 'quantidade');
      const all = i.options.getBoolean('tudo');
      return `!assar ${[r, all ? 'tudo' : q].filter(Boolean).join(' ')}`.trim();
    },
    handler: handleBakeryCommand
  },
  {
    name: 'repetir',
    description: 'Repetir última receita (ou do histórico)',
    build: [
      str('receita', 'id, nome ou #1 do histórico'),
      int('quantidade', 'quantos fornos'),
      (b) =>
        b.addBooleanOption((o) =>
          o.setName('tudo').setDescription('Encher fornos livres').setRequired(false)
        )
    ],
    toContent: (i) => {
      const r = optStr(i, 'receita');
      const q = optInt(i, 'quantidade');
      const all = i.options.getBoolean('tudo');
      return `!repetir ${[r, all ? 'tudo' : q].filter(Boolean).join(' ')}`.trim();
    },
    handler: handleBakeryCommand
  },
  {
    name: 'historico',
    description: 'Últimas receitas que você assou',
    toContent: () => '!historico',
    handler: handleBakeryCommand
  },
  { name: 'servir', description: 'Servir o que está pronto', toContent: () => '!servir', handler: handleBakeryCommand },
  { name: 'receitas', description: 'Receitas desbloqueadas', toContent: () => '!receitas', handler: handleBakeryCommand },
  { name: 'forno', description: 'Comprar forno extra', toContent: () => '!forno', handler: handleBakeryCommand },
  {
    name: 'upgrade',
    description: 'Upgrades da padaria',
    build: [str('id', 'speed | profit | mastery | luck | charm')],
    toContent: (i) => `!upgrade ${optStr(i, 'id')}`.trim(),
    handler: handleBakeryCommand
  },
  {
    name: 'pedido',
    description: 'Pedidos de NPC',
    build: [str('acao', 'vazio ou novo')],
    toContent: (i) => `!pedido ${optStr(i, 'acao')}`.trim(),
    handler: handleBakeryCommand
  },
  { name: 'fornonotify', description: 'DM quando o forno fica pronto', toContent: () => '!fornonotify', handler: handleBakeryCommand },
  { name: 'rankpadaria', description: 'Ranking da padaria', toContent: () => '!rankpadaria', handler: handleBakeryCommand },

  // ── Eventos ──────────────────────────────────────────────
  {
    name: 'evento',
    description: 'Eventos do servidor',
    build: [str('texto', 'status | happyhour 60 | padaria | praid | boss | parar')],
    toContent: (i) => `!evento ${optStr(i, 'texto') || 'status'}`.trim(),
    handler: handleEventCommand
  },

  // ── Pokémon (principais; canal exclusivo) ────────────────
  { name: 'phelp', description: 'Ajuda Pokémon', toContent: () => '!phelp', handler: handlePokemonCommand },
  {
    name: 'pstart',
    description: 'Iniciar aventura Pokémon',
    build: [str('starter', 'id ou nome do starter')],
    toContent: (i) => `!pstart ${optStr(i, 'starter')}`.trim(),
    handler: handlePokemonCommand
  },
  { name: 'pwild', description: 'Encontro selvagem', toContent: () => '!pwild', handler: handlePokemonCommand },
  {
    name: 'pcatch',
    description: 'Capturar selvagem',
    build: [str('ball', 'pokeball etc')],
    toContent: (i) => `!pcatch ${optStr(i, 'ball')}`.trim(),
    handler: handlePokemonCommand
  },
  {
    name: 'pdex',
    description: 'Pokédex / info',
    build: [str('query', 'nome ou número')],
    toContent: (i) => `!pdex ${optStr(i, 'query')}`.trim(),
    handler: handlePokemonCommand
  },
  { name: 'pteam', description: 'Seu time', toContent: () => '!pteam', handler: handlePokemonCommand },
  {
    name: 'pbox',
    description: 'Caixa de Pokémon',
    build: [int('pagina', 'página')],
    toContent: (i) => `!pbox ${optInt(i, 'pagina')}`.trim(),
    handler: handlePokemonCommand
  },
  {
    name: 'pmain',
    description: 'Definir Pokémon principal',
    build: [str('slot', 'slot ou id')],
    toContent: (i) => `!pmain ${optStr(i, 'slot')}`.trim(),
    handler: handlePokemonCommand
  },
  { name: 'pmon', description: 'Ver Pokémon principal', toContent: () => '!pmon', handler: handlePokemonCommand },
  { name: 'pevolve', description: 'Evoluir principal', toContent: () => '!pevolve', handler: handlePokemonCommand },
  { name: 'ploja', description: 'Loja Pokémon', toContent: () => '!ploja', handler: handlePokemonCommand },
  {
    name: 'pbuy',
    description: 'Comprar na loja Pokémon',
    build: [str('item', 'id do item', true)],
    toContent: (i) => `!pbuy ${optStr(i, 'item')}`,
    handler: handlePokemonCommand
  },
  { name: 'pbag', description: 'Mochila Pokémon', toContent: () => '!pbag', handler: handlePokemonCommand },
  {
    name: 'puse',
    description: 'Usar item Pokémon',
    build: [str('item', 'id do item', true)],
    toContent: (i) => `!puse ${optStr(i, 'item')}`,
    handler: handlePokemonCommand
  },
  {
    name: 'pbattle',
    description: 'Desafiar PvP',
    build: [user('user', 'Oponente', true)],
    toContent: (i) => mentionContent('pbattle', i),
    handler: handlePokemonCommand
  },
  { name: 'paccept', description: 'Aceitar duelo', toContent: () => '!paccept', handler: handlePokemonCommand },
  { name: 'pdeny', description: 'Recusar duelo', toContent: () => '!pdeny', handler: handlePokemonCommand },
  {
    name: 'pmove',
    description: 'Usar golpe no PvP',
    build: [str('golpe', '1–4 ou nome', true)],
    toContent: (i) => `!pmove ${optStr(i, 'golpe')}`,
    handler: handlePokemonCommand
  },
  { name: 'pforfeit', description: 'Desistir do PvP', toContent: () => '!pforfeit', handler: handlePokemonCommand },
  { name: 'pstatus', description: 'Status Pokémon', toContent: () => '!pstatus', handler: handlePokemonCommand },
  { name: 'pdaily', description: 'Daily Pokémon', toContent: () => '!pdaily', handler: handlePokemonCommand },

  // ── Tickets / staff ──────────────────────────────────────
  {
    name: 'ticket',
    description: 'Abrir ticket de suporte',
    build: [str('motivo', 'motivo')],
    toContent: (i) => `!ticket ${optStr(i, 'motivo')}`.trim(),
    handler: handleTicketCommand
  },
  {
    name: 'fechar',
    description: 'Fechar ticket (no canal do ticket)',
    build: [str('motivo', 'motivo')],
    toContent: (i) => `!fechar ${optStr(i, 'motivo')}`.trim(),
    handler: handleTicketCommand
  },
  { name: 'tickets', description: 'Listar tickets abertos', toContent: () => '!tickets', handler: handleTicketCommand },
  {
    name: 'config',
    description: 'Painel de config (staff)',
    build: [str('texto', 'ex: welcome on')],
    toContent: (i) => `!config ${optStr(i, 'texto')}`.trim(),
    handler: handleConfigCommand,
    permission: PermissionFlagsBits.ManageGuild
  },
  {
    name: 'limpeza',
    description: 'Limpeza de canal / efeitos (staff)',
    build: [str('texto', 'ex: 20 | bot 50 | efeitos')],
    toContent: (i) => `!limpeza ${optStr(i, 'texto')}`.trim(),
    handler: handleCleanupCommand,
    permission: PermissionFlagsBits.ManageMessages
  },
  {
    name: 'starboard',
    description: 'Config starboard (staff)',
    build: [str('texto', 'ex: canal #x | min 3')],
    toContent: (i) => `!starboard ${optStr(i, 'texto')}`.trim(),
    handler: handleStarboardCommand,
    permission: PermissionFlagsBits.ManageGuild
  },
  {
    name: 'modlogs',
    description: 'Logs de moderação',
    build: [str('texto', 'args')],
    toContent: (i) => `!modlogs ${optStr(i, 'texto')}`.trim(),
    handler: handleModLogCommand,
    permission: PermissionFlagsBits.ModerateMembers
  },

  // ── Moderação ────────────────────────────────────────────
  ...modEntry('ban', 'Banir membro', true),
  ...modEntry('unban', 'Desbanir (id)', false, true),
  ...modEntry('kick', 'Expulsar membro', true),
  ...modEntry('timeout', 'Timeout em membro', true),
  ...modEntry('untimeout', 'Remover timeout', true),
  ...modEntry('warn', 'Advertir membro', true),
  {
    name: 'warnings',
    description: 'Ver advertências',
    build: [user('user', 'Membro')],
    toContent: (i) => mentionContent('warnings', i),
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ModerateMembers
  },
  {
    name: 'clearwarns',
    description: 'Limpar advertências',
    build: [user('user', 'Membro', true)],
    toContent: (i) => mentionContent('clearwarns', i),
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ModerateMembers
  },
  {
    name: 'clear',
    description: 'Apagar mensagens do canal',
    build: [int('quantidade', '1–100', true)],
    toContent: (i) => `!clear ${optInt(i, 'quantidade')}`,
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ManageMessages
  },
  {
    name: 'slowmode',
    description: 'Slowmode do canal (segundos)',
    build: [int('segundos', '0–21600', true)],
    toContent: (i) => `!slowmode ${optInt(i, 'segundos')}`,
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ManageChannels
  },
  {
    name: 'lock',
    description: 'Trancar canal',
    toContent: () => '!lock',
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ManageChannels
  },
  {
    name: 'unlock',
    description: 'Destrancar canal',
    toContent: () => '!unlock',
    handler: handleModerationCommand,
    permission: PermissionFlagsBits.ManageChannels
  }
];

function modEntry(name, description, needsUser, idAsText = false) {
  const build = [];
  if (needsUser) build.push(user('user', 'Membro', true));
  if (idAsText) build.push(str('id', 'ID do usuário', true));
  build.push(str('motivo', 'Motivo / args extras'));
  return [
    {
      name,
      description,
      build,
      toContent: (i) => {
        const parts = [`!${name}`];
        if (idAsText) parts.push(optStr(i, 'id'));
        else {
          const u = i.options.getUser('user');
          if (u) parts.push(`<@${u.id}>`);
        }
        const m = optStr(i, 'motivo');
        if (m) parts.push(m);
        return parts.join(' ');
      },
      handler: handleModerationCommand,
      permission: PermissionFlagsBits.ModerateMembers
    }
  ];
}

function buildCatalogJSON() {
  const out = [];
  const names = new Set();
  for (const e of ENTRIES) {
    if (names.has(e.name)) {
      console.warn(`[slash-catalog] duplicado ignorado: ${e.name}`);
      continue;
    }
    names.add(e.name);
    let b = new SlashCommandBuilder()
      .setName(e.name)
      .setDescription((e.description || e.name).slice(0, 100));
    if (e.permission) {
      b = b.setDefaultMemberPermissions(e.permission);
    }
    if (Array.isArray(e.build)) {
      for (const fn of e.build) fn(b);
    }
    out.push(b.toJSON());
  }
  return out;
}

const byName = new Map(ENTRIES.map((e) => [e.name, e]));

/**
 * @returns {Promise<boolean>}
 */
async function handleCatalogSlash(interaction, data) {
  if (!interaction.isChatInputCommand()) return false;
  const entry = byName.get(interaction.commandName);
  if (!entry) return false;

  const t0 = Date.now();
  const label = `/${entry.name}`;
  try {
    // evita "aplicativo não respondeu" em handlers lentos (música, padaria png…)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const content = entry.toContent(interaction);
    const msg = messageFromInteraction(interaction, content);
    const result = await entry.handler(msg, data);

    if (result === false) {
      await interaction.editReply({
        content: `Não consegui executar \`/${entry.name}\`. Tente: \`${content}\``
      }).catch(() => {});
      trackCommand(label, {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        ok: false,
        ms: Date.now() - t0
      });
      return true;
    }

    // handler async que ainda não respondeu
    if (interaction.deferred && !interaction.replied) {
      // editReply ainda não foi chamado (bridge marca replied só no reply da API;
      // deferred+editReply seta replied). Se ficou só deferred, manda ok genérico.
      try {
        const fetched = await interaction.fetchReply().catch(() => null);
        if (!fetched || (fetched.content === '' && !fetched.embeds?.length && !fetched.attachments?.size)) {
          await interaction.editReply({ content: '✅ Pronto.' }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }

    trackCommand(label, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      ok: true,
      ms: Date.now() - t0
    });
    return true;
  } catch (err) {
    console.error(`[slash-catalog] ${label}:`, err);
    trackError(label, err, {
      guildId: interaction.guildId,
      userId: interaction.user.id
    });
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '⚠️ Erro ao executar o comando.' }).catch(() =>
          interaction.followUp({ content: '⚠️ Erro ao executar o comando.', ephemeral: true })
        );
      } else {
        await interaction.reply({ content: '⚠️ Erro ao executar o comando.', ephemeral: true });
      }
    } catch {
      /* ignore */
    }
    return true;
  }
}

module.exports = {
  buildCatalogJSON,
  handleCatalogSlash,
  ENTRIES
};
