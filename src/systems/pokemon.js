/**
 * Sistema Pokémon (pokedex completa, loja, captura, PvP)
 * Só funciona no canal POKEMON_CHANNEL_ID.
 */
const { getUserData, saveData } = require('./database');
const {
  getAllPokemon,
  getPokemon,
  typeEffectiveness,
  formatTypes,
  randomWildSpecies,
  spriteUrl,
  spriteIcon,
  getEvolution,
  canEvolve,
  RARITY_CATCH,
  TOTAL,
  TYPE_EMOJI
} = require('./pokemon-data');
const { POKE_SHOP, findPokeItem } = require('./pokemon-shop');
const { theme } = require('./theme');

const POKEMON_CHANNEL_ID =
  process.env.POKEMON_CHANNEL_ID || '1529584865249464390';

const STARTERS = [1, 4, 7, 25, 133, 152, 155, 158, 252, 255, 258, 387, 390, 393];
const MAX_TEAM_BASE = 3;
const MAX_TEAM_CAP = 6;
const MAX_BOX = 60;
const WILD_COOLDOWN_MS = 90 * 1000;
const CATCH_COOLDOWN_MS = 45 * 1000;

/** batalhas ativas: key = sorted userIds join */
const battles = new Map();
/** desafios pendentes: targetId -> { from, at, channelId } */
const challenges = new Map();

const MOVE_POOL = {
  Normal: ['Tackle', 'Swift', 'Body Slam', 'Hyper Beam'],
  Fire: ['Ember', 'Flamethrower', 'Fire Blast', 'Heat Wave'],
  Water: ['Water Gun', 'Surf', 'Hydro Pump', 'Aqua Jet'],
  Electric: ['Thunder Shock', 'Thunderbolt', 'Thunder', 'Spark'],
  Grass: ['Vine Whip', 'Razor Leaf', 'Solar Beam', 'Leaf Blade'],
  Ice: ['Powder Snow', 'Ice Beam', 'Blizzard', 'Icy Wind'],
  Fighting: ['Karate Chop', 'Brick Break', 'Close Combat', 'Low Kick'],
  Poison: ['Poison Sting', 'Sludge Bomb', 'Toxic', 'Acid'],
  Ground: ['Mud-Slap', 'Earthquake', 'Bulldoze', 'Dig'],
  Flying: ['Gust', 'Aerial Ace', 'Air Slash', 'Brave Bird'],
  Psychic: ['Confusion', 'Psychic', 'Psybeam', 'Future Sight'],
  Bug: ['Bug Bite', 'X-Scissor', 'Megahorn', 'Signal Beam'],
  Rock: ['Rock Throw', 'Rock Slide', 'Stone Edge', 'Ancient Power'],
  Ghost: ['Lick', 'Shadow Ball', 'Hex', 'Shadow Claw'],
  Dragon: ['Dragon Rage', 'Dragon Claw', 'Dragon Pulse', 'Outrage'],
  Dark: ['Bite', 'Crunch', 'Dark Pulse', 'Foul Play'],
  Steel: ['Metal Claw', 'Iron Head', 'Flash Cannon', 'Steel Wing'],
  Fairy: ['Fairy Wind', 'Dazzling Gleam', 'Moonblast', 'Play Rough']
};

function handlePokemonCommand(message, data) {
  if (!message.guild || message.author.bot) return false;
  if (message.channel.id !== POKEMON_CHANNEL_ID) return false;

  const args = message.content.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();

  const map = {
    '!phelp': () => showHelp(message),
    '!pokedex': () => showHelp(message),
    '!pajuda': () => showHelp(message),
    '!pstart': () => startAdventure(message, args, data),
    '!piniciar': () => startAdventure(message, args, data),
    '!pwild': () => wildEncounter(message, data),
    '!pselvagem': () => wildEncounter(message, data),
    '!pcatch': () => catchWild(message, args, data),
    '!plutar': () => catchWild(message, args, data),
    '!pcapturar': () => catchWild(message, args, data),
    '!pdex': () => showDex(message, args),
    '!pinfo': () => showDex(message, args),
    '!pteam': () => showTeam(message, data),
    '!ptime': () => showTeam(message, data),
    '!pbox': () => showBox(message, args, data),
    '!pcaixa': () => showBox(message, args, data),
    '!padd': () => boxToTeam(message, args, data),
    '!premove': () => teamToBox(message, args, data),
    '!pswap': () => swapTeam(message, args, data),
    // Pokémon principal (líder do time = slot 1, usado em captura/PvP/itens)
    '!pmain': () => setMainPokemon(message, args, data),
    '!plider': () => setMainPokemon(message, args, data),
    '!pprincipal': () => setMainPokemon(message, args, data),
    '!plead': () => setMainPokemon(message, args, data),
    '!pmon': () => showMainPokemon(message, data),
    '!ppoke': () => showMainPokemon(message, data),
    '!pevolve': () => evolveMain(message, data),
    '!pevoluir': () => evolveMain(message, data),
    '!pxp': () => showMainPokemon(message, data),
    '!ploja': () => showPokeShop(message, data),
    '!pshop': () => showPokeShop(message, data),
    '!pbuy': () => buyPokeItem(message, args, data),
    '!pcomprar': () => buyPokeItem(message, args, data),
    '!pbag': () => showBag(message, data),
    '!pmochila': () => showBag(message, data),
    '!puse': () => usePokeItem(message, args, data),
    '!pusar': () => usePokeItem(message, args, data),
    '!pbattle': () => challengePvp(message, args, data),
    '!pduelo': () => challengePvp(message, args, data),
    '!paccept': () => acceptPvp(message, data),
    '!paceitar': () => acceptPvp(message, data),
    '!pdeny': () => denyPvp(message),
    '!precusar': () => denyPvp(message),
    '!pmove': () => pvpMove(message, args, data),
    '!pataque': () => pvpMove(message, args, data),
    '!pforfeit': () => pvpForfeit(message, data),
    '!pdesistir': () => pvpForfeit(message, data),
    '!pstatus': () => showPokeStatus(message, data),
    '!pdaily': () => pokeDaily(message, data)
  };

  if (!map[cmd]) return false;
  map[cmd]();
  return true;
}

/* ───────────── user state ───────────── */

