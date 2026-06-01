const { getUserData, saveData } = require('./database');
const { grantAchievements, notifyAchievements } = require('./achievements');

const shopItems = [
  {
    id: 'cafe',
    name: 'Cafe de Dirtmouth',
    category: 'consumivel',
    price: 50,
    sellPrice: 25,
    description: 'Um cafe simples para guardar no inventario.'
  },
  {
    id: 'amuleto',
    name: 'Amuleto Brilhante',
    category: 'colecionavel',
    price: 150,
    sellPrice: 75,
    description: 'Item colecionavel da loja de pontos.'
  },
  {
    id: 'mapa',
    name: 'Mapa Antigo',
    category: 'colecionavel',
    price: 250,
    sellPrice: 125,
    description: 'Para quem gosta de explorar Hallownest.'
  },
  {
    id: 'coroa',
    name: 'Coroa Palida',
    category: 'raro',
    price: 750,
    sellPrice: 375,
    description: 'Item caro para ostentar no inventario.'
  },
  {
    id: 'banco',
    name: 'Banco de Descanso',
    category: 'raro',
    price: 1000,
    sellPrice: 500,
    description: 'Uma lembranca rara para colecionadores.'
  },
  {
    id: 'lanterna',
    name: 'Lanterna Lumafly',
    category: 'utilidade',
    price: 400,
    sellPrice: 200,
    description: 'Ilumina ate as cavernas mais esquecidas.'
  }
];

function handleShopCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!loja' || command === '!shop') {
    showShop(message, args);
    return true;
  }

  if (command === '!item') {
    showItem(message, args);
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

  return false;
}

function showShop(message, args) {
  const category = args[1]?.toLowerCase();
  const items = category ? shopItems.filter((item) => item.category === category) : shopItems;

  if (items.length === 0) {
    message.reply('Categoria nao encontrada. Categorias: consumivel, colecionavel, raro, utilidade.');
    return;
  }

  const categories = [...new Set(shopItems.map((item) => item.category))].join(', ');
  const lines = items.map((item) => {
    return `**${item.id}** - ${item.name} - ${item.price} pontos (${item.category})`;
  });

  message.reply(`Loja de pontos:\n${lines.join('\n')}\n\nCategorias: ${categories}\nUse: !item id, !comprar id, !vender id, !presentear @usuario id`);
}

function showItem(message, args) {
  const item = findItem(args[1]);

  if (!item) {
    message.reply('Item nao encontrado. Use !loja para ver os itens disponiveis.');
    return;
  }

  message.reply([
    `**${item.name}** (${item.id})`,
    `Categoria: ${item.category}`,
    `Preco: ${item.price} pontos`,
    `Venda: ${item.sellPrice} pontos`,
    item.description
  ].join('\n'));
}

function buyItem(message, args, data) {
  const item = findItem(args[1]);

  if (!item) {
    message.reply('Item nao encontrado. Use !loja para ver os itens disponiveis.');
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);

  if (userData.points < item.price) {
    message.reply(`Voce precisa de ${item.price} pontos para comprar **${item.name}**. Voce tem ${userData.points}.`);
    return;
  }

  userData.points -= item.price;
  userData.inventory[item.id] = (userData.inventory[item.id] ?? 0) + 1;
  userData.stats.purchases += 1;

  const unlocked = updateShopAchievements(userData);
  saveData(data);

  message.reply(`Voce comprou **${item.name}** por ${item.price} pontos. Saldo atual: ${userData.points}.`);
  notifyAchievements(message, unlocked);
}

function sellItem(message, args, data) {
  const item = findItem(args[1]);

  if (!item) {
    message.reply('Item nao encontrado. Use !inventario para ver seus itens.');
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const amount = userData.inventory[item.id] ?? 0;

  if (amount <= 0) {
    message.reply(`Voce nao tem **${item.name}** no inventario.`);
    return;
  }

  userData.inventory[item.id] -= 1;
  userData.points += item.sellPrice;
  saveData(data);

  message.reply(`Voce vendeu **${item.name}** por ${item.sellPrice} pontos. Saldo atual: ${userData.points}.`);
}

function giftItem(message, args, data) {
  const target = message.mentions.users.first();
  const itemId = args[2];
  const item = findItem(itemId);

  if (!target || !item) {
    message.reply('Use: !presentear @usuario id_do_item');
    return;
  }

  if (target.bot || target.id === message.author.id) {
    message.reply('Escolha outro usuario para presentear.');
    return;
  }

  const senderData = getUserData(data, message.guild.id, message.author.id);
  const amount = senderData.inventory[item.id] ?? 0;

  if (amount <= 0) {
    message.reply(`Voce nao tem **${item.name}** no inventario.`);
    return;
  }

  const targetData = getUserData(data, message.guild.id, target.id);
  senderData.inventory[item.id] -= 1;
  targetData.inventory[item.id] = (targetData.inventory[item.id] ?? 0) + 1;
  saveData(data);

  message.channel.send(`${message.author} presenteou ${target} com **${item.name}**.`);
}

function showInventory(message, data) {
  const target = message.mentions.users.first() ?? message.author;
  const userData = getUserData(data, message.guild.id, target.id);
  const entries = Object.entries(userData.inventory).filter(([, amount]) => amount > 0);

  if (entries.length === 0) {
    message.reply(`${target} ainda nao tem itens no inventario.`);
    return;
  }

  const lines = entries.map(([itemId, amount]) => {
    const item = findItem(itemId);
    const name = item ? item.name : itemId;
    return `${name} (${itemId}) x${amount}`;
  });

  message.reply(`Inventario de ${target}:\n${lines.join('\n')}`);
}

function useItem(message, args, data) {
  const item = findItem(args[1]);

  if (!item) {
    message.reply('Item nao encontrado. Use !inventario para ver seus itens.');
    return;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const amount = userData.inventory[item.id] ?? 0;

  if (amount <= 0) {
    message.reply(`Voce nao tem **${item.name}** no inventario.`);
    return;
  }

  userData.inventory[item.id] -= 1;
  saveData(data);

  message.reply(`${message.author} usou **${item.name}**.`);
}

function updateShopAchievements(userData) {
  const unlocked = grantAchievements(userData, ['first_purchase']);
  const itemTypes = Object.values(userData.inventory).filter((amount) => amount > 0).length;
  if (itemTypes >= 3) unlocked.push(...grantAchievements(userData, ['collector']));
  return unlocked;
}

function findItem(itemId) {
  if (!itemId) return null;
  return shopItems.find((item) => item.id === itemId.toLowerCase());
}

module.exports = {
  handleShopCommand,
  shopItems
};
