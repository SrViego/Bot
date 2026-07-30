# Roadmap Morgana — 3 sprints

Foco: **impacto no servidor**, não mais features soltas.  
Prefixo `!` e slash `/` continuam os dois; a lógica fica única.

---

## Sprint 1 — Chegada e 1ª semana ✅ (em andamento no código)

**Meta:** o membro novo sabe o que fazer em 2 minutos e sente progresso.

| Item | Status | Notas |
|------|--------|--------|
| `!inicio` / `/inicio` com checklist | ✅ | Progresso lido do estado real (daily, padaria, poke…) |
| Recompensa ao completar o trilho | ✅ | Pontos + 🪙 padaria (1× por conta no servidor) |
| Welcome aponta pro trilho | ✅ | Embed de boas-vindas + `!inicio` |
| Guia página 0 / menção no `!ajuda` | ✅ | Entrada no help geral |

**Critério de pronto:** novo membro usa `!inicio` e consegue seguir os passos sem perguntar no chat.

---

## Sprint 2 — Carros-chefe (padaria + poke + economia)

**Meta:** os dois jogos grandes e a economia se sentem “vivos” e balanceados.

| Item | Prioridade | Notas |
|------|------------|--------|
| Padaria: flavor Hallownest nos embeds | Alta | Frases ao assar/servir (sem mudar economia) |
| Pokémon: onboarding `!pstart` mais guiado | Alta | Dica pós-captura, próximo passo |
| Sink leve de pontos | Média | Cosmético barato ou meta semanal de guild |
| Ranking semanal automático (canal) | Média | Top pontos / padaria / poke — staff configura canal |
| Documentar taxa de câmbio e sinks | Baixa | README ou `!economia` |

**Critério de pronto:** um jogador casual volta no dia seguinte por padaria ou poke, não só daily.

---

## Sprint 3 — Polimento e ops

**Meta:** menos surpresa em produção e bot com cara de Hallownest.

| Item | Prioridade | Notas |
|------|------------|--------|
| Slash profundos (padaria/loja/poke menus) | Alta | Menos `texto=` genérico |
| Alertas staff (bot/Lavalink down) | Média | Canal staff + `!metrics` |
| Testes smoke (daily, assar, saveUser) | Média | `node --test` ou script simples |
| Backup restore documentado | Baixa | Já existe backup; falta “como restaurar” |
| Lore nos level-ups / daily | Baixa | Uma linha de citação aleatória |

**Critério de pronto:** staff resolve “bot sumiu / slash bugou” com checklist; identidade visual/texto mais Hallownest.

---

## Fora de escopo (por enquanto)

- Novo jogo grande (além de padaria + Pokémon)
- Gacha / lootboxes
- IA de chat genérica
- Remover o prefixo `!` (manter dual)

---

## Como usar este doc

1. Terminar Sprint 1 no servidor (testar `!inicio` com conta nova se possível).  
2. No Sprint 2, pegar **no máximo 2** itens por vez.  
3. Revisar métricas (`!metrics`) depois de cada sprint.

Última atualização: implementação inicial do Sprint 1 no código.
