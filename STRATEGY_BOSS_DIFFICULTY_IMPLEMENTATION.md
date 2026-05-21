# Plano de Implementação de Dificuldade dos Bosses

Este documento analisa a viabilidade da estratégia proposta de categorização e escalabilidade de dificuldade dos bosses e estabelece a ficha de melhorias e mecânicas específicas aplicadas a cada um deles.

---

## 1. Mapeamento de Estrelas (Dificuldade Base) e Curva de Aprendizado

| Inimigo / Boss | Categoria | Dificuldade | Mecânica Curva de Aprendizado |
| :--- | :---: | :---: | :--- |
| **Cubo Roxo** | Iniciante | ⭐ | **Esquiva Direcional Básica:** Ensina o jogador a se mover continuamente para evitar projéteis lentos. |
| **Cone Vermelho** | Iniciante | ⭐ | **Área de Ameaça Estática:** Ensina o jogador a respeitar o perímetro e o alcance territorial de alvos perigosos. |
| **Torre Inimiga** | Iniciante | ⭐ | **Linhas de Aviso (Telegrafia):** Ensina a aproximar-se em zigue-zague usando brechas entre disparos lineares previsíveis. |
| **Guardiões (Guerreiro, Mago, Arqueiro)** | Intermediário | ⭐⭐ | **Posicionamento e Combate Dinâmico:** Ensina o controle de distância com inimigos de alta velocidade e ataques a distância variados. |
| **Bruxa do Gelo** | Intermediário | ⭐⭐ | **Uso Técnico do Dash [Q]:** Ensina a usar o dash para quebrar e escapar de zonas restritivas de congelamento (Nevasca AoE). |
| **Mestra da Ilusão** | Intermediário | ⭐⭐ | **Leitura de Padrões e Foco:** Ensina o jogador a não atirar freneticamente em múltiplos alvos sem identificar o verdadeiro. |
| **Bombardeiro Insano** | Intermediário | ⭐⭐ | **Uso Ofensivo do Repelir [W]:** Ensina que o [W] não é apenas defesa, mas uma das melhores armas para refletir projéteis gigantes de volta no inimigo. |
| **Chefes do Limbo (Círculos 1 ao 6)** | Avançado | ⭐⭐⭐ | **Combinação de Habilidades:** Ensina o jogador a combar o Dash [Q], Repel [W] e Escudo [E] de forma rotativa para sobreviver a múltiplos golpes. |
| **Chefes do Limbo (Círculos 7 ao 9) & Elites** | Expert | ⭐⭐⭐⭐ | **Wipe Mechanics (Fuga Letal):** Ensina a tomada de decisão em frações de segundos sob perigos de morte instantânea e colapso de cenário. |
| **O Faraó (Deus Supremo)** | Mestre | ⭐⭐⭐⭐⭐ | **Maestria Total e Quebra de UI:** O teste definitivo do jogo. Combina todas as mecânicas, adicionando quebra de interface e puzzles geométricos rápidos. |

---

## 2. Aplicação Prática por Boss e Inimigo

### ⭐ Categoria: Iniciante
*   **Cubo Roxo:** Dispara um projétil telegrafado no solo por uma fina linha vermelha (aviso de 2 segundos antes do disparo).
*   **Cone Vermelho:** Permanece imóvel. Exibe uma zona de perigo ao seu redor no chão. Se o jogador ficar na zona por 1.5s, sofre explosão média.
*   **Torre Inimiga:** Ataca com intervalos regulares (1.5s) com indicador linear óbvio pintado no solo.

### ⭐⭐ Categoria: Intermediário
*   **Bruxa do Gelo:** Abaixo de 50% HP (Fase de Enrage), ela cria uma muralha impenetrável ao redor do jogador. O jogador tem 3 segundos para usar o **Dash [Q]** e escapar antes que a área interna exploda em um congelamento de 5s.
*   **Mestra da Ilusão:** Abaixo de 50% HP, cria 2 clones perfeitos de si mesma e altera sua opacidade. Bater no clone incorreto reflete dano e causa cegueira (Blind) de 2 segundos ao player.
*   **Bombardeiro Insano:** Bater nele com projéteis comuns causa dano reduzido em 70%. Ele joga bombas rolantes lentas e pesadas. O jogador **deve usar o Repelir [W]** para rebater as bombas grandes de volta no Bombardeiro; cada bomba rebatida arranca 15% do HP máximo dele.

