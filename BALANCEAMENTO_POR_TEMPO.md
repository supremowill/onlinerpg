# Balanceamento por Tempo — OnlineRPG

## Objetivo

Corrigir a desvantagem do player no início da partida e manter a proposta de sobrevivência: o jogo começa justo, acelera aos poucos e fica muito difícil depois dos 10 minutos.

Este arquivo é uma proposta para o Codex aplicar no projeto. A prioridade é ajustar o começo sem deixar o late game fácil.

---

## Diagnóstico encontrado no repositório

O jogo já possui um sistema de progressão por minuto em `server/src/game/ThreatScalingSystem.ts`.

Atualmente o inimigo escala por:

- tempo de partida;
- level do jogador;
- nível de colapso;
- categoria do inimigo;
- anti-exploit quando o jogador está muito acima do level esperado.

O problema principal não é apenas o multiplicador de status. O início está pesado porque os spawns especiais aparecem cedo demais e muitos timers começam pressionando o jogador antes dele montar a build.

Pontos críticos:

- PurpleCube já nasce de 2 em 2 a cada 5s.
- RedCone aparece a cada 30s e já vem junto com defensor.
- Guardião do Limbo aparece aos 60s.
- Minos aparece aos 120s.
- Smith aparece aos 150s.
- SuperBoss e Cão dos Infernos aparecem aos 180s.
- Planta Carnívora aparece aos 210s.
- Rainha das Trevas e Faraó aparecem aos 300s.
- Lúcifer aparece aos 540s, antes dos 10 minutos.

Isso cria uma fila de boss/elite muito cedo. O player ainda está sem build, sem upgrades suficientes e sem margem para aprender.

---

## Curva desejada

### Fase 1 — 0:00 até 2:00 — Sobrevivência justa

Objetivo: o jogador aprende, pega XP, testa movimentação e começa a build.

- Sem boss verdadeiro.
- Sem defensor junto com RedCone.
- Poucos inimigos comuns.
- Inimigos com dano reduzido.
- XP inicial mais generoso.

Dificuldade alvo: 2/10.

### Fase 2 — 2:00 até 5:00 — Primeira pressão

Objetivo: começar a pressionar sem matar o player instantaneamente.

- Primeiro mini-boss/tutorial pode aparecer.
- RedCone pode aparecer, mas sem combo exagerado.
- O jogo deve cobrar movimentação, mas ainda permitir erro.

Dificuldade alvo: 4/10.

### Fase 3 — 5:00 até 10:00 — Escalada real

Objetivo: a partida entra no ritmo de sobrevivência.

- Bosses começam a aparecer com mais frequência.
- Defensores entram junto com eventos.
- Inimigos comuns ficam mais numerosos.
- Player deve estar perto do level 20–25 aos 10 minutos.

Dificuldade alvo: 6.5/10 a 8/10.

### Fase 4 — Depois de 10:00 — Pesadelo

Objetivo: o jogo deve ficar muito difícil.

- The Mighty One aos 10 minutos vira o marco de virada.
- Depois dos 10 minutos, aumentar HP, dano, defesa, quantidade de inimigos e frequência de elites.
- Bosses de tier alto podem começar a encostar uns nos outros, mas ainda com controle para não quebrar o servidor.

Dificuldade alvo: 9/10 a 10/10.

---

## Balanceamento recomendado do player inicial

Alterar o player base em `server/game_data.json`.

Valores recomendados:

| Campo | Atual recomendado | Motivo |
|---|---:|---|
| hp | 150 | Dar margem de erro no começo. |
| defense | 110 | Reduzir mortes rápidas por projéteis iniciais. |
| speed | 5.2 | Melhorar desvio e sensação de controle. |
| baseDamage | 42 | Ajuda a limpar o início sem explodir o late game. |
| xpToFirstLevel | 8 | Player ganha o primeiro upgrade mais cedo. |
| xpMultiplier | 1.45 | Mantém a meta de level 20–25 aos 10 minutos. |
| skill Q cooldown | 4500ms | Dash mais disponível no começo. |
| skill E cooldown | 18000ms | Escudo mais útil nos primeiros minutos. |

