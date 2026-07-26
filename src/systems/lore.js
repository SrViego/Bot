/**
 * Sabor Hallownest — citações e lore aleatória.
 */

const { theme } = require('./theme');

const QUOTES = [
  { t: 'Hornet', q: 'Não se esqueça… a força que você busca pode destruir você.' },
  { t: 'Quirrel', q: 'É fácil se perder nestas terras. Eu mesmo já me perdi mais de uma vez.' },
  { t: 'Elderbug', q: 'Dirtmouth já foi mais viva… mas ainda há calor no lar, se você souber procurar.' },
  { t: 'Cornifer', q: 'Mapas, mapas! O mundo fica menor quando se entende o caminho.' },
  { t: 'Iselda', q: 'Meu marido some no mapa e eu fico com a loja. Clássico.' },
  { t: 'Sly', q: 'Um bom negócio é aquele em que os dois saem achando que ganharam.' },
  { t: 'Zote', q: 'Eu sou o cavaleiro mais forte que estas terras já viram! …provavelmente.' },
  { t: 'Cloth', q: 'Às vezes a coragem é só dar o próximo passo, mesmo com medo.' },
  { t: 'The Last Stag', q: 'As estações ainda lembram dos trilhos. Eu também.' },
  { t: 'Myla', q: '♪ Lá lá lá… as pedras cantam se você escuta com o coração.' },
  { t: 'Relic Seeker Lemm', q: 'Relíquias contam histórias que os vivos já esqueceram.' },
  { t: 'Divine', q: 'Ahh… o cheiro da ambição. Delicioso.' },
  { t: 'Tiso', q: 'A Coliseu me espera. A glória também. Eu acho.' },
  { t: 'Bretta', q: 'Um dia meu cavaleiro vai aparecer… um dia.' },
  { t: 'Nailmaster Sheo', q: 'A lâmina reflete quem a empunha. Pinte com cuidado.' },
  { t: 'Oro', q: 'Força sem controle é só barulho.' },
  { t: 'Mato', q: 'Irmãos brigam. Irmãos também protegem.' },
  { t: 'White Lady', q: 'Raízes profundas ainda sentem o vento da coroa.' },
  { t: 'Pale King', q: 'Pelo bem do reino… o custo foi além da medida.' },
  { t: 'The Knight', q: '…' },
  { t: 'Seer', q: 'A essência flui. Sonhos são só outra estrada.' },
  { t: 'Grimm', q: 'A trupe chegou. A dança pede fogo e brilho.' },
  { t: 'Midwife', q: 'Tão pequenino… e tão cheio de segredos.' },
  { t: 'Salubra', q: 'Encantamentos são carinho pro casco cansado.' },
  { t: 'Leg Eater', q: 'Tem gosto de… legenda. Heheh.' },
  { t: 'Confessor Jiji', q: 'Confesse seus arrependimentos. Eu guardo o resto.' },
  { t: 'Jinn', q: '…ovos… rancores… trocas justas…' },
  { t: 'Millibelle', q: 'Seu geo está seguro comigo. Pode confiar. De verdade.' },
  { t: 'Nailsmith', q: 'Cada golpe na bigorna é uma oração em aço.' },
  { t: 'Godseeker', q: 'Deuses… deuses em toda parte… attune… attune!' }
];

const FACTS = [
  'Dirtmouth fica acima da vasta rede de cavernas de Hallownest.',
  'O Trem de Stag liga estações esquecidas por todo o reino.',
  'A Cidade das Lágrimas nunca para de chover — a chuva vem do lago acima.',
  'Greenpath é o domínio de Unn e do musgo vivo.',
  'Deepnest não é um bom lugar pra piquenique.',
  'O Coliseu dos Tolos recompensa ousadia… e pune arrogância.',
  'Soul Sanctum experimentou além do que a alma deveria suportar.',
  'Crystal Peak brilha com minério e perigo em igual medida.',
  'Kingdom\'s Edge guarda cinzas e o peso do fim.',
  'A Trupe de Grimm só aparece onde o ritual for aceito.',
  'O Templo do Ovo Negro guarda o que o reino tentou selar.',
  'Monarch Wings não se ganham barato.',
  'Geo é a moeda — mas conhecimento às vezes vale mais.',
  'O Mantis Village respeita força verdadeira.',
  'Em Hallownest, até o silêncio tem eco.'
];

function handleLoreCommand(message) {
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  if (!['!lore', '!hallownest', '!citacao', '!citação', '!hk'].includes(command)) {
    return false;
  }

  const sub = (args[1] || 'random').toLowerCase();

  if (sub === 'fato' || sub === 'fact') {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    message.reply({
      title: '📜 Lore · Hallownest',
      description: fact,
      color: theme.color
    });
    return true;
  }

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  message.reply({
    title: `📜 ${quote.t}`,
    description: `*“${quote.q}”*`,
    footer: { text: `${theme.footer} · !lore fato` },
    color: theme.color
  });
  return true;
}

module.exports = {
  handleLoreCommand,
  QUOTES,
  FACTS
};
