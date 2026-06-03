⚙️ Categoria: Mecânicas e Infraestrutura (Sistemas do Jogo)
Nome do Sistema: Sistema de Loadout Pré-Partida e Algoritmo de Drops Pós-Partida (LootEngine)

Descrição Lógica:
O jogador possui um inventário persistente e uma interface de Loadout (Pré-partida) contendo exatamente 3 Slots de Equipamento. Os itens equipados injetam modificadores de status globais na classe Player no momento do spawn (onGameStart).
Ao final da partida (Tela de Vitória ou Game Over), o jogo deve disparar o LootEngine.calculateDrop(matchDurationMinutes) para rolar um dado percentual de 0 a 100 e determinar se o jogador recebe um item para seu inventário.

Gatilhos de Ativação e Matemática do Drop:

Gatilho: Fim da partida (EndGameEvent).

Taxas Base (Minuto 0 a 9):

Nenhum Drop (None): 90%

Básico (Basic): 8%

Épico (Epic): 1.5%

Lendário (Legendary): 0.5%

Escalonamento por Tempo (+1% a cada 10 min):

Fórmula: bonusDrop = Math.floor(matchDurationMinutes / 10);

Para não quebrar a raridade, subtraia o bonusDrop da chance de "Nenhum Drop" e adicione esse valor integralmente à chance de drop "Básico" (ou distribua proporcionalmente).

Exemplo aos 30 minutos (3% bônus): 87% None, 11% Básico, 1.5% Épico, 0.5% Lendário.

Integração com Outros Sistemas:

StatusManager: Os itens não criam lógicas novas, eles apenas invocam os 25 status já definidos no StatusManager do jogador.

Motor de Dano: Lembre-se da Regra de Ouro: Tudo escala com Dano Físico. Se um item causa "Fogo" (Ignite), o dano do tick é calculado a partir do Atributo de Dano Normal do jogador.

📦 Categoria: Buffs, Upgrades e Itens (Banco de Dados de Itens)
Regra Visual Geométrica no Chão (HTML 3D):
Quando os itens estiverem no inventário ou caírem (caso implemente drop in-game futuro), eles devem ser renderizados como ícones low-poly puramente geométricos, usando cores CSS HEX sólidas ou prismas translúcidos no Three.js. Nenhuma textura orgânica.

Instrução de Código: Crie um arquivo ItemDatabase.ts contendo o seguinte catálogo de 45 itens. Todos os efeitos de "chance no acerto" (Procs) devem ser validados na função calculatePhysicalDamage() antes de aplicar o status no alvo.

🟢 ITENS BÁSICOS (30 Itens - Chance de Drop Base: 8%)
Focados em utilidade simples, atributos puros ou aplicação de 1 único status.

Prisma de Faiscas: (Prisma Laranja) - 5% de chance ao atacar de aplicar Queimadura (Ignite).

Cubo Tóxico: (Cubo Verde Claro) - 5% de chance ao atacar de aplicar 1 stack de Veneno (Poison).

Lâmina Triangular: (Triângulo Vermelho) - Ataques ganham 5% de chance de aplicar Sangramento (Bleed).

Cilindro Corrosivo: (Cilindro Verde Escuro) - 3% de chance de aplicar Corrosão (Acid).

Orbe Enfermo: (Esfera Roxa) - 2% de chance de aplicar Praga (Plague) no inimigo.

Icosaedro Gélido: (Icosaedro Azul Claro) - 1% de chance de causar Congelamento (Freeze) por 1s.

Bloco Pesado: (Cubo Cinza) - 2% de chance de aplicar Atordoamento (Stun).

Raízes Poligonais: (Losango Marrom) - 5% de chance de causar Enraizamento (Root).

Cone da Lentidão: (Cone Azul Escuro) - 10% de chance de aplicar Lentidão (Slow) de 20%.

Luz Prismática: (Prisma Branco) - 2% de chance de causar Cegueira (Blind).

Esfera do Mudo: (Esfera Preta) - 5% de chance de aplicar Silenciamento (Silence).

Espelho Distorcido: (Retângulo Espelhado) - 3% de chance de causar Confusão (Confusion).

Tetraedro do Pânico: (Tetraedro Roxo) - 2% de chance de causar Medo (Fear).

