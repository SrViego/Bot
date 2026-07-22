const {
  getUserData,
  saveData,
  hasActiveEffect,
  getEffectRemainingMs
} = require('./database');
const { grantAchievements, notifyAchievements } = require('./achievements');
const { theme } = require('./theme');

const CATEGORY_META = {
  consumivel: { emoji: '☕', label: 'Consumível', color: 0xe67e22 },
  colecionavel: { emoji: '💎', label: 'Colecionável', color: 0x9b59b6 },
  raro: { emoji: '👑', label: 'Raro', color: 0xf1c40f },
  utilidade: { emoji: '🔧', label: 'Utilidade', color: 0x3498db },
  titulo: { emoji: '🏷️', label: 'Título', color: 0x1abc9c }
};

/**
 * use: tipo de efeito ao !usar
 *  - points: ganha pontos aleatórios
 *  - xpBoost: multiplica XP por durationMs
 *  - dailyBoost: bônus no próximo daily
 *  - luck: mensagem + pequena chance de pontos
 *  - title: equipa título no perfil
 *  - showcase: só ostenta (não consome se keepOnUse)
 *  - healFlavor: só narrativa
 */
const shopItems = [
  {
    id: 'cafe',
    name: 'Café de Dirtmouth',
    emoji: '☕',
    category: 'consumivel',
    price: 50,
    sellPrice: 25,
    description: 'Esquenta a alma. Ao usar, recupera um pouco de pontos.',
    use: { type: 'points', min: 15, max: 40 }
  },
  {
    id: 'cha',
    name: 'Chá da Vidente',
    emoji: '🍵',
    category: 'consumivel',
    price: 80,
    sellPrice: 40,
    description: 'Visões leves. Chance de bônus extra de pontos.',
    use: { type: 'luck', min: 20, max: 60, bonusChance: 0.25, bonus: 50 }
  },
  {
    id: 'bolo',
    name: 'Bolo do Pão de Ovo',
    emoji: '🍰',
    category: 'consumivel',
    price: 120,
    sellPrice: 55,
    description: 'Doce demais. Cura a carteira… um pouco.',
    use: { type: 'points', min: 40, max: 90 }
  },
  {
    id: 'amuleto',
    name: 'Amuleto Brilhante',
    emoji: '✨',
    category: 'colecionavel',
    price: 150,
    sellPrice: 75,
    description: 'Brilha no inventário. Use para exibir com orgulho.',
    use: { type: 'showcase' }
  },
  {
    id: 'mapa',
    name: 'Mapa Antigo',
    emoji: '🗺️',
    category: 'colecionavel',
    price: 250,
    sellPrice: 125,
    description: 'Marcado com rotas de Hallownest.',
    use: { type: 'showcase' }
  },
  {
    id: 'mask',
    name: 'Fragmento de Máscara',
    emoji: '🎭',
    category: 'colecionavel',
    price: 300,
    sellPrice: 140,
    description: 'Quase um pedaço de vida. Só coleção.',
    use: { type: 'showcase' }
  },
  {
    id: 'coroa',
    name: 'Coroa Pálida',
    emoji: '👑',
    category: 'raro',
    price: 750,
    sellPrice: 375,
    description: 'Para quem manda no salão. Ostentação máxima.',
    use: { type: 'showcase' }
  },
  {
    id: 'banco',
    name: 'Banco de Descanso',
    emoji: '🪑',
    category: 'raro',
    price: 1000,
    sellPrice: 500,
    description: 'Relíquia rara de colecionador.',
    use: { type: 'showcase' }
  },
  {
    id: 'geo',
    name: 'Saco de Geo',
    emoji: '💰',
    category: 'raro',
    price: 600,
    sellPrice: 200,
    description: 'Ao abrir, solta uma chuva de pontos.',
    use: { type: 'points', min: 200, max: 450 }
  },
  {
    id: 'lanterna',
    name: 'Lanterna Lumafly',
    emoji: '🏮',
    category: 'utilidade',
    price: 400,
    sellPrice: 200,
    description: 'Por 1h, você ganha **+50% XP** ao conversar.',
    use: { type: 'xpBoost', durationMs: 60 * 60 * 1000, mult: 1.5 }
  },
  {
    id: 'relogio',
    name: 'Relógio do Tempo',
    emoji: '⏰',
    category: 'utilidade',
    price: 350,
    sellPrice: 160,
    description: 'O próximo `!daily` rende **+50%** de pontos.',
    use: { type: 'dailyBoost', mult: 1.5 }
  },
  {
    id: 'pocao',
    name: 'Poção de Foco',
    emoji: '🧪',
    category: 'utilidade',
    price: 280,
    sellPrice: 120,
    description: 'Por 30 min, XP ao conversar com **+100%**.',
    use: { type: 'xpBoost', durationMs: 30 * 60 * 1000, mult: 2 }
  },
  {
    id: 'titulo_cavaleiro',
    name: 'Título: Cavaleiro',
    emoji: '⚔️',
    category: 'titulo',
    price: 500,
    sellPrice: 100,
    description: 'Equipa o título **Cavaleiro** no perfil.',
    use: { type: 'title', title: '⚔️ Cavaleiro' }
  },
  {
    id: 'titulo_sonhador',
    name: 'Título: Sonhador',
    emoji: '🌙',
    category: 'titulo',
    price: 500,
    sellPrice: 100,
    description: 'Equipa o título **Sonhador** no perfil.',
    use: { type: 'title', title: '🌙 Sonhador' }
  },
  {
    id: 'titulo_mercador',
    name: 'Título: Mercador',
    emoji: '🏪',
    category: 'titulo',
    price: 450,
    sellPrice: 90,
    description: 'Equipa o título **Mercador de Dirtmouth**.',
    use: { type: 'title', title: '🏪 Mercador' }
  }
];

function handleShopCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!loja' || command === '!shop') {
    showShop(message, args, data);
    return true;
  }

  if (command === '!item') {
    showItem(message, args, data);
    return true;
  }

  if (command === '!comprar' || command === '!buy') {
    buyItem(message, args, data);
    return true;
  }

  if (command === '!vender' || command === '!sell') {
    sellItem(message, args, data);
    return true;
  }

  if (command === '!presentear' || command === '!gift') {
    giftItem(message, args, data);
    return true;
  }

  if (command === '!inventario' || command === '!inv') {
    showInventory(message, data);
    return true;
  }

  if (command === '!usar') {
    useItem(message, args, data);
    return true;
  }

  if (command === '!efeitos' || command === '!buffs') {
    showEffects(message, data);
    return true;
  }

  return false;
}

function showShop(message, args, data) {
  const category = args[1]?.toLowerCase();
  const userData = getUserData(data, message.guild.id, message.author.id);
  const categories = Object.keys(CATEGORY_META);

  if (category && !categories.includes(category) && category !== 'tudo' && category !== 'all') {
    message.reply({
      title: '🏪 Loja de Dirtmouth',
      description: [
        'Categoria inválida.',
        '',
        '**Categorias:**',
        categories.map((c) => `${CATEGORY_META[c].emoji} \`${c}\``).join(' · '),
        '',
        'Use `!loja` ou `!loja consumivel`'
      ].join('\n')
    });
    return;
  }

  const filterAll = !category || category === 'tudo' || category === 'all';
  const items = filterAll
    ? shopItems
    : shopItems.filter((item) => item.category === category);

  if (items.length === 0) {
    message.reply({
      title: '🏪 Loja',
      description: 'Nenhum item nessa categoria.'
    });
    return;
  }

  // Agrupa por categoria se loja completa
  if (filterAll) {
    const fields = categories
      .map((cat) => {
        const list = shopItems.filter((i) => i.category === cat);
        if (!list.length) return null;
        const meta = CATEGORY_META[cat];
        const lines = list
          .map((i) => `${i.emoji} \`${i.id}\` **${i.name}** — **${i.price}** pts`)
          .join('\n');
        return {
          name: `${meta.emoji} ${meta.label}`,
          value: lines.slice(0, 1020),
          inline: false
        };
      })
      .filter(Boolean);

    message.reply({
      title: '🏪 Loja de Dirtmouth',
      description: [
        `Bem-vindo, ${message.author}!`,
        `Seu saldo: **${userData.points}** pontos`,
        '',
        'Comandos: `!item id` · `!comprar id [qtd]` · `!vender id [qtd]`',
        '`!inventario` · `!usar id` · `!presentear @user id` · `!efeitos`',
        `Filtrar: \`!loja ${categories[0]}\``
      ].join('\n'),
      fields,
      thumbnail: message.client.user.displayAvatarURL({ size: 128 }),
      color: theme.color
    });
    return;
  }

  const meta = CATEGORY_META[category];
  const lines = items.map(
    (i) =>
      `${i.emoji} \`${i.id}\` **${i.name}**\n└ ${i.price} pts · vende por ${i.sellPrice} · ${i.description}`
  );

  message.reply({
    title: `${meta.emoji} Loja · ${meta.label}`,
    description: `${message.author} · saldo **${userData.points}** pts\n\n${lines.join('\n\n')}`.slice(
      0,
      4000
    ),
    color: meta.color,
    footer: { text: 'Use !item id para detalhes · !comprar id [quantidade]' }
  });
}

