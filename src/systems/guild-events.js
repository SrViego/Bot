/**
 * Eventos de servidor (staff): Happy Hour, bônus padaria, raid Pokémon.
 * Estado em guildConfigs[guildId].events
 */

const { getGuildData, saveData } = require('./database');
const { theme } = require('./theme');

function ensureEvents(guildConfig) {
  if (!guildConfig.events || typeof guildConfig.events !== 'object') {
    guildConfig.events = {
      happyHourUntil: 0,
      happyHourXpMult: 2,
      happyHourPointsMult: 2,
      bakeryBonusUntil: 0,
      bakeryCoinMult: 1.5,
      pokeRaidUntil: 0,
      pokeCatchBonus: 1.35,
      bakeryBoss: null // { goal, progress, rewardPoints, rewardBakery, startedBy, startedAt }
    };
  }
  const e = guildConfig.events;
  if (!Number.isFinite(e.happyHourUntil)) e.happyHourUntil = 0;
  if (!Number.isFinite(e.bakeryBonusUntil)) e.bakeryBonusUntil = 0;
  if (!Number.isFinite(e.pokeRaidUntil)) e.pokeRaidUntil = 0;
  if (!Number.isFinite(e.bakeryCoinMult) || e.bakeryCoinMult < 1) e.bakeryCoinMult = 1.5;
  if (!Number.isFinite(e.pokeCatchBonus) || e.pokeCatchBonus < 1) e.pokeCatchBonus = 1.35;
  if (e.bakeryBoss !== null && typeof e.bakeryBoss !== 'object') e.bakeryBoss = null;
  return e;
}

function isActive(until) {
  return typeof until === 'number' && until > Date.now();
}

function getXpMultiplier(data, guildId) {
  const cfg = getGuildData(data, guildId).config;
  const e = ensureEvents(cfg);
  return isActive(e.happyHourUntil) ? e.happyHourXpMult || 2 : 1;
}

function getPointsMultiplier(data, guildId) {
  const cfg = getGuildData(data, guildId).config;
  const e = ensureEvents(cfg);
  return isActive(e.happyHourUntil) ? e.happyHourPointsMult || 2 : 1;
}

function getBakeryCoinMultiplier(data, guildId) {
  const cfg = getGuildData(data, guildId).config;
  const e = ensureEvents(cfg);
  return isActive(e.bakeryBonusUntil) ? e.bakeryCoinMult || 1.5 : 1;
}

function getPokeCatchMultiplier(data, guildId) {
  const cfg = getGuildData(data, guildId).config;
  const e = ensureEvents(cfg);
  return isActive(e.pokeRaidUntil) ? e.pokeCatchBonus || 1.35 : 1;
}

function staffOk(message) {
  return message.member?.permissions?.has?.('ManageGuild') || message.member?.permissions?.has?.('Administrator');
}

function handleEventCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (command !== '!evento' && command !== '!event' && command !== '!eventos') return false;

  const sub = (args[1] || 'status').toLowerCase();
  const guildData = getGuildData(data, message.guild.id);
  const e = ensureEvents(guildData.config);

  if (sub === 'status' || sub === 'lista') {
    showEventStatus(message, e);
    return true;
  }

  if (!staffOk(message)) {
    message.reply({
      title: '🔒 Só staff',
      description: 'Eventos são iniciados por quem tem **Gerenciar Servidor**.\nVeja ativos com `!evento status`.',
      color: theme.colorError
    });
    return true;
  }

  if (sub === 'happyhour' || sub === 'hh') {
    const mins = Math.min(360, Math.max(5, parseInt(args[2], 10) || 60));
    e.happyHourUntil = Date.now() + mins * 60_000;
    e.happyHourXpMult = 2;
    e.happyHourPointsMult = 2;
    saveData(data);
    message.reply({
      title: '🎉 Happy Hour!',
      description: [
        `**${mins} minutos** de bônus no servidor.`,
        '• XP de mensagem **×2**',
        '• Daily / pontos de evento **×2** (onde aplicável)',
        `Termina <t:${Math.floor(e.happyHourUntil / 1000)}:R>`
      ].join('\n'),
      color: theme.color
    });
    return true;
  }

  if (sub === 'padaria' || sub === 'bakery') {
    const mins = Math.min(360, Math.max(5, parseInt(args[2], 10) || 45));
    e.bakeryBonusUntil = Date.now() + mins * 60_000;
    e.bakeryCoinMult = 1.5;
    saveData(data);
    message.reply({
      title: '🥖 Festival da padaria!',
      description: `Moedas da padaria ao servir **×1.5** por **${mins} min**.\nAcaba <t:${Math.floor(e.bakeryBonusUntil / 1000)}:R>`,
      color: theme.color
    });
    return true;
  }

  if (sub === 'praid' || sub === 'pokemon' || sub === 'poke') {
    const mins = Math.min(360, Math.max(5, parseInt(args[2], 10) || 45));
    e.pokeRaidUntil = Date.now() + mins * 60_000;
    e.pokeCatchBonus = 1.35;
    saveData(data);
    message.reply({
      title: '⚔️ Raid Pokémon!',
      description: `Capturas dão **×1.35** pokécoins por **${mins} min**.\nAcaba <t:${Math.floor(e.pokeRaidUntil / 1000)}:R>`,
      color: theme.color
    });
    return true;
  }

  if (sub === 'boss' || sub === 'chefe') {
    const goal = Math.min(200, Math.max(15, parseInt(args[2], 10) || 40));
    e.bakeryBoss = {
      goal,
      progress: 0,
      // recompensa só no golpe final (quem completa a meta)
      rewardPoints: 40 + Math.floor(goal * 1.2),
      rewardBakery: 20 + Math.floor(goal * 0.6),
      startedBy: message.author.id,
      startedAt: Date.now()
    };
    saveData(data);
    message.reply({
      title: '👹 Chefe da padaria!',
      description: [
        `O servidor precisa **servir ${goal} itens** juntos!`,
        `Progresso: **0/${goal}**`,
        `Quem der o golpe final: **${e.bakeryBoss.rewardPoints}** pts + **${e.bakeryBoss.rewardBakery}** 🪙 padaria`,
        'Cada `!servir` no canal da padaria conta. Use `!evento status`.'
      ].join('\n'),
      color: theme.color
    });
    return true;
  }

  if (sub === 'parar' || sub === 'stop' || sub === 'clear') {
    e.happyHourUntil = 0;
    e.bakeryBonusUntil = 0;
    e.pokeRaidUntil = 0;
    e.bakeryBoss = null;
    saveData(data);
    message.reply({
      title: '🛑 Eventos encerrados',
      description: 'Happy Hour, bônus de padaria, raid e chefe foram limpos.',
      color: theme.colorWarn
    });
    return true;
  }

  message.reply({
    title: '🎪 Eventos',
    description: [
      '`!evento status` — o que está rolando',
      '**Staff:**',
      '`!evento happyhour [min]` — XP ×2',
      '`!evento padaria [min]` — moedas padaria ×2',
      '`!evento praid [min]` — pokécoins captura ×1.35',
      '`!evento boss [meta]` — chefe (servir N itens no server)',
      '`!evento parar` — cancela tudo'
    ].join('\n'),
    color: theme.color
  });
  return true;
}

function showEventStatus(message, e) {
  const lines = [];
  if (isActive(e.happyHourUntil)) {
    lines.push(`🎉 **Happy Hour** · acaba <t:${Math.floor(e.happyHourUntil / 1000)}:R>`);
  }
  if (isActive(e.bakeryBonusUntil)) {
    lines.push(`🥖 **Festival padaria** ×${e.bakeryCoinMult} · <t:${Math.floor(e.bakeryBonusUntil / 1000)}:R>`);
  }
  if (isActive(e.pokeRaidUntil)) {
    lines.push(`⚔️ **Raid Pokémon** ×${e.pokeCatchBonus} coins · <t:${Math.floor(e.pokeRaidUntil / 1000)}:R>`);
  }
  if (e.bakeryBoss) {
    const b = e.bakeryBoss;
    lines.push(
      `👹 **Chefe padaria** · **${b.progress}/${b.goal}** servidos · prêmio ${b.rewardPoints}pts + ${b.rewardBakery}🪙`
    );
  }
  message.reply({
    title: '🎪 Eventos do servidor',
    description: lines.length ? lines.join('\n') : '*Nenhum evento ativo.* Staff: `!evento happyhour 60`',
    color: theme.color
  });
}

/**
 * Conta progresso do chefe da padaria. Retorna { completed, reward } se matou o boss.
 */
function contributeBakeryBoss(data, guildId, userId, servedCount) {
  const guildData = getGuildData(data, guildId);
  const e = ensureEvents(guildData.config);
  if (!e.bakeryBoss || servedCount <= 0) return null;
  e.bakeryBoss.progress += servedCount;
  if (e.bakeryBoss.progress < e.bakeryBoss.goal) {
    saveData(data);
    return { completed: false, progress: e.bakeryBoss.progress, goal: e.bakeryBoss.goal };
  }
  const reward = {
    points: e.bakeryBoss.rewardPoints,
    bakery: e.bakeryBoss.rewardBakery
  };
  e.bakeryBoss = null;
  saveData(data);
  return { completed: true, ...reward };
}

module.exports = {
  handleEventCommand,
  showEventStatus,
  ensureEvents,
  getXpMultiplier,
  getPointsMultiplier,
  getBakeryCoinMultiplier,
  getPokeCatchMultiplier,
  contributeBakeryBoss,
  isActive
};
