import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        this.singularityAura = null;
        this.mixers = [];
        this.faraoModelTemplate = null;
        this.faraoAnimations = {};

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
            CaoDosInfernos: {
                geo: new THREE.BoxGeometry(2, 1.5, 4),
                color: 0x111111,
                emissive: 0x111111,
                emissiveIntensity: 0.2,
                isCaoDosInfernos: true,
            },
            MatilhaGeometra: {
                isMatilhaGeometra: true,
            },
            TheMightyOne: { geo: new THREE.BoxGeometry(8, 8, 8), color: 0x0a0a0a },
            AlmaAmaldicoada: { geo: new THREE.SphereGeometry(0.5, 16, 16), color: 0x1a1a1a },
            CaveiraExplosiva: { geo: new THREE.BoxGeometry(0.5, 0.5, 0.5), color: 0xeeeeee },
            EspectroSombrio: { geo: new THREE.SphereGeometry(0.6, 8, 6), color: 0x222222 },
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
            DoutorDoenca: {
                geo: new THREE.DodecahedronGeometry(1.5),
                color: 0x3a0050,
                emissive: 0x1d0032,
                emissiveIntensity: 0.5,
            },
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
            EscaravelhoFarao: { geo: new THREE.SphereGeometry(0.6, 8, 8), color: 0xffd700, emissive: 0xffa500 },
            // ─── FARAÓ (geometric low-poly) ───────────────────────────────────
            Farao: {
                geo: new THREE.BoxGeometry(2.2, 2.8, 1.4),  // body — golden prism
                color: 0xc8a000,
                emissive: 0xffd700,
                emissiveIntensity: 0.5,
                isFaraoGeometric: true,
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
        this.mixers.forEach(m => m.update(dt));
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
                    // Temporal upgrade: flash white/red
                    if (ps.skillUpgrades?.r === 'r_distorcao_temporal') {
                        const flash = Math.sin(Date.now() / 100) > 0;
                        entry.mesh.material.emissive.set(flash ? 0xffffff : 0xff0000);
                    } else {
                        entry.mesh.material.emissive.set(0xff8800);
                    }
                    entry.mesh.material.emissiveIntensity = 1.5;
                    // Fury upgrade: rotate mesh faster on kills
                    if (ps.skillUpgrades?.r === 'r_furia_infinita') {
                        entry.mesh.rotation.y += 0.1;
                    }
                    // Singularity upgrade: darken screen
                    if (ps.skillUpgrades?.r === 'r_singularidade_colapso') {
                        if (!this.singularityAura) {
                            const geo = new THREE.SphereGeometry(30, 32, 32);
                            const mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0.4 });
                            this.singularityAura = new THREE.Mesh(geo, mat);
                            this.scene.add(this.singularityAura);
                        }
                        this.singularityAura.position.copy(entry.mesh.position);
                        this.singularityAura.visible = true;
                        
                        if (entry.mesh.material.emissive) {
                            const darkness = Math.min(0.5, (Date.now() % 10000) / 20000);
                            entry.mesh.material.emissive.setRGB(darkness, darkness, darkness);
                        }
                    } else if (this.singularityAura && ps.isLocal) {
                        this.singularityAura.visible = false;
                    }
                } else {
                    // Assassin upgrade: purple flash before dash (handled elsewhere)
                    if (ps.skillUpgrades?.q === 'q_convergencia_assassina' && ps.isDashing) {
                        entry.mesh.material.emissive = entry.mesh.material.emissive || new THREE.Color();
                        entry.mesh.material.emissive.set(0x8A2BE2);
                        entry.mesh.material.emissiveIntensity = 1.0;
                    } else if (entry.mesh.material.emissive) {
                        entry.mesh.material.emissive.set(0x000000);
                        entry.mesh.material.emissiveIntensity = 0;
                    }
                }
                // --- Shield visuals based on upgrades ---
                if (ps.isShieldActive && !ps.isDead) {
                    if (!entry.shieldMesh) {
                        const geo = ps.skillUpgrades?.e === 'e_fortaleza_inabalavel' ? new THREE.DodecahedronGeometry(1.2, 0) : new THREE.SphereGeometry(1.2, 16, 16);
                        const mat = new THREE.MeshStandardMaterial({
                            color: 0x00aaff, transparent: true, opacity: ps.skillUpgrades?.e === 'e_fortaleza_inabalavel' ? 0.7 : 0.4,
                            metalness: ps.skillUpgrades?.e === 'e_fortaleza_inabalavel' ? 0.8 : 0.3,
                            emissive: new THREE.Color(0x00aaff), emissiveIntensity: 0.5
                        });
                        entry.shieldMesh = new THREE.Mesh(geo, mat);
                        entry.mesh.add(entry.shieldMesh);
                    }
                    // Reactive upgrade: add spines
                    if (ps.skillUpgrades?.e === 'e_carapaca_reativa' && !entry.reactiveSpines) {
                        entry.reactiveSpines = [];
                        for (let i = 0; i < 8; i++) {
                            const coneGeo = new THREE.ConeGeometry(0.1, 0.5, 4);
                            const coneMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1 });
                            const cone = new THREE.Mesh(coneGeo, coneMat);
                            // Position on sphere surface
                            const angle = (i / 8) * Math.PI * 2;
                            cone.position.set(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0);
                            cone.rotation.z = Math.PI / 2;
                            entry.shieldMesh.add(cone);
                            entry.reactiveSpines.push(cone);
                        }
                    }
                    // Overcharge upgrade: pulse emissive between yellow and green
                    if (ps.skillUpgrades?.e === 'e_bateria_sobrecarga' && entry.shieldMesh.material) {
                        const pulse = Math.sin(Date.now() / 500) > 0;
                        entry.shieldMesh.material.emissive.set(pulse ? 0xf1c40f : 0x2ecc71);
                    }
                    entry.shieldMesh.visible = true;
                } else if (entry.shieldMesh) {
                    entry.shieldMesh.visible = false;
                }

                // --- Familiar from Núcleo da Matilha ---
                const hasFamiliar = ps.timedBuffs?.includes('nucleo_da_matilha');
                if (hasFamiliar && !ps.isDead) {
                    if (!entry.familiarMesh) {
                        const famGeo = new THREE.CylinderGeometry(0, 0.3, 0.9, 4, 1);
                        const famMat = new THREE.MeshStandardMaterial({ 
                            color: 0xff0000, 
                            emissive: 0xaa0000, 
                            roughness: 0.2, 
                            metalness: 0.5 
                        });
                        const famMesh = new THREE.Mesh(famGeo, famMat);
                        famMesh.rotation.y = Math.PI / 4;
                        famMesh.rotation.x = Math.PI / 2;
                        famMesh.castShadow = true;
                        this.scene.add(famMesh);
                        entry.familiarMesh = famMesh;
                    }
                    const orbitSpeed = Date.now() * 0.003;
                    const radius = 1.8;
                    const fx = entry.mesh.position.x + Math.sin(orbitSpeed) * radius;
                    const fz = entry.mesh.position.z + Math.cos(orbitSpeed) * radius;
                    entry.familiarMesh.position.set(fx, 1.2, fz);
                    entry.familiarMesh.rotation.y = orbitSpeed + Math.PI / 2;
                } else if (entry.familiarMesh) {
                    this.scene.remove(entry.familiarMesh);
                    entry.familiarMesh.geometry.dispose();
                    entry.familiarMesh.material.dispose();
                    entry.familiarMesh = null;
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
                    let mesh;
                    let mixer = null;
                    const visual = this.enemyVisuals[es.type] || { geo: new THREE.BoxGeometry(1, 1, 1), color: 0xffffff };
                    if (es.type === 'MatilhaGeometra') {
                        mesh = new THREE.Group();
                        const pupGeo = new THREE.CylinderGeometry(0, 0.5, 1.5, 4, 1);
                        const pupMat = new THREE.MeshStandardMaterial({ 
                            color: 0xff0000, 
                            emissive: 0xaa0000,
                            roughness: 0.2,
                            metalness: 0.5
                        });
                        const pupMesh = new THREE.Mesh(pupGeo, pupMat);
                        pupMesh.rotation.y = Math.PI / 4;
                        pupMesh.rotation.x = Math.PI / 2;
                        pupMesh.castShadow = true;
                        mesh.add(pupMesh);
                    } else {
                        const mat = new THREE.MeshStandardMaterial({
                            color: visual.color,
                            emissive: visual.emissive || visual.color,
                            emissiveIntensity: es.type === 'TheMightyOne' ? 1.0 : (visual.emissiveIntensity || 0.2),
                            metalness: es.type === 'Farao' ? 0.7 : 0.4,
                            roughness: es.type === 'Farao' ? 0.3 : 0.5,
                            transparent: es.type === 'SuperBoss' || es.type === 'FeiticeiroImortal' || es.type === 'EspectroSombrio' || es.type === 'EspectroDeRaziel' || es.type === 'Smith' || es.type === 'CloneSmith',
                            opacity: visual.opacity !== undefined ? visual.opacity : (es.type === 'SuperBoss' ? 0.8 : es.type === 'EspectroSombrio' ? 0.5 : es.type === 'EspectroDeRaziel' ? 0.7 : 1.0),
                        });
                        if (es.type === 'EspectroSombrio') mat.emissive.set(0x00aaff);
                        if (es.type === 'EspectroDeRaziel') mat.emissive.set(0x00CCFF);
                        if (es.type === 'Smith' || es.type === 'CloneSmith') mat.metalness = 0.8;
                        if (es.type === 'DoutorDoenca') {
                            mat.metalness = 0.8;
                            mat.roughness = 0.1;
                        }
                        mesh = new THREE.Mesh(visual.geo.clone(), mat);
                        mesh.castShadow = true;

                        // --- CaoDosInfernos (Naafiri) Rework Visual Assembly ---
                        if (es.type === 'CaoDosInfernos') {
                            const glowMaterial = new THREE.MeshStandardMaterial({ 
                                color: 0xff0000, 
                                emissive: 0xaa0000,
                                roughness: 0.2,
                                metalness: 0.5
                            });
                            // Core
                            const coreGeo = new THREE.BoxGeometry(2.1, 0.5, 3);
                            const coreMesh = new THREE.Mesh(coreGeo, glowMaterial);
                            coreMesh.position.set(0, 0, 0);
                            mesh.add(coreMesh);
                            // Snout/Head
                            const headGeo = new THREE.CylinderGeometry(0, 1, 2, 4, 1);
                            const headMesh = new THREE.Mesh(headGeo, mat);
                            headMesh.rotation.x = Math.PI / 2;
                            headMesh.rotation.y = Math.PI / 4;
                            headMesh.position.set(0, 0, 2.5);
                            headMesh.castShadow = true;
                            mesh.add(headMesh);
                            // Teeth
                            for (let i = 0; i < 3; i++) {
                                const toothGeo = new THREE.CylinderGeometry(0, 0.3, 1, 4, 1);
                                const toothMesh = new THREE.Mesh(toothGeo, glowMaterial);
                                toothMesh.rotation.x = Math.PI / 2;
                                toothMesh.rotation.y = Math.PI / 4;
                                toothMesh.position.set(-0.6 + (i * 0.6), -0.55, 3.2);
                                mesh.add(toothMesh);
                            }
                            // Back spikes
                            for (let i = 0; i < 2; i++) {
                                const spikeGeo = new THREE.CylinderGeometry(0, 0.5, 2, 4, 1);
                                const spikeMesh = new THREE.Mesh(spikeGeo, glowMaterial);
                                spikeMesh.rotation.y = Math.PI / 4;
                                spikeMesh.rotation.x = -Math.PI / 6;
                                spikeMesh.position.set(0, 1.25, -1 + (i * 1.5));
                                mesh.add(spikeMesh);
                            }
                        }
                    }

                    if (es.type === 'DoutorDoenca') {

                        const limbGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 6);
                        const limbMat = new THREE.MeshStandardMaterial({
                            color: 0x39ff14,
                            emissive: 0x39ff14,
                            emissiveIntensity: 1.0,
                            roughness: 0.2,
                            metalness: 0.1
                        });

                        mesh.userData.limbs = [];
                        for (let i = 0; i < 4; i++) {
                            const limb = new THREE.Mesh(limbGeo, limbMat);
                            limb.castShadow = true;
                            const angle = (i / 4) * Math.PI * 2;
                            limb.position.set(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2);
                            limb.rotation.x = Math.PI / 4;
                            limb.rotation.z = Math.PI / 4;
                            mesh.add(limb);
                            mesh.userData.limbs.push(limb);
                        }

                        const esporoGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
                        const esporoMat = new THREE.MeshStandardMaterial({
                            color: 0x39ff14,
                            emissive: 0x39ff14,
                            emissiveIntensity: 1.0
                        });
                        mesh.userData.esporos = [];
                        for (let i = 0; i < 12; i++) {
                            const esporo = new THREE.Mesh(esporoGeo, esporoMat);
                            esporo.position.set(Math.cos(i) * 3, 0.5 - Math.random(), Math.sin(i) * 3);
                            mesh.add(esporo);
                            mesh.userData.esporos.push(esporo);
                        }
                    }

                    // ─── FARAÓ — geometric low-poly assembly ─────────────────
                    if (es.type === 'Farao') {
                        // Head — square pyramid (nemes headdress)
                        const headGeo = new THREE.BoxGeometry(1.8, 1.2, 1.2);
                        const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a700, emissive: 0xffd700, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2 });
                        const headMesh = new THREE.Mesh(headGeo, headMat);
                        headMesh.position.y = 2.0;
                        mesh.add(headMesh);
                        // Crown — pyramid atop head (uraeus)
                        const crownGeo = new THREE.ConeGeometry(0.5, 1.2, 4);
                        const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 1.0, metalness: 0.9, roughness: 0.1 });
                        const crownMesh = new THREE.Mesh(crownGeo, crownMat);
                        crownMesh.position.y = 3.2;
                        crownMesh.rotation.y = Math.PI / 4;
                        mesh.add(crownMesh);
                        // Staff — vertical bar on right side
                        const staffGeo = new THREE.BoxGeometry(0.15, 4.5, 0.15);
                        const staffMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, emissive: 0xdaa520, emissiveIntensity: 0.3, metalness: 0.6 });
                        const staffMesh = new THREE.Mesh(staffGeo, staffMat);
                        staffMesh.position.set(1.5, 0.8, 0);
                        mesh.add(staffMesh);
                        // Staff top — ankh cross piece
                        const crossGeo = new THREE.BoxGeometry(0.8, 0.15, 0.15);
                        const crossMesh = new THREE.Mesh(crossGeo, staffMat);
                        crossMesh.position.set(1.5, 3.2, 0);
                        mesh.add(crossMesh);
                        // Scarab chest piece — glowing box
                        const scarabGeo = new THREE.BoxGeometry(0.8, 0.5, 0.2);
                        const scarabMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00e5ff, emissiveIntensity: 1.2 });
                        const scarabMesh = new THREE.Mesh(scarabGeo, scarabMat);
                        scarabMesh.position.set(0, 0.4, 0.8);
                        mesh.add(scarabMesh);
                        // Eye of Ra — flat plane on face
                        const eyeGeo = new THREE.BoxGeometry(0.35, 0.2, 0.05);
                        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
                        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
                        const eyeR = eyeL.clone();
                        eyeL.position.set(-0.4, 2.0, 0.65);
                        eyeR.position.set(0.4, 2.0, 0.65);
                        mesh.add(eyeL); mesh.add(eyeR);
                        // Scale up — Faraó is a god-tier boss
                        mesh.scale.set(1.4, 1.4, 1.4);
                    }

                    this.scene.add(mesh);
                    // HP bar above enemy
                    const hpGroup = this.createHpBar();
                    if (es.type === 'Farao') hpGroup.position.y += 3; // taller boss
                    mesh.add(hpGroup);
                    entry = { mesh, type: 'enemy', hpBar: hpGroup, lastUpdate: Date.now(), mixer, orbitingSoulMeshes: [], cylinderMesh: null, auraMesh: null, headMesh: null, visorMesh: null, bsodMesh: null, isFarao: es.type === 'Farao' };
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
                // Update size multiplier for EspectroDeRaziel, Smith, and CaoDosInfernos
                if ((es.type === 'EspectroDeRaziel' || es.type === 'Smith' || es.type === 'CaoDosInfernos') && es.sizeMultiplier) {
                    entry.mesh.scale.set(es.sizeMultiplier, es.sizeMultiplier, es.sizeMultiplier);
                }
                // Shield visualization for CaoDosInfernos
                if (es.type === 'CaoDosInfernos' && es.shieldActive && !entry.shieldMesh) {
                    const shieldGeo = new THREE.IcosahedronGeometry(2.5, 0); // sharp polygon shield
                    const shieldMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.4, wireframe: true });
                    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
                    entry.mesh.add(shieldMesh);
                    entry.shieldMesh = shieldMesh;
                }
                if (es.type === 'CaoDosInfernos') {
                    if (entry.shieldMesh) {
                        entry.shieldMesh.visible = es.shieldActive || false;
                        entry.shieldMesh.rotation.y += 0.01;
                        entry.shieldMesh.rotation.x += 0.005;
                    }
                    // Channeling W: red line effect
                    if (es.isChannelingW && !entry.channelLine) {
                        const lineGeo = new THREE.BufferGeometry().setFromPoints([
                            new THREE.Vector3(0, 0.5, 0),
                            new THREE.Vector3(0, 6, 0)
                        ]);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 3 });
                        const lineMesh = new THREE.Line(lineGeo, lineMat);
                        entry.mesh.add(lineMesh);
                        entry.channelLine = lineMesh;
                    }
                    if (entry.channelLine) entry.channelLine.visible = es.isChannelingW || false;
                    // Ult active: pulse effect
                    if (es.isUltActive) {
                        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                        entry.mesh.material.emissiveIntensity = 0.4 + pulse * 0.6;
                    }
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
                
                // --- Farao specific visuals ---
                if (entry.isFarao || es.type === 'Farao') {
                    // Eclipse active (Global scene change)
                    if (es.eclipseActive && !this.scene.eclipseDarkened) {
                        this.scene.background = new THREE.Color(0x030005);
                        this.scene.fog.color = new THREE.Color(0x030005);
                        this.scene.eclipseDarkened = true;
                    } else if (!es.eclipseActive && this.scene.eclipseDarkened) {
                        this.scene.background = new THREE.Color(0x100018);
                        this.scene.fog.color = new THREE.Color(0x100018);
                        this.scene.eclipseDarkened = false;
                    }

                    // Raio Warning
                    if (es.isRaioWarning && es.raioTargetX !== undefined && !entry.raioMesh) {
                        const raioGeo = new THREE.CylinderGeometry(1.5, 1.5, 10, 16);
                        const raioMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.3 });
                        const raioMesh = new THREE.Mesh(raioGeo, raioMat);
                        raioMesh.position.set(es.raioTargetX, 5, es.raioTargetZ);
                        this.scene.add(raioMesh);
                        entry.raioMesh = raioMesh;
                    } else if (entry.raioMesh) {
                        if (!es.isRaioWarning) {
                            this.scene.remove(entry.raioMesh);
                            entry.raioMesh.geometry.dispose();
                            entry.raioMesh.material.dispose();
                            entry.raioMesh = null;
                        } else {
                            // Update position if it tracks
                            entry.raioMesh.position.x = es.raioTargetX;
                            entry.raioMesh.position.z = es.raioTargetZ;
                        }
                    }

                    // Julgamento Safe Zone visualization
                    if (es.isJulgamentoActive && es.julgamentoSafeX !== undefined && !entry.julgamentoZone) {
                        const zoneGeo = new THREE.PlaneGeometry(15, 15); // Large safe zone area
                        const zoneMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
                        const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
                        zoneMesh.rotation.x = -Math.PI / 2;
                        zoneMesh.position.set(es.julgamentoSafeX, 0.1, es.julgamentoSafeZ || 0); // Need safeZ if defined, else 0
                        this.scene.add(zoneMesh);
                        entry.julgamentoZone = zoneMesh;
                    } else if (entry.julgamentoZone && !es.isJulgamentoActive) {
                        this.scene.remove(entry.julgamentoZone);
                        entry.julgamentoZone.geometry.dispose();
                        entry.julgamentoZone.material.dispose();
                        entry.julgamentoZone = null;
                    }

                    // Levitation (adjust Y)
                    if (es.isLevitating) {
                        entry.mesh.position.y = THREE.MathUtils.lerp(entry.mesh.position.y, 2.0, 0.1);
                    } else {
                        entry.mesh.position.y = THREE.MathUtils.lerp(entry.mesh.position.y, 0, 0.1);
                    }
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
                if (es.type === 'DoutorDoenca') {
                    entry.mesh.rotation.x += 0.005;
                    entry.mesh.rotation.z += 0.003;

                    if (entry.mesh.userData.limbs) {
                        const time = Date.now() * 0.003;
                        entry.mesh.userData.limbs.forEach((limb, i) => {
                            limb.position.y = Math.sin(time + i) * 0.3;
                            limb.rotation.y += 0.01;
                        });
                    }

                    if (entry.mesh.userData.esporos) {
                        const time = Date.now() * 0.0015;
                        entry.mesh.userData.esporos.forEach((esporo, i) => {
                            const orbitRadius = 2.5 + 0.5 * Math.sin(time + i);
                            const angle = time + (i / 12) * Math.PI * 2;
                            esporo.position.set(Math.cos(angle) * orbitRadius, 0.5 * Math.sin(time * 2 + i), Math.sin(angle) * orbitRadius);
                        });
                    }

                    if (es.isSurtoActive) {
                        const pulseScale = 1.0 + 0.35 * Math.abs(Math.sin(Date.now() * 0.015));
                        entry.mesh.scale.set(pulseScale, pulseScale, pulseScale);
                    } else {
                        entry.mesh.scale.set(1.0, 1.0, 1.0);
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
                    let projColor = c;
                    if (ps.skillUpgrades?.q === 'q_impacto_estilhacante') projColor = 0x00ffff; // cyan
                    else if (ps.skillUpgrades?.q === 'q_convergencia_assassina') projColor = 0x8A2BE2; // purple
                    else if (ps.skillUpgrades?.q === 'q_rastro_polvora') projColor = 0xff4500; // orange
                    if (ps.specialEffect === 'matilha_projectile') projColor = 0xff3333; // bright red
                    else if (ps.specialEffect === 'injecao_geometrica') projColor = 0x39ff14;
                    else if (ps.specialEffect === 'esporo_basico') projColor = 0x39ff14;
                    const mat = new THREE.MeshStandardMaterial({
                        color: projColor, emissive: projColor, emissiveIntensity: 2,
                        wireframe: ps.skillUpgrades?.q === 'q_impacto_estilhacante'
                    });
                    let geo = this.geometries.projectile.clone();
                    if (ps.specialEffect === 'prismaSombrio') {
                        geo = new THREE.CylinderGeometry(0, 0.4, 1.5, 4, 1);
                        geo.rotateX(Math.PI / 2);
                        geo.rotateY(Math.PI / 4);
                    } else if (ps.specialEffect === 'matilha_projectile') {
                        geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
                    } else if (ps.specialEffect === 'injecao_geometrica') {
                        geo = new THREE.CylinderGeometry(0, 0.35, 1.8, 4, 1);
                        geo.rotateX(Math.PI / 2);
                        geo.rotateY(Math.PI / 4);
                    } else if (ps.specialEffect === 'esporo_basico') {
                        geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
                    }
                    const mesh = new THREE.Mesh(geo, mat);
                    this.scene.add(mesh);
                    entry = { mesh };
                    this.projectilePool.set(ps.id, entry);
                }
                const prevProj = prev?.projectiles?.find(p => p.id === ps.id);
                const tx = prevProj ? THREE.MathUtils.lerp(prevProj.x, ps.x, alpha) : ps.x;
                const ty = ps.y || 0.5;
                const tz = prevProj ? THREE.MathUtils.lerp(prevProj.z, ps.z, alpha) : ps.z;
                entry.mesh.position.set(tx, ty, tz);
                if (prevProj) {
                    const dx = ps.x - prevProj.x;
                    const dz = ps.z - prevProj.z;
                    if (dx*dx + dz*dz > 0.0001) {
                        entry.mesh.rotation.y = Math.atan2(dx, dz);
                    }
                }
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
                    let geo = new THREE.CircleGeometry(de.radius || 3, 32);
                    let isLine = false;
                    if (de.type === 'blizzard' || de.type === 'nevascaZone') { color = 0x00aaff; geo = new THREE.RingGeometry(de.radius || 3, (de.radius || 3) + 0.1, 32); }
                    else if (de.type === 'tormentFlames') color = 0x5a189a;
                    else if (de.type === 'cannonSalvo') color = 0xff6600;
                    else if (de.type === 'powderKeg') color = 0x8B4513;
                    // W upgrade visuals
                    else if (de.type === 'w_campo_hemorragia') { color = 0xff0000; geo = new THREE.TetrahedronGeometry(de.radius || 1); }
                    else if (de.type === 'w_refracao_vital') { color = 0x00ff00; geo = new THREE.SphereGeometry(de.radius || 2, 16, 16); }
                    else if (de.type === 'w_vacuo_magnetico') { color = 0x0000ff; geo = new THREE.SphereGeometry(de.radius || 2, 16, 16); }
                    // Mine for Q upgrade
                    else if (de.type === 'mine') { color = 0xff4500; geo = new THREE.SphereGeometry(de.radius || 0.5, 8, 8); }
                    // Explosion for R upgrade
                    else if (de.type === 'explosion') { color = 0xffff00; geo = new THREE.SphereGeometry(de.radius || 5, 32, 32); }
                    // Basic & Mutated Ultimates zones
                    else if (de.type === 'pulso_arcano') { color = 0x8A2BE2; geo = new THREE.SphereGeometry(de.radius || 8, 16, 16); }
                    else if (de.type === 'chuva_tetraedros_zone') { color = 0xff4500; geo = new THREE.TetrahedronGeometry(de.radius || 4); }
                    else if (de.type === 'singularidade_zone') { color = 0x4b0082; geo = new THREE.IcosahedronGeometry(de.radius || 6, 1); }
                    else if (de.type === 'distorcao_temporal_zone') { color = 0x00ffff; geo = new THREE.RingGeometry(de.radius || 8, (de.radius || 8) + 0.2, 32); }
                    else if (de.type === 'terremoto_geometrico_zone') { color = 0x39ff14; geo = new THREE.DodecahedronGeometry(de.radius || 8, 0); }
                    // Cão dos Infernos zones
                    else if (de.type === 'prismaSombrio') { color = 0x8B0000; geo = new THREE.IcosahedronGeometry(de.radius || 3, 0); }
                    else if (de.type === 'investidaChannel') {
                        color = 0xFF0000;
                        const points = [
                            new THREE.Vector3(0, 0.05, 0),
                            new THREE.Vector3((de.extras?.targetX || 0) - de.x, 0.05, (de.extras?.targetZ || 0) - de.z)
                        ];
                        geo = new THREE.BufferGeometry().setFromPoints(points);
                        isLine = true;
                    }
                    else if (de.type === 'investidaImpact') { color = 0xFF0000; geo = new THREE.CylinderGeometry(0.2, 0.2, 6, 8); }
                    else if (de.type === 'eviscerarStart' || de.type === 'eviscerarSlam') { color = 0xFF4400; geo = new THREE.CylinderGeometry(1, 1, 0.5, 16); }
                    else if (de.type === 'chamadoAbismo') { color = 0x4A0000; geo = new THREE.IcosahedronGeometry(de.radius || 8, 1); }
                    else if (de.type === 'nuvem_esporos') { color = 0x39ff14; geo = new THREE.IcosahedronGeometry(de.radius || 8, 1); }
                    else if (de.type === 'esporo_explosion') { color = 0x39ff14; geo = new THREE.SphereGeometry(de.radius || 3.5, 16, 16); }
                    const mat = isLine
                        ? new THREE.LineBasicMaterial({ color, linewidth: 4 })
                        : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, wireframe: de.type === 'w_campo_hemorragia' || de.type === 'prismaSombrio' || de.type === 'chamadoAbismo' || de.type === 'nuvem_esporos' || de.type === 'singularidade_zone' || de.type === 'terremoto_geometrico_zone' });
                    const mesh = isLine ? new THREE.Line(geo, mat) : new THREE.Mesh(geo, mat);
                    if (!isLine && de.type !== 'eviscerarStart' && de.type !== 'eviscerarSlam') mesh.rotation.x = -Math.PI / 2;
                    mesh.position.y = 0.02;
                    this.scene.add(mesh);
                    entry = { mesh, isLine };
                    this.zonePool.set(de.id, entry);
                }
                entry.mesh.position.set(de.x, 0.02, de.z);
                if (entry.mesh.material) {
                    entry.mesh.material.opacity = de.opacity != null ? de.opacity * 0.4 : 0.3;
                }
                // Vacuum upgrade: implode effect
                if (de.type === 'w_vacuo_magnetico') {
                    const scale = 1 - (de.timer || 0) / (de.duration || 1);
                    entry.mesh.scale.set(scale, scale, scale);
                }
                // Esporo explosion: expand effect
                if (de.type === 'esporo_explosion') {
                    const scale = 1 - (de.timer || 0) / (de.duration || 1);
                    entry.mesh.scale.set(scale, scale, scale);
                }
                // Ultimate zones scale/rotate effects
                if (de.type === 'pulso_arcano' || de.type === 'terremoto_geometrico_zone') {
                    const scale = 1 - (de.timer || 0) / (de.duration || 1);
                    entry.mesh.scale.set(scale, scale, scale);
                }
                if (de.type === 'singularidade_zone') {
                    const scale = 1.0 + Math.sin(Date.now() / 100) * 0.1;
                    entry.mesh.scale.set(scale, scale, scale);
                    entry.mesh.rotation.z += 0.02;
                }
                if (de.type === 'chuva_tetraedros_zone') {
                    const scale = 1 - (de.timer || 0) / (de.duration || 1);
                    entry.mesh.scale.set(scale, scale, scale);
                    entry.mesh.rotation.z += 0.05;
                }
                // Eviscerar: expand cylinder shockwave
                if (de.type === 'eviscerarStart' || de.type === 'eviscerarSlam') {
                    const elapsed = (de.duration || 500) - (de.timer || 0);
                    const progress = Math.max(0, Math.min(1, elapsed / (de.duration || 500)));
                    const targetRadius = de.radius || 6;
                    const scale = progress * targetRadius;
                    entry.mesh.scale.set(scale, 1, scale);
                }
                // Investida: rotate cylinder to point direction
                if (!entry.isLine && (de.type === 'investidaChannel' || de.type === 'investidaImpact')) {
                    entry.mesh.rotation.y = Date.now() * 0.005;
                }
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
                if (entry.familiarMesh) { this.scene.remove(entry.familiarMesh); entry.familiarMesh.geometry.dispose(); entry.familiarMesh.material.dispose(); }
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