Placa do Provocador: (Placa Amarela) - Reduz o dano recebido de inimigos sob efeito de Provocação (Taunt) em 5%.

Lente da Fenda: (Lente Ciano) - 5% de chance de aplicar Vulnerabilidade (Vulnerable).

Tijolo Exaustivo: (Retângulo Marrom Claro) - 5% de chance de aplicar Fraqueza (Weakness).

Círculo do Cansaço: (Círculo Cinza Claro) - 5% de chance de aplicar Exaustão (Exhaust).

Seta Marcadora: (Seta Geométrica Vermelha) - 5% de chance de aplicar Marca do Caçador (Marked).

Cunha Serrilhada: (Cunha Prateada) - 5% de chance de aplicar Anti-Cura (Mortal Wounds).

Cristal de Vitalidade: (Cristal Verde Brilhante) - Inicia a partida com buff constante de Regeneração (Regen) (Nível Baixo).

Vento Cúbico: (Cubo Translúcido Branco) - Inicia a partida com Aceleração (Haste) (+5% Move/Atk Speed).

Estilhaço de Fúria: (Fragmento Vermelho Escuro) - Se HP cair abaixo de 20%, ativa Fúria (Enrage) por 3s (Cooldown: 60s).

Mini-Escudo Planar: (Círculo achatado Dourado) - Ao receber dano letal, ativa Escudo Divino (Aegis) por 1s (Consumido, 1 vez por partida).

Cacto Geométrico: (Cilindro Verde com Espinhos) - Garante 5% de chance de aplicar o buff de Espinhos (Thorns) por 5s ao ser atacado.

Presa de Polígono: (Cone Vermelho Escuro) - Garante +2% global de Vampirismo (Lifesteal).

Peso Balanceador: (Esfera Partida ao Meio) - +10% de HP Máximo, aplica -5% permanente de Lentidão (Slow) em si mesmo.

Motor Hasteado: (Cubo com engrenagens) - Ganha +10% de MoveSpeed, mas aplica -5% de dano base.

Frasco Quadrado de Sangue: (Cubo de Vidro Vermelho) - Aumenta o dano do status Sangramento (Bleed) causado em 15%.

Frasco Quadrado de Veneno: (Cubo de Vidro Verde) - Aumenta o limite máximo de Stacks do seu Veneno (Poison) em +2.

Relógio Triangular: (Triângulo flutuante) - Aumenta a duração de todos os status de CC (Freeze, Stun, Root) causados em +0.5s.

🟣 ITENS ÉPICOS (10 Itens - Chance de Drop Base: 1.5%)
Focados em sinergia, combinando dois status ou criando mecânicas condicionais fortes.

Dodecaedro da Carnificina: (Dodecaedro Vermelho Brilhante) - Se o inimigo estiver sob efeito de Sangramento, seus acertos críticos têm 100% de chance de aplicar Fúria (Enrage) em você por 2s.

Bastião de Gelo: (Cubo de Gelo com Núcleo Amarelo) - Quando sua vida cai abaixo de 30%, ativa Escudo Divino (Aegis) por 3s e aplica Congelamento (Freeze) em área (AoE 5 metros) por 2s. (Cooldown: 120s).

Casco Tóxico Farpado: (Meia-esfera Verde com Picos) - Aplica permanentemente Espinhos (Thorns) (+15%). Inimigos que sofrem dano dos seus espinhos recebem 2 stacks de Veneno (Poison).

Lâmina Sanguessuga: (Faca Losango Carmesim) - Aumenta seu Vampirismo (Lifesteal) em +5%. Se você atacar um alvo com Vulnerabilidade, o lifesteal dobra.

Epidemia Ácida: (Dois Icosaedros Interligados, Verde e Roxo) - Sempre que a sua Praga (Plague) se espalhar após a morte de um inimigo, ela espalha também 2 stacks de Corrosão (Acid).

O Olho Aterrorizante: (Esfera flutuante Branca e Preta) - Ao receber dano corpo-a-corpo superior a 15% do seu HP máximo de uma vez, ativa Medo (Fear) no atacante e aplica Marca do Caçador (Marked) nele.