Não aumentar muito o dano base. O problema maior é excesso de pressão cedo, não falta de dano no late game.

---

## Balanceamento recomendado de XP inicial

Alterar em `CONFIG.XP_ORB.INITIAL_COUNT`.

| Campo | Atual | Recomendado |
|---|---:|---:|
| INITIAL_COUNT | 40 | 60 |

Objetivo: permitir que o jogador consiga os primeiros níveis sem depender só de matar inimigo cedo.

Regras extras:

- Até 2 minutos: orbs de XP devem valer 100%.
- De 2 a 5 minutos: manter 100%.
- Depois de 5 minutos: o ganho principal deve vir de combate.

---

## Nova curva de multiplicadores por tempo

Aplicar em `ThreatScalingSystem.getTimeMultipliers`.

| Tempo | HP inimigo | Dano inimigo | Defesa inimigo | Velocidade |
|---|---:|---:|---:|---:|
| 0:00 | 0.72x | 0.65x | 0.75x | 0.90x |
| 1:00 | 0.80x | 0.72x | 0.82x | 0.95x |
| 2:00 | 0.88x | 0.80x | 0.90x | 1.00x |
| 3:00 | 0.94x | 0.85x | 0.94x | 1.00x |
| 4:00 | 1.00x | 0.90x | 0.98x | 1.00x |
| 5:00 | 1.05x | 0.95x | 1.00x | 1.02x |
| 6:00 | 1.13x | 1.01x | 1.03x | 1.03x |
| 7:00 | 1.21x | 1.07x | 1.06x | 1.04x |
| 8:00 | 1.29x | 1.13x | 1.09x | 1.05x |
| 9:00 | 1.37x | 1.19x | 1.12x | 1.06x |
| 10:00 | 1.45x | 1.25x | 1.15x | 1.08x |
| 11:00 | 1.60x | 1.34x | 1.20x | 1.11x |
| 12:00 | 1.75x | 1.43x | 1.25x | 1.14x |
| 15:00 | 2.20x | 1.70x | 1.40x | 1.23x |
| 20:00 | 2.95x | 2.15x | 1.65x | 1.25x máximo |

Intenção:

- Antes dos 5 minutos, reduzir pressão.
- Aos 10 minutos, estar parecido ou um pouco mais pesado que o atual.
- Depois dos 10 minutos, escalar mais forte que o atual.

---

## Nova curva por level do player

Aplicar em `ThreatScalingSystem.getLevelMultipliers`.

Regra importante: level 1 não deve fortalecer inimigo. Hoje o level entra na fórmula desde o começo, então o jogador já fortalece inimigo mesmo estando no início.

Proposta:

| Level do player | HP inimigo | Dano inimigo | Defesa inimigo |
|---|---:|---:|---:|
| 1 | 1.00x | 1.00x | 1.00x |
| 5 | 1.06x | 1.03x | 1.02x |
| 10 | 1.13x | 1.07x | 1.05x |
| 15 | 1.20x | 1.11x | 1.08x |
| 20 | 1.27x | 1.15x | 1.11x |
| 25 | 1.34x | 1.19x | 1.14x |
| 30 | 1.40x | 1.22x | 1.17x |
| 40 | 1.52x | 1.28x | 1.23x |

Essa curva deve somar com o tempo, mas sem esmagar o começo.

---

## Spawns comuns recomendados

Aplicar no `SpawnManager` com spawn dinâmico baseado no `gameTime`.

### PurpleCube

| Tempo | Timer | Quantidade |
|---|---:|---:|
| 0:00–2:00 | 7s | 1 |
| 2:00–5:00 | 6s | 2 |
| 5:00–10:00 | 5s | 2 |
| 10:00–15:00 | 4s | 3 |
| 15:00+ | 3.5s | 4 |

### RedCone

| Tempo | Regra |
|---|---|
| Antes de 1:30 | Não spawnar. |
| 1:30–5:00 | 1 RedCone a cada 45s, sem defensor junto. |
| 5:00–10:00 | 1 RedCone a cada 35s, 50% de chance de vir com defensor. |
| 10:00+ | 1 RedCone a cada 25s, sempre com defensor. |