### ⭐⭐⭐ Categoria: Avançado
*   **Guardião do Limbo (Círculo 1) & Minos (Círculo 2):**
    *   *Fase 2 (Enrage):* Ativa poças de areia movediça na arena.
    *   *Mecânica Especial:* Os projéteis rebatidos causam dano triplo, incentivando uso coordenado de magias.
*   **Cérbero (Círculo 3) ao Megera (Círculo 6):**
    *   *Wipe Mechanic Suave:* O chefe carrega energia por 4s. Um anel de chamas/gelo se fecha em direção ao centro. Para sobreviver, o jogador deve ativar o **Escudo [E]** no segundo exato do impacto ou deslizar através do anel usando o **Dash [Q]**.

### ⭐⭐⭐⭐ Categoria: Expert
*   **Minotauro de Sangue (Círculo 7):** Avança com velocidade extrema. Se colidir com paredes ou obstáculos, fica atordoado por 3s. Fase 2: O chão da arena se transforma em sangue fervente; o jogador deve usar saltos com Dash [Q] ou manter o Escudo [E] ativo para evitar o dano contínuo do solo.
*   **Gerião (Círculo 8):** Cria ilusões atacantes. *Wipe Mechanic:* Canaliza golpe mortal de 4s. Apenas o Gerião verdadeiro possui uma leve sombra circular sob seus pés. O jogador deve repelir [W] a "Esfera da Verdade" contra o Gerião real para interromper a conjuração.
*   **Lúcifer Cósmico (Círculo 9):** Aplica lentidão passiva extrema de 90%. O jogador deve ativar o Escudo [E] para anular a lentidão por alguns segundos. *Wipe Mechanic:* Lúcifer cria uma parede maciça de gelo que varre a sala. A brecha da barreira só pode ser quebrada atacando-a com a explosão do Dash [Q].
*   **Espectro de Raziel (Elite) & Smith (Elite):**
    *   *Raziel:* Consome cadáveres de minions para curar-se e aumentar de tamanho (+5% HP e dano por corpo). O jogador deve empurrar os corpos para fora do raio do boss usando o **Repel [W]**.
    *   *Smith:* Spawna clones digitais disruptivos. Se um clone tocar no player, drena 1% do XP acumulado do jogador e transfere como escudo de vida para o Smith original. Exige controle de hordas imediato.

### ⭐⭐⭐⭐⭐ Categoria: Mestre
*   **O Faraó (Deus Supremo):**
    *   *Fase 1 (Invulnerabilidade):* Faraó flutua envolto em um escudo sagrado de areia. O jogador deve rebater [W] os raios de Rá contra os 3 pilares da pirâmide localizados nos cantos da arena para desestabilizá-lo.
    *   *Fase 2 (Praga das Trevas - 50% HP):* A tela do jogador fica escura e as habilidades da UI começam a rodar de posição na tela, testando a memória muscular do jogador.
    *   *Fase 3 (Colapso Final - 20% HP):* O Faraó prende o jogador em um labirinto de pedras por 4s. O jogador deve achar e entrar na zona verde de escape usando o dash/escudo para evitar 99% de dano verdadeiro.

---

## 3. Estrutura de Balanceamento Dinâmico (Modos de Jogo)

| Modo de Jogo | Modificador de HP | Modificador de Dano | Comportamento das Mecânicas | Recompensas (XP & Score) |
| :--- | :---: | :---: | :--- | :---: |
| **Normal** | 1.0x | 1.0x | Padrões de ataque normais, tempos de aviso de 2.0s a 3.0s. | Base (100%) |
| **Difícil** | 1.5x | 1.3x | Adiciona +1 skill ao boss, tempo de telegrafia reduzido para 1.0s. | +50% XP e Score |
| **Pesadelo** | 3.0x | 1.8x | Ativa todas as habilidades de enrage desde o início, tempos de reação de 0.5s e Wipe Mechanics com margem mínima de erro. | +200% XP e Score |

---

## 5. Dinâmica de Progressão: A Dificuldade Aumenta Durante a Partida?

**Sim!** A melhor forma de implementar isso é combinando a **Dificuldade Estática** (escolhida no lobby) com a **Dificuldade Dinâmica e Temporal** (que escala durante a própria partida).

Isso é feito através de 3 motores funcionando em paralelo no servidor:

