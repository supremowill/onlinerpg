---
description: Cria um novo boss para o jogo RPG online. Use quando o usuário pedir para criar um novo boss, adicionar um novo inimigo, ou criar um novo personagem/boss para o jogo.
argument-hint: <nome-do-boss>
allowed-tools: [Read, Write, Edit, Grep, Glob, Bash, Agent]
---

# New Boss Creation Skill

This skill helps you add a new boss to the online RPG game. It handles all 5 steps needed to fully integrate a new boss into both server and client.

## Understanding the Architecture

Before creating a boss, understand the flow:
1. **Config** (`server/src/config.ts`) - Defines HP, damage, speed, XP, score, hitbox, and spawn timer
2. **Enemy Class** (`server/src/game/enemies/*.ts`) - Server-side logic (AI, abilities, update loop)
3. **SpawnManager** (`server/src/game/SpawnManager.ts`) - Controls when/where boss spawns
4. **GameEngine** (`server/src/game/GameEngine.ts`) - Instantiates the boss on spawn events
5. **SnapshotRenderer** (`client/js/SnapshotRenderer.js`) - Client-side 3D visualization

## Step 1: Gather Boss Information

Ask the user for:
- **Boss name** (e.g., "Dark Dragon")
- **Type identifier** (e.g., "DarkDragon" - used in code)
- **Base stats**:
  - HP (suggest based on game progression)
  - Damage
  - Speed
  - XP reward
  - Score reward
  - Hitbox radius
- **Special abilities** (if any): Describe AI behavior, attacks, special moves
- **Visual**: Preferred geometry (Box, Cone, Sphere, Cylinder, Octahedron) and color (hex)
- **Spawn timing**: After how many minutes should it appear? (adds to SPAWN_TIMERS)

## Step 2: Update Config

Read `server/src/config.ts` and add a new config block:

```typescript
BOSS_NAME: {
    BASE_HP: <hp>,
    BASE_DAMAGE: <damage>,
    SPEED: <speed>,
    XP: <xp>,
    SCORE: <score>,
    HITBOX_RADIUS: <radius>,
},
```

Also add spawn timer in `SPAWN_TIMERS`:
```typescript
BOSS_NAME: <minutes> * 60 * 1000, // Spawns after X minutes
```

## Step 3: Create Enemy Class

Create or update a file in `server/src/game/enemies/`. For bosses, use existing files like `LimboBosses.ts` or create a new one.

Template for new boss class:

```typescript
import { ServerEnemy } from './Enemy';
import { ServerPlayer } from '../Player';
import { Vec3 } from '../../utils/Vector3';
import { CONFIG } from '../../config';

export class BossNameEnemy extends ServerEnemy {
    constructor(pos: Vec3, globalMult: number, playerLevel?: number, playerMaxHp?: number) {
        super(pos);
        this.type = 'BossName'; // Must match config key and spawn event type
        this.name = 'Boss Display Name';
        const c = CONFIG.BOSS_NAME;
        this.maxHp = c.BASE_HP * globalMult;
        this.hp = this.maxHp;
        this.damage = c.BASE_DAMAGE * globalMult;
        this.speed = c.SPEED;
        this.originalSpeed = c.SPEED;
        this.xp = c.XP;
        this.score = c.SCORE;
        this.hitboxRadius = c.HITBOX_RADIUS;
        this.position.y = 1.75; // Adjust based on geometry
    }

    update(dt: number, players: ServerPlayer[], gameTime: number): void {
        super.update(dt, players, gameTime);
        if (this.isDestroyed) return;

        // Custom AI logic here
        // Find nearest player, move towards, use abilities, etc.
    }

    takeDamage(amount: number, instigator: ServerPlayer | null, countsForPassive = true): void {
        // Custom damage handling (barriers, immunity phases, etc.)
        super.takeDamage(amount, instigator, countsForPassive);
    }
}
```

## Step 4: Update SpawnManager

Read `server/src/game/SpawnManager.ts` and:

1. Add alive flag:
```typescript
public isBossNameAlive = false;
```

2. Add timer in constructor:
```typescript
this.timers.spawnBossName = t.BOSS_NAME;
```

3. Add spawn logic in `update()` method - follow pattern of existing bosses like `spawnGuardiãoDoLimbo`:
```typescript
// Spawn Boss Name
if (!this.isBossNameAlive && this.gameTime >= this.timers.spawnBossName) {
    this.isBossNameAlive = true;
    events.push({
        type: 'BossName',
        position: new Vec3(
            (Math.random() - 0.5) * 80,
            1.75,
            (Math.random() - 0.5) * 80
        )
    });
}
```

4. Add death handling - find where other bosses set `isXAlive = false` and add similar logic for the new boss.

## Step 5: Update GameEngine

Read `server/src/game/GameEngine.ts` and:

1. Add import:
```typescript
import { BossNameEnemy } from './enemies/BossFile';
```

2. Add case in `handleSpawnEvent()` method:
```typescript
case 'BossName': {
    const boss = new BossNameEnemy(ev.position, this.globalMultiplier);
    this.enemies.push(boss);
    const sm = this.spawnManager as any;
    sm.isBossNameAlive = true;
    break;
}
```

## Step 6: Update Client Renderer

Read `client/js/SnapshotRenderer.js` and add entry in `enemyVisuals`:

```javascript
BossName: { geo: new THREE.BoxGeometry(2, 2, 2), color: 0xFF0000 },
```

Choose appropriate geometry:
- `BoxGeometry(width, height, depth)` - for box-shaped enemies
- `ConeGeometry(radius, height, segments)` - for cone-shaped
- `SphereGeometry(radius, widthSegments, heightSegments)` - for spherical
- `CylinderGeometry(radiusTop, radiusBottom, height, segments)` - for cylinders
- `OctahedronGeometry(radius, detail)` - for crystal-like enemies

## Step 7: Verify

After all changes:
1. Check that the boss type string is consistent across all files
2. Ensure the config key matches the type used in enemy class
3. Verify the spawn event type matches the case in GameEngine
4. Test by running the server and waiting for spawn timer

## Important Notes

- Boss `type` property must be unique and match what's used in spawn events
- The `position.y` should be set to half the height of the geometry for proper ground placement
- For bosses with special abilities (minions, projectiles, zones), look at existing examples like `FeiticeiroImortalEnemy` or `SuperBossEnemy`
- Minions should be added to `server/src/game/enemies/Minions.ts` and handled in GameEngine's `handleSpawnEvent`

## Quick Reference: File Paths

| Purpose | File Path |
|---------|-----------|
| Config | `server/src/config.ts` |
| Enemy class | `server/src/game/enemies/*.ts` |
| Spawn logic | `server/src/game/SpawnManager.ts` |
| Engine integration | `server/src/game/GameEngine.ts` |
| Client visuals | `client/js/SnapshotRenderer.js` |