Megafone Cônico: (Cone Dourado Truncado) - A cada 30 segundos, emite um pulso que aplica Provocação (Taunt) em todos num raio de 10 metros, mas garante a você Escudo Divino (Aegis) por 3 segundos.

Grilhões do Cansaço: (Correntes Cilíndricas Negras) - Todo inimigo que sofrer Enraizamento (Root) por você sofrerá automaticamente Exaustão (Exhaust) pelo dobro do tempo.

Pêndulo Curativo: (Pêndulo Prateado Geométrico) - Se você não receber dano por 10 segundos, ganha um buff fortíssimo de Regeneração (Regen). O buff cessa ao tomar dano, mas aplica Anti-Cura (Mortal Wounds) no atacante.

Prisma do Duelista: (Prisma Octogonal Laranja e Cinza) - Seus ataques alternam: o 1º golpe aplica Fraqueza (Weakness), o 2º aplica Queimadura (Ignite) e o 3º aplica Confusão (Confusion).

🟠 ITENS LENDÁRIOS (5 Itens - Chance de Drop Base: 0.5%)
Game-Changers que alteram severamente a lógica de construção (build) do jogador com interações massivas.

Cubo do Infinito (Ciclo Vital): (Tesseract Dourado Translúcido, girando)

Mecânica: A cada 10 segundos, alterna automaticamente o jogador entre 3 estados de Buff massivo contínuo:

Estado 1 (10s): Regeneração (Regen) +300% e Aceleração (Haste).

Estado 2 (10s): Fúria (Enrage) (sem a penalidade de receber mais dano).

Estado 3 (10s): Escudo Divino (Aegis) pulsante (1s imune, 1s vulnerável intercalado).

Prisma da Calamidade (O Fim): (Pirâmide Invertida de matéria escura)

Mecânica: Remove a sua habilidade de causar dano físico direto, mas 100% de seus acertos aplicam um "Super DoT". Esse DoT aplica 1 stack de Veneno (Poison), 1 de Corrosão (Acid), 1 tick de Queimadura (Ignite) e implanta a Praga (Plague) instantaneamente no alvo.

Tetraedro da Distorção Temporal: (Tetraedro Azul e Magenta)

Mecânica: Você fica em estado permanente de Aceleração (Haste) Extrema (+50% Velocidade). Inimigos que entrarem num raio de 8 metros ao seu redor sofrem Lentidão (Slow) de -70% constante e perdem a habilidade de conjurar magias (Silenciamento).

Coroa Gélida do Lich (Fragmento): (Um círculo feito de Prismas de Gelo pontiagudos)

Mecânica: Seus ataques normais passam a ser golpes de gelo físico em área (AoE 45°). Inimigos atingidos são imobilizados por Congelamento (Freeze) por 1s. Todo dano causado a inimigos congelados concede 10% de Vampirismo (Lifesteal) direto para a vida máxima do jogador.

O Coração Cúbico de Raziel: (Um Cubo Rosa pulsante com brilho neon intenso)

Mecânica: "Engana a Morte". Ao receber o golpe que causaria sua morte (HP chega a 0), o dano é negado e seu HP é curado em 100% instantaneamente. Você aplica Cegueira (Blind) e Confusão (Confusion) absolutos em toda a tela por 5s, e ganha Escudo Divino (Aegis) por 4s para fugir. (Funciona apenas 1 única vez por partida).