function ensurePoke(userData) {
  if (!userData.pokemon) {
    userData.pokemon = {
      started: false,
      coins: 200,
      team: [],
      box: [],
      bag: { pokeball: 5, potion: 2 },
      teamLimit: MAX_TEAM_BASE,
      lastWildAt: 0,
      lastCatchAt: 0,
      lastDailyAt: 0,
      wild: null,
      wins: 0,
      losses: 0,
      catches: 0,
      incenseUntil: 0,
      expShareLeft: 0
    };
  }
  const p = userData.pokemon;
  if (!Array.isArray(p.team)) p.team = [];
  if (!Array.isArray(p.box)) p.box = [];
  if (!p.bag || typeof p.bag !== 'object') p.bag = {};
  if (!Number.isInteger(p.coins)) p.coins = 200;
  if (!Number.isInteger(p.teamLimit)) p.teamLimit = MAX_TEAM_BASE;
  if (p.teamLimit > MAX_TEAM_CAP) p.teamLimit = MAX_TEAM_CAP;
  if (!Number.isInteger(p.wins)) p.wins = 0;
  if (!Number.isInteger(p.losses)) p.losses = 0;
  if (!Number.isInteger(p.catches)) p.catches = 0;
  return p;
}

function createOwned(species, level = 5) {
  const stats = scaleStats(species.stats, level);
  return {
    uid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    speciesId: species.id,
    name: species.name,
    types: [...species.types],
    level,
    xp: 0,
    rarity: species.rarity,
    stats: { ...stats },
    maxHp: stats.hp,
    hp: stats.hp,
    moves: generateMoves(species.types, level)
  };
}

function scaleStats(base, level) {
  // base: [hp, atk, def, spa, spd, spe]
  const [hp, atk, def, spa, spd, spe] = base;
  const f = (s) => Math.max(5, Math.floor(((2 * s * level) / 100 + 5) * 1.1));
  const h = Math.max(10, Math.floor(((2 * hp * level) / 100 + level + 10)));
  return { hp: h, atk: f(atk), def: f(def), spa: f(spa), spd: f(spd), spe: f(spe) };
}

/**
 * Golpes por nível — evita nível baixo com Hyper Beam / Hydro Pump.
 * Unlock: 1 (fraco), 10, 20, 32. Poder sobe devagar e tem teto.
 */
function generateMoves(types, level = 1) {
  level = Math.max(1, Math.min(100, Number(level) || 1));
  const primary = types[0] || 'Normal';
  const secondary = types[1] || primary;
  const poolA = MOVE_POOL[primary] || MOVE_POOL.Normal;
  const poolB = MOVE_POOL[secondary] || MOVE_POOL.Normal;

  // nameIndex no pool: 0 fraco … 3 forte
  const templates = [
    { name: poolA[0], type: primary, unlock: 1, base: 35, cap: 50 },
    { name: poolA[1] || poolA[0], type: primary, unlock: 10, base: 50, cap: 70 },
    { name: poolB[0], type: secondary, unlock: 20, base: 55, cap: 80 },
    {
      name: poolB[2] || poolB[1] || poolB[0],
      type: secondary,
      unlock: 32,
      base: 65,
      cap: 90
    }
  ];

  const moves = [];
  for (const t of templates) {
    if (level < t.unlock) continue;
    const steps = Math.floor(Math.max(0, level - t.unlock) / 10);
    const power = Math.min(t.cap, t.base + steps * 5);
    moves.push({
      name: t.name,
      type: t.type,
      power,
      unlock: t.unlock
    });
  }

  if (!moves.length) {
    moves.push({ name: 'Tackle', type: 'Normal', power: 35, unlock: 1 });
  }
  return moves.slice(0, 4);
}

/** XP necessário para ir de `level` → level+1 */
function neededXp(level) {
  // curva um pouco mais pesada no fim
  return Math.floor(30 + level * 18 + level * level * 0.35);
}

/**
 * Dá XP e aplica level-ups (stats + golpes).
 * @returns {{ leveled: number, unlockedMoves: string[], canEvolve: object|null }}
 */
function gainXp(mon, amount) {
  if (!mon || amount <= 0) {
    return { leveled: 0, unlockedMoves: [], canEvolve: null };
  }
  if (!Number.isInteger(mon.xp)) mon.xp = 0;
  if (!Number.isInteger(mon.level)) mon.level = 1;

  mon.xp += Math.floor(amount);
  let leveled = 0;
  const unlockedMoves = [];
  const prevMoveNames = new Set((mon.moves || []).map((m) => m.name));

  while (mon.xp >= neededXp(mon.level) && mon.level < 100) {
    mon.xp -= neededXp(mon.level);
    mon.level += 1;
    leveled += 1;
    const species = getPokemon(mon.speciesId);
    if (species) {
      const ratio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;
      mon.stats = scaleStats(species.stats, mon.level);
      mon.maxHp = mon.stats.hp;
      mon.hp = Math.max(1, Math.min(mon.maxHp, Math.floor(mon.maxHp * ratio)));
      mon.moves = generateMoves(species.types, mon.level);
      for (const m of mon.moves) {
        if (!prevMoveNames.has(m.name)) {
          unlockedMoves.push(m.name);
          prevMoveNames.add(m.name);
        }
      }
    }
  }

  return { leveled, unlockedMoves, canEvolve: canEvolve(mon) };
}

function formatXpBar(mon) {
  if (mon.level >= 100) return 'Nv.100 · MAX';
  const need = neededXp(mon.level);
  const have = mon.xp || 0;
  const ratio = Math.min(1, have / Math.max(1, need));
  const filled = Math.round(ratio * 10);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
  return `XP ${bar} **${have}/${need}**`;
}

function formatLevelUpNote(mon, result) {
  if (!result || !result.leveled) return '';
  const parts = [`**${mon.name}** subiu **${result.leveled}** nível(is)! → Nv.**${mon.level}**`];
  if (result.unlockedMoves?.length) {
    parts.push(`Novos golpes: ${result.unlockedMoves.map((n) => `**${n}**`).join(', ')}`);
  }
  if (result.canEvolve) {
    parts.push(
      `✨ Pode evoluir para **${result.canEvolve.next.name}** (Nv.${result.canEvolve.evo.minLevel}+) — \`!pevolve\``
    );
  }
  return parts.join('\n');
}

/* ───────────── commands ───────────── */

function showHelp(message) {
  message.reply({
    title: '📕 Pokémon · Morgana',
    description: [
      `Canal exclusivo · **${TOTAL}** espécies no Pokédex`,
      '',
      '**Início**',
      '`!pstart` — escolher inicial',
      '`!pwild` — encontro selvagem',
      '`!pcatch [ball]` — capturar (pokeball/greatball/ultraball/masterball)',
      '',
      '**Time & caixa**',
      '`!pteam` — ver time (⭐ = principal)',
      '`!pmain 2` / `!plider 2` — **trocar o Pokémon principal**',
      '`!pmon` — detalhes do principal',
      '`!pbox [página]` · `!padd #` · `!premove #` · `!pswap a b`',
      '',
      '**Loja Pokémon** (pokécoins 🪙)',
      '`!ploja` · `!pbuy id` · `!pbag` · `!puse potion` · `!pdaily`',
      '',
      '**XP & evolução**',
      '`!pmon` / `!pxp` — nível, XP e golpes do principal',
      '`!pevolve` — evoluir o principal (se elegível)',
      'Golpes liberam nos Nv. **1 / 10 / 20 / 32** (poder sobe com o nível)',
      '',
      '**PvP**',
      '`!pbattle @user` · `!paccept` · `!pdeny`',
      '`!pmove 1-4` · `!pforfeit`',
      '',
      '`!pdex nome|número` · `!pstatus`'
    ].join('\n'),
    color: 0xe74c3c,
    footer: { text: `Pokédex nacional · ${TOTAL} Pokémon` }
  });
}

