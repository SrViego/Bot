const { getUserData, saveData } = require('./database');

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

  const choice = normalizeCoin(args[1]);
  const bet = parseBet(args[2], userData.points);

  if (!choice || !bet) {
    message.reply({
      title: '🪙 Coinflip',
      description: 'Use: `!coinflip cara|coroa aposta`'
    });
    return;
  }

  const result = Math.random() < 0.5 ? 'cara' : 'coroa';
  const won = choice === result;
  const emoji = result === 'cara' ? '🟡' : '⚪';
  userData.minigames.lastCoinflipAt = Date.now();

  if (won) {
    userData.points += bet;
    userData.minigames.wins += 1;
    message.reply({
      title: '🪙 Deu ' + result + '!',
      description: `${emoji} A moeda caiu em **${result}**.\n${message.author} apostou em **${choice}** e **ganhou**!`,
      fields: [
        { name: '💵 Lucro', value: `**+${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ],
      color: 0xe7644d
    });
  } else {
    userData.points -= bet;
    userData.minigames.losses += 1;
    message.reply({
      title: '🪙 Deu ' + result + '!',
      description: `${emoji} A moeda caiu em **${result}**.\n${message.author} apostou em **${choice}** e **perdeu**.`,
      fields: [
        { name: '📉 Perda', value: `**-${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ],
      color: 0xe74c3c
    });
  }

  saveData(data);
}

function playGuess(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  if (!checkCooldown(message, userData, 'lastGuessAt')) return;

  const guess = Number(args[1]);
  const bet = parseBet(args[2], userData.points);

  if (!Number.isInteger(guess) || guess < 1 || guess > 5 || !bet) {
    message.reply({
      title: '🎯 Adivinhe o número',
      description: 'Use: `!guess numero_de_1_a_5 aposta`\nPrêmio: **4×** a aposta se acertar!'
    });
    return;
  }

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
      color: 0xe7644d
    });
  } else {
    userData.points -= bet;
    userData.minigames.losses += 1;
    message.reply({
      title: '🎯 Errou!',
      description: `O número secreto era **${result}**.\n${message.author} chutou **${guess}**.`,
      fields: [
        { name: '📉 Perda', value: `**-${bet}**`, inline: true },
        { name: '🏦 Saldo', value: `**${userData.points}**`, inline: true }
      ],
      color: 0xe74c3c
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
      color: 0xf1c40f
    });
    return false;
  }
  return true;
}

function normalizeCoin(value) {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'cara' || v === 'coroa') return v;
  return null;
}

function parseBet(raw, points) {
  const bet = Number(raw);
  if (!Number.isInteger(bet) || bet <= 0) return null;
  if (bet > points) return null;
  return bet;
}

module.exports = {
  handleMinigameCommand
};
