const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { createEmbed, theme } = require('./theme');

const HELP_PAGES = [
  {
    title: '📕 Guia da Morgana · Geral',
    description: 'Página **1/6** — visão geral.\nBotões abaixo ou `!ajuda 2`, `!ajuda 3`…',
    fields: [
      {
        name: '🌿 Novo aqui?',
        value:
          '`!inicio` / `/inicio` — **trilho da 1ª semana** (daily → chat → quest → padaria → poke → perfil)\nRecompensa ao completar tudo.'
      },
      {
        name: '🛠️ Utilidade',
        value:
          '`!ping` `!ajuda [página]` `!avatar` `!userinfo` `!serverinfo` `!say` `!limpeza`\n`!ticket` · `!serverstats` · `!lore`'
      },
      {
        name: '🌿 Perfil & social',
        value: '`!perfil` `!cosmetico` `!conquistas` `!rep @user` `!casar` `!starboard` (staff)'
      },
      {
        name: '⭐ XP & quests',
        value: '`!xp` `!rankxp` · `!quest` / `!quest pegar` (diárias + semanais)'
      }
    ]
  },
  {
    title: '📕 Guia · Economia & loja',
    description: 'Página **2/6** — pontos, câmbio, apostas e loja.',
    fields: [
      {
        name: '💰 Pontos',
        value: '`!pontos` `!daily` `!rankpontos` `!efeitos`'
      },
      {
        name: '💱 Câmbio (taxa 35%)',
        value: '`!cambio pontos|padaria|poke <de> <para> <qtd>`\nEx: `!cambio pontos padaria 100`'
      },
      {
        name: '🏪 Loja & cosméticos',
        value:
          '`!loja` · `!cosmetico loja` `!cosmetico comprar id` `!cosmetico equipar id`'
      },
      {
        name: '🎲 Minigames & apostas',
        value:
          '`!coinflip cara|coroa aposta` · `!guess` · `!apostar cara|coroa pts` (próximo flip)'
      }
    ]
  },
  {
    title: '📕 Guia · Padaria',
    description:
      'Página **3/6** — idle + upgrades + pedidos NPC.\n**Só no canal da padaria** · moedas ≠ pontos/poke.',
    fields: [
      {
        name: '📍 Canal',
        value: process.env.BAKERY_CHANNEL_ID
          ? `Comandos da padaria apenas em <#${process.env.BAKERY_CHANNEL_ID}>`
          : 'Configure `BAKERY_CHANNEL_ID` no `.env`'
      },
      {
        name: '🔁 Loop',
        value: '`!assar receita` → espera → `!servir` → 🪙 + XP da padaria'
      },
      {
        name: '🥖 Comandos',
        value:
          '`!padaria` `!assar [qtd]` `!repetir` `!historico` `!servir` `!receitas` `!forno` `!upgrade` `!pedido` `!fornonotify` `!rankpadaria`'
      },
      {
        name: '⬆️ Upgrades & multi-forno',
        value:
          '`!assar pao 3` · `!assar pao tudo` · `!repetir 2` · `!historico`\n`!upgrade speed|profit|mastery|luck|charm` · `!pedido novo`'
      }
    ]
  },
  {
    title: '📕 Guia · Música',
    description: 'Página **4/6** — precisa do Lavalink (Docker ou local).',
    fields: [
      {
        name: '🎵 Comandos',
        value:
          '`!play` / `!p` · `!skip` · `!stop` · `!queue` / `!fila`\n`!pause` · `!resume` · `!np` · `!volume 1-100`'
      },
      {
        name: '📌 Dica',
        value: 'Permissões: **Conectar** e **Falar** no canal de voz. Conta pra quests de música.'
      }
    ]
  },
  {
    title: '📕 Guia · Eventos & staff',
    description: 'Página **5/6** — eventos de servidor e moderação.',
    fields: [
      {
        name: '🎪 Eventos',
        value:
          '`!evento status`\nStaff: `!evento happyhour [min]` · `padaria` · `praid` · `boss [meta]` · `parar`'
      },
      {
        name: '⭐ Starboard',
        value: '`!starboard canal #destaques` · `!starboard min 3` · `!starboard off`'
      },
      {
        name: '⚙️ Config (Gerenciar Servidor)',
        value:
          '`!config` / `!painel`\n`!config logs #canal|off`\n`!config autorole @cargo|off`\n`!config welcome on|off`\n`!config goodbye on|off`'
      },
      {
        name: '🛡️ Moderação',
        value:
          '`!ban` `!unban` `!kick` `!timeout` `!untimeout`\n`!warn` `!warnings` `!clearwarns`\n`!clear` `!limpeza` `!slowmode` `!lock` `!unlock` `!modlogs`'
      },
      {
        name: '🎫 Tickets / ajuda',
        value:
          'Membros: `!ticket [motivo]`\nStaff: `!fechar` · `!addticket @user` · `!tickets`\nConfig: `!config ticket*` (categoria + cargo)'
      }
    ]
  },
  {
    title: '📕 Guia · Pokémon',
    description:
      'Página **6/6** — **apenas no canal Pokémon**.\nPokédex nacional · loja 🪙 · PvP.',
    fields: [
      {
        name: '🌱 Início & captura',
        value: '`!phelp` `!pstart` `!pwild` `!pcatch [ball]` `!pdex nome|nº` `!pdaily`'
      },
      {
        name: '👥 Time',
        value: '`!pteam` `!pbox` `!padd #` `!premove #` `!pswap a b` `!pstatus`'
      },
      {
        name: '🏪 Loja Pokémon (pokécoins)',
        value: '`!ploja` `!pbuy id` `!pbag` `!puse id`'
      },
      {
        name: '⚔️ PvP',
        value: '`!pbattle @user` `!paccept` `!pdeny` `!pmove 1-4` `!pforfeit`'
      }
    ]
  }
];