⚙️ Categoria: Mecânicas e Infraestrutura (Sistemas do Jogo)Nome do Sistema: Sistema de Evolução de Itens em Partida (In-Match Loadout Scaling)Descrição Lógica:
Este sistema cria uma camada de progressão in-game para os 3 itens de Loadout (Pré-partida) que o jogador equipou. Como regra, todas as partidas iniciam com os itens em seus status base (Nível 0). O sistema deve rastrear especificamente os abates do inimigo Cubo Roxo. A cada 100 Cubos Roxos derrotados pelo jogador, os itens equipados sobem 1 nível, recebendo uma melhoria global de 1% em seus efeitos numéricos (chances de ativação, dano, tempo de duração, etc.). O limite máximo dessa evolução é o Nível 10 (+10% de melhoria total).  Gatilhos de Ativação e Eventos:Início da Partida (onGameStart): Zera os contadores. purpleCubesKilled = 0, loadoutLevel = 0, itemMultiplier = 1.0.Morte de Inimigo (onEnemyDeath): O sistema deve "escutar" o evento de morte de entidades. Se a entidade derrotada for o Cubo Roxo (Purple Cube), incrementa purpleCubesKilled++.  Level Up de Itens: Sempre que purpleCubesKilled % 100 === 0 (e desde que purpleCubesKilled > 0), disparar a função upgradeLoadoutItems().Variáveis e Lógica Matemática (Estados):Level Cap: O loadoutLevel tem um teto máximo rígido de 10. Após o Nível 10 (1.000 Cubos Roxos mortos), o contador pode continuar, mas a função de upgrade não deve mais ser chamada.  Cálculo da Melhoria: A cada Level Up, o itemMultiplier aumenta em +0.01. No nível 10, o multiplicador será de 1.10.Aplicação Reversa nos Efeitos: Sempre que o motor for calcular o efeito de um item (ex: 5% de chance de Sangramento), a fórmula deve ser: EfeitoFinal = EfeitoBase * (1 + (loadoutLevel * 0.01)).Exemplo Prático: Um item com 5% de chance de proc, no Nível 10 (multiplicador 1.10), passará a ter 5.5% de chance. Um buff de +10% de vida máxima passará a dar +11% de vida.Integração com Outros Sistemas:Enemy Manager: A checagem de abate precisa validar estritamente a chave identificadora do inimigo (ex: enemy.type === 'PURPLE_CUBE') para ignorar chefes, defensores ou outros minions.  HUD / Interface: Quando upgradeLoadoutItems() for chamado, acionar um breve feedback na tela. Os ícones dos 3 itens na interface inferior do jogador devem piscar na cor branca e um pequeno texto "+1 Nível de Item!" deve flutuar (estilo Floating Text geométrico) sobre a cabeça do jogador.StatusManager e CombatSystem: O multiplicador (itemMultiplier) deve estar acessível globalmente (ex: Player.getLoadoutMultiplier()) para que o sistema de dano e status leia o valor atualizado em tempo real, sem precisar desequipar e equipar os itens no código.Regras de Desempenho:O incremento da variável purpleCubesKilled é uma operação simples de adição e Módulo (%). Evite usar loops pesados (for/forEach) a cada morte para recalcular os itens.Apenas aplique o multiplicador no momento em que a ação do item for exigida pelo motor de jogo (Lazy Evaluation), em vez de tentar sobrescrever o banco de dados original dos itens na memória RAM.


⚙️ Categoria: Mecânicas e Infraestrutura (Sistemas do Jogo)Nome do Sistema: Sistema de Evolução de Itens In-Game e Validação Estrita de LoadoutDescrição Lógica:
Este sistema implementa duas lógicas interconectadas: a progressão de poder dos itens durante a partida (In-Match Scaling) e a nova validação restritiva do inventário pré-partida (Loadout Rules).
No pré-partida, o jogador só pode equipar itens respeitando o limite máximo por raridade (1 Lendário, 2 Épicos, 3 Básicos). Dentro da partida, o sistema monitora os abates do inimigo Cubo Roxo. A cada 100 Cubos Roxos destruídos, os itens equipados evoluem em 1 Nível, aumentando sua eficácia em 1%, com um limite rígido de Nível 10 (+10% de poder total).  1. Validação de Slots Pré-Partida (Loadout):Regra de Equipamento: A interface de Loadout deve bloquear a alocação de itens caso o limite daquela raridade já tenha sido atingido.Limites: maxLegendary = 1, maxEpic = 2, maxBasic = 3.Feedback de UI: Se o jogador tentar equipar um segundo item Lendário, a UI deve barrar a ação e emitir um aviso visual vermelho (Ex: "Slot Lendário Máximo Atingido").2. Evolução em Partida (In-Game Scaling):Gatilhos de Ativação:onGameStart: Zera as variáveis purpleCubesKilled = 0, loadoutLevel = 0, itemMultiplier = 1.0.onEnemyDeath: Um listener que checa se a entidade morta é estritamente o inimigo comum Cubo Roxo.  Cálculo e Gatilho de Level Up:Quando um Cubo Roxo morre, incremente purpleCubesKilled++.Imediatamente após incrementar, verifique: if (purpleCubesKilled % 100 === 0 && loadoutLevel < 10).Se verdadeiro, dispare upgradeLoadoutItems().Variáveis e Estados:loadoutLevel: Inteiro de 0 a 10.itemMultiplier: Float, iniciando em 1.0 e somando 0.01 por nível (Max: 1.10).Aplicação Reversa (Lazy Evaluation): Os itens no banco de dados não devem ser alterados. Apenas quando o CombatSystem for usar a porcentagem ou atributo de um item, ele deve multiplicar o valor base do item pelo itemMultiplier atual. (Ex: um item de 5% de chance de atordoar, no nível 10, será calculado como 5 * 1.10 = 5.5%).3. Integração com Interface (HUD):Feedback Visual Geométrico: Quando o upgradeLoadoutItems() for disparado, acionar duas respostas visuais:Os ícones geométricos dos itens equipados na HUD inferior devem piscar em branco por 0.5s.Instanciar um Floating Text com CSS 3D ou Canvas diretamente acima da coordenada Y do modelo geométrico do jogador dizendo "+1 Nível de Item!" em uma cor chamativa (como Dourado ou Ciano), flutuando para cima e sumindo (opacity 0) em 2 segundos.4. Regras de Desempenho:A checagem do evento de morte (onEnemyDeath) será chamada frequentemente. Garanta que a validação (checagem da string/tipo do inimigo para "Cubo Roxo") seja a primeira linha do método, retornando (return) imediatamente se for outro inimigo ou chefe (como Minos, Cérbero ou O Faraó), evitando desperdício de processamento.  Evite laços de repetição (for, forEach) para atualizar os itens no momento do Level Up. O uso do itemMultiplier global sendo lido apenas no momento da ação (Procs, Dano) garante performance ideal.


