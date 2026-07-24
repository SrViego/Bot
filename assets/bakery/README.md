# Sprites da padaria (pixel-art) — pack Morgana

Pack **já incluído** no tema vermelho/coral da Morgana (`#E7644D`, `#F79F5B`, madeira escura).

O `!padaria` carrega estes PNGs automaticamente. Se apagar um arquivo, o bot volta pro placeholder procedural daquele pedaço.

## Arquivos

| Arquivo | Tamanho | Função |
|---------|---------|--------|
| `bg.png` | 160×90 | Parede, janelas, prateleira, chão, tapete |
| `floor.png` | 160×38 | Chão (camada extra) |
| `counter.png` | 144×18 | Balcão + pano rosa |
| `oven_idle.png` | 22×24 | Forno apagado |
| `oven_cook.png` | 22×24 | Forno assando (vermelho + vapor) |
| `oven_ready.png` | 22×24 | Forno pronto (dourado + brilho) |
| `items/*.png` | 16×16 | Cada receita |

### Itens

`pao` `croissant` `cookie` `muffin` `torta` `bolo` `donut` `cafe` `macaron` `pretzel` `baguete`

## Como trocar a arte

1. Edite no Aseprite / LibreSprite (mantenha o tamanho ou o blit escala nearest-neighbor).
2. Exporte PNG **com transparência**.
3. Substitua o arquivo aqui.
4. **Reinicie o bot** (cache de sprites em memória).

## Cena

- Resolução lógica: **160×90**
- Escala no Discord: **×4 → 640×360**
- HUD no topo: `LV n` e moedas (`nG`)