### Guardiões normais

| Tempo | Regra |
|---|---|
| Antes de 5:00 | Não spawnar guardião comum. |
| 5:00–10:00 | 1 guardião a cada 3:30. |
| 10:00–15:00 | 2 guardiões a cada 2:30. |
| 15:00+ | 3 guardiões a cada 2:00. |

---

## Nova agenda de bosses e elites

Ajustar `CONFIG.SPAWN_TIMERS` e a lógica do `SpawnManager`.

### Regra principal

Antes dos 10 minutos, permitir apenas 1 boss ativo por vez.

Quando um boss estiver vivo, os timers de outros bosses não devem continuar ficando negativos para spawnar tudo junto depois. O Codex deve pausar ou reagendar esses timers enquanto `activeBoss` existir.

Após a morte de um boss:

- Antes de 10:00: 45s de respiro.
- Depois de 10:00: 20s de respiro.
- Depois de 15:00: 10s de respiro.

### Agenda recomendada

| Inimigo/Boss | Atual | Recomendado | Observação |
|---|---:|---:|---|
| Guardião do Limbo | 1:00 | 2:00 | Primeiro mini-boss/tutorial. |
| Minos | 2:00 | 4:00 | Não jogar no player cedo demais. |
| Cerbero | 3:00 | 6:00 | Começa fase de pressão. |
| Plutão | 4:00 | 8:00 | Pré-pico dos 10 min. |
| Fúria | 5:00 | 10:00 | Marco de dificuldade. |
| Megera | 6:00 | 12:00 | Late game. |
| Minotauro | 7:00 | 14:00 | Late game pesado. |
| Geriao | 8:00 | 16:00 | Endurance. |
| Lúcifer | 9:00 | 18:00 | Boss extremo. |
| Smith | 2:30 | 7:30 | Não invadir o começo. |
| SuperBoss | 3:00 | 6:30 | Boss secundário, não no começo. |
| Cão dos Infernos | 3:00 | 5:30 | Caçador, mas sem nascer cedo. |
| Planta Carnívora | 3:30 | 7:00 | Pressão de zona. |
| Rainha das Trevas | 5:00 | 9:00 | Último grande teste antes de 10. |
| Gangplank | 6:00 | 11:00 | Depois do pico. |
| Doutor Doença | 6:00 | 8:30 | Elite de desgaste. |
| Feiticeiro Imortal | 7:00 | 13:00 | Late game. |
| Lich King | 10:00 | 15:00 | Late game pesado. |
| The Mighty One | 10:00 | 10:00 | Manter como marco do colapso. |
| Faraó | 5:00 | 12:00 | Entidade Deus não deve aparecer aos 5 min. |
| Espectro de Raziel | 8:00 | 11:30 | Pós-10, recompensa/ameaça forte. |

---

## Colapso após 10 minutos

O `COLLAPSE_MULTIPLIER` atual está muito extremo se aplicado direto em todos os inimigos. A proposta é deixar o colapso forte, mas controlado.

Recomendação:

| Collapse Level | HP | Dano | Defesa | XP | Score |
|---|---:|---:|---:|---:|---:|
| 0 | 1.00x | 1.00x | 1.00x | 1.00x | 1.00x |
| 1 | 1.60x | 1.35x | 1.20x | 1.25x | 1.35x |
| 2 | 2.30x | 1.75x | 1.45x | 1.55x | 1.80x |
| 3 | 3.20x | 2.25x | 1.75x | 1.90x | 2.40x |

Não usar multiplicador global 20x diretamente no HP/dano comum. Isso pode transformar o pós-10 em quebra brusca demais em vez de dificuldade jogável.

---

## Ajuste de categorias

Manter a lógica de categoria, mas suavizar categorias no começo.

### Antes dos 5 minutos

- common: normal.
- guardian: reduzir HP para 1.05x em vez de 1.20x.
- circle_boss: reduzir HP para 1.25x em vez de 1.50x.
- elite_boss: não spawnar antes de 6 minutos, salvo evento especial.
- great_boss e supreme_entity: proibido antes de 10 minutos.