function startAdventure(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);

  if (poke.started && poke.team.length > 0) {
    message.reply({
      title: '⚠️ Já começou',
      description: 'Você já tem um time. Use `!pteam` ou `!pwild`.',
      color: 0xf1c40f
    });
    return;
  }

  const choice = args[1]?.toLowerCase();
  if (!choice) {
    const lines = STARTERS.map((id) => {
      const s = getPokemon(id);
      return `\`${id}\` ${s.name} (${formatTypes(s.types)})`;
    }).join('\n');
    message.reply({
      title: '🎉 Escolha seu inicial',
      description: `Use \`!pstart id\`\n\n${lines}`,
      color: 0xe7644d
    });
    return;
  }

  const species = getPokemon(choice);
  if (!species || !STARTERS.includes(species.id)) {
    message.reply({
      title: '❌ Inicial inválido',
      description: 'Use um ID da lista: `!pstart`',
      color: 0xe74c3c
    });
    return;
  }

  const mon = createOwned(species, 5);
  poke.started = true;
  poke.team = [mon];
  poke.coins = Math.max(poke.coins, 200);
  poke.bag.pokeball = (poke.bag.pokeball || 0) + 5;
  poke.bag.potion = (poke.bag.potion || 0) + 2;
  saveData(data);

  message.reply({
    title: `✨ ${species.name} se juntou a você!`,
    description: `${message.author} começou a jornada com **${species.name}** Nv.5!`,
    thumbnail: spriteUrl(species.id),
    fields: [
      { name: 'Tipos', value: formatTypes(species.types), inline: true },
      { name: '🪙 Coins', value: String(poke.coins), inline: true },
      { name: 'Mochila', value: '5× Poké Ball · 2× Potion', inline: true }
    ],
    color: 0xe7644d
  });
}

function wildEncounter(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const now = Date.now();
  let cd = WILD_COOLDOWN_MS;
  if (poke.incenseUntil && poke.incenseUntil > now) cd = Math.floor(cd * 0.5);

  if (now - poke.lastWildAt < cd) {
    const left = Math.ceil((cd - (now - poke.lastWildAt)) / 1000);
    message.reply({
      title: '⏳ Aguarde',
      description: `Próximo encontro em **${left}s**.`,
      color: 0xf1c40f
    });
    return;
  }

  const species = randomWildSpecies();
  const level = Math.max(3, Math.min(50, (poke.team[0]?.level || 5) + randInt(-3, 5)));
  const wild = createOwned(species, level);
  poke.wild = wild;
  poke.lastWildAt = now;
  saveData(data);

  message.reply({
    title: '🌿 Pokémon selvagem!',
    description: [
      `Um **${species.name}** selvagem apareceu!`,
      `Nível **${level}** · ${formatTypes(species.types)}`,
      `Raridade: **${species.rarity}**`,
      '',
      'Use `!pcatch` ou `!pcatch greatball`'
    ].join('\n'),
    thumbnail: spriteUrl(species.id),
    image: spriteUrl(species.id),
    color: rarityColor(species.rarity)
  });
}

function catchWild(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  if (!poke.wild) {
    message.reply({
      title: '❌ Nada para capturar',
      description: 'Use `!pwild` primeiro.',
      color: 0xe74c3c
    });
    return;
  }

  const now = Date.now();
  if (now - poke.lastCatchAt < CATCH_COOLDOWN_MS) {
    const left = Math.ceil((CATCH_COOLDOWN_MS - (now - poke.lastCatchAt)) / 1000);
    message.reply({
      title: '⏳ Calma',
      description: `Espere **${left}s** para tentar de novo.`,
      color: 0xf1c40f
    });
    return;
  }

  const ballId = (args[1] || 'pokeball').toLowerCase();
  const ball = findPokeItem(ballId);
  if (!ball || ball.category !== 'ball') {
    message.reply({
      title: '🔴 Ball inválida',
      description: 'Use: pokeball, greatball, ultraball, masterball',
      color: 0xe74c3c
    });
    return;
  }

  const have = poke.bag[ball.id] || 0;
  if (have <= 0) {
    message.reply({
      title: '🎒 Sem ball',
      description: `Você não tem **${ball.name}**. Compre em \`!ploja\`.`,
      color: 0xe74c3c
    });
    return;
  }

  poke.bag[ball.id] -= 1;
  if (poke.bag[ball.id] <= 0) delete poke.bag[ball.id];
  poke.lastCatchAt = now;

  const wild = poke.wild;
  const base = RARITY_CATCH[wild.rarity] || 0.3;
  const chance = Math.min(0.95, base + (ball.catchBonus || 0));
  const success = ball.id === 'masterball' || Math.random() < chance;

  if (!success) {
    // 40% chance wild flees
    const fled = Math.random() < 0.4;
    if (fled) poke.wild = null;
    saveData(data);
    message.reply({
      title: '💨 Escapou!',
      description: fled
        ? `**${wild.name}** quebrou a ${ball.emoji} e **fugiu**.`
        : `**${wild.name}** quebrou a ${ball.emoji}! Tente \`!pcatch\` de novo.`,
      thumbnail: spriteIcon(wild.speciesId),
      color: 0xe67e22
    });
    return;
  }

  const mon = { ...wild, hp: wild.maxHp };
  const placed = addToCollection(poke, mon);
  poke.wild = null;
  poke.catches += 1;

  // XP para o principal (e um pouco pro capturado se entrou no time)
  const xpGain = 18 + wild.level * 3;
  let xpNote = '';
  if (poke.team[0]) {
    let mult = 1;
    if (poke.expShareLeft > 0) {
      mult = 1.5;
      poke.expShareLeft -= 1;
    }
    const res = gainXp(poke.team[0], Math.floor(xpGain * mult));
    const note = formatLevelUpNote(poke.team[0], res);
    if (note) xpNote = `\n${note}`;
    else xpNote = `\n${poke.team[0].name} +**${Math.floor(xpGain * mult)}** XP`;
  }

  const raidMult = (() => {
    try {
      return require('./guild-events').getPokeCatchMultiplier(data, message.guild.id);
    } catch {
      return 1;
    }
  })();
  const coins = Math.floor((20 + wild.level * 3) * raidMult);
  poke.coins += coins;
  // capturado já no nível selvagem — garante moves corretos pro nível
  mon.moves = generateMoves(mon.types, mon.level);
  try {
    require('./quests').trackQuest(data, message.guild.id, message.author.id, 'poke_catch', 1, false);
  } catch {
    /* ignore */
  }
  saveData(data);

  message.reply({
    title: '🎉 Capturado!',
    description: [
      `${message.author} capturou **${mon.name}** Nv.${mon.level}!`,
      `Com: ${ball.emoji} **${ball.name}**`,
      `Guardado em: **${placed}**`,
      `+**${coins}** 🪙${raidMult > 1 ? ' ⚔️ raid' : ''}${xpNote}`
    ].join('\n'),
    thumbnail: spriteUrl(mon.speciesId),
    color: 0xe7644d
  });
}

