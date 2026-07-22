const fs = require('node:fs');
const path = require('node:path');

// Dados estáticos em data/ (separados do runtime database.json)
const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'pokemon-data.json'), 'utf8')
);

/** @type {Map<number, object>} */
const byId = new Map(raw.map((p) => [p.id, p]));
/** @type {Map<string, object>} */
const byName = new Map(raw.map((p) => [p.name.toLowerCase(), p]));

const TYPE_CHART = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 2,
    Bug: 2,
    Rock: 0.5,
    Dragon: 0.5,
    Steel: 2
  },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: {
    Water: 2,
    Electric: 0.5,
    Grass: 0.5,
    Ground: 0,
    Flying: 2,
    Dragon: 0.5
  },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
    Steel: 0.5
  },
  Ice: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Ice: 0.5,
    Ground: 2,
    Flying: 2,
    Dragon: 2,
    Steel: 0.5
  },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Rock: 2,
    Ghost: 0,
    Dark: 2,
    Steel: 2,
    Fairy: 0.5
  },
  Poison: {
    Grass: 2,
    Poison: 0.5,
    Ground: 0.5,
    Rock: 0.5,
    Ghost: 0.5,
    Steel: 0,
    Fairy: 2
  },
  Ground: {
    Fire: 2,
    Electric: 2,
    Grass: 0.5,
    Poison: 2,
    Flying: 0,
    Bug: 0.5,
    Rock: 2,
    Steel: 2
  },
  Flying: {
    Electric: 0.5,
    Grass: 2,
    Fighting: 2,
    Bug: 2,
    Rock: 0.5,
    Steel: 0.5
  },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: {
    Fire: 0.5,
    Grass: 2,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 2,
    Ghost: 0.5,
    Dark: 2,
    Steel: 0.5,
    Fairy: 0.5
  },
  Rock: {
    Fire: 2,
    Ice: 2,
    Fighting: 0.5,
    Ground: 0.5,
    Flying: 2,
    Bug: 2,
    Steel: 0.5
  },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: {
    Fire: 0.5,
    Water: 0.5,
    Electric: 0.5,
    Ice: 2,
    Rock: 2,
    Steel: 0.5,
    Fairy: 2
  },
  Fairy: {
    Fire: 0.5,
    Fighting: 2,
    Poison: 0.5,
    Dragon: 2,
    Dark: 2,
    Steel: 0.5
  }
};

const TYPE_EMOJI = {
  Normal: '⚪',
  Fire: '🔥',
  Water: '💧',
  Electric: '⚡',
  Grass: '🌿',
  Ice: '❄️',
  Fighting: '🥊',
  Poison: '☠️',
  Ground: '🌍',
  Flying: '🪶',
  Psychic: '🔮',
  Bug: '🐛',
  Rock: '🪨',
  Ghost: '👻',
  Dragon: '🐉',
  Dark: '🌑',
  Steel: '⚙️',
  Fairy: '✨'
};

const RARITY_WEIGHT = {
  common: 70,
  uncommon: 22,
  rare: 7,
  legendary: 1
};

const RARITY_CATCH = {
  common: 0.55,
  uncommon: 0.35,
  rare: 0.18,
  legendary: 0.06
};

function getAllPokemon() {
  return raw;
}

function getPokemon(idOrName) {
  if (idOrName == null || idOrName === '') return null;
  const n = Number(idOrName);
  if (Number.isInteger(n) && byId.has(n)) return byId.get(n);
  const key = String(idOrName).toLowerCase().replace(/\s+/g, '-');
  return byName.get(key) || byName.get(key.replace(/-/g, ' ')) || null;
}

function typeEffectiveness(moveType, defenderTypes) {
  let mult = 1;
  const chart = TYPE_CHART[moveType] || {};
  for (const t of defenderTypes || []) {
    if (chart[t] != null) mult *= chart[t];
  }
  return mult;
}

function formatTypes(types) {
  return (types || []).map((t) => `${TYPE_EMOJI[t] || ''} ${t}`).join(' · ');
}

function bst(p) {
  return (p.stats || []).reduce((a, b) => a + b, 0);
}

function pickWeightedRarity() {
  const entries = Object.entries(RARITY_WEIGHT);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, w] of entries) {
    roll -= w;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

function randomWildSpecies() {
  const rarity = pickWeightedRarity();
  const pool = raw.filter((p) => p.rarity === rarity);
  const list = pool.length ? pool : raw;
  return list[Math.floor(Math.random() * list.length)];
}

function spriteUrl(id) {
  // artwork oficial (funciona no Discord)
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function spriteIcon(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

module.exports = {
  getAllPokemon,
  getPokemon,
  typeEffectiveness,
  formatTypes,
  bst,
  randomWildSpecies,
  spriteUrl,
  spriteIcon,
  TYPE_EMOJI,
  TYPE_CHART,
  RARITY_CATCH,
  TOTAL: raw.length
};
