# Guia Completo do Jogador: Estatísticas, Habilidades e Evoluções (Upgrades)

Este guia consolida todas as mecânicas, estatísticas de escalonamento, habilidades ativas e árvores de evolução avançadas do jogador no jogo.

---

## 1. Estatísticas Base do Player & Escalonamento de Nível

O jogador possui atributos dinâmicos que escalam exponencialmente conforme ele ganha XP coletando orbes ou derrotando inimigos.

* **Vida Máxima Inicial (Max HP):** 100 HP.
* **Velocidade de Movimento Base:** 5.0 unidades por segundo.
* **Tempo de Recarga do Ataque Básico:** 500 ms (0.5s), permitindo até 2 projéteis por segundo.
* **Velocidade do Projétil:** 15.0 unidades por segundo.
* **Duração do Projétil:** 3.0 segundos antes de sumir.
* **Raio de Colisão (Hitbox):** 0.5 unidades.

### 📈 Escalonamento por Level:
* **Experiência para Nível 2:** 10 XP base.
* **Crescimento de XP:** O custo do próximo nível é multiplicado por **1.8x** cumulativo (`XP_Atual * 1.8`).
* **Crescimento de HP:** A Vida Máxima aumenta em **+50%** a cada nível (`MaxHP * 1.5`). Subir de nível cura completamente o jogador.
* **Fórmula do Dano do Jogador:** O dano base das habilidades e projéteis é calculado com base no nível atual:
  $$\text{Dano Base} = 40 \times (\text{Nível} \times 2.0)$$
  * *Nível 1:* 80 de Dano
  * *Nível 5:* 400 de Dano
  * *Nível 10:* 800 de Dano
  * *Nível 20:* 1600 de Dano

---

## 2. Habilidades Ativas Base (Q, W, E, R)

### 🌀 Habilidade [Q] — Dash (Corrida Geométrica)
O jogador desliza na direção em que está olhando, ganhando imunidade a controles durante o avanço. Ao finalizar o trajeto, dispara uma rajada em leque de **8 esferas** que causam **40% do dano base** do jogador.
* **Recarga (Cooldown):** 5.0 segundos.
* **Duração da Corrida:** 200 ms (0.2s).
* **Velocidade do Dash:** 30.0 u/s (Sobe para 45.0 u/s no nível de habilidade 2 ou 3).

### 🛡️ Habilidade [W] — Repel (Onda Defensiva)
Emite um campo magnético instantâneo de curto alcance que empurra inimigos para trás e reflete/reverte projéteis inimigos de volta a eles.
* **Recarga (Cooldown):** 8.0 segundos.
* **Alcance de Repulsão:** 10.0 unidades de raio.

### 🔋 Habilidade [E] — Shield (Escudo de Partículas)
Invoca uma bolha de proteção eletromagnética ao redor do jogador.
* **Recarga (Cooldown):** 20.0 segundos.
* **Duração do Escudo:** 15.0 segundos.
* **HP do Escudo:** Equivalente a **1.5x (150%) da Vida Máxima** do jogador.

### 🔥 Habilidade [R] — Ultimate (Sobrecarga Cósmica)
O jogador canaliza o poder do núcleo geométrico, transformando-se temporariamente em uma entidade divina.
* **Recarga (Cooldown):** 50.0 segundos.
* **Duração do Buff:** 25.0 segundos.
* **Multiplicador de Dano:** **4.0x (400%)** em todas as fontes de dano.
* **Redução de Cooldown (Nível de Skill 3):** Reduz o cooldown do ataque básico em 1.5x.

---

## 3. Sistema de Evoluções e Upgrades Avançados (Níveis 5, 10, 15, 20)

Ao atingir os níveis **5, 10, 15 e 20**, a progressão normal de skills abre espaço para uma seleção especial. O jogador escolhe **1 de 3 upgrades avançados** para modificar drasticamente o comportamento de suas habilidades:

### Nível 5 — Especializações da Corrida [Q]
* **Impacto Estilhaçante:** As 8 esferas do fim do dash aplicam *Fratura de Armadura* (-25% de defesa do inimigo por 4s) e reduz permanentemente o cooldown do Dash em **-1 segundo**.
* **Rastro de Pólvora:** Durante os 0.2s do deslize, deixa minas terrestres no solo a cada 0.1s. Inimigos que pisarem sofrem dano em área (30% do dano base) e queima contínua.
* **Convergência Assassina:** Reduz o ângulo de disparo do leque do dash (cone super focado de $\pi/8$). Se 3 ou mais esferas atingirem o mesmo alvo, aplica *Silêncio* por 2s e concede buff de *Velocidade de Ataque*.

### Nível 10 — Especializações do Repel [W]
* **Campo de Hemorragia:** Inimigos atingidos pelo repelir sofrem *Sangramento* por 5s, recebendo dano proporcional a 10% do seu poder atual por segundo.
* **Refração Vital:** Cada projétil revertido cura o jogador em **3% do HP máximo**. Reverter 3 ou mais projéteis simultaneamente limpa instantaneamente todos os debuffs negativos da tela.
* **Vácuo Magnético:** Inverte a física da habilidade. Em vez de empurrar, **puxa todos os inimigos em área para o centro** e aplica lentidão (Slow) de **70% por 3 segundos**.

### Nível 15 — Especializações do Escudo [E]
* **Carapaça Reativa:** Sempre que o escudo receber dano, dispara automaticamente um projétil de volta contra o agressor, causando **50% do dano absorvido** como contra-ataque.
* **Bateria de Sobrecarga:** Transforma a defesa em progresso. **10% de todo o dano absorvido** pelo escudo é convertido diretamente em Experiência (XP).
* **Fortaleza Inabalável:** O valor do escudo dobra, fornecendo **3.0x (300%) da Vida Máxima** em HP de escudo, e concede imunidade total a stuns, congelamentos e enraizamentos enquanto ativo.

### Nível 20 — Especializações da Ultimate [R]
* **Fúria Infinita:** Cada inimigo derrotado durante a ativação da Ultimate estende sua duração em **+1 segundo**.
* **Distorção Temporal:** Reduz o tempo de recarga de suas habilidades básicas (Q, W e E) para **apenas 1 segundo** durante toda a duração da Ultimate, permitindo uso contínuo das habilidades de forma frenética.
* **Singularidade do Colapso:** Acumula todo o dano que o jogador teria sofrido durante a Ultimate. Ao terminar a duração, detona uma explosão termonuclear em um raio de 20 metros, causando **200% do dano armazenado** de uma só vez.