⚙️ Categoria: Mecânicas e Infraestrutura (Sistemas Web e Economia)Nome do Sistema: Plataforma Web de Trocas, Conversão de Itens e Mercado Livre de Moedas (LootExchange & CoinMarket)Descrição Lógica:Este sistema move a economia do jogo para uma plataforma web (fora do loop de renderização 3D do jogo), onde os jogadores gerenciam seus itens persistentes e moedas. O sistema é dividido em três pilares principais: Sistema de Trocas (TradeIn), onde o jogador queima itens do inventário em troca de outros itens ou moedas; Sistema de Moeda Premium (Moedas), indexada à moeda real (BRL) na proporção de R$ 1,00 = 100 Moedas; e o Mercado de Moedas Seguro (CoinMarket), inspirado no sistema de Tibia Coins, onde jogadores compram e vendem moedas entre si, com o sistema retendo uma taxa fixa (taxa de corretagem) de 10% sobre o montante final em qualquer transação (compra ou venda).💵 1. Infraestrutura da Moeda Premium e Compra DiretaA Moeda: A moeda oficial do ecossistema é tratada no banco de dados como PremiumCoin.Conversão de Dinheiro Real: O sistema de faturamento web (ex: integração com Gateway de Pagamento/PIX) deve seguir rigorosamente a proporção matemática fixa:$$\text{Moedas Recebidas} = \text{Valor em BRL} \times 100$$Persistência: O saldo de moedas do jogador deve ser centralizado em uma tabela de balanço no banco de dados (UserWallet), utilizando transações ACID (como PostgreSQL ou MongoDB com sessões) para evitar duplicidade ou perdas de saldo durante picos de acessos.🔄 2. Sistema de Trocas no Site (Trade-In / Reciclagem)O jogador pode acessar o inventário web e selecionar itens indesejados para "destruir/trocar". O site deve oferecer duas opções de recompensa para essa ação, baseadas no valor intrínseco de raridade do item:Tabela Base de Valores de Troca (Valores sugeridos para balanceamento):Item Básico: Vale 10 Moedas OU pode ser trocado por outro Item Básico Aleatório (sistema gacha de reciclagem).Item Épico: Vale 100 Moedas OU o jogador junta 5 Itens Básicos para trocar por 1 Épico Aleatório.Item Lendário: Vale 500 Moedas OU o jogador junta 5 Itens Épicos para trocar por 1 Lendário Aleatório.Validação de Estado do Item: O microsserviço da web deve verificar se o jogador não está com o item equipado no Loadout ativo da partida ou se a partida está em andamento (is_in_match == true). Se estiver ativo ou em partida, a solicitação de troca deve ser sumariamente rejeitada pelo backend.📈 3. Mercado Interno de Moedas (Estilo Tibia Coins - P2P Seguro)O mercado funciona de forma descentralizada entre os jogadores. Um jogador que precisa de moedas cria uma oferta de compra usando dinheiro real/moedas de jogo, e quem tem moedas em excesso pode vendê-las, ou vice-versa. O sistema atua como o intermediário confiável (Escrow).Lógica de Ordens (Ofertas):Ordem de Venda (Sell Order): O Jogador A coloca $X$ moedas à venda estipulando um preço unitário. Essas moedas ficam "bloqueadas" pelo sistema (retiradas do inventário dele temporariamente).Ordem de Compra (Buy Order): O Jogador B cria uma intenção de compra, estipulando quantas moedas deseja e quanto está disposto a pagar por elas.A Regra da Taxa de Retenção de 10%:Para garantir a sustentabilidade da plataforma e remover o excesso de moedas/capital do ecossistema (reduzindo a inflação), o sistema cobra 10% de taxa sobre o valor final da transação. O cálculo deve ser aplicado de forma estrita no backend:Na Venda (Seller): Se o Jogador A vende 1.000 moedas por um valor combinado, a plataforma retém 10% das moedas transacionadas ou do lucro gerado na moeda local da transação.$$\text{Moedas Recebidas pelo Comprador} = 1.000$$$$\text{Taxa Retida pelo Sistema} = 1.000 \times 0.10 = 100 \text{ moedas}$$$$\text{Lucro Líquido do Vendedor} = \text{Valor Total} - \text{Taxa (10\%)}$$Na Compra (Buyer): Se a taxa for embutida no comprador, a plataforma adiciona 10% de custo operacional sobre o valor que ele está pagando para adquirir as moedas.💻 Integração Técnica e Fluxo de Dados:Sincronização API Web $\leftrightarrow$ Game Client: O jogo em si não processa transações financeiras. No entanto, quando o jogador faz o login no jogo, o cliente dispara uma chamada de API (GET /api/user/inventory) para renderizar os itens e o saldo de moedas atualizados com base no que foi feito no site.Segurança Concorrente (Race Conditions): O desenvolvedor deve implementar travas de banco de dados (SELECT FOR UPDATE ou travas pessimistas). Se um jogador clicar duas vezes no botão de "Vender" ou "Trocar", a segunda requisição deve falhar imediatamente informando que o item ou saldo já mudou de estado.Logs de Auditoria: Cada movimentação no Mercado Interno ou no Sistema de Trocas deve gerar uma linha imutável em uma tabela de logs (financial_audit_logs). O log deve conter: User_ID, Action_Type (Trade/Buy/Sell), Amount, Fee_Retained (Os 10%) e Timestamp.🚨 Regras de Desempenho e Segurança:Nunca confie em dados enviados pelo lado do cliente (Front-end/Javascript). Toda e qualquer validação de se o usuário realmente possui o item, se possui moedas suficientes e o cálculo dos 10% de taxa deve ser recalculado obrigatoriamente no servidor (Back-end) antes de persistir no banco de dados.A interface do mercado deve atualizar via WebSockets ou polling de curto tempo para garantir que os jogadores vejam flutuações de preços reais em tempo real, exatamente igual ao comportamento do mercado de moedas do Tibia.