function showItem(message, args, data) {
  const item = findItem(args[1]);
  const userData = getUserData(data, message.guild.id, message.author.id);

  if (!item) {
    message.reply({
      title: '❓ Item não encontrado',
      description: 'Use `!loja` para ver os IDs disponíveis.'
    });
    return;
  }

  const meta = CATEGORY_META[item.category] ?? { emoji: '📦', label: item.category, color: theme.color };
  const owned = userData.inventory[item.id] ?? 0;
  const canBuy = userData.points >= item.price;
  const useText = describeUse(item);

  message.reply({
    title: `${item.emoji} ${item.name}`,
    description: item.description,
    color: meta.color,
    fields: [
      { name: '🆔 ID', value: `\`${item.id}\``, inline: true },
      { name: '📂 Categoria', value: `${meta.emoji} ${meta.label}`, inline: true },
      { name: '🎒 Você tem', value: `**${owned}**`, inline: true },
      { name: '💰 Preço', value: `**${item.price}** pts`, inline: true },
      { name: '💸 Venda', value: `**${item.sellPrice}** pts`, inline: true },
      { name: '🛒 Pode comprar?', value: canBuy ? '✅ Sim' : '❌ Pontos insuficientes', inline: true },
      { name: '✨ Ao usar', value: useText, inline: false }
    ],
    footer: { text: `!comprar ${item.id}  ·  !usar ${item.id}  ·  !vender ${item.id}` }
  });
}

