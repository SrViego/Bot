/**
 * Música — ainda delega ao handler legado (Lavalink),
 * mas entra pelo registry (aliases + métricas).
 */
const { handleMusicCommand } = require('../systems/music');
const { register } = require('./registry');

const MUSIC_NAMES = [
  'play',
  'p',
  'skip',
  'stop',
  'queue',
  'fila',
  'pause',
  'resume',
  'continuar',
  'np',
  'tocando',
  'volume'
];

register({
  name: 'play',
  aliases: MUSIC_NAMES.filter((n) => n !== 'play'),
  description: 'Música (Lavalink): play, skip, queue…',
  category: 'music',
  // slash de música fica pra depois (opções complexas)
  slash: false,
  prefixOnly: true,
  legacyMessageHandler: handleMusicCommand
});
