/**
 * Pipeline de pixel-art da padaria.
 *
 * - Desenha cena em buffer RGBA (lógica pixel)
 * - Exporta PNG (pngjs, pure JS — sem canvas nativo)
 * - Se existirem arquivos em assets/bakery/, usa como sprites
 * - Senão, fallback procedural (placeholders) até você colocar a arte
 *
 * Layout esperado (opcional):
 *   assets/bakery/bg.png
 *   assets/bakery/floor.png
 *   assets/bakery/counter.png
 *   assets/bakery/oven_idle.png
 *   assets/bakery/oven_cook.png
 *   assets/bakery/oven_ready.png
 *   assets/bakery/hud.png          (opcional faixa)
 *   assets/bakery/items/<id>.png   (pao, croissant, …)
 */

const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets', 'bakery');

// Resolução lógica (tiles) e escala final enviada ao Discord
const W = 160;
const H = 90;
const SCALE = 4; // 640×360 final

// Paleta Morgana / padaria (vermelho + madeira)
const C = {
  void: [20, 12, 16, 255],
  wall: [55, 28, 32, 255],
  wallDark: [36, 18, 22, 255],
  wallLight: [90, 42, 48, 255],
  beam: [120, 60, 40, 255],
  floor: [70, 40, 32, 255],
  floorLight: [95, 55, 42, 255],
  floorDark: [48, 28, 24, 255],
  counter: [110, 70, 48, 255],
  counterTop: [160, 100, 70, 255],
  oven: [50, 50, 55, 255],
  ovenDark: [30, 30, 34, 255],
  ovenHot: [231, 100, 77, 255],
  ovenReady: [247, 159, 91, 255],
  ovenIdle: [80, 80, 90, 255],
  glass: [100, 160, 180, 180],
  text: [240, 224, 216, 255],
  textDim: [180, 140, 130, 255],
  gold: [247, 199, 103, 255],
  shadow: [0, 0, 0, 90],
  bread: [210, 160, 90, 255],
  breadDark: [160, 110, 55, 255],
  pink: [231, 100, 77, 255],
  cream: [245, 220, 190, 255],
  chocolate: [90, 50, 30, 255],
  green: [80, 140, 70, 255]
};

const spriteCache = new Map();

class PixelBuf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
    this.clear(C.void);
  }

  idx(x, y) {
    return (y * this.w + x) * 4;
  }

  clear(rgba) {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = rgba[0];
      this.data[i + 1] = rgba[1];
      this.data[i + 2] = rgba[2];
      this.data[i + 3] = rgba[3];
    }
  }

  set(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = rgba[3] / 255;
    if (a <= 0) return;
    const i = this.idx(x, y);
    if (a >= 1) {
      this.data[i] = rgba[0];
      this.data[i + 1] = rgba[1];
      this.data[i + 2] = rgba[2];
      this.data[i + 3] = 255;
      return;
    }
    // alpha blend
    const ia = 1 - a;
    this.data[i] = Math.round(rgba[0] * a + this.data[i] * ia);
    this.data[i + 1] = Math.round(rgba[1] * a + this.data[i + 1] * ia);
    this.data[i + 2] = Math.round(rgba[2] * a + this.data[i + 2] * ia);
    this.data[i + 3] = 255;
  }

  fillRect(x, y, w, h, rgba) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgba);
    }
  }

  rect(x, y, w, h, rgba) {
    for (let xx = x; xx < x + w; xx++) {
      this.set(xx, y, rgba);
      this.set(xx, y + h - 1, rgba);
    }
    for (let yy = y; yy < y + h; yy++) {
      this.set(x, yy, rgba);
      this.set(x + w - 1, yy, rgba);
    }
  }

  /** Desenha sprite PNG (ou PixelBuf) em (dx,dy). nearest-neighbor se sw/sh != sprite */
  blit(src, dx, dy, opts = {}) {
    if (!src) return;
    const sw = src.width ?? src.w;
    const sh = src.height ?? src.h;
    const sdata = src.data;
    const flipX = opts.flipX;
    const tw = opts.w ?? sw;
    const th = opts.h ?? sh;

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const sx = Math.min(sw - 1, Math.floor((x * sw) / tw));
        const sy = Math.min(sh - 1, Math.floor((y * sh) / th));
        const srcX = flipX ? sw - 1 - sx : sx;
        const si = (sy * sw + srcX) * 4;
        const a = sdata[si + 3];
        if (a === 0) continue;
        this.set(dx + x, dy + y, [sdata[si], sdata[si + 1], sdata[si + 2], a]);
      }
    }
  }

  scaleNearest(factor) {
    const out = new PixelBuf(this.w * factor, this.h * factor);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const sx = Math.floor(x / factor);
        const sy = Math.floor(y / factor);
        const i = this.idx(sx, sy);
        const oi = out.idx(x, y);
        out.data[oi] = this.data[i];
        out.data[oi + 1] = this.data[i + 1];
        out.data[oi + 2] = this.data[i + 2];
        out.data[oi + 3] = this.data[i + 3];
      }
    }
    return out;
  }

  toPngBuffer() {
    const png = new PNG({ width: this.w, height: this.h });
    this.data.copy(png.data);
    return PNG.sync.write(png);
  }
}

