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
    moves: generateMoves(species.types)
  };
}

function scaleStats(base, level) {
  // base: [hp, atk, def, spa, spd, spe]
  const [hp, atk, def, spa, spd, spe] = base;
  const f = (s) => Math.max(5, Math.floor(((2 * s * level) / 100 + 5) * 1.1));
  const h = Math.max(10, Math.floor(((2 * hp * level) / 100 + level + 10)));
  return { hp: h, atk: f(atk), def: f(def), spa: f(spa), spd: f(spd), spe: f(spe) };
}

function generateMoves(types) {
  const moves = [];
  const primary = types[0] || 'Normal';
  const secondary = types[1] || 'Normal';
  const poolA = MOVE_POOL[primary] || MOVE_POOL.Normal;
  const poolB = MOVE_POOL[secondary] || MOVE_POOL.Normal;
  moves.push({ name: poolA[0], type: primary, power: 40 });
  moves.push({ name: poolA[1] || poolA[0], type: primary, power: 70 });
  moves.push({ name: poolB[0], type: secondary, power: 45 });
  moves.push({ name: poolB[2] || poolB[1] || poolB[0], type: secondary, power: 90 });
  return moves;
}

function neededXp(level) {
  return 40 + level * 20;
}

function gainXp(mon, amount) {
  mon.xp += amount;
  let leveled = 0;
  while (mon.xp >= neededXp(mon.level) && mon.level < 100) {
    mon.xp -= neededXp(mon.level);
    mon.level += 1;
    leveled += 1;
    const species = getPokemon(mon.speciesId);
    if (species) {
      const ratio = mon.hp / mon.maxHp;
      mon.stats = scaleStats(species.stats, mon.level);
      mon.maxHp = mon.stats.hp;
      mon.hp = Math.max(1, Math.min(mon.maxHp, Math.floor(mon.maxHp * ratio)));
      mon.moves = generateMoves(species.types);
    }
  }
  return leveled;
}

/* ───────────── commands ───────────── */

function showHelp(message) {
  message.reply({
    title: '📕 Pokémon · Isolde',
    description: [
      `Canal exclusivo · **${TOTAL}** espécies no Pokédex`,
      '',
      '**Início**',
      '`!pstart` — escolher inicial',
      '`!pwild` — encontro selvagem',
      '`!pcatch [ball]` — capturar (pokeball/greatball/ultraball/masterball)',
      '',
      '**Time & caixa**',
      '`!pteam` · `!pbox [página]` · `!padd #` · `!premove #` · `!pswap a b`',
      '',
      '**Loja Pokémon** (pokécoins 🪙)',
      '`!ploja` · `!pbuy id` · `!pbag` · `!puse rarecandy` · `!pdaily`',
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
      color: 0x2ecc71
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
    color: 0x2ecc71
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

  // XP share / team xp
  const xpGain = 15 + wild.level * 2;
  let xpNote = '';
  if (poke.team[0]) {
    let mult = 1;
    if (poke.expShareLeft > 0) {
      mult = 1.5;
      poke.expShareLeft -= 1;
    }
    const lv = gainXp(poke.team[0], Math.floor(xpGain * mult));
    if (lv) xpNote = `\n${poke.team[0].name} subiu **${lv}** nível(is)!`;
  }

  const coins = 20 + wild.level * 3;
  poke.coins += coins;
  saveData(data);

  message.reply({
    title: '🎉 Capturado!',
    description: [
      `${message.author} capturou **${mon.name}** Nv.${mon.level}!`,
      `Com: ${ball.emoji} **${ball.name}**`,
      `Guardado em: **${placed}**`,
      `+**${coins}** 🪙${xpNote}`
    ].join('\n'),
    thumbnail: spriteUrl(mon.speciesId),
    color: 0x2ecc71
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

function showTeam(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const poke = ensurePoke(userData);
  if (!requireStart(message, poke)) return;

  if (!poke.team.length) {
    message.reply({ title: '👥 Time vazio', description: 'Use `!padd #` da caixa.' });
    return;
  }

  const lines = poke.team.map((m, i) => {
    const active = i === 0 ? '⭐' : `${i + 1}.`;
    return `${active} **${m.name}** Nv.${m.level} · HP ${m.hp}/${m.maxHp} · ${formatTypes(m.types)}`;
  });

  message.reply({
    title: `👥 Time de ${message.author.username}`,
    description: lines.join('\n'),
    thumbnail: spriteIcon(poke.team[0].speciesId),
    footer: {
      text: `Limite ${poke.team.length}/${poke.teamLimit} · 🪙 ${poke.coins} · W/L ${poke.wins}/${poke.losses}`
    },
    color: 0x3498db
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
    color: 0x2ecc71
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
    message.reply({ title: 'Uso', description: '`!pswap 1 2` — troca posições do time' });
    return;
  }
  [poke.team[a], poke.team[b]] = [poke.team[b], poke.team[a]];
  saveData(data);
  message.reply({
    title: '🔄 Time reordenado',
    description: showTeamInline(poke.team),
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
      color: 0x2ecc71
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
    color: 0x2ecc71
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
    const lv = gainXp(mon, neededXp(mon.level));
    mon.xp = 0;
    if (!lv) {
      mon.level = Math.min(100, mon.level + 1);
      const species = getPokemon(mon.speciesId);
      if (species) {
        const ratio = mon.hp / mon.maxHp;
        mon.stats = scaleStats(species.stats, mon.level);
        mon.maxHp = mon.stats.hp;
        mon.hp = Math.max(1, Math.floor(mon.maxHp * ratio));
      }
    }
    desc = `**${mon.name}** agora é Nv.**${mon.level}**!`;
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
    color: 0x2ecc71
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
    color: 0x2ecc71
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
      ? `Líder: **${mon.name}** Nv.${mon.level}\nHP ${mon.hp}/${mon.maxHp}`
      : 'Sem líder',
    fields: [
      { name: '🪙 Coins', value: String(poke.coins), inline: true },
      { name: '✅ Capturas', value: String(poke.catches), inline: true },
      { name: '⚔️ PvP', value: `${poke.wins}W / ${poke.losses}L`, inline: true },
      { name: '👥 Time', value: `${poke.team.length}/${poke.teamLimit}`, inline: true },
      { name: '📦 Caixa', value: `${poke.box.length}/${MAX_BOX}`, inline: true },
      {
        name: 'Buffs',
        value: [
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

  // heal to full for fair pvp snapshot
  for (const id of battle.ids) {
    const m = battle.players[id].mon;
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
  if (wPoke.team[0]) gainXp(wPoke.team[0], 40);
  saveData(data);

  message.channel.send({
    title: '🏆 Fim de batalha!',
    description: [
      ...preamble,
      '',
      `Vencedor: <@${winnerId}> (+80 🪙)`,
      `Derrota: <@${loserId}>`
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
    color: 0x2ecc71
  });
  return false;
}

function showTeamInline(team) {
  return team.map((m, i) => `${i + 1}. **${m.name}** Nv.${m.level}`).join('\n');
}

function rarityColor(r) {
  return (
    {
      common: 0x95a5a6,
      uncommon: 0x2ecc71,
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