function addToCollection(poke, mon) {
  if (poke.team.length < poke.teamLimit) {
    poke.team.push(mon);
    return 'time';
  }
  if (poke.box.length < MAX_BOX) {
    poke.box.push(mon);
    return 'caixa';
  }
  // replace last box
  poke.box[poke.box.length - 1] = mon;
  return 'caixa (cheia, substituiu o último)';
}

function showDex(message, args) {
  const q = args.slice(1).join(' ') || args[1];
  if (!q) {
    message.reply({
      title: '📖 Pokédex',
      description: `Há **${TOTAL}** espécies.\nUse \`!pdex pikachu\` ou \`!pdex 25\`.`
    });
    return;
  }
  const species = getPokemon(q);
  if (!species) {
    message.reply({
      title: '❌ Não encontrado',
      description: `Nenhum Pokémon \`${q}\` no dex.`,
      color: 0xe74c3c
    });
    return;
  }
  const [hp, atk, def, spa, spd, spe] = species.stats;
  message.reply({
    title: `#${species.id} · ${species.name}`,
    description: formatTypes(species.types),
    thumbnail: spriteUrl(species.id),
    fields: [
      { name: 'HP', value: String(hp), inline: true },
      { name: 'Atk', value: String(atk), inline: true },
      { name: 'Def', value: String(def), inline: true },
      { name: 'SpA', value: String(spa), inline: true },
      { name: 'SpD', value: String(spd), inline: true },
      { name: 'Spe', value: String(spe), inline: true },
      { name: 'BST', value: String(hp + atk + def + spa + spd + spe), inline: true },
      { name: 'Raridade', value: species.rarity, inline: true }
    ],
    color: rarityColor(species.rarity)
  });
}

function hpBar(hp, maxHp, size = 8) {
  const max = Math.max(1, maxHp || 1);
  const cur = Math.max(0, Math.min(max, hp ?? max));
  const filled = Math.round((cur / max) * size);
  const empty = size - filled;
  const pct = Math.floor((cur / max) * 100);
  return `\`${'█'.repeat(filled)}${'░'.repeat(empty)}\` ${cur}/${max} (${pct}%)`;
}

function showTeam(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  if (!poke.team.length) {
    message.reply({
      title: '👥 Time vazio',
      description: 'Use `!padd #` da caixa para montar o time.'
    });
    return;
  }

  const leader = poke.team[0];
  const lines = poke.team.map((m, i) => {
    const tag = i === 0 ? '⭐ **PRINCIPAL**' : `**#${i + 1}**`;
    return [
      `${tag} · **${m.name}** · Nv.**${m.level}**`,
      `HP ${hpBar(m.hp, m.maxHp)}`,
      `${formatTypes(m.types)}`
    ].join('\n');
  });

  message.reply({
    title: `👥 Time de ${message.author.username}`,
    description: [
      `Líder atual: **${leader.name}** (usa \`!pmain N\` para trocar)`,
      '',
      lines.join('\n\n')
    ].join('\n'),
    thumbnail: spriteUrl(leader.speciesId),
    fields: [
      { name: 'Slots', value: `${poke.team.length}/${poke.teamLimit}`, inline: true },
      { name: '🪙 Coins', value: String(poke.coins), inline: true },
      { name: 'PvP', value: `${poke.wins}W / ${poke.losses}L`, inline: true }
    ],
    footer: {
      text: '!pmain 2 = torna o #2 principal · !pmon · !pswap 1 2'
    },
    color: 0x3498db
  });
}

/**
 * Define o Pokémon principal (líder): vai para o slot 1.
 * Uso: !pmain 2   |  !plider 3   |  !pprincipal 1
 */
function setMainPokemon(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  if (poke.team.length < 1) {
    message.reply({
      title: '👥 Time vazio',
      description: 'Capture ou adicione Pokémon antes.',
      color: 0xe74c3c
    });
    return;
  }

  if (!args[1]) {
    const list = poke.team
      .map((m, i) => {
        const star = i === 0 ? '⭐' : `\`#${i + 1}\``;
        return `${star} **${m.name}** Nv.${m.level}`;
      })
      .join('\n');
    message.reply({
      title: '⭐ Trocar Pokémon principal',
      description: [
        'O **principal** (⭐) luta no PvP, recebe XP de captura e usa itens.',
        '',
        '**Uso:** `!pmain número`',
        'Exemplos: `!pmain 2` · `!plider 3` · `!pprincipal 1`',
        '',
        list
      ].join('\n'),
      thumbnail: spriteIcon(poke.team[0].speciesId),
      color: 0xf1c40f
    });
    return;
  }

  const idx = Number(args[1]) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= poke.team.length) {
    message.reply({
      title: '❌ Número inválido',
      description: `Escolha de **1** a **${poke.team.length}**. Veja com \`!pteam\`.`,
      color: 0xe74c3c
    });
    return;
  }

  if (idx === 0) {
    message.reply({
      title: '⭐ Já é o principal',
      description: `**${poke.team[0].name}** já é o líder do time.`,
      thumbnail: spriteIcon(poke.team[0].speciesId),
      color: 0xe7644d
    });
    return;
  }

  const [mon] = poke.team.splice(idx, 1);
  poke.team.unshift(mon);
  saveData(data);

  message.reply({
    title: '⭐ Novo Pokémon principal!',
    description: [
      `${message.author} definiu **${mon.name}** como líder.`,
      '',
      showTeamInline(poke.team),
      '',
      'Ele será usado em **PvP**, **itens** e **XP** de captura.'
    ].join('\n'),
    thumbnail: spriteUrl(mon.speciesId),
    color: 0xf1c40f
  });
}

