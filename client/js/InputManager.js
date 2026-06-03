import * as THREE from 'three';

/**
 * InputManager - Captures keyboard, mouse, and touch inputs
 * Sends input state to the network client at a fixed rate
 */
export class InputManager {
    constructor(networkClient) {
        this.net = networkClient;
        this.keys = { w: false, a: false, s: false, d: false };
        this.mouseX = 0; // normalized -1..1
        this.mouseY = 0;
        this.joystickX = 0;
        this.joystickY = 0;
        this.worldX = 0;
        this.worldZ = 0;
        this.isAttacking = false;
        this.platform = 'pc';
        this.camera = null;
        this.scene = null;
        this.sendInterval = null;
        this.boundHandlers = {};
        this.clickIndicators = [];
        
        // Mobile drag aiming states
        this.isMobileAiming = false;
        this.aimIndicatorGroup = null;
        this.aimIndicatorMaterial = null;
    }

    setup(platform, camera, scene) {
        this.platform = platform;
        this.camera = camera;
        this.scene = scene;
        this.net.selectPlatform(platform);

        if (platform === 'pc') {
            this.setupPC();
        } else {
            this.createAimIndicator();
            this.setupMobile();
        }
        // Send input at 20Hz
        this.sendInterval = setInterval(() => this.sendInput(), 50);
    }

