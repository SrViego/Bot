/**
 * Registra handlers legados no registry (aliases + métricas unificadas).
 * Bakery fica fora (precisa capturar `!ajuda padaria` antes do registry).
 */

const { PermissionFlagsBits } = require('discord.js');
const { register } = require('./registry');

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

/** @param {{ name: string, aliases?: string[], description: string, category?: string, permission?: bigint, handler: Function, data?: boolean }} opts */
function legacy(opts) {
  const aliases = (opts.aliases || []).filter((a) => a !== opts.name);
  register({
    name: opts.name,
    aliases,
    description: opts.description,
    category: opts.category || 'misc',
    slash: false,
    prefixOnly: true,
    permission: opts.permission,
    // handlers sem `data` (utility/metrics) ignoram o 2º arg
    legacyMessageHandler: (message, data) => opts.handler(message, data)
  });
}

// ── Economia / perfil ──────────────────────────────────────────
legacy({
  name: 'pontos',
  aliases: ['daily', 'rankpontos'],
  description: 'Pontos, daily e ranking',
  category: 'economy',
  handler: handlePointsCommand
});

legacy({
  name: 'xp',
  aliases: ['level', 'rankxp'],
  description: 'XP e ranking de nível',
  category: 'economy',
  handler: handleXpCommand
});

legacy({
  name: 'perfil',
  aliases: ['profile'],
  description: 'Perfil do usuário',
  category: 'social',
  handler: handleProfileCommand
});

legacy({
  name: 'rep',
  aliases: ['reps', 'rankrep'],
  description: 'Reputação',
  category: 'social',
  handler: handleReputationCommand
});

legacy({
  name: 'quest',
  aliases: ['quests', 'missao', 'missão', 'missoes', 'missões'],
  description: 'Missões diárias/semanais',
  category: 'economy',
  handler: handleQuestCommand
});

legacy({
  name: 'cosmetico',
  aliases: ['cosmético', 'cosmetics', 'skin', 'skins', 'titulo', 'título'],
  description: 'Cosméticos de perfil',
  category: 'economy',
  handler: handleCosmeticsCommand
});

legacy({
  name: 'loja',
  aliases: [
    'shop',
    'item',
    'comprar',
    'buy',
    'vender',
    'sell',
    'presentear',
    'gift',
    'inventario',
    'inv',
    'usar',
    'efeitos',
    'buffs'
  ],
  description: 'Loja de itens e inventário',
  category: 'economy',
  handler: handleShopCommand
});

legacy({
  name: 'cambio',
  aliases: ['câmbio', 'exchange', 'trocar', 'converter'],
  description: 'Câmbio entre moedas',
  category: 'economy',
  handler: handleExchangeCommand
});

legacy({
  name: 'apostar',
  aliases: ['bet', 'aposta'],
  description: 'Apostas',
  category: 'fun',
  handler: handleBetCommand
});

legacy({
  name: 'conquistas',
  aliases: ['achievements'],
  description: 'Conquistas',
  category: 'social',
  handler: handleAchievementsCommand
});

// ── Util ───────────────────────────────────────────────────────
legacy({
  name: 'avatar',
  aliases: ['userinfo', 'serverinfo', 'say'],
  description: 'Utilidades (avatar, userinfo, serverinfo, say)',
  category: 'util',
  handler: handleUtilityCommand
});

legacy({
  name: 'metrics',
  aliases: ['metricas'],
  description: 'Métricas do bot (staff)',
  category: 'admin',
  permission: PermissionFlagsBits.ManageGuild,
  handler: handleMetricsCommand
});

legacy({
  name: 'serverstats',
  aliases: ['stats', 'servidor', 'dashboard'],
  description: 'Estatísticas do servidor',
  category: 'util',
  handler: handleServerStatsCommand
});

// ── Minigames ──────────────────────────────────────────────────
legacy({
  name: 'coinflip',
  aliases: ['moeda', 'guess', 'adivinhar', 'minigames'],
  description: 'Minigames',
  category: 'fun',
  handler: handleMinigameCommand
});

// ── Pokémon (canal exclusivo — handler valida POKEMON_CHANNEL_ID) ──
const POKEMON_ALIASES = [
  'phelp',
  'pokedex',
  'pajuda',
  'pstart',
  'piniciar',
  'pwild',
  'pselvagem',
  'pcatch',
  'plutar',
  'pcapturar',
  'pdex',
  'pinfo',
  'pteam',
  'ptime',
  'pbox',
  'pcaixa',
  'padd',
  'premove',
  'pswap',
  'pmain',
  'plider',
  'pprincipal',
  'plead',
  'pmon',
  'ppoke',
  'pevolve',
  'pevoluir',
  'pxp',
  'ploja',
  'pshop',
  'pbuy',
  'pcomprar',
  'pbag',
  'pmochila',
  'puse',
  'pusar',
  'pbattle',
  'pduelo',
  'paccept',
  'paceitar',
  'pdeny',
  'precusar',
  'pmove',
  'pataque',
  'pforfeit',
  'pdesistir',
  'pstatus',
  'pdaily'
];

legacy({
  name: 'phelp',
  aliases: POKEMON_ALIASES.filter((n) => n !== 'phelp'),
  description: 'Pokémon (canal exclusivo)',
  category: 'pokemon',
  handler: handlePokemonCommand
});