### Depois dos 10 minutos

- common: normal.
- guardian: 1.25x HP.
- circle_boss: 1.60x HP.
- elite_boss: 1.85x HP.
- great_boss: 2.40x HP.
- supreme_entity: 3.20x HP.

---

## Resultado esperado por minuto

| Minuto | Experiência esperada |
|---:|---|
| 0 | Player nasce seguro, coleta XP e aprende controles. |
| 1 | Começa pressão leve de cubos. |
| 2 | Primeiro mini-boss simples. |
| 3 | Mais inimigos comuns, mas ainda sem caos. |
| 4 | Minos entra como primeiro teste real. |
| 5 | Começa a fase de sobrevivência de verdade. |
| 6 | Cerbero/SuperBoss podem pressionar, mas sem empilhar tudo. |
| 7 | Planta/Smith começam a testar posicionamento. |
| 8 | Plutão/Doutor Doença aumentam desgaste. |
| 9 | Rainha prepara o pico de dificuldade. |
| 10 | The Mighty One + Fúria: jogo fica muito difícil. |
| 11+ | Escalada forte, elites frequentes e menos tempo de respiro. |
| 15+ | Modo pesadelo: muitos inimigos, bosses pesados e pouco descanso. |

---

## Prompt para o Codex aplicar

Prompt Gerado para o Desenvolvedor

Categoria: Balanceamento de Progressão por Tempo

Nome do Sistema: Balanceamento Justo de Início e Escalada Pós-10 Minutos

Descrição Lógica Geral:

O player está em muita desvantagem no começo do jogo. Ajuste o balanceamento para que os primeiros 2 minutos sejam uma fase justa de aprendizado e coleta de XP, dos 2 aos 5 minutos comece a primeira pressão, dos 5 aos 10 minutos o jogo escale para sobrevivência real, e após 10 minutos o jogo fique muito difícil.

Arquivos principais a verificar:

- `server/game_data.json`
- `server/src/config.ts`
- `server/src/game/ThreatScalingSystem.ts`
- `server/src/game/SpawnManager.ts`
- `server/src/game/GameEngine.ts`

Diretrizes de implementação:

1. Ajustar o player inicial para hp 150, defense 110, speed 5.2, baseDamage 42, xpToFirstLevel 8 e xpMultiplier 1.45.
2. Aumentar XP_ORB.INITIAL_COUNT para 60.
3. Refazer a curva de `getTimeMultipliers` seguindo a tabela deste arquivo.
4. Refazer a curva de `getLevelMultipliers` para que level 1 não aumente status dos inimigos.
5. Implementar spawn dinâmico de PurpleCube por faixa de tempo.
6. Impedir RedCone + defensor antes dos 5 minutos.
7. Impedir boss verdadeiro antes dos 2 minutos.
8. Reagendar bosses conforme a tabela de agenda recomendada.
9. O Faraó deve nascer somente depois dos 12 minutos.
10. The Mighty One deve continuar aos 10 minutos e marcar a virada para o modo muito difícil.
11. Enquanto `activeBoss` existir antes dos 10 minutos, pausar ou reagendar timers de outros bosses para evitar fila acumulada.
12. Depois de matar um boss, aplicar tempo de respiro: 45s antes dos 10 minutos, 20s depois dos 10 minutos, 10s depois dos 15 minutos.
13. Reduzir o impacto do colapso para uma curva controlada, evitando multiplicador global 20x direto em tudo.
14. Testar se o jogador chega entre level 20 e 25 perto dos 10 minutos em uma partida normal.
15. Ativar logs de debug temporários para imprimir minuto, level do jogador, tipo de inimigo, HP final, dano final e boss ativo.

Critério de sucesso:

- O jogador não deve morrer facilmente antes dos 2 minutos se movimentar minimamente.
- Aos 5 minutos, o jogo deve exigir atenção.
- Aos 10 minutos, o jogo deve ficar muito difícil.
- Após 12 minutos, bosses de tier alto podem começar a aparecer sem tornar o jogo impossível instantaneamente.
- O jogo deve continuar difícil, mas jogável, até 15–20 minutos para jogadores fortes.
