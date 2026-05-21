# Estratégia de Aumento de Dificuldade dos Bosses

O objetivo deste documento é fornecer diretrizes de game design para aumentar a dificuldade dos inimigos de forma inteligente. Em vez de simplesmente aumentar a Vida (HP) e o Dano (o que torna o combate maçante), o foco é adicionar **complexidade mecânica, fases e exigência de habilidade (skill gap)** do jogador.

---

## 1. Defensores e Guardiões de Mapa (Ex: Bruxa do Gelo, Bombardeiro)
*Foco: Punição de Posicionamento e Sinergia de Grupo.*

*   **Zonas de Conforto Negadas:** Guardiões não devem ser "pipados" (atraídos infinitamente). Eles devem ter uma "Aura de Vínculo" com a torre ou área que defendem. Se saírem dessa área, ficam invulneráveis e retornam rapidamente. Se o jogador entrar na área, sofre debuffs (ex: -20% de dano).
*   **Ataques em Falso (Fintas):** A Mestra da Ilusão deve cancelar animações de ataque pela metade e se teleportar, forçando o jogador a gastar seu Escudo [E] ou Dash [Q] no momento errado (gastando cooldown à toa).
*   **Sinergia Obrigatória:** Defensores nunca devem lutar sozinhos. O Bombardeiro Insano pode criar barricadas que só são destruídas se você repelir [W] as próprias bombas dele de volta para a estrutura.

## 2. Chefes do Limbo (Círculos 1 ao 9)
*Foco: Modificadores Globais de Arena e Sobrevivência (Endurance).*

*   **Mutações de Sala (Regras do Círculo):** Ao entrar no raio de combate de um chefe do Limbo, uma "Regra" é ativada.
    *   *Ex (Círculo 4 - Avareza):* Coletar qualquer orb durante a luta reduz sua velocidade permanentemente.
    *   *Ex (Círculo 7 - Violência):* Ficar parado por mais de 1.5s acumula sangramento letal.
*   **Fases de Enrage (Abaixo de 50% HP):** Em 50% de vida, o chefe muda o padrão de ataque em vez de apenas bater mais rápido. O Cérbero, por exemplo, separa suas 3 cabeças geométricas em 3 alvos independentes que atacam de flancos diferentes.
*   **Wipe Mechanics (Dano Letal Evitável):** O Lúcifer Cósmico (Círculo 9) deve ter um golpe que causa 100% da vida do jogador, exigindo que o jogador se esconda atrás de "Pilares de Gelo" (que ele mesmo criou antes com outros ataques) para não ser obliterado.

## 3. Grandes Chefes e Elites (Raziel, Gangplank, Lich King)
*Foco: DPS Checks, Puzzles Dinâmicos e Tomada de Decisão Rápida.*

*   **DPS Checks (Testes de Dano):** O Lich King inicia um cântico de 6 segundos. Durante isso, ele recebe um escudo de 5.000 HP. Se o jogador não quebrar o escudo e dar dano no chefe a tempo, o Lich King revive todos os inimigos do mapa e recupera toda a vida. Isso força o jogador a guardar o Ultimate [R] para o momento certo.
*   **Gestão de Recursos (Mecânica de Risco/Recompensa):** O Espectro de Raziel se cura absorvendo orbes de alma do chão. O jogador tem que "roubar" esses orbes passando por cima deles, mas cada orbe roubado reduz o dano base do jogador em 5% temporariamente, forçando o jogador a decidir entre curar o boss ou perder seu próprio dano.
*   **Negação de Habilidade:** O Smith pode aplicar um "Vírus de Sistema". Quando ativado, o próximo botão de habilidade que o jogador apertar (Q, W ou E) sofrerá um cooldown imediato de 30 segundos, forçando o jogador a usar a habilidade menos importante de propósito para "limpar" o vírus.

## 4. Entidade Suprema (O Faraó)
*Foco: Quebra da Quarta Parede, Desespero e Teste de Maestria Total.*

*   **Desintegração de Arena:** A arena começa com raio 50. A cada 30 segundos de luta, o Faraó destrói 5 metros das bordas. Tocar no vazio é morte instantânea. A luta se torna uma corrida contra o relógio e exige manobras perfeitas em um espaço cada vez menor.
*   **Fraqueza Condicional (Puzzles de Combate):** O Faraó é 100% imune a ataques normais. Para causar dano, o jogador deve repelir (usando o [W]) os Escaravelhos que ele invoca diretamente contra as Pilastras da Pirâmide para colapsá-las em cima do boss.
*   **Julgamento Cego:** Durante a habilidade "Praga das Trevas", além de deixar a tela escura, o Faraó desativa a interface do jogador (remove barra de vida e cooldowns temporariamente). O jogador precisa jogar pelo instinto e memória mecânica.