function showMainPokemon(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const mon = poke.team[0];
  if (!mon) {
    message.reply({ title: 'Sem líder', description: 'Time vazio.', color: 0xe74c3c });
    return;
  }

  // sincroniza golpes com o nível atual (migra saves antigos com power 90)
  mon.moves = generateMoves(mon.types || getPokemon(mon.speciesId)?.types || ['Normal'], mon.level);

  const moves = (mon.moves || [])
    .map((m, i) => `\`${i + 1}\` **${m.name}** (${m.type} · poder **${m.power}**)`)
    .join('\n');

  const locked = [1, 10, 20, 32]
    .filter((lv) => mon.level < lv)
    .map((lv) => `Nv.${lv}`)
    .join(', ');

  const species = getPokemon(mon.speciesId);
  const evo = getEvolution(mon.speciesId);
  const evoReady = canEvolve(mon);
  let evoLine = 'Não evolui (ou sem dados)';
  if (evo) {
    const next = getPokemon(evo.to);
    evoLine = evoReady
      ? `✨ Pronto → **${next?.name || evo.to}** — use \`!pevolve\``
      : `→ **${next?.name || evo.to}** no Nv.**${evo.minLevel}** (faltam ${Math.max(0, evo.minLevel - mon.level)})`;
  }

  const [hp, atk, def, spa, spd, spe] = [
    mon.stats?.hp ?? mon.maxHp,
    mon.stats?.atk ?? '—',
    mon.stats?.def ?? '—',
    mon.stats?.spa ?? '—',
    mon.stats?.spd ?? '—',
    mon.stats?.spe ?? '—'
  ];

  message.reply({
    title: `⭐ Principal · ${mon.name}`,
    description: [
      `${message.author}`,
      `Nível **${mon.level}** · ${formatTypes(mon.types)}`,
      formatXpBar(mon),
      `HP ${hpBar(mon.hp, mon.maxHp, 10)}`,
      '',
      '**Golpes**',
      moves || '_sem golpes_',
      locked ? `_Próximos slots: ${locked}_` : '_Todos os slots de golpe liberados_',
      '',
      `**Evolução:** ${evoLine}`
    ].join('\n'),
    thumbnail: spriteUrl(mon.speciesId),
    fields: [
      { name: 'ATK', value: String(atk), inline: true },
      { name: 'DEF', value: String(def), inline: true },
      { name: 'SpA', value: String(spa), inline: true },
      { name: 'SpD', value: String(spd), inline: true },
      { name: 'SPE', value: String(spe), inline: true },
      { name: 'Raridade', value: mon.rarity || species?.rarity || '—', inline: true }
    ],
    footer: { text: 'Trocar líder: !pmain 2  ·  Evoluir: !pevolve  ·  Time: !pteam' },
    color: 0xf1c40f
  });
}

function evolveMain(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const mon = poke.team[0];
  if (!mon) {
    message.reply({ title: 'Sem líder', description: 'Time vazio.', color: 0xe74c3c });
    return;
  }

  const ready = canEvolve(mon);
  if (!ready) {
    const evo = getEvolution(mon.speciesId);
    if (!evo) {
      message.reply({
        title: '🔮 Sem evolução',
        description: `**${mon.name}** não tem evolução cadastrada (ou já é a forma final neste bot).`,
        color: theme.colorWarn
      });
      return;
    }
    message.reply({
      title: '🔮 Ainda não',
      description: [
        `**${mon.name}** evolui no **Nv.${evo.minLevel}** (está no **${mon.level}**).`,
        `Faltam **${evo.minLevel - mon.level}** níveis · ${formatXpBar(mon)}`,
        'Capture selvagens (`!pwild` / `!pcatch`) ou vença PvP para ganhar XP.'
      ].join('\n'),
      thumbnail: spriteIcon(mon.speciesId),
      color: theme.colorWarn
    });
    return;
  }

  const { evo, next } = ready;
  const oldName = mon.name;
  const oldId = mon.speciesId;
  const ratio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;

  mon.speciesId = next.id;
  mon.name = next.name;
  mon.types = [...next.types];
  mon.rarity = next.rarity;
  mon.stats = scaleStats(next.stats, mon.level);
  mon.maxHp = mon.stats.hp;
  mon.hp = Math.max(1, Math.min(mon.maxHp, Math.floor(mon.maxHp * ratio)));
  mon.moves = generateMoves(mon.types, mon.level);

  saveData(data);

  message.reply({
    title: '✨ Evolução!',
    description: [
      `${message.author}`,
      `**${oldName}** evoluiu para **${next.name}**!`,
      `Nível **${mon.level}** · ${formatTypes(mon.types)}`,
      '',
      '**Novos golpes**',
      (mon.moves || []).map((m, i) => `\`${i + 1}\` **${m.name}** (${m.type} · ${m.power})`).join('\n')
    ].join('\n'),
    thumbnail: spriteUrl(next.id),
    image: spriteUrl(next.id),
    color: theme.color
  });
}

function showBox(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const page = Math.max(1, Number(args[1]) || 1);
  const per = 10;
  const start = (page - 1) * per;
  const slice = poke.box.slice(start, start + per);
  const pages = Math.max(1, Math.ceil(poke.box.length / per));

  if (!poke.box.length) {
    message.reply({
      title: '📦 Caixa vazia',
      description: 'Pokémon extras vão para a caixa quando o time enche.'
    });
    return;
  }

  const lines = slice.map(
    (m, i) => `\`#${start + i + 1}\` **${m.name}** Nv.${m.level} · ${formatTypes(m.types)}`
  );

  message.reply({
    title: `📦 Caixa (${poke.box.length}/${MAX_BOX})`,
    description: lines.join('\n'),
    footer: { text: `Página ${page}/${pages} · !padd # para colocar no time` }
  });
}

function boxToTeam(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const idx = Number(args[1]) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= poke.box.length) {
    message.reply({
      title: '📦 Uso',
      description: '`!padd número` — veja os números em `!pbox`'
    });
    return;
  }
  if (poke.team.length >= poke.teamLimit) {
    message.reply({
      title: '👥 Time cheio',
      description: `Limite ${poke.teamLimit}. Use \`!premove\` ou compre expansão na loja.`,
      color: 0xe74c3c
    });
    return;
  }
  const [mon] = poke.box.splice(idx, 1);
  poke.team.push(mon);
  saveData(data);
  message.reply({
    title: '✅ Adicionado ao time',
    description: `**${mon.name}** entrou no time.`,
    thumbnail: spriteIcon(mon.speciesId),
    color: 0xe7644d
  });
}

function teamToBox(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const idx = Number(args[1]) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= poke.team.length) {
    message.reply({
      title: '👥 Uso',
      description: '`!premove número` (1 = líder)'
    });
    return;
  }
  if (poke.team.length <= 1) {
    message.reply({
      title: '❌',
      description: 'Você precisa de pelo menos 1 Pokémon no time.',
      color: 0xe74c3c
    });
    return;
  }
  if (poke.box.length >= MAX_BOX) {
    message.reply({ title: '📦 Caixa cheia', color: 0xe74c3c });
    return;
  }
  const [mon] = poke.team.splice(idx, 1);
  poke.box.push(mon);
  saveData(data);
  message.reply({
    title: '📦 Movido para a caixa',
    description: `**${mon.name}** foi para a caixa.`,
    color: 0x95a5a6
  });
}

