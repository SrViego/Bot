/**
 * Catálogo slash reorganizado (Sprint 3).
 * Poucos comandos raiz + subcomandos — limite Discord 100, ~25 subcmds cada.
 * Cada uso monta `!cmd …` e reutiliza o handler de prefixo.
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
const { handleOnboardingCommand } = require('../systems/onboarding');
const { handleRankingCommand } = require('../systems/weekly-rank');

function optStr(i, ...names) {
  for (const n of names) {
    const v = i.options.getString(n);
    if (v != null && v !== '') return v;
  }
  return '';
}
function optInt(i, ...names) {
  for (const n of names) {
    const v = i.options.getInteger(n);
    if (v != null) return String(v);
  }
  return '';
}
function optUser(i, ...names) {
  for (const n of names) {
    const v = i.options.getUser(n);
    if (v) return v;
  }
  return null;
}
function mention(cmd, i, extra = '') {
  const u = optUser(i, 'user', 'alvo', 'membro');
  const rest = [u ? `<@${u.id}>` : null, extra].filter(Boolean).join(' ');
  return rest ? `!${cmd} ${rest}` : `!${cmd}`;
}
function join(...parts) {
  return parts.filter((p) => p != null && String(p).trim() !== '').join(' ').trim();
}

/**
 * Entry: { name, description, permission?, subcommands?: [...], options?: fn, toContent, handler }
 * subcommand: { name, description, options?: (sc) => void, toContent: (i) => string }
 */
function buildOne(entry) {
  let b = new SlashCommandBuilder()
    .setName(entry.name)
    .setDescription((entry.description || entry.name).slice(0, 100));
  if (entry.permission) b = b.setDefaultMemberPermissions(entry.permission);

  if (entry.subcommands?.length) {
    for (const sub of entry.subcommands) {
      b.addSubcommand((sc) => {
        sc.setName(sub.name).setDescription((sub.description || sub.name).slice(0, 100));
        if (typeof sub.options === 'function') sub.options(sc);
        return sc;
      });
    }
  } else if (typeof entry.options === 'function') {
    entry.options(b);
  }
  return b.toJSON();
}

