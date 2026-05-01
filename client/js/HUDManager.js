/**
 * HUDManager - Updates all UI elements from server snapshots
 * Handles: HP/XP bars, boss HUD, player list, buffs, skills, events
 */
export class HUDManager {
    constructor(localPlayerId) {
        this.localPlayerId = localPlayerId;
        // Player HUD
        this.hpBar = document.getElementById('hp-bar');
        this.xpBar = document.getElementById('xp-bar');
        this.shieldHudItem = document.getElementById('shield-hud-item');
        this.shieldBar = document.getElementById('shield-bar');
        this.levelValue = document.getElementById('level-value');
        this.passiveLevelValue = document.getElementById('passive-level-value');
        this.scoreValue = document.getElementById('score-value');
        this.timeValue = document.getElementById('time-value');
        this.collapseValue = document.getElementById('collapse-value');
        // Boss HUD
        this.bossHud = document.getElementById('boss-hud');
        this.bossNameLabel = document.getElementById('boss-name-label');
        this.bossHpBar = document.getElementById('boss-hp-bar');
        // Poderoso HUD
        this.poderosoHud = document.getElementById('poderoso-hud');
        this.poderosoHpBar = document.getElementById('poderoso-hp-bar');
        this.poderosoHpText = document.getElementById('poderoso-hp-text');
        this.poderosoPowerBar = document.getElementById('poderoso-power-bar');
        this.poderosoPowerText = document.getElementById('poderoso-power-text');
        // Buffs
        this.buffDisplay = document.getElementById('buff-display');
        this.buffName = document.getElementById('buff-name');
        // Skills
        this.skillSlots = {
            q: document.getElementById('skill-q'),
            w: document.getElementById('skill-w'),
            e: document.getElementById('skill-e'),
            r: document.getElementById('skill-r'),
        };
        // Blind overlay
        this.blindOverlay = document.getElementById('blind-overlay');
        // Latency
        this.latencyEl = document.getElementById('latency-value');
        // Multiplayer scoreboard
        this.scoreboardEl = document.getElementById('multiplayer-scoreboard');
    }

    update(snapshot) {
        if (!snapshot) return;
        const me = snapshot.players?.find(p => p.id === this.localPlayerId);
        if (!me) return;

        // HP bar
        const hpP = me.maxHp > 0 ? (me.hp / me.maxHp) * 100 : 0;
        this.hpBar.style.width = `${hpP}%`;
        this.hpBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(me.hp)} / ${Math.ceil(me.maxHp)}</div>`;
        this.hpBar.classList.toggle('low', hpP < 30);

        // XP bar
        const xpP = me.xpNext > 0 ? (me.xp / me.xpNext) * 100 : 0;
        this.xpBar.style.width = `${xpP}%`;
        this.xpBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(me.xp)} / ${me.xpNext}</div>`;