function swapTeam(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;
  const a = Number(args[1]) - 1;
  const b = Number(args[2]) - 1;
  if (
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 ||
    b < 0 ||
    a >= poke.team.length ||
    b >= poke.team.length
  ) {
    message.reply({
      title: '🔄 Trocar posições',
      description: [
        '`!pswap A B` — troca dois slots do time',
        'Ex.: `!pswap 1 2` (principal ↔ segundo)',
        '',
        'Para só definir o líder: `!pmain 2`'
      ].join('\n')
    });
    return;
  }
  [poke.team[a], poke.team[b]] = [poke.team[b], poke.team[a]];
  saveData(data);
  message.reply({
    title: '🔄 Time reordenado',
    description: [
      `Principal agora: ⭐ **${poke.team[0].name}**`,
      '',
      showTeamInline(poke.team)
    ].join('\n'),
    thumbnail: spriteIcon(poke.team[0].speciesId),
    color: 0x3498db
  });
}

/* ───────────── shop ───────────── */

function showPokeShop(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);

  const byCat = {};
  for (const item of POKE_SHOP) {
    if (!byCat[item.category]) byCat[item.category] = [];
    byCat[item.category].push(
      `${item.emoji} \`${item.id}\` **${item.name}** — **${item.price}** 🪙\n└ ${item.description}`
    );
  }

  const labels = { ball: '🔴 Balls', heal: '💚 Cura', boost: '⚡ Boosts' };
  const fields = Object.entries(byCat).map(([cat, lines]) => ({
    name: labels[cat] || cat,
    value: lines.join('\n\n').slice(0, 1020),
    inline: false
  }));

  message.reply({
    title: '🏪 Loja Pokémon',
    description: `${message.author} · saldo **${poke.coins}** 🪙\nCompre: \`!pbuy id\` · Mochila: \`!pbag\``,
    fields,
    color: 0xe74c3c
  });
}

function buyPokeItem(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const item = findPokeItem(args[1]);
  const qty = Math.min(20, Math.max(1, Number(args[2]) || 1));
  if (!item) {
    message.reply({
      title: '❓ Item',
      description: 'Use `!ploja` e `!pbuy id`',
      color: 0xe74c3c
    });
    return;
  }
  const total = item.price * qty;
  if (poke.coins < total) {
    message.reply({
      title: '🪙 Sem pokécoins',
      description: `Precisa **${total}** 🪙 · você tem **${poke.coins}**`,
      color: 0xe74c3c
    });
    return;
  }

  if (item.id === 'teambag') {
    if (poke.teamLimit >= MAX_TEAM_CAP) {
      message.reply({ title: 'Já no máximo', description: `Limite de time: ${MAX_TEAM_CAP}` });
      return;
    }
    poke.coins -= item.price;
    poke.teamLimit = Math.min(MAX_TEAM_CAP, poke.teamLimit + 1);
    saveData(data);
    message.reply({
      title: '🎒 Time expandido',
      description: `Novo limite: **${poke.teamLimit}** Pokémon no time.`,
      color: 0xe7644d
    });
    return;
  }

  poke.coins -= total;
  poke.bag[item.id] = (poke.bag[item.id] || 0) + qty;
  saveData(data);
  message.reply({
    title: '🛍️ Compra Pokémon',
    description: `Comprou ${item.emoji} **${item.name}** ×${qty}`,
    fields: [
      { name: 'Gastou', value: `**${total}** 🪙`, inline: true },
      { name: 'Saldo', value: `**${poke.coins}** 🪙`, inline: true },
      { name: 'Na mochila', value: String(poke.bag[item.id]), inline: true }
    ],
    color: 0xe7644d
  });
}

function showBag(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const entries = Object.entries(poke.bag).filter(([, n]) => n > 0);
  if (!entries.length) {
    message.reply({ title: '🎒 Mochila vazia', description: '`!ploja` para comprar itens.' });
    return;
  }
  const lines = entries.map(([id, n]) => {
    const item = findPokeItem(id);
    return `${item?.emoji || '📦'} **${item?.name || id}** ×${n} (\`${id}\`)`;
  });
  message.reply({
    title: '🎒 Mochila Pokémon',
    description: `${lines.join('\n')}\n\n🪙 **${poke.coins}** · use \`!puse id\``,
    color: 0x9b59b6
  });
}

function usePokeItem(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const item = findPokeItem(args[1]);
  if (!item) {
    message.reply({ title: '❓', description: '`!puse rarecandy` etc.', color: 0xe74c3c });
    return;
  }
  const have = poke.bag[item.id] || 0;
  if (have <= 0) {
    message.reply({ title: 'Sem item', description: `Você não tem ${item.name}.`, color: 0xe74c3c });
    return;
  }

  const mon = poke.team[0];
  if (!mon && item.id !== 'incense' && item.id !== 'expshare') {
    message.reply({ title: 'Sem líder', description: 'Coloque um Pokémon no time.', color: 0xe74c3c });
    return;
  }

  poke.bag[item.id] -= 1;
  if (poke.bag[item.id] <= 0) delete poke.bag[item.id];

  let desc = '';
  if (item.category === 'heal') {
    const before = mon.hp;
    mon.hp = Math.min(mon.maxHp, mon.hp + (item.heal || 40));
    desc = `**${mon.name}** curou **${mon.hp - before}** HP → ${mon.hp}/${mon.maxHp}`;
  } else if (item.id === 'rarecandy') {
    // 1 nível exato
    mon.xp = 0;
    const res = gainXp(mon, neededXp(mon.level));
    mon.xp = 0;
    const note = formatLevelUpNote(mon, res);
    desc = note || `**${mon.name}** agora é Nv.**${mon.level}**!`;
  } else if (item.id === 'expshare') {
    poke.expShareLeft = (poke.expShareLeft || 0) + (item.charges || 10);
    desc = `Exp. Share ativo: **${poke.expShareLeft}** capturas com bônus.`;
  } else if (item.id === 'incense') {
    poke.incenseUntil = Date.now() + (item.durationMs || 3600000);
    desc = `Incenso ativo até <t:${Math.floor(poke.incenseUntil / 1000)}:t>`;
  } else if (item.category === 'ball') {
    poke.bag[item.id] = (poke.bag[item.id] || 0) + 1; // devolve
    message.reply({
      title: 'Balls',
      description: 'Balls são usadas no `!pcatch nome_da_ball`.',
      color: 0xf1c40f
    });
    return;
  } else {
    desc = `Usou ${item.name}.`;
  }

  saveData(data);
  message.reply({
    title: `${item.emoji} Item usado`,
    description: desc,
    color: 0xe7644d
  });
}