/** @type {Array<object>} */
const ENTRIES = [
  // ── Standalone ───────────────────────────────────────────
  {
    name: 'inicio',
    description: 'Trilho da 1ª semana',
    toContent: () => '!inicio',
    handler: handleOnboardingCommand
  },
  {
    name: 'perfil',
    description: 'Perfil completo',
    options: (b) => b.addUserOption((o) => o.setName('user').setDescription('Membro')),
    toContent: (i) => mention('perfil', i),
    handler: handleProfileCommand
  },
  {
    name: 'daily',
    description: 'Resgatar daily de pontos',
    toContent: () => '!daily',
    handler: handlePointsCommand
  },
  {
    name: 'quest',
    description: 'Quests diárias/semanais',
    options: (b) =>
      b.addStringOption((o) =>
        o
          .setName('acao')
          .setDescription('Listar ou resgatar')
          .addChoices(
            { name: 'Listar', value: 'lista' },
            { name: 'Resgatar', value: 'pegar' }
          )
      ),
    toContent: (i) => (optStr(i, 'acao') === 'pegar' ? '!quest pegar' : '!quest'),
    handler: handleQuestCommand
  },
  {
    name: 'ranking',
    description: 'Tops do servidor',
    toContent: () => '!ranking',
    handler: handleRankingCommand
  },
  {
    name: 'serverstats',
    description: 'Dashboard do servidor',
    toContent: () => '!serverstats',
    handler: handleServerStatsCommand
  },
  {
    name: 'evento',
    description: 'Eventos do servidor',
    options: (b) =>
      b.addStringOption((o) =>
        o.setName('texto').setDescription('status | happyhour 60 | padaria | parar')
      ),
    toContent: (i) => `!evento ${optStr(i, 'texto') || 'status'}`.trim(),
    handler: handleEventCommand
  },
  {
    name: 'conquistas',
    description: 'Conquistas',
    options: (b) => b.addUserOption((o) => o.setName('user').setDescription('Membro')),
    toContent: (i) => mention('conquistas', i),
    handler: handleAchievementsCommand
  },
  {
    name: 'apostar',
    description: 'Apostar no próximo coinflip',
    options: (b) =>
      b.addStringOption((o) =>
        o.setName('texto').setDescription('ex: cara 50').setRequired(true)
      ),
    toContent: (i) => `!apostar ${optStr(i, 'texto')}`,
    handler: handleBetCommand
  },

  // ── /pontos ──────────────────────────────────────────────
  {
    name: 'pontos',
    description: 'Pontos e ranking',
    subcommands: [
      {
        name: 'ver',
        description: 'Ver pontos',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('pontos', i)
      },
      { name: 'rank', description: 'Ranking de pontos', toContent: () => '!rankpontos' }
    ],
    handler: handlePointsCommand
  },

  // ── /xp ──────────────────────────────────────────────────
  {
    name: 'xp',
    description: 'XP e ranking de nível',
    subcommands: [
      {
        name: 'ver',
        description: 'Ver XP',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('xp', i)
      },
      { name: 'rank', description: 'Ranking de XP', toContent: () => '!rankxp' }
    ],
    handler: handleXpCommand
  },

  // ── /rep ─────────────────────────────────────────────────
  {
    name: 'rep',
    description: 'Reputação',
    subcommands: [
      {
        name: 'dar',
        description: 'Dar +1 rep',
        options: (sc) =>
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true)),
        toContent: (i) => mention('rep', i)
      },
      { name: 'rank', description: 'Ranking de rep', toContent: () => '!rankrep' }
    ],
    handler: handleReputationCommand
  },

  // ── /economia ────────────────────────────────────────────
  {
    name: 'economia',
    description: 'Câmbio, guia e oferenda',
    subcommands: [
      { name: 'guia', description: 'Como funciona a economia', toContent: () => '!economia' },
      {
        name: 'cambio',
        description: 'Converter moedas (taxa 45%)',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('texto').setDescription('ex: pontos padaria 100').setRequired(true)
          ),
        toContent: (i) => `!cambio ${optStr(i, 'texto')}`
      },
      {
        name: 'ofrenda',
        description: 'Doar pontos ao hall (sink)',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('quantidade').setDescription('ex: 50 ou tudo').setRequired(true)
          ),
        toContent: (i) => `!ofrenda ${optStr(i, 'quantidade')}`
      }
    ],
    handler: handleExchangeCommand
  },

  // ── /loja ────────────────────────────────────────────────
  {
    name: 'loja',
    description: 'Loja, inventário e itens',
    subcommands: [
      { name: 'ver', description: 'Abrir a loja', toContent: () => '!loja' },
      {
        name: 'item',
        description: 'Detalhe de um item',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('id').setDescription('id do item').setRequired(true)),
        toContent: (i) => `!item ${optStr(i, 'id')}`
      },
      {
        name: 'comprar',
        description: 'Comprar item',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('id').setDescription('id do item').setRequired(true)),
        toContent: (i) => `!comprar ${optStr(i, 'id')}`
      },
      {
        name: 'vender',
        description: 'Vender item',
        options: (sc) => {
          sc.addStringOption((o) => o.setName('id').setDescription('id').setRequired(true));
          sc.addIntegerOption((o) => o.setName('quantidade').setDescription('qtd'));
          return sc;
        },
        toContent: (i) => join('!vender', optStr(i, 'id'), optInt(i, 'quantidade'))
      },
      {
        name: 'presentear',
        description: 'Presentear alguém',
        options: (sc) => {
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true));
          sc.addStringOption((o) => o.setName('id').setDescription('id do item').setRequired(true));
          return sc;
        },
        toContent: (i) => mention('presentear', i, optStr(i, 'id'))
      },
      { name: 'inventario', description: 'Seu inventário', toContent: () => '!inventario' },
      {
        name: 'usar',
        description: 'Usar item',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('id').setDescription('id').setRequired(true)),
        toContent: (i) => `!usar ${optStr(i, 'id')}`
      },
      { name: 'efeitos', description: 'Buffs ativos', toContent: () => '!efeitos' }
    ],
    handler: handleShopCommand
  },

  // ── /cosmetico ───────────────────────────────────────────
  {
    name: 'cosmetico',
    description: 'Cosméticos de perfil',
    options: (b) => {
      b.addStringOption((o) =>
        o.setName('acao').setDescription('loja | comprar | equipar | perfil')
      );
      b.addStringOption((o) => o.setName('id').setDescription('id do cosmético'));
      return b;
    },
    toContent: (i) =>
      join('!cosmetico', optStr(i, 'acao') || 'loja', optStr(i, 'id')),
    handler: handleCosmeticsCommand
  },

  // ── /padaria ─────────────────────────────────────────────
  {
    name: 'padaria',
    description: 'Padaria idle (canal exclusivo)',
    subcommands: [
      { name: 'status', description: 'Status da padaria', toContent: () => '!padaria' },
      {
        name: 'assar',
        description: 'Assar em 1+ fornos',
        options: (sc) => {
          sc.addStringOption((o) => o.setName('receita').setDescription('ex: pao'));
          sc.addIntegerOption((o) => o.setName('quantidade').setDescription('fornos'));
          sc.addStringOption((o) =>
            o
              .setName('tudo')
              .setDescription('Encher fornos livres?')
              .addChoices({ name: 'Sim', value: 'sim' }, { name: 'Não', value: 'nao' })
          );
          return sc;
        },
        toContent: (i) => {
          const all = ['sim', 's', 'yes'].includes((optStr(i, 'tudo') || '').toLowerCase());
          return join('!assar', optStr(i, 'receita'), all ? 'tudo' : optInt(i, 'quantidade'));
        }
      },
      {
        name: 'repetir',
        description: 'Repetir última / histórico',
        options: (sc) => {
          sc.addStringOption((o) => o.setName('receita').setDescription('id ou #1'));
          sc.addIntegerOption((o) => o.setName('quantidade').setDescription('fornos'));
          sc.addStringOption((o) =>
            o
              .setName('tudo')
              .setDescription('Encher fornos livres?')
              .addChoices({ name: 'Sim', value: 'sim' }, { name: 'Não', value: 'nao' })
          );
          return sc;
        },
        toContent: (i) => {
          const all = ['sim', 's', 'yes'].includes((optStr(i, 'tudo') || '').toLowerCase());
          return join('!repetir', optStr(i, 'receita'), all ? 'tudo' : optInt(i, 'quantidade'));
        }
      },
      { name: 'historico', description: 'Receitas recentes', toContent: () => '!historico' },
      { name: 'servir', description: 'Servir o pronto', toContent: () => '!servir' },
      { name: 'receitas', description: 'Lista de receitas', toContent: () => '!receitas' },
      { name: 'forno', description: 'Comprar forno', toContent: () => '!forno' },
      {
        name: 'upgrade',
        description: 'Upgrades',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('id').setDescription('speed | profit | …')),
        toContent: (i) => join('!upgrade', optStr(i, 'id'))
      },
      {
        name: 'pedido',
        description: 'Pedidos NPC',
        options: (sc) => sc.addStringOption((o) => o.setName('acao').setDescription('novo')),
        toContent: (i) => join('!pedido', optStr(i, 'acao'))
      },
      { name: 'notify', description: 'DM quando o forno fica pronto', toContent: () => '!fornonotify' },
      { name: 'rank', description: 'Ranking da padaria', toContent: () => '!rankpadaria' }
    ],
    handler: handleBakeryCommand
  },

  // ── /poke ────────────────────────────────────────────────
  {
    name: 'poke',
    description: 'Pokémon (canal exclusivo)',
    subcommands: [
      { name: 'ajuda', description: 'Ajuda Pokémon', toContent: () => '!phelp' },
      {
        name: 'start',
        description: 'Escolher inicial',
        options: (sc) => sc.addStringOption((o) => o.setName('starter').setDescription('id')),
        toContent: (i) => join('!pstart', optStr(i, 'starter'))
      },
      { name: 'wild', description: 'Encontro selvagem', toContent: () => '!pwild' },
      {
        name: 'catch',
        description: 'Capturar',
        options: (sc) => sc.addStringOption((o) => o.setName('ball').setDescription('pokeball…')),
        toContent: (i) => join('!pcatch', optStr(i, 'ball'))
      },
      {
        name: 'dex',
        description: 'Pokédex',
        options: (sc) => sc.addStringOption((o) => o.setName('query').setDescription('nome/nº')),
        toContent: (i) => join('!pdex', optStr(i, 'query'))
      },
      { name: 'team', description: 'Time', toContent: () => '!pteam' },
      {
        name: 'box',
        description: 'Caixa',
        options: (sc) => sc.addIntegerOption((o) => o.setName('pagina').setDescription('página')),
        toContent: (i) => join('!pbox', optInt(i, 'pagina'))
      },
      {
        name: 'main',
        description: 'Definir principal',
        options: (sc) => sc.addStringOption((o) => o.setName('slot').setDescription('slot')),
        toContent: (i) => join('!pmain', optStr(i, 'slot'))
      },
      { name: 'mon', description: 'Ver principal', toContent: () => '!pmon' },
      { name: 'evolve', description: 'Evoluir principal', toContent: () => '!pevolve' },
      { name: 'shop', description: 'Loja Pokémon', toContent: () => '!ploja' },
      {
        name: 'buy',
        description: 'Comprar item',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('item').setDescription('id').setRequired(true)),
        toContent: (i) => `!pbuy ${optStr(i, 'item')}`
      },
      { name: 'bag', description: 'Mochila', toContent: () => '!pbag' },
      {
        name: 'use',
        description: 'Usar item',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('item').setDescription('id').setRequired(true)),
        toContent: (i) => `!puse ${optStr(i, 'item')}`
      },
      {
        name: 'battle',
        description: 'Desafiar PvP',
        options: (sc) =>
          sc.addUserOption((o) => o.setName('user').setDescription('Oponente').setRequired(true)),
        toContent: (i) => mention('pbattle', i)
      },
      { name: 'accept', description: 'Aceitar duelo', toContent: () => '!paccept' },
      { name: 'deny', description: 'Recusar duelo', toContent: () => '!pdeny' },
      {
        name: 'move',
        description: 'Golpe no PvP',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('golpe').setDescription('1–4').setRequired(true)
          ),
        toContent: (i) => `!pmove ${optStr(i, 'golpe')}`
      },
      { name: 'forfeit', description: 'Desistir PvP', toContent: () => '!pforfeit' },
      { name: 'status', description: 'Status', toContent: () => '!pstatus' },
      { name: 'daily', description: 'Daily Pokémon', toContent: () => '!pdaily' }
    ],
    handler: handlePokemonCommand
  },

  // ── /musica ──────────────────────────────────────────────
  {
    name: 'musica',
    description: 'Música (Lavalink)',
    subcommands: [
      {
        name: 'play',
        description: 'Tocar',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('query').setDescription('Nome ou URL').setRequired(true)
          ),
        toContent: (i) => `!play ${optStr(i, 'query')}`
      },
      { name: 'skip', description: 'Pular', toContent: () => '!skip' },
      { name: 'stop', description: 'Parar', toContent: () => '!stop' },
      { name: 'queue', description: 'Fila', toContent: () => '!queue' },
      { name: 'pause', description: 'Pausar', toContent: () => '!pause' },
      { name: 'resume', description: 'Continuar', toContent: () => '!resume' },
      { name: 'np', description: 'Tocando agora', toContent: () => '!np' },
      {
        name: 'volume',
        description: 'Volume 0–100',
        options: (sc) =>
          sc.addIntegerOption((o) =>
            o.setName('nivel').setDescription('0–100').setRequired(true)
          ),
        toContent: (i) => `!volume ${optInt(i, 'nivel')}`
      }
    ],
    handler: handleMusicCommand
  },

  // ── /util ────────────────────────────────────────────────
  {
    name: 'util',
    description: 'Utilidades',
    subcommands: [
      {
        name: 'avatar',
        description: 'Avatar',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('avatar', i)
      },
      {
        name: 'userinfo',
        description: 'Info do membro',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('userinfo', i)
      },
      { name: 'serverinfo', description: 'Info do servidor', toContent: () => '!serverinfo' },
      {
        name: 'say',
        description: 'Fazer o bot falar',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('texto').setDescription('Mensagem').setRequired(true)
          ),
        toContent: (i) => `!say ${optStr(i, 'texto')}`
      }
    ],
    handler: handleUtilityCommand
  },

  // ── /minigame ────────────────────────────────────────────
  {
    name: 'minigame',
    description: 'Minigames',
    subcommands: [
      {
        name: 'coinflip',
        description: 'Cara ou coroa',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('texto').setDescription('ex: cara 50').setRequired(true)
          ),
        toContent: (i) => `!coinflip ${optStr(i, 'texto')}`
      },
      {
        name: 'guess',
        description: 'Adivinhar número',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('texto').setDescription('ex: 3 50').setRequired(true)
          ),
        toContent: (i) => `!guess ${optStr(i, 'texto')}`
      },
      { name: 'lista', description: 'Lista de minigames', toContent: () => '!minigames' }
    ],
    handler: handleMinigameCommand
  },

  // ── /casamento ───────────────────────────────────────────
  {
    name: 'casamento',
    description: 'Casamento',
    subcommands: [
      {
        name: 'pedir',
        description: 'Pedir em casamento',
        options: (sc) =>
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true)),
        toContent: (i) => mention('casar', i)
      },
      { name: 'aceitar', description: 'Aceitar pedido', toContent: () => '!aceitarcasamento' },
      { name: 'recusar', description: 'Recusar pedido', toContent: () => '!recusarcasamento' },
      { name: 'divorciar', description: 'Divórcio', toContent: () => '!divorciar' },
      {
        name: 'ver',
        description: 'Ver casamento',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('casamento', i)
      }
    ],
    handler: handleMarriageCommand
  },

  // ── /ticket ──────────────────────────────────────────────
  {
    name: 'ticket',
    description: 'Tickets de suporte',
    subcommands: [
      {
        name: 'abrir',
        description: 'Abrir ticket',
        options: (sc) => sc.addStringOption((o) => o.setName('motivo').setDescription('motivo')),
        toContent: (i) => join('!ticket', optStr(i, 'motivo'))
      },
      {
        name: 'fechar',
        description: 'Fechar (no canal do ticket)',
        options: (sc) => sc.addStringOption((o) => o.setName('motivo').setDescription('motivo')),
        toContent: (i) => join('!fechar', optStr(i, 'motivo'))
      },
      { name: 'lista', description: 'Listar abertos', toContent: () => '!tickets' }
    ],
    handler: handleTicketCommand
  },

  // ── /mod ─────────────────────────────────────────────────
  {
    name: 'mod',
    description: 'Moderação',
    permission: PermissionFlagsBits.ModerateMembers,
    subcommands: [
      {
        name: 'ban',
        description: 'Banir',
        options: (sc) => {
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true));
          sc.addStringOption((o) => o.setName('motivo').setDescription('Motivo'));
          return sc;
        },
        toContent: (i) => join(mention('ban', i), optStr(i, 'motivo'))
      },
      {
        name: 'unban',
        description: 'Desbanir por ID',
        options: (sc) => {
          sc.addStringOption((o) => o.setName('id').setDescription('ID').setRequired(true));
          sc.addStringOption((o) => o.setName('motivo').setDescription('Motivo'));
          return sc;
        },
        toContent: (i) => join('!unban', optStr(i, 'id'), optStr(i, 'motivo'))
      },
      {
        name: 'kick',
        description: 'Expulsar',
        options: (sc) => {
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true));
          sc.addStringOption((o) => o.setName('motivo').setDescription('Motivo'));
          return sc;
        },
        toContent: (i) => join(mention('kick', i), optStr(i, 'motivo'))
      },
      {
        name: 'timeout',
        description: 'Timeout',
        options: (sc) => {
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true));
          sc.addStringOption((o) => o.setName('motivo').setDescription('duração/motivo'));
          return sc;
        },
        toContent: (i) => join(mention('timeout', i), optStr(i, 'motivo'))
      },
      {
        name: 'untimeout',
        description: 'Remover timeout',
        options: (sc) =>
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true)),
        toContent: (i) => mention('untimeout', i)
      },
      {
        name: 'warn',
        description: 'Advertir',
        options: (sc) => {
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true));
          sc.addStringOption((o) => o.setName('motivo').setDescription('Motivo'));
          return sc;
        },
        toContent: (i) => join(mention('warn', i), optStr(i, 'motivo'))
      },
      {
        name: 'warnings',
        description: 'Ver warns',
        options: (sc) => sc.addUserOption((o) => o.setName('user').setDescription('Membro')),
        toContent: (i) => mention('warnings', i)
      },
      {
        name: 'clearwarns',
        description: 'Limpar warns',
        options: (sc) =>
          sc.addUserOption((o) => o.setName('user').setDescription('Membro').setRequired(true)),
        toContent: (i) => mention('clearwarns', i)
      },
      {
        name: 'clear',
        description: 'Apagar mensagens',
        options: (sc) =>
          sc.addIntegerOption((o) =>
            o.setName('quantidade').setDescription('1–100').setRequired(true)
          ),
        toContent: (i) => `!clear ${optInt(i, 'quantidade')}`
      },
      {
        name: 'slowmode',
        description: 'Slowmode (seg)',
        options: (sc) =>
          sc.addIntegerOption((o) =>
            o.setName('segundos').setDescription('0–21600').setRequired(true)
          ),
        toContent: (i) => `!slowmode ${optInt(i, 'segundos')}`
      },
      { name: 'lock', description: 'Trancar canal', toContent: () => '!lock' },
      { name: 'unlock', description: 'Destrancar canal', toContent: () => '!unlock' }
    ],
    handler: handleModerationCommand
  },

  // ── /staff ───────────────────────────────────────────────
  {
    name: 'staff',
    description: 'Ferramentas de staff',
    permission: PermissionFlagsBits.ManageGuild,
    subcommands: [
      {
        name: 'config',
        description: 'Config do servidor',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('texto').setDescription('ex: ranking #canal')),
        toContent: (i) => join('!config', optStr(i, 'texto'))
      },
      {
        name: 'limpeza',
        description: 'Limpeza de canal/efeitos',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('texto').setDescription('20 | bot 50 | efeitos')),
        toContent: (i) => join('!limpeza', optStr(i, 'texto'))
      },
      {
        name: 'starboard',
        description: 'Config starboard',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('texto').setDescription('canal | min 3')),
        toContent: (i) => join('!starboard', optStr(i, 'texto'))
      },
      {
        name: 'modlogs',
        description: 'Logs de moderação',
        options: (sc) => sc.addStringOption((o) => o.setName('texto').setDescription('args')),
        toContent: (i) => join('!modlogs', optStr(i, 'texto'))
      },
      {
        name: 'metrics',
        description: 'Métricas do bot',
        options: (sc) =>
          sc.addStringOption((o) => o.setName('acao').setDescription('vazio ou errors')),
        toContent: (i) => join('!metrics', optStr(i, 'acao'))
      },
      {
        name: 'alerta',
        description: 'Canal de alerta bot/Lavalink',
        options: (sc) =>
          sc.addStringOption((o) =>
            o.setName('texto').setDescription('#canal | off').setRequired(true)
          ),
        toContent: (i) => `!config alerta ${optStr(i, 'texto')}`
      }
    ],
    // metrics has ManageGuild in handler; config routes through config for alerta
    handler: async (msg, data) => {
      const cmd = msg.content.trim().split(/\s+/)[0].toLowerCase();
      if (cmd === '!metrics') return handleMetricsCommand(msg, data);
      if (cmd === '!limpeza' || cmd === '!cleanup' || cmd === '!clean') {
        return handleCleanupCommand(msg, data);
      }
      if (cmd === '!starboard' || cmd === '!estrelas') return handleStarboardCommand(msg, data);
      if (cmd === '!modlogs') return handleModLogCommand(msg, data);
      return handleConfigCommand(msg, data);
    }
  }
];

