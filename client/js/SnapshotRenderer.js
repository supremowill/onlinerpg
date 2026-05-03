import * as THREE from 'three';

/**
 * SnapshotRenderer - Creates/updates Three.js meshes from server world snapshots
 * Maintains entity pools and interpolates positions for smooth rendering
 */
export class SnapshotRenderer {
    constructor(scene) {
        this.scene = scene;
        this.entityPool = new Map(); // id -> { mesh, type, lastUpdate }
        this.projectilePool = new Map();
        this.orbPool = new Map();
        this.zonePool = new Map();
        this.previousSnapshot = null;
        this.currentSnapshot = null;
        this.interpolationAlpha = 0;

        // Material caches
        this.materials = {
            player: new THREE.MeshStandardMaterial({ color: 0x00BFFF, metalness: 0.5, roughness: 0.4 }),
            playerOther: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.5, roughness: 0.4 }),
            projectilePlayer: new THREE.MeshStandardMaterial({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 2 }),
            projectileEnemy: new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 2 }),
        };
        this.geometries = {
            player: new THREE.BoxGeometry(1, 1, 1),
            projectile: new THREE.SphereGeometry(0.15, 8, 8),
            orb: new THREE.SphereGeometry(0.25, 16, 16),
        };
        // Enemy visual registry
        this.enemyVisuals = {
            PurpleCube: { geo: new THREE.BoxGeometry(1.2, 1.2, 1.2), color: 0x6a1b9a },
            RedCone: { geo: new THREE.ConeGeometry(1, 3, 8), color: 0xd32f2f },
            EnemyTower: { geo: new THREE.CylinderGeometry(1, 1.2, 4, 12), color: 0xc0392b },
            GuardianGuerreiro: { geo: new THREE.BoxGeometry(1.5, 1.5, 1.5), color: 0x8B0000 },
            GuardianMago: { geo: new THREE.OctahedronGeometry(1.2, 0), color: 0x00008B },
            GuardianArqueiro: { geo: new THREE.ConeGeometry(0.8, 2.5, 4), color: 0x006400 },
            BruxaDoGelo: { geo: new THREE.ConeGeometry(0.8, 2.5, 6), color: 0x81D4FA },
            MestraDaIlusao: { geo: new THREE.OctahedronGeometry(1.2, 0), color: 0x9C27B0 },
            BombardeiroInsano: { geo: new THREE.BoxGeometry(1.8, 1.8, 1.8), color: 0xFF6F00 },
            SuperBoss: { geo: new THREE.SphereGeometry(3.0, 32, 32), color: 0xff00ff },
            Gangplank: { geo: new THREE.BoxGeometry(2, 2, 2), color: 0x8D6E63 },
            RainhaDasTrevas: { geo: new THREE.CylinderGeometry(0.8, 0.8, 3, 6), color: 0x3a0ca3 },
            FeiticeiroImortal: { geo: new THREE.SphereGeometry(1.2, 16, 16), color: 0x4B0082 },
            LichKing: { geo: new THREE.BoxGeometry(2, 2, 2), color: 0xADD8E6 },
            PlantaCarnivora: { geo: new THREE.CylinderGeometry(2, 1.5, 1, 12), color: 0x588157 },
            CaoDosInfernos: { geo: new THREE.BoxGeometry(2.4, 1.2, 1.2), color: 0x6e1005 },
            TheMightyOne: { geo: new THREE.BoxGeometry(8, 8, 8), color: 0x0a0a0a },
            AlmaAmaldicoada: { geo: new THREE.SphereGeometry(0.5, 16, 16), color: 0x1a1a1a },
            CaveiraExplosiva: { geo: new THREE.BoxGeometry(0.5, 0.5, 0.5), color: 0xeeeeee },
            EspectroSombrio: { geo: new THREE.SphereGeometry(0.6, 8, 6), color: 0x222222 },
            FilhoteCao: { geo: new THREE.BoxGeometry(1.2, 0.6, 0.6), color: 0x8a3324 },
            BrotoCarnivoro: { geo: new THREE.SphereGeometry(0.6, 8, 6), color: 0x4c956c },
            CloneIlusorio: { geo: new THREE.BoxGeometry(1.5, 1.5, 1.5), color: 0xd095e0 },
            PowderKeg: { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), color: 0x966F33 },
            // Novos bosses do Limbo (Círculos 1-9)
            GuardiãoDoLimbo: { geo: new THREE.OctahedronGeometry(1.5, 0), color: 0x4A148C },
            Minos: { geo: new THREE.CylinderGeometry(1.2, 1.5, 2.5, 12), color: 0xBF360C },
            Cerbero: { geo: new THREE.BoxGeometry(2.5, 1.8, 1.8), color: 0x5D4037 },
            Plutão: { geo: new THREE.SphereGeometry(1.8, 20, 20), color: 0x1A237E },
            Fúria: { geo: new THREE.ConeGeometry(1.2, 3, 8), color: 0xE65100 },
            Megera: { geo: new THREE.OctahedronGeometry(1.3, 0), color: 0x880E4F },
            Minotauro: { geo: new THREE.BoxGeometry(2.5, 2.5, 2.5), color: 0x4E342E },
            Geriao: { geo: new THREE.CylinderGeometry(0.8, 0.8, 3.5, 6), color: 0x004D40 },
            Lúcifer: { geo: new THREE.SphereGeometry(3, 32, 32), color: 0xFF0000 },
            EspectroDeRaziel: {
                geo: new THREE.OctahedronGeometry(1.2, 0),
                color: 0x00CCFF, // Cyan-blue, translucent
                transparent: true,
                opacity: 0.7,
                cylinder: new THREE.CylinderGeometry(1.5, 1.5, 0.3, 16, 1, true), // Open cylinder (scarf)
                cylinderColor: 0x8B4513, // Brown
                orbitingSouls: true,
            },
            Smith: {
                geo: new THREE.BoxGeometry(2, 2, 2),
                color: 0x0D0D0D, // Black metallic prism
                headColor: 0x808080, // Gray cube head
                visorColor: 0x00ff00, // Neon green visor
                headGeo: new THREE.BoxGeometry(1, 1, 1),
            },
            CloneSmith: {
                geo: new THREE.BoxGeometry(1.4, 1.4, 1.4),
                color: 0x0D0D0D,
                headColor: 0x808080,
                visorColor: 0x00ff00,
                headGeo: new THREE.BoxGeometry(0.7, 0.7, 0.7),
                opacity: 0.7,
            },
        };
    }

    pushSnapshot(snapshot) {
        this.previousSnapshot = this.currentSnapshot;
        this.currentSnapshot = snapshot;
        this.interpolationAlpha = 0;
    }

    update(dt, tickIntervalMs) {
        if (!this.currentSnapshot) return;
        this.interpolationAlpha += (dt * 1000) / tickIntervalMs;
        const snap = this.currentSnapshot;
        const prev = this.previousSnapshot;
        const alpha = prev ? Math.min(this.interpolationAlpha, 1.2) : 1;

        // Track active IDs for cleanup
        const activeEnemyIds = new Set();
        const activeProjIds = new Set();
        const activeOrbIds = new Set();
        const activeZoneIds = new Set();

        // --- Players ---
        if (snap.players) {
            for (const ps of snap.players) {
                activeEnemyIds.add(ps.id); // reuse cleanup
                let entry = this.entityPool.get(ps.id);
                if (!entry) {
                    const mat = new THREE.MeshStandardMaterial({ color: ps.color || 0x00BFFF, metalness: 0.5, roughness: 0.4 });
                    const mesh = new THREE.Mesh(this.geometries.player.clone(), mat);
                    mesh.castShadow = true;
                    this.scene.add(mesh);
                    entry = { mesh, type: 'player', lastUpdate: Date.now() };
                    this.entityPool.set(ps.id, entry);
                }
                const prevP = prev?.players?.find(p => p.id === ps.id);
                const tx = prevP ? THREE.MathUtils.lerp(prevP.x, ps.x, alpha) : ps.x;
                const tz = prevP ? THREE.MathUtils.lerp(prevP.z, ps.z, alpha) : ps.z;
                entry.mesh.position.set(tx, 0.5, tz);
                entry.mesh.rotation.y = ps.rotY || 0;
                entry.mesh.visible = !ps.isDead;

                // Ult glow
                if (ps.isUltActive) {
                    entry.mesh.material.emissive = entry.mesh.material.emissive || new THREE.Color();
                    entry.mesh.material.emissive.set(0xff8800);
                    entry.mesh.material.emissiveIntensity = 1.5;
                } else {
                    if (entry.mesh.material.emissive) entry.mesh.material.emissive.set(0x000000);
                    entry.mesh.material.emissiveIntensity = 0;
                }
                entry.lastUpdate = Date.now();
            }
        }

        // --- Enemies ---
        if (snap.enemies) {
            for (const es of snap.enemies) {
                activeEnemyIds.add(es.id);
                let entry = this.entityPool.get(es.id);
                if (!entry) {
                    const visual = this.enemyVisuals[es.type] || { geo: new THREE.BoxGeometry(1, 1, 1), color: 0xffffff };
                    const mat = new THREE.MeshStandardMaterial({
                        color: visual.color,
                        emissive: visual.color,
                        emissiveIntensity: es.type === 'TheMightyOne' ? 1.0 : 0.2,
                        metalness: 0.4, roughness: 0.5,
                        transparent: es.type === 'SuperBoss' || es.type === 'FeiticeiroImortal' || es.type === 'EspectroSombrio' || es.type === 'EspectroDeRaziel' || es.type === 'Smith' || es.type === 'CloneSmith',
                        opacity: visual.opacity !== undefined ? visual.opacity : (es.type === 'SuperBoss' ? 0.8 : es.type === 'EspectroSombrio' ? 0.5 : es.type === 'EspectroDeRaziel' ? 0.7 : 1.0),
                    });
                    if (es.type === 'EspectroSombrio') mat.emissive.set(0x00aaff);
                    if (es.type === 'EspectroDeRaziel') mat.emissive.set(0x00CCFF);
                    if (es.type === 'Smith' || es.type === 'CloneSmith') mat.metalness = 0.8;
                    const mesh = new THREE.Mesh(visual.geo.clone(), mat);
                    mesh.castShadow = true;
                    this.scene.add(mesh);
                    // HP bar above enemy
                    const hpGroup = this.createHpBar();
                    mesh.add(hpGroup);
                    entry = { mesh, type: 'enemy', hpBar: hpGroup, lastUpdate: Date.now(), orbitingSoulMeshes: [], cylinderMesh: null, auraMesh: null, headMesh: null, visorMesh: null, bsodMesh: null };
                    // Add head and visor for Smith / CloneSmith
                    if ((es.type === 'Smith' || es.type === 'CloneSmith') && visual.headGeo) {
                        const headMat = new THREE.MeshStandardMaterial({ color: visual.headColor, metalness: 0.6, roughness: 0.4 });
                        const headMesh = new THREE.Mesh(visual.headGeo.clone(), headMat);
                        headMesh.position.y = 1.5;
                        mesh.add(headMesh);
                        entry.headMesh = headMesh;
                        // Visor (green neon)
                        const visorGeo = new THREE.BoxGeometry(0.8, 0.2, 0.1);
                        const visorMat = new THREE.MeshBasicMaterial({ color: visual.visorColor, emissive: visual.visorColor, emissiveIntensity: 1.0 });
                        const visorMesh = new THREE.Mesh(visorGeo, visorMat);
                        visorMesh.position.y = 1.5;
                        visorMesh.position.z = 0.51;
                        mesh.add(visorMesh);
                        entry.visorMesh = visorMesh;
                    }
                    // Add scarf (half-cylinder) for EspectroDeRaziel
                    if (es.type === 'EspectroDeRaziel' && visual.cylinder) {
                        const cylMat = new THREE.MeshStandardMaterial({ color: visual.cylinderColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                        const cylMesh = new THREE.Mesh(visual.cylinder.clone(), cylMat);
                        cylMesh.rotation.x = Math.PI / 2;
                        mesh.add(cylMesh);
                        entry.cylinderMesh = cylMesh;
                    }
                    // Add aura wireframe for EspectroDeRaziel
                    if (es.type === 'EspectroDeRaziel') {
                        const auraGeo = new THREE.RingGeometry(visual.geo.parameters.radius || 1.2, (visual.geo.parameters.radius || 1.2) + 0.1, 8);
                        const auraMat = new THREE.MeshBasicMaterial({ color: 0x00CCFF, wireframe: true, transparent: true, opacity: 0.3 });
                        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
                        auraMesh.rotation.x = -Math.PI / 2;
                        auraMesh.position.y = -0.5;
                        mesh.add(auraMesh);
                        entry.auraMesh = auraMesh;
                    }
                    this.entityPool.set(es.id, entry);
                }
                const prevE = prev?.enemies?.find(e => e.id === es.id);
                const tx = prevE ? THREE.MathUtils.lerp(prevE.x, es.x, alpha) : es.x;
                const ty = es.y || 0;
                const tz = prevE ? THREE.MathUtils.lerp(prevE.z, es.z, alpha) : es.z;
                entry.mesh.position.set(tx, ty, tz);
                entry.mesh.rotation.y = es.rotY || 0;
                // Update HP bar
                if (entry.hpBar) {
                    const hpPct = es.maxHp > 0 ? es.hp / es.maxHp : 0;
                    entry.hpBar.children[1].scale.x = Math.max(0.001, hpPct);
                    entry.hpBar.children[1].position.x = -(1 - hpPct) * 0.5;
                }
                // Update size multiplier for EspectroDeRaziel and Smith
                if ((es.type === 'EspectroDeRaziel' || es.type === 'Smith') && es.sizeMultiplier) {
                    entry.mesh.scale.set(es.sizeMultiplier, es.sizeMultiplier, es.sizeMultiplier);
                }
                // Pulse visor for Smith/CloneSmith
                if ((es.type === 'Smith' || es.type === 'CloneSmith') && entry.visorMesh) {
                    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
                    entry.visorMesh.material.emissiveIntensity = pulse;
                }
                // BSOD effect on death for Smith
                if ((es.type === 'Smith' || es.type === 'CloneSmith') && es.hp <= 0 && !entry.bsodMesh) {
                    const bsodGeo = new THREE.PlaneGeometry(3, 2);
                    const bsodCanvas = document.createElement('canvas');
                    bsodCanvas.width = 256; bsodCanvas.height = 128;
                    const ctx = bsodCanvas.getContext('2d');
                    ctx.fillStyle = '#000080'; ctx.fillRect(0, 0, 256, 128);
                    ctx.fillStyle = '#ffffff'; ctx.font = '10px monospace';
                    ctx.fillText('SYSTEM ERROR: SMITH PROTOCOL TERMINATED', 10, 20);
                    ctx.fillText('0x000000FF - CRITICAL FAILURE', 10, 40);
                    ctx.fillText('Memory dump: ' + Math.random().toString(16).substr(2, 8), 10, 60);
                    ctx.fillText('Rebooting in 3... 2... 1...', 10, 80);
                    const bsodMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bsodCanvas), transparent: true, opacity: 0.9 });
                    const bsodMesh = new THREE.Mesh(bsodGeo, bsodMat);
                    bsodMesh.position.y = 2.0; bsodMesh.rotation.x = -0.5;
                    entry.mesh.add(bsodMesh);
                    entry.bsodMesh = bsodMesh;
                    setTimeout(() => {
                        if (entry.mesh.parent) {
                            entry.mesh.parent.remove(entry.mesh);
                            entry.mesh.geometry.dispose(); entry.mesh.material.dispose();
                        }
                    }, 2000);
                }
                // Update orbiting souls for EspectroDeRaziel
                if (es.type === 'EspectroDeRaziel' && es.orbitingSouls) {
                    // Remove old soul meshes
                    while (entry.orbitingSoulMeshes.length > 0) {
                        const soulMesh = entry.orbitingSoulMeshes.pop();
                        entry.mesh.remove(soulMesh);
                        soulMesh.geometry.dispose();
                        soulMesh.material.dispose();
                    }
                    // Add new soul meshes
                    for (const soul of es.orbitingSouls) {
                        const soulGeo = new THREE.SphereGeometry(0.15, 8, 8);
                        const soulMat = new THREE.MeshBasicMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
                        const soulMesh = new THREE.Mesh(soulGeo, soulMat);
                        // Position based on angle and radius
                        const x = Math.cos(soul.angle) * soul.radius * (es.sizeMultiplier || 1);
                        const z = Math.sin(soul.angle) * soul.radius * (es.sizeMultiplier || 1);
                        soulMesh.position.set(x, 0.5, z);
                        entry.mesh.add(soulMesh);
                        entry.orbitingSoulMeshes.push(soulMesh);
                    }
                }
                // Rotate cylinder scarf
                if (entry.cylinderMesh) {
                    entry.cylinderMesh.rotation.z += 0.02;
                }
                entry.lastUpdate = Date.now();
            }
        }

        // --- Projectiles ---
        if (snap.projectiles) {
            for (const ps of snap.projectiles) {
                activeProjIds.add(ps.id);
                let entry = this.projectilePool.get(ps.id);
                if (!entry) {
                    const c = ps.color || (ps.isPlayerOwned ? 0x00BFFF : 0xff4444);
                    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 });
                    const mesh = new THREE.Mesh(this.geometries.projectile.clone(), mat);
                    this.scene.add(mesh);
                    entry = { mesh };
                    this.projectilePool.set(ps.id, entry);
                }
                entry.mesh.position.set(ps.x, ps.y || 0.5, ps.z);
            }
        }

        // --- Orbs ---
        if (snap.orbs) {
            for (const os of snap.orbs) {
                activeOrbIds.add(os.id);
                let entry = this.orbPool.get(os.id);
                if (!entry) {
                    let color = 0x2ecc71;
                    if (os.type === 'healing') color = 0x00ff00;
                    else if (os.type === 'buff') {
                        if (os.buffType === 'damage') color = 0xff4500;
                        else if (os.buffType === 'attackSpeed') color = 0x1e90ff;
                        else if (os.buffType === 'essencia_negra') color = 0x4B0082;
                        else color = 0xffd700;
                    }
                    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
                    const mesh = new THREE.Mesh(this.geometries.orb.clone(), mat);
                    this.scene.add(mesh);
                    entry = { mesh };
                    this.orbPool.set(os.id, entry);
                }
                entry.mesh.position.set(os.x, 0.5 + Math.sin(Date.now() * 0.002 + os.x) * 0.1, os.z);
                entry.mesh.rotation.y += dt * 2;
            }
        }

        // --- Dynamic Zones ---
        if (snap.dynamicEntities) {
            for (const de of snap.dynamicEntities) {
                activeZoneIds.add(de.id);
                let entry = this.zonePool.get(de.id);
                if (!entry) {
                    let color = 0xffa500;
                    if (de.type === 'blizzard' || de.type === 'nevascaZone') color = 0x00aaff;
                    else if (de.type === 'tormentFlames') color = 0x5a189a;
                    else if (de.type === 'cannonSalvo') color = 0xff6600;
                    else if (de.type === 'powderKeg') color = 0x8B4513;
                    const r = de.radius || 3;
                    const geo = new THREE.CircleGeometry(r, 32);
                    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.y = 0.02;
                    this.scene.add(mesh);
                    entry = { mesh };
                    this.zonePool.set(de.id, entry);
                }
                entry.mesh.position.set(de.x, 0.02, de.z);
                entry.mesh.material.opacity = de.opacity != null ? de.opacity * 0.4 : 0.3;
            }
        }

        // --- Cleanup removed entities ---
        this.cleanupPool(this.entityPool, activeEnemyIds);
        this.cleanupPool(this.projectilePool, activeProjIds);
        this.cleanupPool(this.orbPool, activeOrbIds);
        this.cleanupPool(this.zonePool, activeZoneIds);
    }

    cleanupPool(pool, activeIds) {
        for (const [id, entry] of pool) {
            if (!activeIds.has(id)) {
                // Clean up extra meshes for Smith/CloneSmith
                if (entry.headMesh) { entry.mesh.remove(entry.headMesh); entry.headMesh.geometry.dispose(); (entry.headMesh.material).dispose(); }
                if (entry.visorMesh) { entry.mesh.remove(entry.visorMesh); entry.visorMesh.geometry.dispose(); (entry.visorMesh.material).dispose(); }
                if (entry.bsodMesh) { entry.mesh.remove(entry.bsodMesh); entry.bsodMesh.geometry.dispose(); (entry.bsodMesh.material).dispose(); }
                if (entry.orbitingSoulMeshes) { while (entry.orbitingSoulMeshes.length > 0) { const sm = entry.orbitingSoulMeshes.pop(); entry.mesh.remove(sm); sm.geometry.dispose(); sm.material.dispose(); } }
                if (entry.cylinderMesh) { entry.mesh.remove(entry.cylinderMesh); entry.cylinderMesh.geometry.dispose(); (entry.cylinderMesh.material).dispose(); }
                if (entry.auraMesh) { entry.mesh.remove(entry.auraMesh); entry.auraMesh.geometry.dispose(); (entry.auraMesh.material).dispose(); }
                this.scene.remove(entry.mesh);
                if (entry.mesh.geometry) entry.mesh.geometry.dispose();
                if (entry.mesh.material) {
                    if (Array.isArray(entry.mesh.material)) entry.mesh.material.forEach(m => m.dispose());
                    else entry.mesh.material.dispose();
                }
                pool.delete(id);
            }
        }
    }

    createHpBar() {
        const group = new THREE.Group();
        group.position.y = 2.5;
        // Background
        const bgGeo = new THREE.PlaneGeometry(1.2, 0.15);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        group.add(bg);
        // Fill
        const fillGeo = new THREE.PlaneGeometry(1.0, 0.1);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xe53935 });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.position.z = 0.001;
        group.add(fill);
        group.lookAt = () => {}; // prevent lookAt errors
        return group;
    }

    getLocalPlayerMesh(playerId) {
        const entry = this.entityPool.get(playerId);
        return entry?.mesh || null;
    }

    getSpectatorTarget(playerId) {
        if (!this.currentSnapshot || !this.currentSnapshot.players) return null;
        
        // Try local player first
        const localPlayer = this.currentSnapshot.players.find(p => p.id === playerId);
        if (localPlayer && !localPlayer.isDead) {
            return this.getLocalPlayerMesh(playerId);
        }
        
        // Spectate an alive player
        const alivePlayer = this.currentSnapshot.players.find(p => !p.isDead);
        if (alivePlayer) {
            return this.getLocalPlayerMesh(alivePlayer.id);
        }
        
        // Everyone is dead
        return this.getLocalPlayerMesh(playerId);
    }

    destroy() {
        for (const [, entry] of this.entityPool) this.scene.remove(entry.mesh);
        for (const [, entry] of this.projectilePool) this.scene.remove(entry.mesh);
        for (const [, entry] of this.orbPool) this.scene.remove(entry.mesh);
        for (const [, entry] of this.zonePool) this.scene.remove(entry.mesh);
        this.entityPool.clear();
        this.projectilePool.clear();
        this.orbPool.clear();
        this.zonePool.clear();
    }
}