### A. Escalonamento Temporal da Partida (Threat Level)
O servidor monitora o tempo de jogo decorrido em segundos (`gameTime`). À medida que o tempo passa, o **Nível de Ameaça** da partida sobe, alterando quais monstros nascem e seus atributos:

*   **Fase 1 (0s a 180s - Minuto 0 a 3):**
    *   *Ameaça:* ⭐
    *   *Spawn:* Apenas Cubos Roxos, Cones Vermelhos e Torres.
    *   *Objetivo:* Permitir ao jogador subir os primeiros níveis (1 ao 5) e escolher seu primeiro upgrade avançado [Q].
*   **Fase 2 (180s a 360s - Minuto 3 a 6):**
    *   *Ameaça:* ⭐⭐
    *   *Spawn:* Começam a surgir a Bruxa do Gelo e a Mestra da Ilusão. Inimigos comuns ganham +15% de HP e Dano.
*   **Fase 3 (360s a 600s - Minuto 6 a 10):**
    *   *Ameaça:* ⭐⭐⭐ e ⭐⭐⭐⭐
    *   *Spawn:* Bosses do Limbo (Círculos 1 a 6) começam a spawnar nos seus respectivos tempos. Inimigos comuns ganham +35% de HP e velocidade de movimento base.
*   **Fase 4 (Acima de 600s - Minuto 10+):**
    *   *Ameaça:* ⭐⭐⭐⭐⭐
    *   *Spawn:* Spawna a Entidade Suprema (O Faraó) e o Lúcifer Cósmico. O mapa entra em colapso geométrico contínuo.

### B. Faseamento de Vida do Boss (Fases durante a Luta)
Durante o combate com um boss específico (ex: O Faraó ou Lich King), a dificuldade muda baseado no **HP restante do Boss**:

1.  **Fase de Abertura (100% a 50% HP):** Ataques telegrafados comuns. O jogador aprende o ritmo da esquiva.
2.  **Fase de Enrage (50% a 20% HP):** O Boss ganha velocidade de ataque (+30%), projeta mais projéteis e invoca minions auxiliares (como os Escaravelhos).
3.  **Fase de Desespero (Abaixo de 20% HP):** O Boss ativa a **Wipe Mechanic** (mecânica de dano letal) ou altera a interface visual da arena, exigindo execução perfeita para finalizar a luta.

---

## 6. Exemplo de Estrutura no Código do Servidor

Abaixo está o modelo conceitual de como a lógica de escalonamento temporal e por vida do boss é executada dentro do loop de ticks do servidor (`GameEngine.ts`):

```typescript
// No loop de atualização da partida (GameEngine.ts)
update(dt: number) {
    this.gameTime += dt; // Incrementa o tempo de jogo em segundos

    // 1. Escalonamento Dinâmico de Atributos Base
    const minutes = Math.floor(this.gameTime / 60);
    const scalingFactor = 1.0 + (minutes * 0.15); // +15% de HP/Dano por minuto

    // 2. Controle de Spawn de acordo com a Fase do Jogo
    if (this.gameTime < 180) {
        this.spawnPool = ['purple_cube', 'red_cone'];
    } else if (this.gameTime < 360) {
        this.spawnPool = ['purple_cube', 'red_cone', 'bruxa_gelo', 'mestra_ilusao'];
    } else {
        this.spawnPool = ['purple_cube', 'red_cone', 'bruxa_gelo', 'mestra_ilusao', 'limbo_bosses'];
    }
}
```

```typescript
// Na inteligência artificial do Boss (ServerEnemy.ts / Farao.ts)
updateAI(player: ServerPlayer) {
    const hpPercentage = this.hp / this.maxHp;

    // FASE 1: Comportamento Padrão
    if (hpPercentage > 0.50) {
        this.executeBasicAttackPattern();
    }
    // FASE 2: Enrage (Vida abaixo de 50%)
    else if (hpPercentage > 0.20) {
        this.attackCooldown = this.baseAttackCooldown * 0.7; // Ataca 30% mais rápido
        this.spawnMinions(3); // Invoca Escaravelhos de defesa
        this.executeEnragePattern();
    }
    // FASE 3: Desespero / Wipe (Vida abaixo de 20%)
    else {
        this.executeWipeMechanic(); // Ativa "Julgamento Divino" ou "Praga das Trevas"
    }
}
```