function pokeDaily(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (poke.lastDailyAt && now - poke.lastDailyAt < day) {
    const h = Math.ceil((day - (now - poke.lastDailyAt)) / 3600000);
    message.reply({
      title: '⏰ Daily Pokémon',
      description: `Já resgatou. Volte em ~**${h}h**.`,
      color: 0xf1c40f
    });
    return;
  }
  poke.lastDailyAt = now;
  const coins = 150 + randInt(0, 100);
  poke.coins += coins;
  poke.bag.pokeball = (poke.bag.pokeball || 0) + 3;
  saveData(data);
  message.reply({
    title: '🎁 Daily Pokémon',
    description: `${message.author} recebeu **${coins}** 🪙 e **3** Poké Balls!`,
    color: 0xe7644d
  });
}

function showPokeStatus(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;
  const mon = poke.team[0];
  message.reply({
    title: '📊 Status Pokémon',
    description: mon
      ? [
          `⭐ **Principal:** ${mon.name} Nv.**${mon.level}**`,
          `HP ${hpBar(mon.hp, mon.maxHp, 10)}`,
          formatTypes(mon.types),
          '',
          '_Trocar: `!pmain 2` · Detalhes: `!pmon`_'
        ].join('\n')
      : 'Sem líder',
    fields: [
      { name: '🪙 Coins', value: String(poke.coins), inline: true },
      { name: '✅ Capturas', value: String(poke.catches), inline: true },
      { name: '⚔️ PvP', value: `${poke.wins}W / ${poke.losses}L`, inline: true },
      { name: '👥 Time', value: `${poke.team.length}/${poke.teamLimit}`, inline: true },
      { name: '📦 Caixa', value: `${poke.box.length}/${MAX_BOX}`, inline: true },
      {
        name: 'Buffs',
        value:
          [
            poke.expShareLeft ? `ExpShare×${poke.expShareLeft}` : null,
            poke.incenseUntil > Date.now() ? 'Incenso' : null
          ]
            .filter(Boolean)
            .join(' · ') || 'nenhum',
        inline: true
      }
    ],
    thumbnail: mon ? spriteUrl(mon.speciesId) : undefined,
    color: 0xe74c3c
  });
}

/* ───────────── PvP ───────────── */

function challengePvp(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;
  if (!poke.team[0] || poke.team[0].hp <= 0) {
    message.reply({
      title: '❌',
      description: 'Seu líder está nocauteado. Cure com `!puse potion`.',
      color: 0xe74c3c
    });
    return;
  }

  const target = message.mentions.users.first();
  if (!target || target.bot || target.id === message.author.id) {
    message.reply({
      title: '⚔️ Duelo',
      description: 'Use `!pbattle @usuario`',
      color: 0xf1c40f
    });
    return;
  }

  const tData = getUserData(data, message.guild.id, target.id);
  const tPoke = ensurePoke(tData);
  if (!tPoke.started || !tPoke.team[0]) {
    message.reply({
      title: '❌',
      description: `${target} ainda não tem time Pokémon (\`!pstart\`).`,
      color: 0xe74c3c
    });
    return;
  }

  if (findBattle(message.author.id) || findBattle(target.id)) {
    message.reply({
      title: 'Já em batalha',
      description: 'Alguém já está duelando.',
      color: 0xe74c3c
    });
    return;
  }

  challenges.set(target.id, {
    from: message.author.id,
    at: Date.now(),
    channelId: message.channel.id
  });

  message.channel.send({
    content: `${target}`,
    title: '⚔️ Desafio PvP!',
    description: [
      `${message.author} desafiou ${target} para um duelo Pokémon!`,
      '',
      `${target}: \`!paccept\` ou \`!pdeny\``,
      'Expira em 60s.'
    ].join('\n'),
    color: 0xe74c3c,
    allowedMentions: { users: [target.id] }
  });
}

function acceptPvp(message, data) {
  const ch = challenges.get(message.author.id);
  if (!ch || Date.now() - ch.at > 60_000) {
    challenges.delete(message.author.id);
    message.reply({
      title: 'Nenhum desafio',
      description: 'Nada pendente (ou expirou).',
      color: 0xf1c40f
    });
    return;
  }
  if (message.channel.id !== ch.channelId) {
    message.reply({ title: 'Canal errado', description: 'Aceite no mesmo canal do desafio.' });
    return;
  }

  const aId = ch.from;
  const bId = message.author.id;
  challenges.delete(bId);

  const aData = getUserData(data, message.guild.id, aId);
  const bData = getUserData(data, message.guild.id, bId);
  const aPoke = ensurePoke(aData);
  const bPoke = ensurePoke(bData);

  // snapshot clones for battle
  const battle = {
    channelId: message.channel.id,
    turn: aId, // challenger starts
    players: {
      [aId]: {
        mon: cloneMon(aPoke.team[0]),
        name: null
      },
      [bId]: {
        mon: cloneMon(bPoke.team[0]),
        name: null
      }
    },
    ids: [aId, bId]
  };

  // heal to full + golpes balanceados pro nível (migra saves antigos)
  for (const id of battle.ids) {
    const m = battle.players[id].mon;
    m.moves = generateMoves(m.types || ['Normal'], m.level || 1);
    const species = getPokemon(m.speciesId);
    if (species) {
      m.stats = scaleStats(species.stats, m.level || 1);
      m.maxHp = m.stats.hp;
    }
    m.hp = m.maxHp;
  }

  battles.set(battleKey(aId, bId), battle);

  const aUser = message.client.users.cache.get(aId);
  const aMon = battle.players[aId].mon;
  const bMon = battle.players[bId].mon;

  message.channel.send({
    title: '⚔️ Batalha iniciada!',
    description: [
      `**${aUser?.username || aId}** · ${aMon.name} Nv.${aMon.level} (${aMon.hp}/${aMon.maxHp})`,
      `**vs**`,
      `**${message.author.username}** · ${bMon.name} Nv.${bMon.level} (${bMon.hp}/${bMon.maxHp})`,
      '',
      `Turno de <@${aId}> — use \`!pmove 1-4\``,
      movesList(aMon)
    ].join('\n'),
    color: 0xe74c3c,
    allowedMentions: { users: [aId, bId] }
  });
}

function denyPvp(message) {
  const ch = challenges.get(message.author.id);
  if (!ch) {
    message.reply({ title: 'Nada para recusar' });
    return;
  }
  challenges.delete(message.author.id);
  message.channel.send({
    title: '❌ Desafio recusado',
    description: `${message.author} recusou o duelo.`,
    color: 0x95a5a6
  });
}