⚙️ Categoria: Mecânicas e Infraestrutura (Sistemas Web e Economia)
Nome do Sistema: Plataforma Web de Trocas, Mercado de Moedas, Validação de Segurança e Painel de Auditoria em Tempo Real (LootExchange, CoinMarket & AdminWatch)

Descrição Lógica:
Este sistema gerencia a economia do jogo fora da renderização 3D, englobando o Trade-In de itens do inventário e o Mercado P2P de Moedas Premium (onde R$ 1,00 = 100 Moedas, com taxa de 10% de retenção em transações P2P).
A prioridade absoluta desta implementação é a Segurança (Anti-Cheat) e a Transparência Administrativa. Nenhuma validação deve ser confiada ao lado do cliente (Front-end). Além disso, todas as transações financeiras e de inventário alimentarão um canal de WebSockets restrito, renderizando logs em tempo real para os administradores.

🛡️ 1. Verificações de Segurança Rigorosas (Anti-Cheat e Anti-Duplicação)
O Backend deve implementar as seguintes travas antes de concluir qualquer transação:

Validação de Estado do Jogador:

O endpoint da API deve verificar a flag is_in_match. Se o jogador estiver com uma partida em andamento (ou se o servidor de jogo relatar o jogador como online na arena), a transação (venda, compra ou troca) deve ser rejeitada com erro 403 Forbidden.