function buildCatalogJSON() {
  const out = [];
  const names = new Set();
  for (const e of ENTRIES) {
    if (names.has(e.name)) {
      console.warn(`[slash-catalog] duplicado: ${e.name}`);
      continue;
    }
    names.add(e.name);
    out.push(buildOne(e));
  }
  return out;
}

const byName = new Map(ENTRIES.map((e) => [e.name, e]));

function resolveToContent(entry, interaction) {
  if (entry.subcommands?.length) {
    const subName = interaction.options.getSubcommand(false);
    const sub = entry.subcommands.find((s) => s.name === subName);
    if (!sub) return `!${entry.name}`;
    return sub.toContent(interaction);
  }
  return entry.toContent(interaction);
}

async function handleCatalogSlash(interaction, data) {
  if (!interaction.isChatInputCommand()) return false;
  const entry = byName.get(interaction.commandName);
  if (!entry) return false;

  const t0 = Date.now();
  const sub = interaction.options.getSubcommand(false);
  const label = sub ? `/${entry.name} ${sub}` : `/${entry.name}`;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const content = resolveToContent(entry, interaction);
    const msg = messageFromInteraction(interaction, content);
    const result = await entry.handler(msg, data);

    if (result === false) {
      await interaction
        .editReply({
          content: `Não consegui executar \`${label}\`. Tente: \`${content}\``
        })
        .catch(() => {});
      trackCommand(label, {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        ok: false,
        ms: Date.now() - t0
      });
      return true;
    }

    if (interaction.deferred && !interaction.replied) {
      try {
        const fetched = await interaction.fetchReply().catch(() => null);
        if (
          !fetched ||
          (fetched.content === '' && !fetched.embeds?.length && !fetched.attachments?.size)
        ) {
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
        await interaction
          .editReply({ content: '⚠️ Erro ao executar o comando.' })
          .catch(() =>
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