function clampPage(n) {
  const page = parseInt(n, 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(HELP_PAGES.length, page);
}

function buildHelpPayload(page, userId) {
  const idx = clampPage(page) - 1;
  const p = HELP_PAGES[idx];

  const embed = createEmbed(p.description, {
    title: p.title,
    fields: p.fields,
    footer: {
      text: `${theme.footer} · página ${idx + 1}/${HELP_PAGES.length}`
    },
    color: theme.color
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:prev:${userId}:${idx + 1}`)
      .setLabel('Anterior')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx === 0),
    new ButtonBuilder()
      .setCustomId(`help:noop:${userId}:${idx + 1}`)
      .setLabel(`${idx + 1} / ${HELP_PAGES.length}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`help:next:${userId}:${idx + 1}`)
      .setLabel('Próxima')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx >= HELP_PAGES.length - 1)
  );

  return { embeds: [embed], components: [row] };
}

async function showHelp(message, pageArg) {
  let currentPage = clampPage(pageArg);
  const payload = buildHelpPayload(currentPage, message.author.id);
  const sent = await message.reply(payload);

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000
  });

  collector.on('collect', async (interaction) => {
    try {
      const parts = interaction.customId.split(':');
      const action = parts[1];
      const ownerId = parts[2];
      let page = Number(parts[3]) || 1;

      if (interaction.user.id !== ownerId) {
        await interaction.reply({
          content: 'Só quem usou `!ajuda` pode trocar de página.',
          ephemeral: true
        });
        return;
      }

      if (action === 'prev') page -= 1;
      else if (action === 'next') page += 1;
      else if (action === 'noop') {
        await interaction.deferUpdate();
        return;
      }

      currentPage = clampPage(page);
      await interaction.update(buildHelpPayload(currentPage, ownerId));
    } catch (err) {
      console.error('help collect:', err);
    }
  });

  collector.on('end', async () => {
    try {
      await sent.edit({
        embeds: buildHelpPayload(currentPage, message.author.id).embeds,
        components: []
      });
    } catch {
      /* ignore */
    }
  });
}

function handleHelpCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  if (cmd !== '!help' && cmd !== '!ajuda') return false;

  showHelp(message, args[1]).catch((err) => {
    console.error('help error:', err);
  });
  return true;
}

module.exports = {
  handleHelpCommand,
  showHelp,
  HELP_PAGES
};