function loadSprite(relPath) {
  const key = relPath;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const full = path.join(ASSETS_DIR, relPath);
  if (!fs.existsSync(full)) {
    spriteCache.set(key, null);
    return null;
  }
  try {
    const png = PNG.sync.read(fs.readFileSync(full));
    const sprite = { width: png.width, height: png.height, data: png.data };
    spriteCache.set(key, sprite);
    return sprite;
  } catch (err) {
    console.error('bakery sprite load failed:', relPath, err.message);
    spriteCache.set(key, null);
    return null;
  }
}

/** Invalida cache (útil se trocar assets sem reiniciar em dev) */
function clearSpriteCache() {
  spriteCache.clear();
}

function drawProceduralBackground(buf) {
  // parede
  buf.fillRect(0, 0, W, 52, C.wall);
  // listras de tijolo
  for (let y = 0; y < 52; y += 6) {
    for (let x = 0; x < W; x++) {
      if (((x + (y % 12 === 0 ? 0 : 4)) % 8) === 0) buf.set(x, y, C.wallDark);
    }
    buf.fillRect(0, y, W, 1, C.wallDark);
  }
  // viga
  buf.fillRect(0, 48, W, 4, C.beam);
  // chão
  buf.fillRect(0, 52, W, H - 52, C.floor);
  for (let y = 52; y < H; y += 4) {
    for (let x = 0; x < W; x += 8) {
      buf.fillRect(x + (y % 8), y, 4, 2, C.floorLight);
    }
  }
  // rodapé
  buf.fillRect(0, 52, W, 2, C.floorDark);
}

function drawProceduralCounter(buf, x, y, w) {
  buf.fillRect(x, y, w, 10, C.counter);
  buf.fillRect(x, y, w, 3, C.counterTop);
  buf.fillRect(x, y + 9, w, 1, C.floorDark);
}

function drawProceduralOven(buf, x, y, state) {
  // corpo
  buf.fillRect(x, y, 22, 20, C.oven);
  buf.fillRect(x + 1, y + 1, 20, 18, C.ovenDark);
  // porta / vidro
  let glass = C.ovenIdle;
  if (state === 'cook') glass = C.ovenHot;
  if (state === 'ready') glass = C.ovenReady;
  buf.fillRect(x + 4, y + 5, 14, 10, glass);
  buf.rect(x + 4, y + 5, 14, 10, C.oven);
  // pés
  buf.fillRect(x + 2, y + 20, 4, 3, C.ovenDark);
  buf.fillRect(x + 16, y + 20, 4, 3, C.ovenDark);
  // botão
  buf.set(x + 18, y + 3, state === 'ready' ? C.gold : C.textDim);
  // vapor se assando
  if (state === 'cook') {
    buf.set(x + 8, y - 1, [255, 255, 255, 120]);
    buf.set(x + 10, y - 2, [255, 255, 255, 100]);
    buf.set(x + 12, y - 1, [255, 255, 255, 80]);
  }
  // brilho se pronto
  if (state === 'ready') {
    buf.fillRect(x + 6, y + 7, 10, 2, [255, 220, 150, 160]);
  }
}

function drawProceduralItem(buf, x, y, recipeId) {
  // mini ícones 8×8 por tipo
  const map = {
    pao: () => {
      buf.fillRect(x + 1, y + 3, 6, 3, C.bread);
      buf.fillRect(x + 2, y + 2, 4, 1, C.breadDark);
    },
    croissant: () => {
      buf.fillRect(x + 1, y + 4, 6, 2, C.bread);
      buf.set(x, y + 3, C.bread);
      buf.set(x + 7, y + 3, C.bread);
    },
    cookie: () => {
      buf.fillRect(x + 2, y + 2, 4, 4, C.breadDark);
      buf.set(x + 3, y + 3, C.chocolate);
      buf.set(x + 4, y + 4, C.chocolate);
    },
    muffin: () => {
      buf.fillRect(x + 2, y + 4, 4, 3, C.pink);
      buf.fillRect(x + 1, y + 3, 6, 2, C.cream);
    },
    torta: () => {
      buf.fillRect(x + 1, y + 4, 6, 3, C.gold);
      buf.fillRect(x + 2, y + 3, 4, 1, C.pink);
    },
    bolo: () => {
      buf.fillRect(x + 1, y + 3, 6, 4, C.chocolate);
      buf.fillRect(x + 1, y + 2, 6, 1, C.cream);
      buf.set(x + 3, y + 1, C.pink);
    },
    donut: () => {
      buf.fillRect(x + 1, y + 2, 6, 4, C.pink);
      buf.fillRect(x + 3, y + 3, 2, 2, C.void);
    },
    cafe: () => {
      buf.fillRect(x + 2, y + 2, 4, 5, C.text);
      buf.fillRect(x + 3, y + 3, 2, 3, C.chocolate);
      buf.set(x + 6, y + 4, C.textDim);
    },
    macaron: () => {
      buf.fillRect(x + 2, y + 2, 4, 2, C.pink);
      buf.fillRect(x + 2, y + 4, 4, 2, C.cream);
    },
    pretzel: () => {
      buf.fillRect(x + 1, y + 3, 6, 2, C.bread);
      buf.set(x + 2, y + 2, C.bread);
      buf.set(x + 5, y + 2, C.bread);
    },
    baguete: () => {
      buf.fillRect(x, y + 3, 8, 2, C.bread);
      buf.fillRect(x + 1, y + 2, 6, 1, C.breadDark);
    }
  };
  (map[recipeId] || map.pao)();
}

