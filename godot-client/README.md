# Survival 3D Godot Client

Cliente Godot 4.x paralelo ao cliente web atual.

O servidor continua sendo a autoridade de jogo. Este cliente apenas conecta no WebSocket, recebe snapshots e renderiza entidades 3D substituíveis.

## Estrutura visual obrigatória

Todas as cenas de personagem, inimigo e boss mantêm a mesma árvore base e a mesma forma geométrica placeholder. Isso deixa a troca de visual previsível: o GLB entra no mesmo ponto em todas elas.

```text
AvatarRoot
  ModelRoot
  HpBar
    Fill
  StatusAnchor
  AnimationPlayer
  AnimationTree
```

Para trocar um visual:

1. Importe um `.glb` em `assets/models/...`.
2. Abra a cena desejada, por exemplo `scenes/entities/enemies/farao.tscn`.
3. Substitua o conteúdo dentro de `ModelRoot`.
4. Preserve os nós `ModelRoot`, `HpBar`, `StatusAnchor`, `AnimationPlayer` e `AnimationTree`.
5. Se criar uma cena nova, registre o tipo no `scripts/entity/EntityFactory.gd`.

Não é necessário alterar o servidor para trocar mesh, GLB, material ou animação.

## Controles de teste

- Movimento: `WASD`
- Ataque: botão esquerdo do mouse
- Skills estilo HTML: `Q`, `E`, `R`, `F` enviam `q`, `w`, `e`, `r`
- Atalhos extras: `1`, `2`, `3`, `4` tambem enviam `q`, `w`, `e`, `r`
- `Espaco` envia `jump`
- A mira usa raycast da camera para o chao e envia `worldX/worldZ` a cada `50ms`, igual ao HTML.

## Fluxo de login e fila

A cena principal abre em `scenes/main/GameWorld.tscn` e mostra uma UI Godot equivalente ao lobby HTML:

1. Login ou registro via `/api/auth/login`, `/api/auth/register` e `/api/auth/me`.
2. Sessao JWT salva em `user://survival_session.cfg`.
3. Botao PC/Mobile conecta no WebSocket.
4. Ao receber `WELCOME`, envia `JOIN_QUEUE` com token e `SELECT_PLATFORM`.
5. `QUEUE_STATUS`, `MATCH_FOUND` e `GAME_START` atualizam a tela.

Por padrao o cliente aponta para:

- API: `http://18.231.110.109`
- WebSocket: `ws://18.231.110.109/ws`

## Camera e terreno

O Godot replica a base do HTML:

- Camera perspectiva com FOV `75`.
- Camera seguindo o jogador local com offset `(0, 20, 12)`.
- Chao plano `100x100`, cor `#222222`.
- Fundo/fog roxo escuro equivalente a `0x100018`.
- Luz ambiente `0.4` e direcional em `(15, 25, 10)`.
- Torre central e aura ciano.
- Obstaculos do `GAME_START.obstacles` viram blocos `width x 4 x depth`.
