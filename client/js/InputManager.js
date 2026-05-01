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
    }

    setup(platform, camera, scene) {
        this.platform = platform;
        this.camera = camera;
        this.scene = scene;
        this.net.selectPlatform(platform);

        if (platform === 'pc') {
            this.setupPC();
        } else {
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
            }
        };
        const onKeyUp = (e) => {
            const k = e.key.toLowerCase();
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

    setupMobile() {
        document.getElementById('skills-hud').style.display = 'none';
        document.getElementById('mobile-controls').style.display = 'block';

        this.setupJoystick();

        // Attack button
        const attackBtn = document.getElementById('attack-button');
        let attackInterval;
        attackBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.net.attackStart();
            attackInterval = setInterval(() => {}, 100);
        }, { passive: false });
        attackBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.net.attackStop();
            clearInterval(attackInterval);
        });

        // Skill buttons
        ['q', 'w', 'e', 'r'].forEach(skill => {
            const btn = document.getElementById(`${skill}-button`);
            if (btn) {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.net.useSkill(skill);
                }, { passive: false });
            }
        });
    }

    setupJoystick() {
        const cont = document.getElementById('joystick-container');
        const thumb = document.getElementById('joystick-thumb');
        if (!cont || !thumb) return;
        const maxR = cont.offsetWidth / 2 - thumb.offsetWidth / 2;
        let touchId = null;

        cont.addEventListener('touchstart', (e) => {
            if (touchId === null) { e.preventDefault(); touchId = e.changedTouches[0].identifier; }
        }, { passive: false });

        cont.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    const rect = cont.getBoundingClientRect();
                    const t = e.changedTouches[i];
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

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    thumb.style.transform = 'translate(0px, 0px)';
                    this.joystickX = 0;
                    this.joystickY = 0;
                    touchId = null;
                    break;
                }
            }
        });
    }

    sendInput() {
        if (!this.net.connected) return;

        // Update worldX/Z based on current camera and mouse position before sending
        this.updateWorldRaycast();

        this.net.sendInput(
            this.keys,
            this.mouseX, this.mouseY,
            this.joystickX, this.joystickY,
            this.worldX, this.worldZ
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
