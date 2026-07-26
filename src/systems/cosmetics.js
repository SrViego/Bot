/**
 * Cosméticos de perfil (molduras, títulos, badges) — sink de pontos.
 */

const { getUserData, saveData } = require('./database');
const { theme } = require('./theme');

/** @type {{ id: string, name: string, emoji: string, type: 'title'|'frame'|'badge', price: number, currency: 'points'|'bakery', unlockLevel?: number }[]} */
const COSMETICS = [
  { id: 'title_baker', name: 'Padeiro de Dirtmouth', emoji: '🥖', type: 'title', price: 350, currency: 'points' },
  { id: 'title_hunter', name: 'Caçador de Hallownest', emoji: '🗡️', type: 'title', price: 450, currency: 'points' },
  { id: 'title_radiant', name: 'Brilho da Radiância', emoji: '✨', type: 'title', price: 900, currency: 'points' },
  { id: 'title_dough', name: 'Mestre da Massa', emoji: '🥐', type: 'title', price: 280, currency: 'bakery' },
  { id: 'title_trainer', name: 'Treinador Hallownest', emoji: '🔴', type: 'title', price: 400, currency: 'points' },
  { id: 'frame_coral', name: 'Moldura Coral', emoji: '🖼️', type: 'frame', price: 220, currency: 'points' },
  { id: 'frame_void', name: 'Moldura do Vazio', emoji: '⬛', type: 'frame', price: 550, currency: 'points' },
  { id: 'frame_gold', name: 'Moldura Dourada', emoji: '🟨', type: 'frame', price: 420, currency: 'bakery' },
  { id: 'badge_first', name: 'Badge Primeiro Pão', emoji: '🍞', type: 'badge', price: 120, currency: 'bakery' },
  { id: 'badge_shiny', name: 'Badge Shiny', emoji: '🌟', type: 'badge', price: 650, currency: 'points' },
  { id: 'badge_dj', name: 'Badge DJ', emoji: '🎧', type: 'badge', price: 280, currency: 'points' },
  { id: 'badge_boss', name: 'Badge Matador de Chefe', emoji: '👹', type: 'badge', price: 0, currency: 'points' } // special grant
];

function ensureCosmetics(userData) {
  if (!userData.cosmetics || typeof userData.cosmetics !== 'object') {
    userData.cosmetics = { owned: [], title: null, frame: null, badges: [] };
  }
  const c = userData.cosmetics;
  if (!Array.isArray(c.owned)) c.owned = [];
  if (!Array.isArray(c.badges)) c.badges = [];
  if (c.title === undefined) c.title = null;
  if (c.frame === undefined) c.frame = null;
  return c;
}

function findCosmetic(id) {
  return COSMETICS.find((x) => x.id === id || x.id === `title_${id}` || x.name.toLowerCase().includes(String(id).toLowerCase()));
}

function handleCosmeticsCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (!['!cosmetico', '!cosmético', '!cosmetics', '!skin', '!skins', '!titulo', '!título'].includes(command)) {
    return false;
  }

  const userData = getUserData(data, message.guild.id, message.author.id);
  const cos = ensureCosmetics(userData);
  const sub = (args[1] || 'loja').toLowerCase();

  if (sub === 'loja' || sub === 'shop' || sub === 'list') {
    const lines = COSMETICS.filter((c) => c.price > 0).map((c) => {
      const owned = cos.owned.includes(c.id) ? ' ✅' : '';
      const cur = c.currency === 'bakery' ? '🪙 padaria' : 'pts';
      return `${c.emoji} \`${c.id}\` **${c.name}** · ${c.price} ${cur}${owned}`;
    });
    message.reply({
      title: '✨ Loja de cosméticos',
      description: [
        '`!cosmetico comprar <id>` · `!cosmetico equipar <id>` · `!cosmetico perfil`',
        '',
        lines.join('\n')
      ].join('\n'),
      color: theme.color
    });
    return true;
  }

  if (sub === 'perfil' || sub === 'eu' || sub === 'me') {
    const owned = cos.owned.length
      ? cos.owned.map((id) => {
          const c = COSMETICS.find((x) => x.id === id);
          return c ? `${c.emoji} ${c.name}` : id;
        }).join('\n')
      : '*nada ainda*';
    message.reply({
      title: '✨ Seus cosméticos',
      fields: [
        { name: 'Título', value: cos.title || '*nenhum*', inline: true },
        { name: 'Moldura', value: cos.frame || '*nenhuma*', inline: true },
        { name: 'Badges', value: cos.badges?.length ? cos.badges.join(' ') : '*—*', inline: true },
        { name: 'Inventário', value: owned.slice(0, 1000), inline: false }
      ],
      color: theme.color
    });
    return true;
  }

  if (sub === 'comprar' || sub === 'buy') {
    const id = args[2];
    const item = findCosmetic(id);
    if (!item || item.price <= 0) {
      message.reply({
        title: '✨ Item inválido',
        description: 'Use um id da loja: `!cosmetico loja`',
        color: theme.colorError
      });
      return true;
    }
    if (cos.owned.includes(item.id)) {
      message.reply({
        title: '✨ Já possui',
        description: `${item.emoji} **${item.name}** já está no seu inventário. Equipe com \`!cosmetico equipar ${item.id}\``,
        color: theme.colorWarn
      });
      return true;
    }
    if (item.currency === 'bakery') {
      if (!userData.bakery) userData.bakery = { coins: 0 };
      if ((userData.bakery.coins || 0) < item.price) {
        message.reply({
          title: '🪙 Padaria insuficiente',
          description: `Custa **${item.price}** 🪙 padaria · você tem **${userData.bakery.coins || 0}**.`,
          color: theme.colorError
        });
        return true;
      }
      userData.bakery.coins -= item.price;
    } else {
      if ((userData.points || 0) < item.price) {
        message.reply({
          title: '💰 Pontos insuficientes',
          description: `Custa **${item.price}** pts · você tem **${userData.points || 0}**.`,
          color: theme.colorError
        });
        return true;
      }
      userData.points -= item.price;
    }
    cos.owned.push(item.id);
    saveData(data);
    message.reply({
      title: '✨ Comprado!',
      description: `${item.emoji} **${item.name}**\nEquipe: \`!cosmetico equipar ${item.id}\``,
      color: theme.color
    });
    return true;
  }

  if (sub === 'equipar' || sub === 'equip' || sub === 'usar') {
    const id = args[2];
    const item = findCosmetic(id);
    if (!item || !cos.owned.includes(item.id)) {
      message.reply({
        title: '✨ Não encontrado',
        description: 'Compre primeiro na loja ou confira o id com `!cosmetico perfil`.',
        color: theme.colorError
      });
      return true;
    }
    if (item.type === 'title') {
      cos.title = `${item.emoji} ${item.name}`;
      userData.equippedTitle = cos.title;
    } else if (item.type === 'frame') {
      cos.frame = `${item.emoji} ${item.name}`;
    } else if (item.type === 'badge') {
      if (!cos.badges.includes(item.emoji)) cos.badges.push(item.emoji);
    }
    saveData(data);
    message.reply({
      title: '✨ Equipado',
      description: `${item.emoji} **${item.name}** agora aparece no seu perfil.`,
      color: theme.color
    });
    return true;
  }

  message.reply({
    title: '✨ Cosméticos',
    description: '`!cosmetico loja` · `comprar` · `equipar` · `perfil`',
    color: theme.color
  });
  return true;
}

function grantCosmetic(userData, cosmeticId) {
  const cos = ensureCosmetics(userData);
  if (!cos.owned.includes(cosmeticId)) cos.owned.push(cosmeticId);
  const item = COSMETICS.find((c) => c.id === cosmeticId);
  if (item?.type === 'badge' && item.emoji && !cos.badges.includes(item.emoji)) {
    cos.badges.push(item.emoji);
  }
}

function profileCosmeticLines(userData) {
  const cos = ensureCosmetics(userData);
  const parts = [];
  if (cos.frame) parts.push(cos.frame);
  if (cos.badges?.length) parts.push(cos.badges.join(' '));
  return parts.join(' · ');
}

module.exports = {
  handleCosmeticsCommand,
  ensureCosmetics,
  grantCosmetic,
  profileCosmeticLines,
  COSMETICS
};