function drawPixelText(buf, text, x, y, color = C.text) {
  // fonte 3×5 minimalista só pra HUD (números e letras básicas)
  const font = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    L: ['100', '100', '100', '100', '111'],
    V: ['101', '101', '101', '101', '010'],
    '.': ['000', '000', '000', '000', '010'],
    ' ': ['000', '000', '000', '000', '000'],
    ':': ['000', '010', '000', '010', '000']
  };
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const g = font[ch] || font['.'];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (g[row][col] === '1') buf.set(cx + col, y + row, color);
      }
    }
    cx += 4;
  }
}

/**
 * @param {object} bakery - estado ensureBakery()
 * @param {object} opts
 * @param {string} [opts.displayName]
 * @param {number} [opts.now]
 * @param {Array<{id:string}>} [opts.recipes] - lista RECIPES pra achar itens
 */
function renderBakeryScene(bakery, opts = {}) {
  const now = opts.now ?? Date.now();
  const buf = new PixelBuf(W, H);

  const bg = loadSprite('bg.png');
  if (bg) buf.blit(bg, 0, 0, { w: W, h: H });
  else drawProceduralBackground(buf);

  const floor = loadSprite('floor.png');
  if (floor) buf.blit(floor, 0, 52, { w: W, h: H - 52 });

  // balcão
  const counter = loadSprite('counter.png');
  if (counter) buf.blit(counter, 8, 58);
  else drawProceduralCounter(buf, 8, 62, W - 16);

  // fornos (até 5)
  const ovenCount = Math.min(5, Math.max(1, bakery.ovens || 1));
  const jobs = Array.isArray(bakery.cooking) ? bakery.cooking : [];
  const spacing = Math.min(28, Math.floor((W - 20) / ovenCount));
  const startX = Math.floor((W - spacing * ovenCount) / 2) + 2;

  for (let i = 0; i < ovenCount; i++) {
    const job = jobs[i];
    let state = 'idle';
    let recipeId = null;
    if (job) {
      recipeId = job.recipeId;
      state = job.readyAt <= now ? 'ready' : 'cook';
    }

    const ox = startX + i * spacing;
    const oy = 30;

    const spriteName =
      state === 'cook' ? 'oven_cook.png' : state === 'ready' ? 'oven_ready.png' : 'oven_idle.png';
    const ovenSprite = loadSprite(spriteName) || loadSprite('oven_idle.png');

    if (ovenSprite) {
      buf.blit(ovenSprite, ox, oy);
    } else {
      drawProceduralOven(buf, ox, oy, state);
    }

    // item em cima / na porta
    if (recipeId) {
      const itemSprite = loadSprite(path.join('items', `${recipeId}.png`));
      if (itemSprite) {
        // centraliza 16x16 (ou menor) na porta do forno ~22x24
        const iw = itemSprite.width ?? 16;
        const ih = itemSprite.height ?? 16;
        const ix = ox + Math.floor((22 - Math.min(iw, 16)) / 2);
        const iy = oy + 6 + Math.floor((12 - Math.min(ih, 12)) / 2);
        buf.blit(itemSprite, ix, iy, { w: Math.min(iw, 16), h: Math.min(ih, 16) });
      } else drawProceduralItem(buf, ox + 7, oy + 8, recipeId);
    }
  }

  // HUD barra superior
  buf.fillRect(0, 0, W, 11, [0, 0, 0, 140]);
  const name = (opts.displayName || 'Padaria').slice(0, 14);
  // só mostra nível e moedas em pixel font (nome fica no embed)
  drawPixelText(buf, `LV ${bakery.level ?? 1}`, 3, 3, C.gold);
  drawPixelText(buf, `${bakery.coins ?? 0}G`, W - 4 - String(bakery.coins ?? 0).length * 4 - 8, 3, C.cream);

  // sombra sutil inferior
  buf.fillRect(0, H - 2, W, 2, C.shadow);

  return buf.scaleNearest(SCALE);
}

/**
 * @returns {Buffer} PNG
 */
function renderBakeryPng(bakery, opts = {}) {
  const scene = renderBakeryScene(bakery, opts);
  return scene.toPngBuffer();
}

function assetsDir() {
  return ASSETS_DIR;
}

function listMissingCoreSprites() {
  const core = ['bg.png', 'oven_idle.png', 'oven_cook.png', 'oven_ready.png'];
  return core.filter((f) => !fs.existsSync(path.join(ASSETS_DIR, f)));
}

module.exports = {
  renderBakeryPng,
  renderBakeryScene,
  clearSpriteCache,
  assetsDir,
  listMissingCoreSprites,
  W,
  H,
  SCALE
};