        // Shield
        if (me.isShieldActive && me.shieldHp > 0) {
            this.shieldHudItem.style.display = 'block';
            const sP = me.shieldMaxHp > 0 ? (me.shieldHp / me.shieldMaxHp) * 100 : 0;
            this.shieldBar.style.width = `${sP}%`;
            this.shieldBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(me.shieldHp)}</div>`;
        } else {
            this.shieldHudItem.style.display = 'none';
        }

        // Stats
        this.levelValue.textContent = me.level;
        this.passiveLevelValue.textContent = me.passiveLevel || 1;
        this.scoreValue.textContent = me.score;
        this.timeValue.textContent = this.formatTime(snapshot.time);
        this.collapseValue.textContent = snapshot.globalMultiplier?.toExponential(0) || '1';

        // Boss HUD
        if (snapshot.boss) {
            this.bossHud.style.display = 'flex';
            this.bossNameLabel.textContent = snapshot.boss.name;
            const bP = snapshot.boss.maxHp > 0 ? (snapshot.boss.hp / snapshot.boss.maxHp) * 100 : 0;
            this.bossHpBar.style.width = `${bP}%`;
            this.bossHpBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(snapshot.boss.hp)} / ${Math.ceil(snapshot.boss.maxHp)}</div>`;
        } else {
            this.bossHud.style.display = 'none';
        }

        // Mighty One HUD
        if (snapshot.mightyOne) {
            this.poderosoHud.style.display = 'flex';
            const mP = (snapshot.mightyOne.hp / snapshot.mightyOne.maxHp) * 100;
            this.poderosoHpBar.style.width = `${mP}%`;
            this.poderosoHpText.textContent = `${Math.ceil(snapshot.mightyOne.hp)} / ${snapshot.mightyOne.maxHp}`;
            const powerP = Math.min(100, (snapshot.mightyOne.damageBonus - 1) * 200);
            this.poderosoPowerBar.style.width = `${powerP}%`;
            this.poderosoPowerText.textContent = `Poder Acumulado: Dano x${snapshot.mightyOne.damageBonus.toFixed(2)}`;
        } else {
            this.poderosoHud.style.display = 'none';
        }

        // Buffs
        let buffText = '';
        if (me.activeBuff) buffText += me.activeBuff;
        if (me.timedBuffs?.length > 0) {
            const buffNames = {
                rainha_buff: 'Sombra Corrompida', planta_buff: 'Benção da Flora',
                essencia_negra: 'Essência do Medo', coroa_lich_buff: 'Coroa do Lich',
                lamina_geada_buff: 'Lâmina da Geada', fragmento_morte_buff: 'Fragmento da Morte',
                talisma_quebrado_buff: 'Talismã Quebrado', sabre_pirata: 'Sabre Pirata',
            };
            for (const b of me.timedBuffs) {
                const name = buffNames[b] || b;
                if (buffText) buffText += ' | ';
                buffText += name;
            }
        }
        if (buffText) { this.buffDisplay.style.display = 'block'; this.buffName.textContent = buffText; }
        else this.buffDisplay.style.display = 'none';

        // Skills cooldowns
        if (me.skillCooldowns) {
            for (const key of ['q', 'w', 'e', 'r']) {
                const slot = this.skillSlots[key];
                if (!slot) continue;
                const rem = me.skillCooldowns[key]; // remaining ms
                let cdDiv = slot.querySelector('.skill-cooldown');
                if (rem > 0) {
                    if (!cdDiv) { cdDiv = document.createElement('div'); cdDiv.className = 'skill-cooldown'; slot.appendChild(cdDiv); }
                    cdDiv.textContent = (rem / 1000).toFixed(1);
                } else if (cdDiv) { slot.removeChild(cdDiv); }
            }
        }

        // Status effects
        if (me.statusEffects) {
            const isBlind = me.statusEffects.includes('blind');
            const isDisoriented = me.statusEffects.includes('disoriented');
            this.blindOverlay?.classList.toggle('active', isBlind);
            document.body.classList.toggle('disoriented-screen', isDisoriented);
        }

        // Multiplayer scoreboard
        this.updateScoreboard(snapshot.players);
    }

    updateScoreboard(players) {
        if (!this.scoreboardEl || !players) return;
        const sorted = [...players].sort((a, b) => b.score - a.score);
        let html = '';
        for (const p of sorted) {
            const isMe = p.id === this.localPlayerId;
            const deadClass = p.isDead ? ' dead' : '';
            html += `<div class="sb-row${isMe ? ' me' : ''}${deadClass}">
                <span class="sb-name">${p.name}</span>
                <span class="sb-score">${p.score}</span>
                <span class="sb-level">Lv.${p.level}</span>
                <div class="sb-hp-mini"><div class="sb-hp-fill" style="width:${p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 0}%"></div></div>
            </div>`;
        }
        this.scoreboardEl.innerHTML = html;
    }

    updateLatency(ms) {
        if (this.latencyEl) this.latencyEl.textContent = `${ms}ms`;
    }

    showEvent(msg) {
        const el = document.getElementById('event-message');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 5000);
    }

    formatTime(s) {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }
}