function pvpMove(message, args, data) {
  const battle = findBattle(message.author.id);
  if (!battle) {
    message.reply({
      title: 'Fora de batalha',
      description: 'Desafie alguém com `!pbattle @user`.',
      color: 0xf1c40f
    });
    return;
  }
  if (battle.channelId !== message.channel.id) {
    message.reply({ title: 'Canal errado', description: 'Batalhe no canal do duelo.' });
    return;
  }
  if (battle.turn !== message.author.id) {
    message.reply({
      title: '⏳ Não é seu turno',
      description: `Vez de <@${battle.turn}>`,
      color: 0xf1c40f
    });
    return;
  }

  const moveIdx = Number(args[1]) - 1;
  const me = battle.players[message.author.id];
  const foeId = battle.ids.find((id) => id !== message.author.id);
  const foe = battle.players[foeId];

  if (!Number.isInteger(moveIdx) || moveIdx < 0 || moveIdx > 3) {
    message.reply({
      title: 'Ataques',
      description: movesList(me.mon)
    });
    return;
  }

  const move = me.mon.moves[moveIdx];
  const result = resolveAttack(me.mon, foe.mon, move);

  let text = [
    `**${me.mon.name}** usou **${move.name}**!`,
    result.effText,
    `Dano: **${result.damage}**`,
    `HP de **${foe.mon.name}**: **${foe.mon.hp}/${foe.mon.maxHp}**`
  ];

  if (foe.mon.hp <= 0) {
    endBattle(message, data, battle, message.author.id, foeId, text);
    return;
  }

  // foe auto? turn-based: switch turn
  battle.turn = foeId;
  battles.set(battleKey(battle.ids[0], battle.ids[1]), battle);

  text.push('', `Turno de <@${foeId}> — \`!pmove 1-4\``, movesList(foe.mon));

  message.channel.send({
    title: '⚔️ Turno',
    description: text.join('\n'),
    color: 0xe67e22,
    allowedMentions: { users: [foeId] }
  });
}

function pvpForfeit(message, data) {
  const battle = findBattle(message.author.id);
  if (!battle) {
    message.reply({ title: 'Você não está em batalha.' });
    return;
  }
  const foeId = battle.ids.find((id) => id !== message.author.id);
  endBattle(message, data, battle, foeId, message.author.id, [
    `${message.author} desistiu do duelo.`
  ]);
}

function endBattle(message, data, battle, winnerId, loserId, preamble = []) {
  const key = battleKey(battle.ids[0], battle.ids[1]);
  battles.delete(key);

  const wData = getUserData(data, message.guild.id, winnerId);
  const lData = getUserData(data, message.guild.id, loserId);
  const wPoke = ensurePoke(wData);
  const lPoke = ensurePoke(lData);
  wPoke.wins += 1;
  lPoke.losses += 1;
  wPoke.coins += 80;
  // sync HP back lightly (winner full, loser 1 hp)
  if (wPoke.team[0]) wPoke.team[0].hp = wPoke.team[0].maxHp;
  if (lPoke.team[0]) lPoke.team[0].hp = Math.max(1, Math.floor(lPoke.team[0].maxHp * 0.25));
  let xpLine = '';
  if (wPoke.team[0]) {
    const res = gainXp(wPoke.team[0], 45 + (wPoke.team[0].level || 1));
    const note = formatLevelUpNote(wPoke.team[0], res);
    xpLine = note ? `\n${note}` : `\n${wPoke.team[0].name} +XP de vitória`;
  }
  // perdedor ganha um pouco de XP também
  if (lPoke.team[0]) {
    gainXp(lPoke.team[0], 12);
  }
  try {
    const { trackQuest } = require('./quests');
    trackQuest(data, message.guild.id, winnerId, 'poke_pvp', 1, false);
    trackQuest(data, message.guild.id, loserId, 'poke_pvp', 1, false);
  } catch {
    /* ignore */
  }
  saveData(data);

  message.channel.send({
    title: '🏆 Fim de batalha!',
    description: [
      ...preamble,
      '',
      `Vencedor: <@${winnerId}> (+80 🪙)${xpLine}`,
      `Derrota: <@${loserId}> (+XP consolação)`
    ].join('\n'),
    color: 0xf1c40f,
    allowedMentions: { users: [winnerId, loserId] }
  });
}

function resolveAttack(attacker, defender, move) {
  const atkStat = ['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Psychic', 'Dragon', 'Dark', 'Fairy'].includes(
    move.type
  )
    ? attacker.stats.spa
    : attacker.stats.atk;
  const defStat = ['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Psychic', 'Dragon', 'Dark', 'Fairy'].includes(
    move.type
  )
    ? defender.stats.spd
    : defender.stats.def;

  const eff = typeEffectiveness(move.type, defender.types);
  let effText = '';
  if (eff === 0) effText = 'Não teve efeito…';
  else if (eff >= 2) effText = 'É **super efetivo**!';
  else if (eff <= 0.5) effText = 'Não é muito efetivo…';
  else effText = 'O ataque acertou.';

  const level = attacker.level;
  const power = move.power || 50;
  const base = Math.floor((((2 * level) / 5 + 2) * power * (atkStat / Math.max(1, defStat))) / 50) + 2;
  const variance = 0.85 + Math.random() * 0.15;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const damage = eff === 0 ? 0 : Math.max(1, Math.floor(base * variance * stab * eff));

  defender.hp = Math.max(0, defender.hp - damage);
  return { damage, eff, effText };
}

function cloneMon(mon) {
  return JSON.parse(JSON.stringify(mon));
}

function movesList(mon) {
  return mon.moves
    .map((m, i) => `\`${i + 1}\` **${m.name}** (${m.type} · poder ${m.power})`)
    .join('\n');
}

function findBattle(userId) {
  for (const b of battles.values()) {
    if (b.ids.includes(userId)) return b;
  }
  return null;
}

function battleKey(a, b) {
  return [a, b].sort().join(':');
}

/* ───────────── helpers ───────────── */

function requireStart(message, poke) {
  if (poke.started && (poke.team.length || poke.box.length)) return true;
  message.reply({
    title: '🌱 Comece a jornada',
    description: 'Use `!pstart` para escolher um inicial neste canal.',
    color: 0xe7644d
  });
  return false;
}

function showTeamInline(team) {
  return team
    .map((m, i) => {
      const star = i === 0 ? '⭐' : `\`#${i + 1}\``;
      return `${star} **${m.name}** Nv.${m.level} · HP ${m.hp}/${m.maxHp}`;
    })
    .join('\n');
}

function rarityColor(r) {
  return (
    {
      common: 0x95a5a6,
      uncommon: 0xe7644d,
      rare: 0x3498db,
      legendary: 0xf1c40f
    }[r] || theme.color
  );
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

module.exports = {
  handlePokemonCommand,
  POKEMON_CHANNEL_ID
};
