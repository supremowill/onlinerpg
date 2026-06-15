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
- Skills enviadas para o servidor: `1`, `2`, `3`, `4` enviam `q`, `w`, `e`, `r`
