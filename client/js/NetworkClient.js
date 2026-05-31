/**
 * NetworkClient - WebSocket connection to the survival game server
 * Handles connection, message routing, and input sending
 */
export class NetworkClient {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.serverVersion = null;
        this.tickRate = 20;
        this.connected = false;
        this.listeners = new Map(); // event -> callbacks[]
        this.pingInterval = null;
        this.lastPing = 0;
        this.latency = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);
                this.ws.onopen = () => {
                    console.log('[Network] Connected to server');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.startPing();
                    resolve();
                };
                this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
                this.ws.onclose = (event) => {
                    console.log('[Network] Disconnected', event.code, event.reason);
                    this.connected = false;
                    this.stopPing();
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
                        console.log(`[Network] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                        setTimeout(() => this.connect(url), delay);
                    }
                };
                this.ws.onerror = (err) => {
                    console.error('[Network] Error:', err);
                    reject(err);
                };
            } catch (e) { reject(e); }
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'WELCOME':
                this.playerId = msg.payload.playerId;
                this.serverVersion = msg.payload.serverVersion;
                this.tickRate = msg.payload.tickRate;
                console.log(`[Network] Welcome! ID: ${this.playerId.slice(0, 8)}, Server v${this.serverVersion}`);
                this.emit('welcome', msg.payload);
                break;
            case 'QUEUE_STATUS':
                this.emit('queueStatus', msg.payload);
                break;
            case 'MATCH_FOUND':
                this.emit('matchFound', msg.payload);
                break;
            case 'GAME_START':
                this.emit('gameStart', msg.payload);
                break;
            case 'GAME_STATE':
                this.emit('gameState', msg.payload);
                break;
            case 'GAME_OVER':
                this.emit('gameOver', msg.payload);
                break;
            case 'EVENT':
                this.emit('gameEvent', msg.payload);
                break;
            case 'UPGRADE_PROMPT':
                this.emit('upgradePrompt', msg.payload);
                break;
            case 'PLAYER_DIED':
                this.emit('playerDied', msg.payload);
                break;
            case 'PONG':
                this.latency = Date.now() - this.lastPing;
                this.emit('latencyUpdate', this.latency);
                break;
            case 'ERROR':
                console.error('[Network] Server error:', msg.payload.message);
                this.emit('serverError', msg.payload);
                break;
        }
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }
    off(event, callback) {
        const cbs = this.listeners.get(event);
        if (cbs) this.listeners.set(event, cbs.filter(cb => cb !== callback));
    }
    emit(event, data) {
        const cbs = this.listeners.get(event);
        if (cbs) cbs.forEach(cb => cb(data));
    }

    // Send methods
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    joinQueue(name, build, loadout, platform) { this.send({ type: 'JOIN_QUEUE', payload: { name, build, loadout, platform } }); }
    joinQueueWithToken(token, build, loadout, platform) { this.send({ type: 'JOIN_QUEUE', payload: { token, build, loadout, platform } }); }
    leaveQueue() { this.send({ type: 'LEAVE_QUEUE' }); }
    selectPlatform(platform) { this.send({ type: 'SELECT_PLATFORM', payload: { platform } }); }

    sendInput(keys, mouseX, mouseY, joystickX, joystickY, worldX, worldZ, isAiming) {
        if (!this.connected) return;
        this.send({
            type: 'INPUT_STATE',
            payload: { keys, mouseX, mouseY, joystickX, joystickY, worldX, worldZ, isAiming }
        });
    }

    attackStart() { this.send({ type: 'ATTACK_START' }); }
    attackStop() { this.send({ type: 'ATTACK_STOP' }); }
    useSkill(skill) { this.send({ type: 'USE_SKILL', payload: { skill } }); }
    chooseUpgrade(skillKey) { this.send({ type: 'CHOOSE_UPGRADE', payload: { skillKey } }); }
    upgradeChosen(skill, option) { this.send({ type: 'UPGRADE_SELECT', payload: { skill, option } }); }
    skipUpgrade() { this.send({ type: 'CHOOSE_UPGRADE', payload: { skip: true } }); }
    moveTo(x, z) { this.send({ type: 'MOVE_TO', payload: { x, z } }); }

    startPing() {
        this.pingInterval = setInterval(() => {
            this.lastPing = Date.now();
            this.send({ type: 'PING' });
        }, 2000);
    }
    stopPing() { if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; } }

    disconnect() {
        this.stopPing();
        if (this.ws) { this.ws.close(); this.ws = null; }
    }
}
