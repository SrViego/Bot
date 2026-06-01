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
    message.reply('Use: !coinflip cara|coroa aposta');
    return;
  }

  const result = Math.random() < 0.5 ? 'cara' : 'coroa';
  const won = choice === result;
  userData.minigames.lastCoinflipAt = Date.now();

  if (won) {
    userData.points += bet;
    userData.minigames.wins += 1;
    message.reply(`Deu ${result}. Voce ganhou ${bet} pontos. Saldo: ${userData.points}.`);
  } else {
    userData.points -= bet;
    userData.minigames.losses += 1;
    message.reply(`Deu ${result}. Voce perdeu ${bet} pontos. Saldo: ${userData.points}.`);
  }

  saveData(data);
}

function playGuess(message, args, data) {
  const userData = getUserData(data, message.guild.id, message.author.id);
  if (!checkCooldown(message, userData, 'lastGuessAt')) return;

  const guess = Number(args[1]);
  const bet = parseBet(args[2], userData.points);

  if (!Number.isInteger(guess) || guess < 1 || guess > 5 || !bet) {
    message.reply('Use: !guess numero_de_1_a_5 aposta');
    return;
  }

  const result = Math.floor(Math.random() * 5) + 1;
  const won = guess === result;
  userData.minigames.lastGuessAt = Date.now();

  if (won) {
    const prize = bet * 4;
    userData.points += prize;
    userData.minigames.wins += 1;
    message.reply(`O numero era ${result}. Voce acertou e ganhou ${prize} pontos. Saldo: ${userData.points}.`);
  } else {
    userData.points -= bet;
    userData.minigames.losses += 1;
    message.reply(`O numero era ${result}. Voce perdeu ${bet} pontos. Saldo: ${userData.points}.`);
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

  message.reply(`${target} tem ${wins} vitoria(s), ${losses} derrota(s) e ${rate}% de aproveitamento nos minigames.`);
}

function checkCooldown(message, userData, field) {
  const lastPlayedAt = userData.minigames[field] ?? 0;
  const now = Date.now();

  if (lastPlayedAt && now - lastPlayedAt < gameCooldown) {
    const seconds = Math.ceil((gameCooldown - (now - lastPlayedAt)) / 1000);
    message.reply(`Espere ${seconds}s antes de jogar esse minigame de novo.`);
    return false;
  }

  return true;
}

function normalizeCoin(value) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (['cara', 'heads', 'h'].includes(normalized)) return 'cara';
  if (['coroa', 'tails', 't'].includes(normalized)) return 'coroa';
  return null;
}

function parseBet(value, points) {
  const bet = Number(value);
  if (!Number.isInteger(bet) || bet < 1 || bet > 500 || bet > points) return null;
  return bet;
}

module.exports = {
  handleMinigameCommand
};
