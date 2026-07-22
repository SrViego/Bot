/** Loja exclusiva do sistema Pokémon (pokécoins) */

const POKE_SHOP = [
  {
    id: 'pokeball',
    name: 'Poké Ball',
    emoji: '🔴',
    price: 100,
    description: 'Aumenta a chance de captura. Uso automático no !pcatch se tiver.',
    category: 'ball',
    catchBonus: 0.1
  },
  {
    id: 'greatball',
    name: 'Great Ball',
    emoji: '🔵',
    price: 250,
    description: 'Melhor que a Poké Ball.',
    category: 'ball',
    catchBonus: 0.2
  },
  {
    id: 'ultraball',
    name: 'Ultra Ball',
    emoji: '⚫',
    price: 600,
    description: 'Alta chance de captura.',
    category: 'ball',
    catchBonus: 0.35
  },
  {
    id: 'masterball',
    name: 'Master Ball',
    emoji: '🟣',
    price: 5000,
    description: 'Captura garantida (1 uso).',
    category: 'ball',
    catchBonus: 1
  },
  {
    id: 'potion',
    name: 'Potion',
    emoji: '🧪',
    price: 150,
    description: 'Cura 40 HP do Pokémon ativo na batalha (auto).',
    category: 'heal',
    heal: 40
  },
  {
    id: 'superpotion',
    name: 'Super Potion',
    emoji: '🧴',
    price: 350,
    description: 'Cura 80 HP do Pokémon ativo.',
    category: 'heal',
    heal: 80
  },
  {
    id: 'hyperpotion',
    name: 'Hyper Potion',
    emoji: '💉',
    price: 700,
    description: 'Cura 150 HP do Pokémon ativo.',
    category: 'heal',
    heal: 150
  },
  {
    id: 'fullrestore',
    name: 'Full Restore',
    emoji: '✨',
    price: 1200,
    description: 'Cura total do Pokémon ativo.',
    category: 'heal',
    heal: 9999
  },
  {
    id: 'rarecandy',
    name: 'Rare Candy',
    emoji: '🍬',
    price: 2000,
    description: 'Sobe +1 nível no seu Pokémon ativo.',
    category: 'boost'
  },
  {
    id: 'expshare',
    name: 'Exp. Share',
    emoji: '📿',
    price: 1500,
    description: 'Próximas 10 capturas dão +50% XP ao time.',
    category: 'boost',
    charges: 10
  },
  {
    id: 'incense',
    name: 'Incenso Selvagem',
    emoji: '🌫️',
    price: 400,
    description: 'Reduz o cooldown de encontro selvagem em 50% (1h).',
    category: 'boost',
    durationMs: 60 * 60 * 1000
  },
  {
    id: 'teambag',
    name: 'Expansão de Time',
    emoji: '🎒',
    price: 3000,
    description: 'Aumenta o limite do time em +1 (máx. 6).',
    category: 'boost'
  }
];

function findPokeItem(id) {
  if (!id) return null;
  const key = String(id).toLowerCase();
  return POKE_SHOP.find((i) => i.id === key || i.name.toLowerCase() === key) || null;
}

module.exports = {
  POKE_SHOP,
  findPokeItem
};
