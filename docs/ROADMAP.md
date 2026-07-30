# Roadmap Morgana — 3 sprints

Foco: **impacto no servidor**, não mais features soltas.  
Prefixo `!` e slash `/` continuam os dois; a lógica fica única.

---

## Sprint 1 — Chegada e 1ª semana ✅

| Item | Status |
|------|--------|
| `!inicio` / `/inicio` checklist | ✅ |
| Recompensa ao completar | ✅ |
| Welcome + ajuda | ✅ |

---

## Sprint 2 — Carros-chefe ✅

| Item | Status |
|------|--------|
| Flavor padaria Hallownest | ✅ |
| Poke onboarding / captura guiada | ✅ |
| `!ofrenda` + `!economia` | ✅ |
| Ranking semanal | ✅ |

---

## Sprint 3 — Polimento e ops ✅

| Item | Status | Notas |
|------|--------|--------|
| Slash profundos (menus) | ✅ | `/padaria` `/poke` `/loja` `/musica` `/mod` `/economia` `/staff`… |
| Alertas staff Lavalink | ✅ | `!config alerta #canal` |
| Smoke tests | ✅ | `npm test` / `node scripts/smoke-test.js` |
| Backup restore doc | ✅ | [`BACKUP-RESTORE.md`](./BACKUP-RESTORE.md) |
| Lore no daily / level-up | ✅ | Citação aleatória |

### Mapa slash (raiz)

| Comando | Subcomandos (resumo) |
|---------|----------------------|
| `/inicio` | — |
| `/daily` `/perfil` `/quest` `/ranking` `/evento` | — |
| `/pontos` | ver, rank |
| `/xp` | ver, rank |
| `/rep` | dar, rank |
| `/economia` | guia, cambio, ofrenda |
| `/loja` | ver, item, comprar, vender, inventário… |
| `/padaria` | status, assar, servir, repetir, historico… |
| `/poke` | start, wild, catch, team, battle… |
| `/musica` | play, skip, queue, volume… |
| `/mod` | ban, kick, clear… |
| `/staff` | config, metrics, limpeza, alerta… |
| `/util` `/minigame` `/casamento` `/ticket` | … |
| `/ping` `/lore` `/ajuda` | registry |

Prefixo `!assar`, `!play`, etc. **continua igual**.

---

## Fora de escopo (por enquanto)

- Novo jogo grande  
- Gacha  
- Remover o prefixo `!`

Última atualização: Sprint 3 + reorg slash.
