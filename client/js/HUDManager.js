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

        this.faraoHud = document.getElementById('farao-hud');
        this.faraoHpBar = document.getElementById('farao-hp-bar');
        this.faraoHpText = document.getElementById('farao-hp-text');
        this.faraoWarning = document.getElementById('farao-warning');
        this.faraoWarningTimer = document.getElementById('farao-warning-timer');

        this.julgamentoWarning = document.getElementById('julgamento-warning');
        this.julgamentoWarningTimer = document.getElementById('julgamento-warning-timer');

        // Buffs
        this.buffDisplay = document.getElementById('buff-display');
        this.buffMaxDurations = new Map();
        // Skills
        this.skillSlots = {
            q: document.getElementById('skill-q'),
            w: document.getElementById('skill-w'),
            e: document.getElementById('skill-e'),
            r: document.getElementById('skill-r'),
        };
        // Blind overlay
        this.blindOverlay = document.getElementById('blind-overlay');
        this.visaoTurvaOverlay = document.getElementById('visao-turva-overlay');
        // Latency
        this.latencyEl = document.getElementById('latency-value');
        // Multiplayer scoreboard
        this.scoreboardEl = document.getElementById('multiplayer-scoreboard');
        // Tower badge HUD
        this.towerBadgeHud = document.getElementById('tower-badge-hud');
        this.isStatsOpen = false;
    }

    update(snapshot) {
        if (!snapshot) return;
        const me = snapshot.players?.find(p => p.id === this.localPlayerId);
        if (!me) return;

        // Active Tower Details and HUD styling
        const towerDetails = {
            red: { name: 'Torre Vermelha', color: '#ff4d4d', icon: '🔺', passives: [
                ['+15% Dano', '+10% Speed', '+20% Crítico'],
                ['10% Lifesteal', '+20% Dano (<30% HP)', 'Ignora 25% Armor'],
                ['Dano escala c/ hits', 'Ataque Cleave', '+70% Dano / -30% AS'],
                ['Kill = Cura+Speed', '4º Hit Explode', 'Dano x2 (<20% HP)']
            ]},
            green: { name: 'Torre Verde', color: '#4dff4d', icon: '🟩', passives: [
                ['+25% HP Max', 'Redução Dano Flat', 'Imune a Knockback'],
                ['Regen 1% HP/s', '+30% Defesa (>80% HP)', 'Reflete 15% Dano'],
                ['Ataques geram Taunt', 'Aura Redução Dano', 'Cura de itens x2'],
                ['Escudo fora combate', 'Sobrevive 1 Hit Kill', 'Escudo quebrado explode']
            ]},
            purple: { name: 'Torre Roxa', color: '#d44dff', icon: '🟣', passives: [
                ['+25% Escudo Max', '+15% Move Speed', '+CDR'],
                ['Dano extra após skill', 'Escudo Defletor', 'Vampirismo Mágico'],
                ['10% Esquiva', 'Ataques dão Slow', 'Orbes extras no hit'],
                ['Kill reseta CDs', 'Hitbox magias +30%', 'Aura tóxica DPS']
            ]},
            poison: { name: 'Torre do Veneno', color: '#10b981', icon: '☠️', passives: [
                ['+20% Attack Speed', '+15% Move Speed permanent', 'Tiro Tóxico'],
                ['Passos Leves (+20% MS)', 'Presas Gêmeas (Heal)', 'Dardo Cegante (Cegueira)'],
                ['Miasma Menor (Poça morte)', 'Toxina Paralisante (Slow)', 'Foco Infeccioso (+20% dmg)'],
                ['Contaminação (Detonação)', 'Armadilha Cúbica (Shroom)', 'Espalhar a Peste (Transfer Stacks)']
            ]}
        };

        if (this.towerBadgeHud && me.build) {
            const tower = towerDetails[me.build.buildingColor];
            if (tower) {
                let html = `<div style="font-weight:bold; color:${tower.color};">${tower.icon} ${tower.name}</div>`;
                const p1 = tower.passives[0][me.build.floor1] || '';
                const p2 = tower.passives[1][me.build.floor2] || '';
                const p3 = tower.passives[2][me.build.floor3] || '';
                const p4 = tower.passives[3][me.build.floor4] || '';
                html += `<div style="font-size:0.65rem; opacity:0.85; display:flex; flex-direction:column; gap:2px; margin-left:4px;">`;
                if (p1) html += `<div>• ${p1}</div>`;
                if (p2) html += `<div>• ${p2}</div>`;
                if (p3) html += `<div>• ${p3}</div>`;
                if (p4) html += `<div>• ${p4}</div>`;
                
                if (me.skillUpgrades && me.skillUpgrades.r) {
                    const ultUpgradeName = {
                        r_chuva_tetraedros: 'Chuva de Tetraedros',
                        r_raio_oblivio: 'Raio do Oblívio',
                        r_corte_dimensional: 'Corte Dimensional',
                        r_bastiao_titanio: 'Bastião de Titânio',
                        r_terremoto_geometrico: 'Terremoto Geométrico',
                        r_armadura_reativa: 'Armadura Reativa',
                        r_singularidade: 'Singularidade',
                        r_distorcao_temporal_mut: 'Distorção Temporal',
                        r_reset_dimensional: 'Reset Dimensional',
                        r_campo_fungos: 'Campo de Fungos',
                        r_olhar_gorgona: 'Olhar da Górgona',
                        r_raio_peste: 'Raio da Peste'
                    }[me.skillUpgrades.r] || 'Mutação Desperta';
                    html += `<div style="font-weight:bold; color:#ffcc00; margin-top:2px;">✨ ${ultUpgradeName}</div>`;
                }
                
                html += `</div>`;
                this.towerBadgeHud.innerHTML = html;
            }
        }

        if (this.skillSlots.r && me.build) {
            const tower = towerDetails[me.build.buildingColor];
            if (tower) {
                let ultText = 'R';
                if (me.skillUpgrades && me.skillUpgrades.r) {
                    const ultShort = {
                        r_chuva_tetraedros: 'CHUVA',
                        r_raio_oblivio: 'RAIO',
                        r_corte_dimensional: 'CORTE',
                        r_bastiao_titanio: 'BAST.',
                        r_terremoto_geometrico: 'TERRE',
                        r_armadura_reativa: 'REAC.',
                        r_singularidade: 'SING.',
                        r_distorcao_temporal_mut: 'DIST.',
                        r_reset_dimensional: 'RESET',
                        r_campo_fungos: 'FUNG.',
                        r_olhar_gorgona: 'GÓRG.',
                        r_raio_peste: 'PESTE'
                    }[me.skillUpgrades.r] || 'ULT';
                    ultText = ultShort;
                } else {
                    ultText = { red: 'RAIO', green: 'ESCU', purple: 'PULS', poison: 'FRAS' }[me.build.buildingColor] || 'R';
                }
                
                const rSlot = this.skillSlots.r;
                rSlot.style.borderColor = tower.color;
                rSlot.style.boxShadow = `0 0 8px ${tower.color}aa`;
                rSlot.innerHTML = `<span style="font-size:0.6rem; position:absolute; top:2px; left:4px; opacity:0.6;">R</span><span style="font-size:0.65rem; font-weight:bold; margin-top:8px;">${ultText}</span>`;
            }
        }

        // HP bar
        if (this.hpBar) {
            const hpP = me.maxHp > 0 ? (me.hp / me.maxHp) * 100 : 0;
            this.hpBar.style.width = `${hpP}%`;
            this.hpBar.innerHTML = `<div class="progress-bar-text">HP: ${Math.ceil(me.hp)} / ${Math.ceil(me.maxHp)}</div>`;
            this.hpBar.classList.toggle('low', hpP < 30);
        }

        // XP bar
        if (this.xpBar) {
            const xpP = me.xpNext > 0 ? (me.xp / me.xpNext) * 100 : 0;
            this.xpBar.style.width = `${xpP}%`;
            this.xpBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(me.xp)} / ${me.xpNext}</div>`;
        }

        // Shield
        if (this.shieldHudItem && this.shieldBar) {
            if (me.isShieldActive && me.shieldHp > 0) {
                this.shieldHudItem.style.display = 'block';
                const sP = me.shieldMaxHp > 0 ? (me.shieldHp / me.shieldMaxHp) * 100 : 0;
                this.shieldBar.style.width = `${sP}%`;
                this.shieldBar.innerHTML = `<div class="progress-bar-text">Escudo: ${Math.ceil(me.shieldHp)}</div>`;
            } else {
                this.shieldHudItem.style.display = 'none';
            }
        }

        // Stats
        if (this.levelValue) this.levelValue.textContent = me.level;
        if (this.passiveLevelValue) this.passiveLevelValue.textContent = me.passiveLevel || 1;
        if (this.scoreValue) this.scoreValue.textContent = me.score;
        if (this.timeValue) this.timeValue.textContent = this.formatTime(snapshot.time);
        if (this.collapseValue) this.collapseValue.textContent = snapshot.globalMultiplier?.toExponential(0) || '1';

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

        // Farao HUD
        const farao = snapshot.enemies?.find(e => e.type === 'Farao');
        if (farao) {
            this.faraoHud.style.display = 'flex';
            const fP = (farao.hp / farao.maxHp) * 100;
            this.faraoHpBar.style.width = `${fP}%`;
            this.faraoHpText.textContent = `${Math.ceil(farao.hp)} / ${farao.maxHp}`;
        } else {
            this.faraoHud.style.display = 'none';
        }

        // Farao Warning
        if (snapshot.faraoWarning) {
            this.faraoWarning.style.display = 'block';
            this.faraoWarningTimer.textContent = Math.ceil(snapshot.faraoWarning.timer);
        } else {
            this.faraoWarning.style.display = 'none';
        }

        // Julgamento Warning
        if (snapshot.julgamento) {
            this.julgamentoWarning.style.display = 'block';
            this.julgamentoWarningTimer.textContent = Math.ceil(snapshot.julgamento.timer / 1000);
        } else {
            this.julgamentoWarning.style.display = 'none';
        }

        // Buffs/Debuffs Dynamic Rendering
        const activeTypes = new Set();
        const buffList = [];

        const registerActive = (type, timer, stacks = undefined) => {
            if (!type || activeTypes.has(type)) return;
            activeTypes.add(type);
            buffList.push({ type, timer, stacks });
        };

        // Gather all active effects
        if (me.activeBuff) registerActive(me.activeBuff, me.buffTimer || 0);
        if (me.tempBuff) registerActive(me.tempBuff, me.buffTimers?.[me.tempBuff] || 0);
        if (me.timedBuffs) {
            for (const b of me.timedBuffs) {
                registerActive(b, me.buffTimers?.[b] || 0);
            }
        }
        if (me.statusEffects) {
            for (const se of me.statusEffects) {
                registerActive(se, me.buffTimers?.[se] || 0);
            }
        }
        if (me.pathogens) {
            for (const [k, stacks] of Object.entries(me.pathogens)) {
                registerActive(k, me.buffTimers?.[k] || 0, stacks);
            }
        }

        // Clean up durations for buffs that are no longer active
        for (const type of this.buffMaxDurations.keys()) {
            if (!activeTypes.has(type)) {
                this.buffMaxDurations.delete(type);
            }
        }

        if (buffList.length > 0) {
            this.buffDisplay.style.display = 'flex';
            
            const BUFF_DETAILS = {
                guerreiro: { name: 'Guerreiro', symbol: '⚔', isBuff: true },
                arqueiro: { name: 'Arqueiro', symbol: '🏹', isBuff: true },
                mago: { name: 'Mago', symbol: '🔮', isBuff: true },
                damage: { name: 'Fúria Destrutiva', symbol: '💥', isBuff: true },
                attackSpeed: { name: 'Ímpeto de Ataque', symbol: '⚡', isBuff: true },
                rainha_buff: { name: 'Sombra Corrompida', symbol: '👑', isBuff: true },
                planta_buff: { name: 'Benção da Flora', symbol: '🌿', isBuff: true },
                essencia_negra: { name: 'Essência do Medo', symbol: '💀', isBuff: true },
                coroa_lich_buff: { name: 'Coroa do Lich', symbol: '❄', isBuff: true },
                lamina_geada_buff: { name: 'Lâmina da Geada', symbol: '❄', isBuff: true },
                fragmento_morte_buff: { name: 'Fragmento da Morte', symbol: '⏳', isBuff: true },
                talisma_quebrado_buff: { name: 'Talismã Quebrado', symbol: '🛡', isBuff: true },
                sabre_pirata: { name: 'Sabre Pirata', symbol: '⚔', isBuff: true },
                bencao_do_farao: { name: 'Bênção do Faraó', symbol: '☀', isBuff: true },
                cao_dos_infernos_buff: { name: 'Instinto de Caçador', symbol: '🐺', isBuff: true },
                nucleo_da_matilha: { name: 'Núcleo da Matilha', symbol: '🔺', isBuff: true },

                smith_debuff: { name: 'Sobrescrita Global', symbol: '🖥', isBuff: false },
                stunned: { name: 'Atordoado', symbol: '🌀', isBuff: false },
                frozen: { name: 'Congelado', symbol: '🧊', isBuff: false },
                bleeding: { name: 'Sangramento', symbol: '🩸', isBuff: false },
                slowed: { name: 'Lentidão', symbol: '❄', isBuff: false },
                rooted: { name: 'Enraizado', symbol: '🕸', isBuff: false },
                attackSpeedSlow: { name: 'Lentidão de Ataque', symbol: '⏳', isBuff: false },
                disoriented: { name: 'Desorientado', symbol: '🌀', isBuff: false },
                blind: { name: 'Cegueira', symbol: '👁', isBuff: false },
                silenced: { name: 'Silenciado', symbol: '🔇', isBuff: false },
                burning: { name: 'Queimadura', symbol: '🔥', isBuff: false },
                armorFracture: { name: 'Fractura de Armadura', symbol: '💔', isBuff: false },
                marcaDaAlma: { name: 'Marca da Alma', symbol: '✨', isBuff: false },
                lichKingPrison: { name: 'Prisão do Rei Lich', symbol: '⛓', isBuff: false },
                lichKingLifeDrain: { name: 'Dreno de Vida', symbol: '💔', isBuff: false },
                invertedControls: { name: 'Controles Invertidos', symbol: '🔄', isBuff: false },

                febre_critica: { name: 'Febre Crítica', symbol: '🤒', isBuff: false },
                paralisia_parcial: { name: 'Paralisia Parcial', symbol: '🦵', isBuff: false },
                mao_tremula: { name: 'Mão Trêmula', symbol: '🤝', isBuff: false },
                imunidade_baixa: { name: 'Imunidade Baixa', symbol: '🛡️', isBuff: false },
                visao_turva: { name: 'Visão Turva', symbol: '👁️', isBuff: false },
                cansaco_viral: { name: 'Cansaço Viral', symbol: '💤', isBuff: false },
                incapacidade: { name: 'Incapacidade', symbol: '🚫', isBuff: false },
                hemorragia_quadrada: { name: 'Hemorragia Quadrada', symbol: '🩸', isBuff: false }
            };

            // 1. Remove cards that are no longer active
            const currentCardIds = new Set(buffList.map(item => `buff-card-${item.type}`));
            const existingCards = this.buffDisplay.querySelectorAll('.buff-card');
            for (const card of existingCards) {
                if (!currentCardIds.has(card.id)) {
                    card.remove();
                }
            }

            // 2. Create or update cards
            for (const item of buffList) {
                const type = item.type;
                const timer = item.timer; // in ms
                const cardId = `buff-card-${type}`;
                
                const details = BUFF_DETAILS[type] || {
                    name: type.replace(/_/g, ' ').toUpperCase(),
                    symbol: '✨',
                    isBuff: !type.toLowerCase().includes('debuff') && 
                            !type.toLowerCase().includes('slow') && 
                            !type.toLowerCase().includes('stun') && 
                            !type.toLowerCase().includes('fracture') &&
                            !type.toLowerCase().includes('bleeding') &&
                            !type.toLowerCase().includes('burning') &&
                            !['febre_critica','paralisia_parcial','mao_tremula','imunidade_baixa','visao_turva','cansaco_viral','incapacidade','hemorragia_quadrada'].includes(type)
                };

                // Track and calculate progress percentage
                let maxDur = this.buffMaxDurations.get(type) || 0;
                if (timer > maxDur) {
                    maxDur = timer;
                    this.buffMaxDurations.set(type, maxDur);
                }
                const pct = maxDur > 0 ? (timer / maxDur) * 100 : 100;

                const cardClass = details.isBuff ? 'type-buff' : 'type-debuff';
                const timeText = timer > 0 ? this.formatTimerText(timer) : '∞';
                const displayName = item.stacks && item.stacks > 0 ? `${details.name} x${item.stacks}` : details.name;

                let card = this.buffDisplay.querySelector(`#${cardId}`);
                if (!card) {
                    card = document.createElement('div');
                    card.className = `buff-card ${cardClass}`;
                    card.id = cardId;
                    card.innerHTML = `
                        <div class="buff-card-icon">${details.symbol}</div>
                        <div class="buff-card-info">
                            <span class="buff-card-name">${displayName}</span>
                            <span class="buff-card-timer">${timeText}</span>
                        </div>
                        ${timer > 0 ? `<div class="buff-card-progress" style="width: ${pct}%"></div>` : ''}
                    `;
                    this.buffDisplay.appendChild(card);
                } else {
                    const nameEl = card.querySelector('.buff-card-name');
                    if (nameEl && nameEl.textContent !== displayName) {
                        nameEl.textContent = displayName;
                    }
                    const timerEl = card.querySelector('.buff-card-timer');
                    if (timerEl && timerEl.textContent !== timeText) {
                        timerEl.textContent = timeText;
                    }
                    const progressEl = card.querySelector('.buff-card-progress');
                    if (progressEl) {
                        progressEl.style.width = `${pct}%`;
                    }
                }
            }

            // 3. Ensure correct order of elements matching buffList
            buffList.forEach((item, index) => {
                const cardId = `buff-card-${item.type}`;
                const card = this.buffDisplay.querySelector(`#${cardId}`);
                const referenceNode = this.buffDisplay.children[index] || null;
                if (card && referenceNode !== card) {
                    this.buffDisplay.insertBefore(card, referenceNode);
                }
            });
        } else {
            this.buffDisplay.style.display = 'none';
            this.buffDisplay.innerHTML = '';
        }

        // Skills cooldowns
        if (me.skillCooldowns) {
            for (const key of ['q', 'w', 'e', 'r']) {
                const pcSlot = this.skillSlots[key];
                const mobileSlot = document.getElementById(`${key}-button`);
                const rem = me.skillCooldowns[key]; // remaining ms

                const updateSlot = (slot) => {
                    if (!slot) return;
                    let cdDiv = slot.querySelector('.skill-cooldown');
                    if (rem > 0) {
                        if (!cdDiv) {
                            cdDiv = document.createElement('div');
                            cdDiv.className = 'skill-cooldown';
                            slot.appendChild(cdDiv);
                        }
                        cdDiv.textContent = (rem / 1000).toFixed(1);
                    } else if (cdDiv) {
                        slot.removeChild(cdDiv);
                    }
                };

                updateSlot(pcSlot);
                updateSlot(mobileSlot);
            }
        }

        // Status effects
        if (me.statusEffects) {
            const isBlind = me.statusEffects.includes('blind');
            const isDisoriented = me.statusEffects.includes('disoriented');
            this.blindOverlay?.classList.toggle('active', isBlind);
            document.body.classList.toggle('disoriented-screen', isDisoriented);
        }

        // Visão Turva overlay handling
        if (this.visaoTurvaOverlay) {
            const visaoTurvaStacks = me.pathogens?.['visao_turva'] || 0;
            this.visaoTurvaOverlay.classList.toggle('active', visaoTurvaStacks >= 1);
            this.visaoTurvaOverlay.classList.toggle('active-stack2', visaoTurvaStacks >= 2);
        }

        // Multiplayer scoreboard
        this.updateScoreboard(snapshot.players);

        // Update stats overlay if open
        if (this.isStatsOpen) {
            this.updateStatsOverlay(me);
        }
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

    showUpgradeModal(skill, options) {
        const panel = document.getElementById('upgrade-panel');
        const optionsEl = document.getElementById('upgrade-options');
        const skillNames = { q: 'Dash + Esferas', w: 'Repulsão', e: 'Escudo de Vida', r: 'Ultimate - Modo Divino' };
        document.getElementById('upgrade-skill-name').textContent = `Melhore sua habilidade: ${skillNames[skill] || skill}`;
        optionsEl.innerHTML = '';
        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'overlay-button upgrade-option';
            btn.innerHTML = `<strong>${opt.name}</strong><br><small>${opt.description}</small>`;
            btn.onclick = () => {
                this.hideUpgradeModal();
                const nc = window.net;
                if (nc) nc.upgradeChosen(skill, opt.id);
            };
            optionsEl.appendChild(btn);
        });
        panel.style.display = 'flex';
    }

    hideUpgradeModal() {
        const panel = document.getElementById('upgrade-panel');
        if (panel) panel.style.display = 'none';
    }

    formatTime(s) {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    formatTimerText(ms) {
        if (ms <= 0) return '0.0s';
        const s = ms / 1000;
        if (s >= 60) {
            const mins = Math.floor(s / 60);
            const secs = Math.floor(s % 60);
            return `${mins}m ${secs}s`;
        }
        return `${s.toFixed(1)}s`;
    }

    setStatsOpen(open) {
        this.isStatsOpen = open;
        const el = document.getElementById('player-stats-overlay');
        if (el) {
            if (open) {
                el.style.display = 'block';
                el.classList.add('active');
            } else {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        }
    }

    updateStatsOverlay(me) {
        const attackEl = document.getElementById('stats-attack-value');
        const defenseEl = document.getElementById('stats-defense-value');
        const attackSpeedEl = document.getElementById('stats-attack-speed-value');
        const critChanceEl = document.getElementById('stats-crit-chance-value');
        const critMultEl = document.getElementById('stats-crit-mult-value');
        const speedEl = document.getElementById('stats-speed-value');

        if (attackEl && me.damage !== undefined) attackEl.textContent = me.damage;
        if (defenseEl && me.defense !== undefined) defenseEl.textContent = me.defense;
        if (attackSpeedEl && me.attackSpeed !== undefined) attackSpeedEl.textContent = `${me.attackSpeed.toFixed(2)}/s`;
        if (critChanceEl && me.critChance !== undefined) critChanceEl.textContent = `${Math.round(me.critChance * 100)}%`;
        if (critMultEl && me.critDamageMultiplier !== undefined) critMultEl.textContent = `${me.critDamageMultiplier.toFixed(1)}x`;
        if (speedEl && me.speed !== undefined) speedEl.textContent = me.speed.toFixed(1);
    }
}