    setupPC() {
        document.getElementById('skills-hud').style.display = 'flex';
        document.getElementById('mobile-controls').style.display = 'none';

        const onKeyDown = (e) => {
            const k = e.key.toLowerCase();
            if (k === 'tab') {
                e.preventDefault();
                if (window.hudManager) {
                    window.hudManager.setStatsOpen(true);
                }
                return;
            }
            if (['w', 'a', 's', 'd'].includes(k)) {
                this.keys[k] = true;
            } else if (k === 'q') {
                this.net.useSkill('q');
            } else if (k === 'e') {
                this.net.useSkill('w');
            } else if (k === 'r') {
                this.net.useSkill('e');
            } else if (k === 'f') {
                this.net.useSkill('r');
            } else if (e.code === 'Space') {
                this.net.useSkill('jump');
            }
        };
        const onKeyUp = (e) => {
            const k = e.key.toLowerCase();
            if (k === 'tab') {
                e.preventDefault();
                if (window.hudManager) {
                    window.hudManager.setStatsOpen(false);
                }
                return;
            }
            if (['w', 'a', 's', 'd'].includes(k)) {
                this.keys[k] = false;
            }
        };
        const onMouseMove = (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        const onMouseDown = (e) => {
            if (e.button === 0) { // Left click
                if (!this.isAttacking) {
                    this.isAttacking = true;
                    this.net.attackStart();
                }
            }
        };
        const onMouseUp = (e) => {
            if (e.button === 0) {
                this.isAttacking = false;
                this.net.attackStop();
            }
        };
        const onContextMenu = (e) => e.preventDefault();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        document.body.addEventListener('contextmenu', onContextMenu);

        this.boundHandlers = { onKeyDown, onKeyUp, onMouseMove, onMouseDown, onMouseUp, onContextMenu };
    }

    updateWorldRaycast() {
        if (this.platform === 'pc' && this.camera) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(this.mouseX, this.mouseY), this.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, target)) {
                this.worldX = target.x;
                this.worldZ = target.z;
            }
        }
    }

    createClickIndicator(x, z) {
        if (!this.scene) return;
        const geo = new THREE.RingGeometry(0.1, 0.4, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.05, z);
        this.scene.add(mesh);
        this.clickIndicators.push({ mesh, timer: 0.3, maxTimer: 0.3 });
    }

    update(dt) {
        for (let i = this.clickIndicators.length - 1; i >= 0; i--) {
            const ind = this.clickIndicators[i];
            ind.timer -= dt;
            if (ind.timer <= 0) {
                this.scene.remove(ind.mesh);
                this.clickIndicators.splice(i, 1);
            } else {
                const scale = 1 + (1 - ind.timer / ind.maxTimer) * 2;
                ind.mesh.scale.set(scale, scale, scale);
                ind.mesh.material.opacity = ind.timer / ind.maxTimer;
            }
        }
    }

    createAimIndicator() {
        if (!this.scene) return;
        
        this.aimIndicatorGroup = new THREE.Group();
        this.aimIndicatorGroup.visible = false;
        
        this.aimIndicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        // Stem (pointing along +Z, flat on XZ plane)
        const stemGeo = new THREE.PlaneGeometry(0.6, 3.0);
        const stemMesh = new THREE.Mesh(stemGeo, this.aimIndicatorMaterial);
        stemMesh.rotation.x = -Math.PI / 2;
        stemMesh.position.set(0, 0.05, 1.5); // extends forward in +Z
        this.aimIndicatorGroup.add(stemMesh);
        
        // Arrowhead (tip pointing along +Z)
        const coneGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
        const coneMesh = new THREE.Mesh(coneGeo, this.aimIndicatorMaterial);
        coneMesh.rotation.x = Math.PI / 2; // rotates cone to point along +Z
        coneMesh.position.set(0, 0.05, 3.75); // positioned at the end of the stem
        this.aimIndicatorGroup.add(coneMesh);
        
        this.scene.add(this.aimIndicatorGroup);
    }

    updateAimIndicator(dirX, dirZ, isCancelled) {
        if (!this.aimIndicatorGroup) return;
        
        const playerMesh = window.snapshotRenderer?.getLocalPlayerMesh(this.net.playerId);
        if (!playerMesh) {
            this.aimIndicatorGroup.visible = false;
            return;
        }
        
        this.aimIndicatorGroup.position.copy(playerMesh.position);
        this.aimIndicatorGroup.position.y = 0.05;
        
        const angle = Math.atan2(dirX, dirZ);
        this.aimIndicatorGroup.rotation.y = angle;
        
        if (isCancelled) {
            this.aimIndicatorMaterial.color.setHex(0xff3333); // red
        } else {
            this.aimIndicatorMaterial.color.setHex(0x00e5ff); // cyan
        }
        
        this.aimIndicatorGroup.visible = true;
    }

    hideAimIndicator() {
        if (this.aimIndicatorGroup) {
            this.aimIndicatorGroup.visible = false;
        }
    }

    getClosestEnemyPosition() {
        const currentSnapshot = window.snapshotRenderer?.currentSnapshot;
        if (!currentSnapshot || !currentSnapshot.enemies) return null;
        const localPlayerMesh = window.snapshotRenderer.getLocalPlayerMesh(this.net.playerId);
        if (!localPlayerMesh) return null;
        
        let closestEnemy = null;
        let minDist = Infinity;
        const pPos = localPlayerMesh.position;
        
        for (const enemy of currentSnapshot.enemies) {
            // Skip dead or destroyed enemies if possible
            if (enemy.hp <= 0) continue;
            const dx = enemy.x - pPos.x;
            const dz = enemy.z - pPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDist) {
                minDist = dist;
                closestEnemy = enemy;
            }
        }
        return closestEnemy ? { x: closestEnemy.x, z: closestEnemy.z } : null;
    }

    setupMobile() {
        document.getElementById('skills-hud').style.display = 'none';
        document.getElementById('mobile-controls').style.display = 'block';

        this.setupJoystick();

        // Setup action buttons (ATK, Q, W, E, R) with drag-to-aim controls
        this.setupActionButton('attack-button', 'attack');
        this.setupActionButton('q-button', 'q');
        this.setupActionButton('w-button', 'w');
        this.setupActionButton('e-button', 'e');
        this.setupActionButton('r-button', 'r');
    }

    setupActionButton(btnId, type) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const thumb = btn.querySelector('.aim-thumb');
        const cancelZone = document.getElementById('aim-cancel-zone');
        let touchId = null;
        let startX = 0;
        let startY = 0;
        const maxRadius = 45; // limit drag visual knob to 45px
        let isCancelled = false;
        let hasDragged = false;
        
        btn.addEventListener('touchstart', (e) => {
            if (touchId !== null) return;
            e.preventDefault();
            
            const touch = e.changedTouches[0];
            touchId = touch.identifier;
            startX = touch.clientX;
            startY = touch.clientY;
            isCancelled = false;
            hasDragged = false;
            
            // Show cancel overlay
            if (cancelZone) {
                cancelZone.style.display = 'flex';
                cancelZone.classList.remove('active');
            }
            
            // Position knob at center of button
            if (thumb) {
                thumb.style.display = 'block';
                thumb.style.transform = 'translate(-50%, -50%)';
            }
            
            // If it is basic attack, start firing right away
            if (type === 'attack') {
                const closestEnemyPos = this.getClosestEnemyPosition();
                if (closestEnemyPos) {
                    this.worldX = closestEnemyPos.x;
                    this.worldZ = closestEnemyPos.z;
                    this.sendInput();
                }
                this.net.attackStart();
            }
        }, { passive: false });
        
        btn.addEventListener('touchmove', (e) => {
            if (touchId === null) return;
            e.preventDefault();
            
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.identifier === touchId) {
                    let dx = touch.clientX - startX;
                    let dy = touch.clientY - startY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 8) {
                        hasDragged = true;
                    }
                    
                    if (dist > maxRadius) {
                        dx = (dx / dist) * maxRadius;
                        dy = (dy / dist) * maxRadius;
                    }
                    
                    if (thumb) {
                        thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    }
                    
                    const joyX = dx / maxRadius;
                    const joyY = dy / maxRadius;
                    const joyLen = Math.sqrt(joyX * joyX + joyY * joyY);
                    
                    if (joyLen > 0.15) {
                        const dirX = joyX / joyLen;
                        const dirZ = joyY / joyLen;
                        
                        // Check if touch coordinates fall inside cancel zone bounds
                        if (cancelZone) {
                            const rect = cancelZone.getBoundingClientRect();
                            isCancelled = (
                                touch.clientX >= rect.left &&
                                touch.clientX <= rect.right &&
                                touch.clientY >= rect.top &&
                                touch.clientY <= rect.bottom
                            );
                            if (isCancelled) {
                                cancelZone.classList.add('active');
                            } else {
                                cancelZone.classList.remove('active');
                            }
                        }
                        
                        // Tell network client we are aiming to prevent player movement vector from overriding facing angle
                        this.isMobileAiming = true;
                        
                        // Set world coords ahead of player
                        const playerMesh = window.snapshotRenderer?.getLocalPlayerMesh(this.net.playerId);
                        if (playerMesh) {
                            this.worldX = playerMesh.position.x + dirX * 10;
                            this.worldZ = playerMesh.position.z + dirZ * 10;
                        }
                        
                        this.updateAimIndicator(dirX, dirZ, isCancelled);
                    } else {
                        this.hideAimIndicator();
                    }
                    break;
                }
            }
        }, { passive: false });
        
        const onTouchEnd = (e) => {
            if (touchId === null) return;
            
            let targetTouch = null;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    targetTouch = e.changedTouches[i];
                    break;
                }
            }
            
            if (targetTouch) {
                e.preventDefault();
                
                if (cancelZone) {
                    cancelZone.style.display = 'none';
                    cancelZone.classList.remove('active');
                }
                if (thumb) {
                    thumb.style.display = 'none';
                }
                this.hideAimIndicator();
                this.isMobileAiming = false;
                
                if (type === 'attack') {
                    this.net.attackStop();
                }
                
                if (!isCancelled) {
                    if (hasDragged) {
                        // Cast in aimed direction
                        this.sendInput();
                        if (type !== 'attack') {
                            this.net.useSkill(type);
                        }
                    } else {
                        // Tap: auto-target closest enemy if available
                        const closestEnemyPos = this.getClosestEnemyPosition();
                        if (closestEnemyPos) {
                            this.worldX = closestEnemyPos.x;
                            this.worldZ = closestEnemyPos.z;
                            this.sendInput();
                        }
                        if (type !== 'attack') {
                            this.net.useSkill(type);
                        }
                    }
                }
                
                touchId = null;
            }
        };
        
        btn.addEventListener('touchend', onTouchEnd, { passive: false });
        btn.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }

    setupJoystick() {
        const cont = document.getElementById('joystick-container');
        const thumb = document.getElementById('joystick-thumb');
        if (!cont || !thumb) return;
        
        const getMaxR = () => {
            const r = cont.offsetWidth / 2 - thumb.offsetWidth / 2;
            return r > 0 ? r : 45; // Default fallback if element is hidden/layout not ready
        };

        let touchId = null;

        cont.addEventListener('touchstart', (e) => {
            if (touchId === null) { e.preventDefault(); touchId = e.changedTouches[0].identifier; }
        }, { passive: false });

        cont.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const maxR = getMaxR();
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === touchId) {
                    const rect = cont.getBoundingClientRect();
                    const t = e.touches[i];
                    let x = t.clientX - rect.left - rect.width / 2;
                    let y = t.clientY - rect.top - rect.height / 2;
                    const dist = Math.sqrt(x * x + y * y);
                    if (dist > maxR) { x = (x / dist) * maxR; y = (y / dist) * maxR; }
                    thumb.style.transform = `translate(${x}px, ${y}px)`;
                    this.joystickX = x / maxR;
                    this.joystickY = y / maxR;
                    break;
                }
            }
        }, { passive: false });

        const onTouchEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    thumb.style.transform = 'translate(0px, 0px)';
                    this.joystickX = 0;
                    this.joystickY = 0;
                    touchId = null;
                    break;
                }
            }
        };

        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);
    }

    sendInput() {
        if (!this.net.connected) return;

        this.updateWorldRaycast();

        this.net.sendInput(
            this.keys,
            this.mouseX, this.mouseY,
            this.joystickX, this.joystickY,
            this.worldX, this.worldZ,
            this.isMobileAiming
        );
    }

    destroy() {
        if (this.sendInterval) clearInterval(this.sendInterval);
        const h = this.boundHandlers;
        if (h.onKeyDown) window.removeEventListener('keydown', h.onKeyDown);
        if (h.onKeyUp) window.removeEventListener('keyup', h.onKeyUp);
        if (h.onMouseMove) window.removeEventListener('mousemove', h.onMouseMove);
        if (h.onMouseDown) window.removeEventListener('mousedown', h.onMouseDown);
        if (h.onMouseUp) window.removeEventListener('mouseup', h.onMouseUp);
    }
}