function buyItem(message, args, data) {
  const item = findItem(args[1]);
  const qty = parseQty(args[2], 1);

  if (!item) {
    message.reply({
      title: '❓ Item não encontrado',
      description: 'Use `!loja` para ver os itens.'
    });
    return;
  }

  if (!qty) {
    message.reply({
      title: '🛒 Compra',
      description: 'Quantidade inválida. Use `!comprar id` ou `!comprar id 3` (máx. 20).'
    });
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const total = item.price * qty;

  if (userData.points < total) {
    message.reply({
      title: '💸 Pontos insuficientes',
      description: [
        `Você quer **${qty}× ${item.emoji} ${item.name}**.`,
        `Custo: **${total}** pts · Você tem: **${userData.points}** pts`,
        `Faltam: **${total - userData.points}** pts`
      ].join('\n'),
      color: 0xe74c3c
    });
    return;
  }

  userData.points -= total;
  userData.inventory[item.id] = (userData.inventory[item.id] ?? 0) + qty;
  userData.stats.purchases += qty;

  const unlocked = updateShopAchievements(userData);
  saveData(data);

  message.reply({
    title: '🛍️ Compra realizada!',
    description: `${message.author} comprou na loja de Dirtmouth.`,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
    fields: [
      { name: 'Item', value: `${item.emoji} **${item.name}** ×${qty}`, inline: true },
      { name: 'Gastou', value: `**${total}** pts`, inline: true },
      { name: 'Saldo', value: `**${userData.points}** pts`, inline: true },
      { name: 'No inventário', value: `**${userData.inventory[item.id]}**`, inline: true }
    ],
    color: 0x2ecc71
  });
  notifyAchievements(message, unlocked);
}

function sellItem(message, args, data) {
  const item = findItem(args[1]);
  const qty = parseQty(args[2], 1);

  if (!item) {
    message.reply({
      title: '❓ Item não encontrado',
      description: 'Use `!inventario` para ver seus itens.'
    });
    return;
  }

  if (!qty) {
    message.reply({
      title: '💸 Venda',
      description: 'Use `!vender id` ou `!vender id 3`.'
    });
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const amount = userData.inventory[item.id] ?? 0;

  if (amount < qty) {
    message.reply({
      title: '🎒 Sem estoque',
      description: `Você tem **${amount}×** ${item.emoji} **${item.name}**, mas tentou vender **${qty}**.`,
      color: 0xe74c3c
    });
    return;
  }

  const gain = item.sellPrice * qty;
  userData.inventory[item.id] -= qty;
  if (userData.inventory[item.id] <= 0) delete userData.inventory[item.id];
  userData.points += gain;
  saveData(data);

  message.reply({
    title: '💸 Venda concluída',
    description: `${message.author} vendeu itens de volta à loja.`,
    fields: [
      { name: 'Item', value: `${item.emoji} **${item.name}** ×${qty}`, inline: true },
      { name: 'Recebeu', value: `**+${gain}** pts`, inline: true },
      { name: 'Saldo', value: `**${userData.points}** pts`, inline: true }
    ]
  });
}

function giftItem(message, args, data) {
  const target = message.mentions.users.first();
  // !presentear @user id  OR  !presentear id @user
  let itemId = args[2];
  if (!itemId || itemId.startsWith('<@')) {
    itemId = args.find((a, i) => i > 0 && !a.startsWith('<@') && !a.startsWith('!'));
  }
  const item = findItem(itemId);

  if (!target || !item) {
    message.reply({
      title: '🎁 Presentear',
      description: 'Use: `!presentear @usuario id_do_item`'
    });
    return;
  }

  if (target.bot || target.id === message.author.id) {
    message.reply({
      title: '🎁 Presentear',
      description: 'Escolha outro usuário (não bots e não você mesmo).',
      color: 0xf1c40f
    });
    return;
  }

  const senderData = getUserData(data, message.guild.id, message.author.id);
  const amount = senderData.inventory[item.id] ?? 0;

  if (amount <= 0) {
    message.reply({
      title: '🎒 Sem item',
      description: `Você não tem ${item.emoji} **${item.name}**.`,
      color: 0xe74c3c
    });
    return;
  }

  const targetData = getUserData(data, message.guild.id, target.id);
  senderData.inventory[item.id] -= 1;
  if (senderData.inventory[item.id] <= 0) delete senderData.inventory[item.id];
  targetData.inventory[item.id] = (targetData.inventory[item.id] ?? 0) + 1;
  senderData.stats.giftsSent = (senderData.stats.giftsSent ?? 0) + 1;
  saveData(data);

  message.channel.send({
    title: '🎁 Presente entregue!',
    description: `${message.author} presenteou ${target} com carinho.`,
    fields: [
      { name: 'Item', value: `${item.emoji} **${item.name}**`, inline: true },
      { name: 'De', value: `${message.author}`, inline: true },
      { name: 'Para', value: `${target}`, inline: true }
    ],
    thumbnail: target.displayAvatarURL({ size: 128 }),
    color: 0xe91e63
  });
}

function showInventory(message, data) {
  const target = message.mentions.users.first() ?? message.author;
  const userData = getUserData(data, message.guild.id, target.id);
  const entries = Object.entries(userData.inventory).filter(([, amount]) => amount > 0);

  if (entries.length === 0) {
    message.reply({
      title: '🎒 Inventário',
      description: `${target} ainda não tem itens.\nPasse na loja com \`!loja\`!`,
      thumbnail: target.displayAvatarURL({ size: 128 })
    });
    return;
  }

  const byCat = {};
  for (const [itemId, amount] of entries) {
    const item = findItem(itemId);
    const cat = item?.category ?? 'outro';
    if (!byCat[cat]) byCat[cat] = [];
    const emoji = item?.emoji ?? '📦';
    const name = item?.name ?? itemId;
    byCat[cat].push(`${emoji} **${name}** (\`${itemId}\`) ×**${amount}**`);
  }

  const fields = Object.entries(byCat).map(([cat, lines]) => {
    const meta = CATEGORY_META[cat] ?? { emoji: '📦', label: cat };
    return {
      name: `${meta.emoji} ${meta.label}`,
      value: lines.join('\n').slice(0, 1020),
      inline: false
    };
  });

  const titleLine = userData.equippedTitle
    ? `\nTítulo equipado: **${userData.equippedTitle}**`
    : '';

  message.reply({
    title: `🎒 Inventário de ${target.username}`,
    description: `${target}${titleLine}\nSaldo: **${userData.points}** pts · Itens: **${entries.length}** tipo(s)`,
    thumbnail: target.displayAvatarURL({ size: 128 }),
    fields,
    footer: { text: '!usar id  ·  !vender id [qtd]  ·  !efeitos' }
  });
}

function useItem(message, args, data) {
  const item = findItem(args[1]);

  if (!item) {
    message.reply({
      title: '❓ Item não encontrado',
      description: 'Use `!inventario` para ver seus itens.'
    });
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const amount = userData.inventory[item.id] ?? 0;

  if (amount <= 0) {
    message.reply({
      title: '🎒 Sem item',
      description: `Você não tem ${item.emoji} **${item.name}**.`,
      color: 0xe74c3c
    });
    return;
  }

  const use = item.use ?? { type: 'showcase' };
  const result = applyUseEffect(message, userData, item, use);

  if (result.error) {
    message.reply({
      title: '✨ Não foi possível usar',
      description: result.error,
      color: 0xf1c40f
    });
    return;
  }

  // Consome item (títulos e showcase também consomem 1, exceto se keepOnUse)
  if (!use.keepOnUse) {
    userData.inventory[item.id] -= 1;
    if (userData.inventory[item.id] <= 0) delete userData.inventory[item.id];
  }

  userData.stats.itemsUsed = (userData.stats.itemsUsed ?? 0) + 1;
  saveData(data);

  message.reply({
    title: result.title ?? `✨ Usou ${item.name}`,
    description: result.description,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
    fields: result.fields ?? [],
    color: result.color ?? CATEGORY_META[item.category]?.color ?? theme.color
  });
}

function applyUseEffect(message, userData, item, use) {
  const now = Date.now();

  switch (use.type) {
    case 'points': {
      const gain = randInt(use.min ?? 10, use.max ?? 30);
      userData.points += gain;
      return {
        title: `${item.emoji} ${item.name}`,
        description: `${message.author} usou **${item.name}** e se sente renovado!`,
        fields: [
          { name: '💰 Pontos', value: `**+${gain}**`, inline: true },
          { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
        ],
        color: 0x2ecc71
      };
    }
    case 'luck': {
      let gain = randInt(use.min ?? 10, use.max ?? 40);
      let bonusText = 'Sem sorte extra desta vez.';
      if (Math.random() < (use.bonusChance ?? 0.2)) {
        gain += use.bonus ?? 30;
        bonusText = `🌟 Sorte! Bônus de **+${use.bonus ?? 30}**!`;
      }
      userData.points += gain;
      return {
        title: `${item.emoji} ${item.name}`,
        description: `${message.author} usou **${item.name}**.\n${bonusText}`,
        fields: [
          { name: '💰 Total ganho', value: `**+${gain}**`, inline: true },
          { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
        ]
      };
    }
    case 'xpBoost': {
      if (hasActiveEffect(userData, 'xpBoostUntil')) {
        const left = Math.ceil(getEffectRemainingMs(userData, 'xpBoostUntil') / 60000);
        return { error: `Você já tem boost de XP ativo (~${left} min restantes).` };
      }
      const duration = use.durationMs ?? 30 * 60 * 1000;
      userData.effects.xpBoostUntil = now + duration;
      userData.effects.xpBoostMult = use.mult ?? 1.5;
      const mins = Math.round(duration / 60000);
      return {
        title: '⚡ Boost de XP!',
        description: `${message.author} acendeu **${item.name}**.\nXP ao conversar: **×${use.mult ?? 1.5}** por **${mins} min**.`,
        fields: [{ name: 'Expira', value: `<t:${Math.floor((now + duration) / 1000)}:R>`, inline: true }],
        color: 0x3498db
      };
    }
    case 'dailyBoost': {
      if (userData.effects.dailyBoostMult) {
        return { error: 'Você já tem um bônus de daily guardado. Use o `!daily` antes.' };
      }
      userData.effects.dailyBoostMult = use.mult ?? 1.5;
      return {
        title: '📅 Daily turbinado',
        description: `${message.author} preparou **${item.name}**.\nO próximo \`!daily\` rende **×${use.mult ?? 1.5}** pontos!`,
        color: 0x9b59b6
      };
    }
    case 'title': {
      userData.equippedTitle = use.title ?? item.name;
      return {
        title: '🏷️ Título equipado',
        description: `${message.author} agora carrega o título:\n## ${userData.equippedTitle}`,
        color: 0x1abc9c
      };
    }
    case 'showcase':
    default: {
      return {
        title: `${item.emoji} Exibição`,
        description: `${message.author} ergue **${item.name}** para todos verem!\n*${item.description}*`,
        color: 0x9b59b6
      };
    }
  }
}

function showEffects(message, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  const lines = [];

  if (hasActiveEffect(userData, 'xpBoostUntil')) {
    const mult = userData.effects.xpBoostMult ?? 1.5;
    const until = Math.floor(userData.effects.xpBoostUntil / 1000);
    lines.push(`⚡ **XP ×${mult}** — expira <t:${until}:R>`);
  }

  if (userData.effects.dailyBoostMult) {
    lines.push(`📅 **Daily ×${userData.effects.dailyBoostMult}** — próximo \`!daily\``);
  }

  if (userData.equippedTitle) {
    lines.push(`🏷️ Título: **${userData.equippedTitle}**`);
  }

  if (!lines.length) {
    message.reply({
      title: '✨ Efeitos ativos',
      description: `${message.author} não tem buffs no momento.\nCompre utilidades na \`!loja utilidade\`!`,
      thumbnail: message.author.displayAvatarURL({ size: 128 })
    });
    return;
  }

  message.reply({
    title: '✨ Efeitos ativos',
    description: `${message.author}\n\n${lines.join('\n')}`,
    thumbnail: message.author.displayAvatarURL({ size: 128 })
  });
}

function describeUse(item) {
  const use = item.use;
  if (!use) return 'Sem efeito especial.';
  switch (use.type) {
    case 'points':
      return `Ganha entre **${use.min}–${use.max}** pontos.`;
    case 'luck':
      return `Ganha pontos (+ chance de bônus).`;
    case 'xpBoost':
      return `Boost de XP **×${use.mult}** por ${Math.round((use.durationMs ?? 0) / 60000)} min.`;
    case 'dailyBoost':
      return `Próximo daily **×${use.mult}**.`;
    case 'title':
      return `Equipa título **${use.title}**.`;
    case 'showcase':
      return 'Exibe o item no chat (consome 1).';
    default:
      return 'Efeito especial.';
  }
}

function updateShopAchievements(userData) {
  const unlocked = grantAchievements(userData, ['first_purchase']);
  const itemTypes = Object.values(userData.inventory).filter((amount) => amount > 0).length;
  if (itemTypes >= 3) unlocked.push(...grantAchievements(userData, ['collector']));
  return unlocked;
}

function findItem(itemId) {
  if (!itemId) return null;
  const id = itemId.toLowerCase();
  return shopItems.find((item) => item.id === id || item.name.toLowerCase() === id) ?? null;
}

function parseQty(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  handleShopCommand,
  shopItems,
  hasActiveEffect,
  getEffectRemainingMs
};