Controle de Concorrência (Prevenção de Race Conditions):

Utilize travas de banco de dados (Ex: SELECT ... FOR UPDATE no PostgreSQL/MySQL) ou um sistema de Mutex no Redis para bloquear a linha do inventário/carteira do usuário durante a transação.

Objetivo: Impedir que o usuário envie múltiplas requisições simultâneas (exploit de duplo clique) para vender o mesmo item ou gastar a mesma quantia de moedas mais de uma vez.

Sanitização e Validação de Payload:

Rejeitar valores negativos ou fracionados para moedas.

Validar se os IDs dos itens informados no payload realmente pertencem ao User_ID autenticado através de uma query direta no banco de dados.

Rate Limiting Específico:

Aplicar um limite rigoroso nas rotas financeiras (Ex: máximo de 3 requisições de transação por minuto por IP/Sessão).

👁️ 2. Painel de Auditoria do Admin (Logs em Tempo Real)
Crie um microsserviço ou namespace de WebSockets (ex: Socket.io no /admin-watch) que transmita dados instantaneamente para o painel de administradores.

Transmissão de Logs:

Toda vez que uma transação passar pelas validações e for commitada no banco de dados, o backend deve emitir um evento ADMIN_LOG_EMIT.

Estrutura do Log (Payload do WebSocket):

JSON
{
  "timestamp": "2026-05-30T14:38:00Z",
  "transaction_id": "uuid-1234",
  "user_id": "player_88",
  "action_type": "MARKET_SELL | MARKET_BUY | ITEM_TRADE_IN",
  "details": "Vendeu 1000 Moedas | Queimou 1 Prisma de Faiscas",
  "fee_retained": 100,
  "ip_address": "192.168.x.x",
  "threat_level": "LOW | MEDIUM | HIGH"
}
*   **Sistema de Flags Automáticas (Threat Level):**
    *   **LOW:** Transações normais, pequenos valores.
    *   **MEDIUM:** Usuário realizando muitas transações no mesmo dia ou vendendo itens Lendários.
    *   **HIGH:** Movimentação de grandes volumes de moedas (ex: +10.000 moedas de uma vez), múltiplas falhas de validação de segurança seguidas (tentativa de exploit), ou transações entre contas com o mesmo endereço de IP (possível *Wash Trading*). Logs `HIGH` devem disparar um alerta sonoro e visual no painel do Admin.

---

### 💻 3. Interface do Painel Admin (Estética Visual Geométrica)
Mesmo sendo uma interface web de auditoria, mantenha a linguagem visual do jogo:
*   **Design dos Logs:** Cada linha de log que aparece na tela do Admin não deve ser uma tabela chata padrão. Modele cada entrada como um bloco poligonal (CSS `clip-path: polygon(...)`) flutuando verticalmente numa fila.
*   **Cores de Ameaça:**
    *   Risco Baixo (LOW): Borda Ciano néon.
    *   Risco Médio (MEDIUM): Borda Amarela/Laranja brilhante.
    *   Risco Alto (HIGH): Bloco pulsante em Vermelho Escuro com aviso geométrico intermitente (Animação CSS de um Triângulo de perigo girando).

### 🚨 Regras de Implementação para o Desenvolvedor:
*   A conexão WebSocket do Admin deve exigir um token de autorização especial (Role: `SUPER_ADMIN`). Qualquer tentativa de escutar esses logs com um token de jogador normal deve derrubar a conexão instantaneamente e banir temporariamente o IP.
*   Mantenha um log paralelo persistente em um banco de dados NoSQL (como MongoDB ou ElasticSearch) para que o Admin possa buscar o histórico passado, caso não estivesse online no momento do stream WebSocket.