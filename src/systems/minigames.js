const { getUserData, saveData } = require('./database');
const { theme } = require('./theme');
const { settlePendingBets } = require('./bets');
const { trackQuest } = require('./quests');

const gameCooldown = 30 * 1000;

function handleMinigameCommand(message, data) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!coinflip' || command === '!moeda') {
    playCoinflip(message, args, data);
    return true;
  }

  if (command === '!guess' || command === '!adivinhar') {
    playGuess(message, args, data);
    return true;
  }

  if (command === '!minigames') {
    showMinigameStats(message, data);
    return true;
  }

  return false;
}

function playCoinflip(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  if (!checkCooldown(message, userData, 'lastCoinflipAt')) return;

  // Aceita: !coinflip cara 50  |  !coinflip 50 cara  |  aliases
  const parsed = parseCoinflipArgs(args.slice(1), userData.points);

  if (parsed.error === 'usage') {
    message.reply({
      title: '🪙 Coinflip',
      description: [
        'Use: `!coinflip cara|coroa <aposta>`',
        'Também: `!coinflip <aposta> cara|coroa`',
        'Aliases: `heads/tails`, `h/t`, `c/k` · aposta `all` / `tudo`',
        `Seu saldo: **${userData.points}** pontos`
      ].join('\n'),
      color: theme.color
    });
    return;
  }

  if (parsed.error === 'choice') {
    message.reply({
      title: '🪙 Lado inválido',
      description: 'Escolha **cara** ou **coroa** (também: `heads`/`tails`, `h`/`t`, `c`/`k`).',
      color: theme.colorWarn
    });
    return;
  }

  if (parsed.error === 'bet') {
    message.reply({
      title: '🪙 Aposta inválida',
      description: 'A aposta precisa ser um **número inteiro ≥ 1** (ou `all` / `tudo`).',
      color: theme.colorWarn
    });
    return;
  }

  if (parsed.error === 'broke') {
    message.reply({
      title: '🪙 Sem pontos',
      description: 'Você está com **0** pontos. Use `!daily` ou fale no chat pra juntar XP/pontos.',
      color: theme.colorError
    });
    return;
  }

  if (parsed.error === 'funds') {
    message.reply({
      title: '🪙 Saldo insuficiente',
      description: `Você tem **${userData.points}** pontos e tentou apostar **${parsed.wanted}**.`,
      color: theme.colorError
    });
    return;
  }

  const { choice, bet } = parsed;
  const result = Math.random() < 0.5 ? 'cara' : 'coroa';
  const won = choice === result;
  const emoji = result === 'cara' ? '🟡' : '⚪';

  // só gasta cooldown quando a rodada de fato roda
  userData.minigames.lastCoinflipAt = Date.now();

  if (won) {
    // odds 1:1 → lucro = aposta (fica com o dobro do valor arriscado)
    userData.points += bet;
    userData.minigames.wins += 1;
  } else {
    userData.points = Math.max(0, userData.points - bet);
    userData.minigames.losses += 1;
  }

  trackQuest(data, message.guild.id, message.author.id, 'minigame', 1, false);
  const betLines = settlePendingBets(data, message.guild.id, result);

  const fields = won
    ? [
        { name: '💵 Lucro', value: `**+${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ]
    : [
        { name: '📉 Perda', value: `**-${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ];

  if (betLines) {
    fields.push({ name: '🎲 Apostas da galera', value: betLines.slice(0, 1000), inline: false });
  }

  message.reply({
    title: `🪙 Deu ${result}!`,
    description: won
      ? `${emoji} A moeda caiu em **${result}**.\n${message.author} apostou em **${choice}** e **ganhou**!`
      : `${emoji} A moeda caiu em **${result}**.\n${message.author} apostou em **${choice}** e **perdeu**.`,
    fields,
    color: won ? theme.color : theme.colorError
  });

  saveData(data);
}

/**
 * @returns {{ choice: string, bet: number } | { error: string, wanted?: number }}
 */
function parseCoinflipArgs(tokens, points) {
  if (!tokens.length) return { error: 'usage' };

  let choiceRaw = null;
  let betRaw = null;

  if (tokens.length === 1) {
    // só um arg: pode ser lado (falta aposta) ou aposta (falta lado)
    if (normalizeCoin(tokens[0])) return { error: 'usage' };
    if (parseBetValue(tokens[0], points).ok || tokens[0].toLowerCase() === 'all' || tokens[0].toLowerCase() === 'tudo') {
      return { error: 'usage' };
    }
    return { error: 'usage' };
  }

  const a = tokens[0];
  const b = tokens[1];

  if (normalizeCoin(a) && !normalizeCoin(b)) {
    choiceRaw = a;
    betRaw = b;
  } else if (normalizeCoin(b) && !normalizeCoin(a)) {
    // !coinflip 50 cara
    betRaw = a;
    choiceRaw = b;
  } else if (normalizeCoin(a) && normalizeCoin(b)) {
    // dois lados? inválido
    return { error: 'choice' };
  } else {
    // tenta choice + bet na ordem normal
    choiceRaw = a;
    betRaw = b;
  }

  const choice = normalizeCoin(choiceRaw);
  if (!choice) return { error: 'choice' };

  if (points <= 0) return { error: 'broke' };

  const betResult = parseBetValue(betRaw, points);
  if (!betResult.ok) {
    if (betResult.reason === 'funds') {
      return { error: 'funds', wanted: betResult.wanted };
    }
    return { error: 'bet' };
  }

  return { choice, bet: betResult.bet };
}

function playGuess(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  if (!checkCooldown(message, userData, 'lastGuessAt')) return;

  const guess = Number(args[1]);
  const betResult = parseBetValue(args[2], userData.points);

  if (!Number.isInteger(guess) || guess < 1 || guess > 5) {
    message.reply({
      title: '🎯 Adivinhe o número',
      description: 'Use: `!guess <1-5> <aposta>`\nPrêmio: **4×** a aposta se acertar!\nAposta também aceita `all` / `tudo`.',
      color: theme.color
    });
    return;
  }

  if (!betResult.ok) {
    if (userData.points <= 0) {
      message.reply({
        title: '🎯 Sem pontos',
        description: 'Você está com **0** pontos.',
        color: theme.colorError
      });
      return;
    }
    if (betResult.reason === 'funds') {
      message.reply({
        title: '🎯 Saldo insuficiente',
        description: `Você tem **${userData.points}** e tentou apostar **${betResult.wanted}**.`,
        color: theme.colorError
      });
      return;
    }
    message.reply({
      title: '🎯 Adivinhe o número',
      description: 'Use: `!guess <1-5> <aposta>`\nPrêmio: **4×** a aposta se acertar!',
      color: theme.color
    });
    return;
  }

  const bet = betResult.bet;
  const result = Math.floor(Math.random() * 5) + 1;
  const won = guess === result;
  userData.minigames.lastGuessAt = Date.now();

  if (won) {
    const prize = bet * 4;
    userData.points += prize;
    userData.minigames.wins += 1;
    message.reply({
      title: '🎯 Acertou!',
      description: `O número secreto era **${result}**.\n${message.author} chutou **${guess}** e mandou bem!`,
      fields: [
        { name: '💵 Prêmio', value: `**+${prize}** (4×)`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ],
      color: theme.color
    });
  } else {
    userData.points = Math.max(0, userData.points - bet);
    userData.minigames.losses += 1;
    message.reply({
      title: '🎯 Errou!',
      description: `O número secreto era **${result}**.\n${message.author} chutou **${guess}**.`,
      fields: [
        { name: '📉 Perda', value: `**-${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ],
      color: theme.colorError
    });
  }

  saveData(data);
}

function showMinigameStats(message, data) {
  const target = message.mentions.users.first() ?? message.author;
  const userData = getUserData(data, message.guild.id, target.id);
  const wins = userData.minigames.wins;
  const losses = userData.minigames.losses;
  const total = wins + losses;
  const rate = total === 0 ? 0 : Math.round((wins / total) * 100);

  message.reply({
    title: '🎮 Minigames',
    description: `${target}`,
    thumbnail: target.displayAvatarURL({ size: 128 }),
    fields: [
      { name: '🏆 Vitórias', value: `**${wins}**`, inline: true },
      { name: '💀 Derrotas', value: `**${losses}**`, inline: true },
      { name: '📊 Aproveitamento', value: `**${rate}%**`, inline: true }
    ]
  });
}

function checkCooldown(message, userData, field) {
  const lastPlayedAt = userData.minigames[field] ?? 0;
  const now = Date.now();
  if (now - lastPlayedAt < gameCooldown) {
    const secs = Math.ceil((gameCooldown - (now - lastPlayedAt)) / 1000);
    message.reply({
      title: '⏳ Calma aí',
      description: `Espere **${secs}s** para jogar de novo.`,
      color: theme.colorWarn
    });
    return false;
  }
  return true;
}

function normalizeCoin(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (['cara', 'heads', 'head', 'h', 'c', 'frente'].includes(v)) return 'cara';
  if (['coroa', 'tails', 'tail', 't', 'k', 'verso'].includes(v)) return 'coroa';
  return null;
}

/**
 * @returns {{ ok: true, bet: number } | { ok: false, reason: string, wanted?: number }}
 */
function parseBetValue(raw, points) {
  if (raw == null || raw === '') return { ok: false, reason: 'invalid' };

  const s = String(raw).toLowerCase();
  if (s === 'all' || s === 'tudo' || s === 'max') {
    if (!Number.isInteger(points) || points <= 0) return { ok: false, reason: 'funds', wanted: points };
    return { ok: true, bet: points };
  }

  const bet = Number(raw);
  if (!Number.isInteger(bet) || bet <= 0) return { ok: false, reason: 'invalid' };
  if (bet > points) return { ok: false, reason: 'funds', wanted: bet };
  return { ok: true, bet };
}

module.exports = {
  handleMinigameCommand
};
