import { ALL_ITEMS, ITEM_ICONS, ITEM_IMAGES } from './ItemData.js';

/**
 * HUDManager - Updates all UI elements from server snaposhots
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
        this.collaposeValue = document.getElementById('collapose-value');
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
        this.coinStateHud = document.getElementById('coin-state-hud');
        this.lastCoinState = null;
        this.loadoutHudContainer = document.getElementById('loadout-hud-container');
        this.isStatsOpen = false;
        
        // Listen to loadout level up event
        window.addEventListener('loadout-level-up', () => {
            if (this.loadoutHudContainer) {
                this.loadoutHudContainer.classList.add('flash-level-up');
                setTimeout(() => this.loadoutHudContainer.classList.remove('flash-level-up'), 500);
            }
        });
    }

    update(snaposhot) {
        if (!snaposhot) return;
        const me = snaposhot.players?.find(p => p.id === this.localPlayerId);
        if (!me) return;

        // Active Tower Details and HUD styling
        const towerDetails = {
            red: { name: 'Torre Vermelha', color: '#ff4d4d', icon: 'RED', passives: [
                ['+15% Dano', '+10% Speed', '+20% Critico'],
                ['10% Lifesteal', '+20% Dano (<30% HP)', 'Ignora 25% Armor'],
                ['Dano escala c/ hits', 'Ataque Cleave', '+70% Dano / -30% AS'],
                ['Kill = Cura+Speed', '4o Hit Explode', 'Dano x2 (<20% HP)']
            ]},
            green: { name: 'Torre Verde', color: '#4dff4d', icon: 'GREEN', passives: [
                ['+25% HP Max', 'Reducao Dano Flat', 'Imune a Knockback'],
                ['Regen 1% HP/s', '+30% Defesa (>80% HP)', 'Reflete 15% Dano'],
                ['Ataques geram Taunt', 'Aura Reducao Dano', 'Cura de itens x2'],
                ['Escudo fora combate', 'Sobrevive 1 Hit Kill', 'Escudo quebrado explode']
            ]},
            purple: { name: 'Torre Roxa', color: '#d44dff', icon: 'PURPLE', passives: [
                ['+25% Escudo Max', '+15% Move Speed', '+CDR'],
                ['Dano extra apos skill', 'Escudo Defletor', 'Vampirismo Magico'],
                ['10% Esquiva', 'Ataques dao Slow', 'Orbes extras no hit'],
                ['Kill reseta CDs', 'Hitbox magias +30%', 'Aura toxica DPS']
            ]},
            poison: { name: 'Torre do Veneno', color: '#10b981', icon: 'POISON', passives: [
                ['+20% Attack Speed', '+15% Move Speed permanent', 'Tiro Toxico'],
                ['Passos Leves (+20% MS)', 'Presas Gemeas (Heal)', 'Dardo Cegante (Cegueira)'],
                ['Miasma Menor (Poca morte)', 'Toxina Paralisante (Slow)', 'Foco Infeccioso (+20% dmg)'],
                ['Contaminacao (Detonacao)', 'Armadilha Cubica (Shroom)', 'Espalhar a Peste (Transfer Stacks)']
            ]},
            coin: { name: 'Torre Coringa', color: '#f59e0b', icon: 'COIN', passives: [
                ['Cara Agressiva (+18% Dmg/-10% HP)', 'Coroa Vital (+22% HP/-10% Dmg)', 'Moeda Rapida (+15% MS/-12% Def)'],
                ['Critico Endividado (+18% Crit)', 'Pancada Pesada (+25% CritDmg)', 'Ataque Instavel (+20% AS/-12% Dmg)'],
                ['Sanguessuga Fragil (6% Lifesteal)', 'Armadura Cobrada (+18% Def)', 'Folego de Risco (+12% XP/-8% HP)'],
                ['Poder no Desespero (<35%)', 'Seguranca Cara (>70%)', 'Tudo ou Nada (5o hit)']
            ]},
            predator_hive: { name: 'Bastiao Predador da Colmeia', color: '#38bdf8', icon: 'ERG', passives: [
                ['Reflexo Felino [PREDADOR]', 'Pele Cinetica [GUARDIAO]', 'Garras da Colmeia [ERG]'],
                ['Braco de Bastiao [GUARDIAO]', 'Aparar Geometrico [GUARDIAO]', 'Chamado dos Ergs [ERG]'],
                ['Enxame de Fragmentos [ERG]', 'Regeneracao Mutante [ERG]', 'Carapaca Viva [ERG]'],
                ['Contra-Ataque Cinetico [PREDADOR]', 'Muralha Predadora [GUARDIAO]', 'Evolucao da Ninhada [ERG]']
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
                if (p1) html += `<div>- ${p1}</div>`;
                if (p2) html += `<div>- ${p2}</div>`;
                if (p3) html += `<div>- ${p3}</div>`;
                if (p4) html += `<div>- ${p4}</div>`;
                
                if (me.skillUpgrades && me.skillUpgrades.r) {
                    const ultUpgradeName = {
                        r_chuva_tetraedros: 'Chuva de Tetraedros',
                        r_raio_oblivio: 'Raio do Oblivio',
                        r_corte_dimensional: 'Corte Dimensional',
                        r_bastiao_titanio: 'Bastiao de Titanio',
                        r_terremoto_geometrico: 'Terremoto Geometrico',
                        r_armadura_reativa: 'Armadura Reativa',
                        r_singularidade: 'Singularidade',
                        r_distorcao_temporal_mut: 'Distorcao Temporal',
                        r_reset_dimensional: 'Reset Dimensional',
                        r_campo_fungos: 'Campo de Fungos',
                        r_olhar_gorgona: 'Olhar da Gorgona',
                        r_raio_peste: 'Raio da Peste',
                        r_cara_viciada: 'Cara Viciada',
                        r_coroa_quebrada: 'Coroa Quebrada',
                        r_coringa_absoluto: 'Coringa Absoluto',
                        r_pantera_cinetica: 'Pantera Cinetica',
                        r_guardiao_muralha_viva: 'Guardiao da Muralha Viva',
                        r_ascensao_colmeia_erg: 'Ascensao da Colmeia Erg'
                    }[me.skillUpgrades.r] || 'Mutacao Desperta';
                    html += `<div style="font-weight:bold; color:#ffcc00; margin-top:2px;">${ultUpgradeName}</div>`;
                }
                if (me.build.buildingColor === 'predator_hive' && me.ergCentralBaseActive) {
                    const biomass = Math.round((Number(me.ergBiomassPct || 0) * 10000)) / 100;
                    const level = Number(me.ergBaseLevel || 1);
                    const stacks = Math.min(50, Number(me.ergBaseStacks || 0));
                    const activeWorkers = Number(me.ergActiveWorkers || 0);
                    const pips = Array.isArray(me.ergWorkerIntegrities)
                        ? me.ergWorkerIntegrities.map(v => {
                            const n = Number(v || 0);
                            return n <= 0 ? 'X' : 'o'.repeat(Math.min(6, n));
                        }).join(' ')
                        : '';
                    const slime = me.ergBaseSlimeEnabled ? ' - Gosma Ativa' : '';
                    html += `<div style="color:#a78bfa; font-weight:bold; margin-top:2px;">Base Erg Nv.${level} - ${stacks}/50 - Ergs ${activeWorkers}/4${slime}</div>`;
                    html += `<div style="color:#c4b5fd; font-size:10px;">Integridade: ${pips || '----'} - Biomassa ${biomass}%</div>`;
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
                        r_olhar_gorgona: 'GRG.',
                        r_raio_peste: 'PESTE',
                        r_cara_viciada: 'CARA',
                        r_coroa_quebrada: 'COROA',
                        r_coringa_absoluto: 'ABS',
                        r_pantera_cinetica: 'PANT.',
                        r_guardiao_muralha_viva: 'MURAL',
                        r_ascensao_colmeia_erg: 'ERG'
                    }[me.skillUpgrades.r] || 'ULT';
                    ultText = ultShort;
                } else {
                    ultText = { red: 'RAIO', green: 'ESCU', purple: 'PULS', poison: 'FRAS', coin: 'GIRO', predator_hive: 'BAST' }[me.build.buildingColor] || 'R';
                }
                if (me.coinState) ultText = String(me.coinState).toUpperCase().slice(0, 6);
                
                const rSlot = this.skillSlots.r;
                rSlot.style.borderColor = tower.color;
                rSlot.style.boxShadow = `0 0 8px ${tower.color}aa`;
                rSlot.innerHTML = `<span style="font-size:0.6rem; position:absolute; top:2px; left:4px; opacity:0.6;">R</span><span style="font-size:0.65rem; font-weight:bold; margin-top:8px;">${ultText}</span>`;
            }
        }

        this.updateCoinStateHud(me);

        if (this.loadoutHudContainer) {
            let html = '';
            if (me.loadoutItems && me.loadoutItems.length > 0) {
                const colors = { legendary: '#f1c40f', epic: '#9b59b6', basic: '#bdc3c7' };
                me.loadoutItems.forEach(itemId => {
                    const details = ALL_ITEMS[itemId] || { name: itemId, rarity: 'basic' };
                    const imageFile = ITEM_IMAGES[itemId] || 'item1.png';
                    const color = colors[details.rarity] || colors.basic;
                    
                    html += `<div data-item-id="${itemId}" style="width:24px; height:24px; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; background:${color}22; box-shadow: 0 0 5px ${color}88; cursor: pointer;">
                        <img src="items/${imageFile}" style="width:18px; height:18px; object-fit:contain;" />
                    </div>`;
                });
                if (me.loadoutLevel) {
                    html += `<div style="font-size: 0.7rem; color: #fff; font-weight: bold; margin-left: 4px;">Nv. ${me.loadoutLevel}</div>`;
                }
            } else {
                html = `<div style="font-size: 0.6rem; color: #666;">Sem Itens Equipados</div>`;
            }
            if (this.loadoutHudContainer.innerHTML !== html) {
                this.loadoutHudContainer.innerHTML = html;
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
            this.xpBar.innerHTML = `<div class="progress-bar-text" style="line-height:18px; font-size:.72rem;">XP: ${Math.ceil(me.xp)} / ${me.xpNext}</div>`;
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
        if (this.timeValue) this.timeValue.textContent = this.formatTime(snaposhot.time);
        if (this.collaposeValue) this.collaposeValue.textContent = snaposhot.globalMultiplier?.toExponential(0) || '1';

        // Boss HUD
        if (snaposhot.boss) {
            this.bossHud.style.display = 'flex';
            this.bossNameLabel.textContent = snaposhot.boss.name;
            const bP = snaposhot.boss.maxHp > 0 ? (snaposhot.boss.hp / snaposhot.boss.maxHp) * 100 : 0;
            this.bossHpBar.style.width = `${bP}%`;
            this.bossHpBar.innerHTML = `<div class="progress-bar-text">${Math.ceil(snaposhot.boss.hp)} / ${Math.ceil(snaposhot.boss.maxHp)}</div>`;
        } else {
            this.bossHud.style.display = 'none';
        }

        // Mighty One HUD
        if (snaposhot.mightyOne) {
            this.poderosoHud.style.display = 'flex';
            const mP = (snaposhot.mightyOne.hp / snaposhot.mightyOne.maxHp) * 100;
            this.poderosoHpBar.style.width = `${mP}%`;
            this.poderosoHpText.textContent = `${Math.ceil(snaposhot.mightyOne.hp)} / ${snaposhot.mightyOne.maxHp}`;
            const powerP = Math.min(100, (snaposhot.mightyOne.damageBonus - 1) * 200);
            this.poderosoPowerBar.style.width = `${powerP}%`;
            this.poderosoPowerText.textContent = `Poder Acumulado: Dano x${snaposhot.mightyOne.damageBonus.toFixed(2)}`;
        } else {
            this.poderosoHud.style.display = 'none';
        }

        // Farao HUD
        const farao = snaposhot.enemies?.find(e => e.type === 'Farao');
        if (farao) {
            this.faraoHud.style.display = 'flex';
            const fP = (farao.hp / farao.maxHp) * 100;
            this.faraoHpBar.style.width = `${fP}%`;
            this.faraoHpText.textContent = `${Math.ceil(farao.hp)} / ${farao.maxHp}`;
        } else {
            this.faraoHud.style.display = 'none';
        }

        // Farao Warning
        if (snaposhot.faraoWarning) {
            this.faraoWarning.style.display = 'block';
            this.faraoWarningTimer.textContent = Math.ceil(snaposhot.faraoWarning.timer);
        } else {
            this.faraoWarning.style.display = 'none';
        }

        // Julgamento Warning
        if (snaposhot.julgamento) {
            this.julgamentoWarning.style.display = 'block';
            this.julgamentoWarningTimer.textContent = Math.ceil(snaposhot.julgamento.timer / 1000);
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
                // se is now { id, stacks }  pass stacks to the card
                registerActive(se.id, me.buffTimers?.[se.id] || 0, se.stacks > 1 ? se.stacks : undefined);
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
                guerreiro: { name: 'Guerreiro', symbol: '+', isBuff: true },
                arqueiro: { name: 'Arqueiro', symbol: '+', isBuff: true },
                mago: { name: 'Mago', symbol: '+', isBuff: true },
                damage: { name: 'Furia Destrutiva', symbol: '+', isBuff: true },
                attackSpeed: { name: 'mpeto de Ataque', symbol: '+', isBuff: true },
                rainha_buff: { name: 'Sombra Corrompida', symbol: '+', isBuff: true },
                planta_buff: { name: 'Beno da Flora', symbol: '+', isBuff: true },
                essencia_negra: { name: 'Essencia do Medo', symbol: '+', isBuff: true },
                coroa_lich_buff: { name: 'Coroa do Lich', symbol: '+', isBuff: true },
                lamina_geada_buff: { name: 'Lmina da Geada', symbol: '+', isBuff: true },
                fragmento_morte_buff: { name: 'Fragmento da Morte', symbol: '+', isBuff: true },
                talisma_quebrado_buff: { name: 'Talism Quebrado', symbol: '+', isBuff: true },
                sabre_pirata: { name: 'Sabre Pirata', symbol: '+', isBuff: true },
                bencao_do_farao: { name: 'Bno do Fara', symbol: '+', isBuff: true },
                cao_dos_infernos_buff: { name: 'Instinto de Caador', symbol: '+', isBuff: true },
                nucleo_da_matilha: { name: 'Ncleo da Matilha', symbol: '+', isBuff: true },

                smith_debuff: { name: 'Sobrescrita Global', symbol: '-', isBuff: false },
                stunned: { name: 'Atordoado', symbol: '-', isBuff: false },
                frozen: { name: 'Congelado', symbol: '-', isBuff: false },
                bleeding: { name: 'Sangramento', symbol: '-', isBuff: false },
                slowed: { name: 'Lentido', symbol: '-', isBuff: false },
                rooted: { name: 'Enraizado', symbol: '-', isBuff: false },
                attackSpeedSlow: { name: 'Lentido de Ataque', symbol: '-', isBuff: false },
                disoriented: { name: 'Desorientado', symbol: '-', isBuff: false },
                blind: { name: 'Cegueira', symbol: '-', isBuff: false },
                silenced: { name: 'Silenciado', symbol: '-', isBuff: false },
                burning: { name: 'Queimadura', symbol: '-', isBuff: false },
                armorFracture: { name: 'Fractura de Armadura', symbol: '-', isBuff: false },
                marcaDaAlma: { name: 'Marca da Alma', symbol: '-', isBuff: false },
                lichKingPrison: { name: 'Priso do Rei Lich', symbol: '-', isBuff: false },
                lichKingLifeDrain: { name: 'Dreno de Vida', symbol: '-', isBuff: false },
                invertedControls: { name: 'Controles Invertidos', symbol: '-', isBuff: false },

                febre_critica: { name: 'Febre Crtica', symbol: '-', isBuff: false },
                paralisia_parcial: { name: 'Paralisia Parcial', symbol: '-', isBuff: false },
                mao_tremula: { name: 'Mo Trmula', symbol: '-', isBuff: false },
                imunidade_baixa: { name: 'Imunidade Baixa', symbol: '-', isBuff: false },
                visao_turva: { name: 'Viso Turva', symbol: '-', isBuff: false },
                cansaco_viral: { name: 'Cansao Viral', symbol: '-', isBuff: false },
                incapacidade: { name: 'Incapacidade', symbol: '-', isBuff: false },
                hemorragia_quadrada: { name: 'Hemorragia Quadrada', symbol: '-', isBuff: false }
                ,
                acid: { name: 'Corrosao', symbol: '-', isBuff: false },
                plague: { name: 'Praga', symbol: '-', isBuff: false },
                ignite: { name: 'Queimadura', symbol: '-', isBuff: false },
                bleed: { name: 'Sangramento', symbol: '-', isBuff: false },
                freeze: { name: 'Congelamento', symbol: '-', isBuff: false },
                stun: { name: 'Atordoamento', symbol: '-', isBuff: false },
                root: { name: 'Enraizamento', symbol: '-', isBuff: false },
                slow: { name: 'Lentidao', symbol: '-', isBuff: false },
                silence: { name: 'Silencio', symbol: '-', isBuff: false },
                confusion: { name: 'Confusao', symbol: '-', isBuff: false },
                fear: { name: 'Medo', symbol: '-', isBuff: false },
                vulnerable: { name: 'Vulneravel', symbol: '-', isBuff: false },
                weakness: { name: 'Fraqueza', symbol: '-', isBuff: false },
                exhaust: { name: 'Exaustao', symbol: '-', isBuff: false },
                marked: { name: 'Marcado', symbol: '-', isBuff: false },
                mortalWounds: { name: 'Anti-Cura', symbol: '-', isBuff: false },
                taunt: { name: 'Provocacao', symbol: '-', isBuff: false },
                regen: { name: 'Regeneracao', symbol: '+', isBuff: true },
                haste: { name: 'Aceleracao', symbol: '+', isBuff: true },
                enrage: { name: 'Furia', symbol: '+', isBuff: true },
                aegis: { name: 'Aegis', symbol: '+', isBuff: true }
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
                    symbol: '',
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
                const timeText = timer > 0 ? this.formatTimerText(timer) : 'inf';
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
            const isBlind = me.statusEffects.some(se => se.id === 'blind');
            const isDisoriented = me.statusEffects.some(se => se.id === 'disoriented');
            this.blindOverlay?.classList.toggle('active', isBlind);
            document.body.classList.toggle('disoriented-screen', isDisoriented);
        }

        // Viso Turva overlay handling
        if (this.visaoTurvaOverlay) {
            const visaoTurvaStacks = me.pathogens?.['visao_turva'] || 0;
            this.visaoTurvaOverlay.classList.toggle('active', visaoTurvaStacks >= 1);
            this.visaoTurvaOverlay.classList.toggle('active-stack2', visaoTurvaStacks >= 2);
        }

        // Multiplayer scoreboard
        this.updateScoreboard(snaposhot.players);

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

    updateCoinStateHud(me) {
        if (!this.coinStateHud) return;
        const isCoin = me.build?.buildingColor === 'coin';
        const rawState = me.coinState ? String(me.coinState) : '';
        if (!isCoin || !rawState) {
            this.coinStateHud.style.display = 'none';
            this.coinStateHud.className = '';
            this.lastCoinState = null;
            return;
        }

        const normalized = rawState.toLowerCase();
        const isCrown = normalized.includes('coroa');
        const isAbsolute = normalized.includes('absoluto');
        const title = isAbsolute ? 'ABS' : isCrown ? 'COROA' : 'CARA';
        const subtitle = isCrown ? 'Defensivo' : 'Ofensivo';
        const icon = isCrown ? 'COROA' : 'CARA';
        const details = isCrown
            ? 'Defesa e velocidade aumentadas; dano reduzido.'
            : 'Dano e critico aumentados; defesa reduzida.';
        const timerMs = Math.max(0, Number(me.coinStateTimer || 0));
        const maxTimer = isAbsolute || normalized === 'cara' || normalized === 'coroa' ? 2000 : Math.max(timerMs, 1);
        const timerPct = maxTimer > 0 ? Math.max(0, Math.min(100, (timerMs / maxTimer) * 100)) : 0;

        this.coinStateHud.style.display = 'block';
        this.coinStateHud.className = `${isCrown ? 'coin-crown' : 'coin-face'}`;
        if (this.lastCoinState && this.lastCoinState !== rawState) {
            this.coinStateHud.classList.add('coin-flip');
            setTimeout(() => this.coinStateHud?.classList.remove('coin-flip'), 520);
        }
        this.lastCoinState = rawState;

        this.coinStateHud.innerHTML = `
            <div class="coin-state-row" title="${details}">
                <div class="coin-state-icon">${icon}</div>
                <div class="coin-state-main">
                    <div class="coin-state-title">${title}</div>
                    <div class="coin-state-subtitle">${subtitle}</div>
                </div>
            </div>
            <div class="coin-state-timer"><div class="coin-state-timer-fill" style="width:${timerPct}%"></div></div>
            <div class="coin-state-flip-text">A moeda girou!</div>
        `;
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
        const skillNames = { q: 'Dash + Esferas', w: 'Repulsao', e: 'Escudo de Vida', r: 'Ultimate - Modo Divino' };
        
        const titleEl = document.getElementById('upgrade-skill-name');
        if (titleEl) {
            titleEl.textContent = `${skillNames[skill] || skill.toUpperCase()}`;
        }
        
        const iconThemes = {
            q_impacto_estilhacante: { glyph: 'Q', shape: 'burst', c1: '#38bdf8', c2: '#facc15' },
            q_rastro_polvora: { glyph: 'Q', shape: 'trail', c1: '#f97316', c2: '#ef4444' },
            q_convergencia_assassina: { glyph: 'Q', shape: 'focus', c1: '#a78bfa', c2: '#22d3ee' },
            w_campo_hemorragia: { glyph: 'W', shape: 'bleed', c1: '#ef4444', c2: '#f87171' },
            w_refracao_vital: { glyph: 'W', shape: 'heal', c1: '#22c55e', c2: '#67e8f9' },
            w_vacuo_magnetico: { glyph: 'W', shape: 'vortex', c1: '#818cf8', c2: '#22d3ee' },
            e_carapaca_reativa: { glyph: 'E', shape: 'shield', c1: '#22c55e', c2: '#a3e635' },
            e_bateria_sobrecarga: { glyph: 'E', shape: 'bolt', c1: '#facc15', c2: '#fb923c' },
            e_fortaleza_inabalavel: { glyph: 'E', shape: 'fort', c1: '#94a3b8', c2: '#38bdf8' },
            r_furia_infinita: { glyph: 'R', shape: 'burst', c1: '#ef4444', c2: '#f97316' },
            r_distorcao_temporal: { glyph: 'R', shape: 'vortex', c1: '#a78bfa', c2: '#22d3ee' },
            r_singularidade_colapso: { glyph: 'R', shape: 'focus', c1: '#6366f1', c2: '#f472b6' },
            r_chuva_tetraedros: { glyph: 'R', shape: 'shards', c1: '#38bdf8', c2: '#a78bfa' },
            r_raio_oblivio: { glyph: 'R', shape: 'bolt', c1: '#facc15', c2: '#ef4444' },
            r_corte_dimensional: { glyph: 'R', shape: 'slash', c1: '#22d3ee', c2: '#f472b6' },
            r_bastiao_titanio: { glyph: 'R', shape: 'fort', c1: '#94a3b8', c2: '#22d3ee' },
            r_terremoto_geometrico: { glyph: 'R', shape: 'burst', c1: '#f97316', c2: '#fde047' },
            r_armadura_reativa: { glyph: 'R', shape: 'shield', c1: '#22c55e', c2: '#38bdf8' },
            r_singularidade: { glyph: 'R', shape: 'vortex', c1: '#8b5cf6', c2: '#22d3ee' },
            r_distorcao_temporal_mut: { glyph: 'R', shape: 'focus', c1: '#a78bfa', c2: '#67e8f9' },
            r_reset_dimensional: { glyph: 'R', shape: 'shards', c1: '#f472b6', c2: '#22d3ee' },
            r_campo_fungos: { glyph: 'R', shape: 'poison', c1: '#22c55e', c2: '#84cc16' },
            r_olhar_gorgona: { glyph: 'R', shape: 'focus', c1: '#10b981', c2: '#a78bfa' },
            r_raio_peste: { glyph: 'R', shape: 'bolt', c1: '#84cc16', c2: '#22c55e' },
            r_cara_viciada: { glyph: 'R', shape: 'coin', c1: '#f59e0b', c2: '#fde047' },
            r_coroa_quebrada: { glyph: 'R', shape: 'shield', c1: '#f59e0b', c2: '#38bdf8' },
            r_coringa_absoluto: { glyph: 'R', shape: 'burst', c1: '#f59e0b', c2: '#f472b6' },
            r_pantera_cinetica: { glyph: 'R', shape: 'slash', c1: '#38bdf8', c2: '#a78bfa' },
            r_guardiao_muralha_viva: { glyph: 'R', shape: 'fort', c1: '#22c55e', c2: '#38bdf8' },
            r_ascensao_colmeia_erg: { glyph: 'R', shape: 'hive', c1: '#38bdf8', c2: '#a78bfa' }
        };

        const makeUpgradeIcon = (upgradeId) => {
            const theme = iconThemes[upgradeId] || { glyph: (skill || '?').toUpperCase(), shape: 'burst', c1: '#00e5ff', c2: '#a5f3fc' };
            const gradientId = `upgrade-icon-${upgradeId.replace(/[^a-z0-9_-]/gi, '')}`;
            const shapes = {
                burst: `<path d="M24 5 L29 18 L43 12 L34 25 L44 34 L30 31 L24 44 L19 31 L5 36 L15 25 L6 12 L20 18 Z" fill="url(#${gradientId})"/>`,
                trail: `<path d="M9 33 C18 22 26 18 39 15" stroke="url(#${gradientId})" stroke-width="5" stroke-linecap="round"/><circle cx="13" cy="35" r="4" fill="${theme.c2}"/><circle cx="23" cy="27" r="3" fill="${theme.c1}"/><circle cx="34" cy="18" r="3" fill="${theme.c2}"/>`,
                focus: `<circle cx="24" cy="24" r="14" fill="none" stroke="url(#${gradientId})" stroke-width="4"/><path d="M24 8 V16 M24 32 V40 M8 24 H16 M32 24 H40" stroke="${theme.c2}" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="4" fill="${theme.c1}"/>`,
                bleed: `<path d="M24 7 C17 17 13 23 13 30 C13 38 18 43 24 43 C31 43 36 38 36 30 C36 23 31 17 24 7 Z" fill="url(#${gradientId})"/><path d="M20 30 C22 34 26 36 31 34" stroke="#fff" stroke-opacity="0.6" stroke-width="2" fill="none" stroke-linecap="round"/>`,
                heal: `<path d="M20 10 H28 V20 H38 V28 H28 V38 H20 V28 H10 V20 H20 Z" fill="url(#${gradientId})"/>`,
                vortex: `<path d="M39 17 C31 9 16 10 12 22 C8 36 25 43 35 33 C42 26 36 17 26 18" fill="none" stroke="url(#${gradientId})" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="24" r="4" fill="${theme.c2}"/>`,
                shield: `<path d="M24 6 L39 12 V22 C39 32 33 39 24 43 C15 39 9 32 9 22 V12 Z" fill="url(#${gradientId})"/><path d="M18 24 L23 29 L32 18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
                bolt: `<path d="M27 4 L11 27 H22 L18 44 L37 19 H26 Z" fill="url(#${gradientId})"/>`,
                fort: `<path d="M9 40 V15 H15 V9 H21 V15 H27 V9 H33 V15 H39 V40 Z" fill="url(#${gradientId})"/><path d="M19 40 V29 C19 25 29 25 29 29 V40" fill="rgba(2,8,23,0.8)"/>`,
                shards: `<path d="M24 5 L32 20 L24 27 L16 20 Z M9 25 L18 29 L16 40 Z M39 25 L30 29 L32 40 Z" fill="url(#${gradientId})"/>`,
                slash: `<path d="M39 7 L14 40 L9 36 L34 5 Z" fill="url(#${gradientId})"/><path d="M16 13 L34 31" stroke="${theme.c2}" stroke-width="3" stroke-linecap="round"/>`,
                poison: `<circle cx="18" cy="19" r="8" fill="${theme.c1}"/><circle cx="30" cy="19" r="8" fill="${theme.c2}"/><path d="M15 31 H33 L29 41 H19 Z" fill="url(#${gradientId})"/>`,
                coin: `<circle cx="24" cy="24" r="16" fill="url(#${gradientId})"/><path d="M18 16 H31 M17 24 H30 M18 32 H31" stroke="rgba(2,8,23,0.65)" stroke-width="3" stroke-linecap="round"/>`,
                hive: `<path d="M24 6 L39 15 V33 L24 42 L9 33 V15 Z" fill="none" stroke="url(#${gradientId})" stroke-width="4"/><path d="M24 6 V42 M9 15 L39 33 M39 15 L9 33" stroke="${theme.c2}" stroke-width="2" stroke-opacity="0.65"/>`
            };
            return `
                <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="${gradientId}" x1="8" y1="6" x2="40" y2="42">
                            <stop offset="0" stop-color="${theme.c2}"/>
                            <stop offset="1" stop-color="${theme.c1}"/>
                        </linearGradient>
                    </defs>
                    <rect x="3" y="3" width="42" height="42" rx="8" fill="rgba(2,8,23,0.55)" stroke="${theme.c1}" stroke-opacity="0.35"/>
                    ${shapes[theme.shape] || shapes.burst}
                    <text x="8" y="16" fill="#ffffff" font-size="9" font-family="Arial, sans-serif" font-weight="700">${theme.glyph}</text>
                </svg>
            `;
        };

        optionsEl.innerHTML = '';
        options.forEach((opt) => {
            const card = document.createElement('div');
            card.className = 'upgrade-option-card';
            card.setAttribute('data-upgrade-id', opt.id);
            card.setAttribute('data-upgrade-skill', skill);
            
            const icon = makeUpgradeIcon(opt.id);
            
            card.innerHTML = `
                <div class="upgrade-option-icon">${icon}</div>
                <div class="upgrade-option-details">
                    <span class="upgrade-option-title">${opt.name}</span>
                    <span class="upgrade-option-desc">${opt.description}</span>
                </div>
            `;
            
            card.onclick = () => {
                this.hideUpgradeModal();
                // Clear any remaining tooltips immediately
                const tooltip = document.getElementById('rpg-item-tooltip');
                if (tooltip) {
                    tooltip.classList.remove('show');
                    tooltip.style.display = 'none';
                }
                const nc = window.net;
                if (nc) nc.upgradeChosen(skill, opt.id);
            };
            
            optionsEl.appendChild(card);
        });
        
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    hideUpgradeModal() {
        const panel = document.getElementById('upgrade-panel');
        if (panel) {
            panel.style.display = 'none';
        }
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

        // 1. Equipped Items
        const loadoutEl = document.getElementById('stats-loadout-list');
        if (loadoutEl) {
            let html = '';
            if (me.loadoutItems && me.loadoutItems.length > 0) {
                const colors = { legendary: '#f1c40f', epic: '#9b59b6', basic: '#bdc3c7' };
                me.loadoutItems.forEach(itemId => {
                    const details = ALL_ITEMS[itemId] || { name: itemId, rarity: 'basic' };
                    const imageFile = ITEM_IMAGES[itemId] || 'item1.png';
                    const color = colors[details.rarity] || colors.basic;
                    html += `<div data-item-id="${itemId}" style="width:28px; height:28px; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; background:${color}22; box-shadow: 0 0 5px ${color}88; cursor: pointer;">
                        <img src="items/${imageFile}" style="width:22px; height:22px; object-fit:contain;" />
                    </div>`;
                });
                if (me.loadoutLevel) {
                    html += `<div style="font-size: 0.75rem; color: #f1c40f; font-weight: bold; align-self: center;">Nv. ${me.loadoutLevel}</div>`;
                }
            } else {
                html = `<div style="font-size: 0.8rem; color: #666;">Nenhum item equipado</div>`;
            }
            if (loadoutEl.innerHTML !== html) {
                loadoutEl.innerHTML = html;
            }
        }

        // 2. Tower Passives
        const towerInfoEl = document.getElementById('stats-tower-info');
        if (towerInfoEl) {
            let html = '';
            if (me.build) {
                const towerDetails = {
                    red: { name: 'Torre Vermelha', color: '#ff4d4d', icon: 'RED', passives: [
                        ['+15% Dano', '+10% Speed', '+20% Critico'],
                        ['10% Lifesteal', '+20% Dano (<30% HP)', 'Ignora 25% Armor'],
                        ['Dano escala c/ hits', 'Ataque Cleave', '+70% Dano / -30% AS'],
                        ['Kill = Cura+Speed', '4o Hit Explode', 'Dano x2 (<20% HP)']
                    ]},
                    green: { name: 'Torre Verde', color: '#4dff4d', icon: 'GREEN', passives: [
                        ['+25% HP Max', 'Reducao Dano Flat', 'Imune a Knockback'],
                        ['Regen 1% HP/s', '+30% Defesa (>80% HP)', 'Reflete 15% Dano'],
                        ['Ataques geram Taunt', 'Aura Reducao Dano', 'Cura de itens x2'],
                        ['Escudo fora combate', 'Sobrevive 1 Hit Kill', 'Escudo quebrado explode']
                    ]},
                    purple: { name: 'Torre Roxa', color: '#d44dff', icon: 'PURPLE', passives: [
                        ['+25% Escudo Max', '+15% Move Speed', '+CDR'],
                        ['Dano extra apos skill', 'Escudo Defletor', 'Vampirismo Magico'],
                        ['10% Esquiva', 'Ataques do Slow', 'Orbes extras no hit'],
                        ['Kill reseta CDs', 'Hitbox magias +30%', 'Aura toxica DPS']
                    ]},
                    poison: { name: 'Torre do Veneno', color: '#10b981', icon: 'POISON', passives: [
                        ['+20% Attack Speed', '+15% Move Speed permanent', 'Tiro Toxico'],
                        ['Passos Leves (+20% MS)', 'Presas Gemeas (Heal)', 'Dardo Cegante (Cegueira)'],
                        ['Miasma Menor (Poca morte)', 'Toxina Paralisante (Slow)', 'Foco Infeccioso (+20% dmg)'],
                        ['Contaminacao (Detonacao)', 'Armadilha Cubica (Shroom)', 'Espalhar a Peste (Transfer Stacks)']
                    ]},
                    coin: { name: 'Torre Coringa', color: '#f59e0b', icon: 'COIN', passives: [
                        ['Cara Agressiva', 'Coroa Vital', 'Moeda Rapida'],
                        ['Critico Endividado', 'Pancada Pesada', 'Ataque Instavel'],
                        ['Sanguessuga Fragil', 'Armadura Cobrada', 'Folego de Risco'],
                        ['Poder no Desespero', 'Seguranca Cara', 'Tudo ou Nada']
                    ]},
                    predator_hive: { name: 'Bastiao Predador da Colmeia', color: '#38bdf8', icon: 'ERG', passives: [
                        ['Reflexo Felino', 'Pele Cinetica', 'Garras da Colmeia'],
                        ['Braco de Bastiao', 'Aparar Geometrico', 'Chamado dos Ergs'],
                        ['Enxame de Fragmentos', 'Regeneracao Mutante', 'Carapaca Viva'],
                        ['Contra-Ataque Cinetico', 'Muralha Predadora', 'Evolucao da Ninhada']
                    ]}
                };
                const tower = towerDetails[me.build.buildingColor];
                if (tower) {
                    html += `<div style="font-weight:bold; color:${tower.color}; text-align:center;">${tower.icon} ${tower.name}</div>`;
                    const p1 = tower.passives[0][me.build.floor1];
                    const p2 = tower.passives[1][me.build.floor2];
                    const p3 = tower.passives[2][me.build.floor3];
                    const p4 = tower.passives[3][me.build.floor4];
                    if (p1) html += `<div style="color:#aaa;"> F1: <span style="color:#fff;">${p1}</span></div>`;
                    if (p2) html += `<div style="color:#aaa;"> F2: <span style="color:#fff;">${p2}</span></div>`;
                    if (p3) html += `<div style="color:#aaa;"> F3: <span style="color:#fff;">${p3}</span></div>`;
                    if (p4) html += `<div style="color:#aaa;"> F4: <span style="color:#fff;">${p4}</span></div>`;
                }
            } else {
                html = `<div style="color:#666; text-align:center;">Nenhuma Torre de Essencia</div>`;
            }
            if (towerInfoEl.innerHTML !== html) {
                towerInfoEl.innerHTML = html;
            }
        }

        // 3. Skill Upgrades
        const upgradesEl = document.getElementById('stats-upgrades-list');
        if (upgradesEl) {
            let html = '';
            if (me.skillUpgrades) {
                const UPGRADE_NAMES = {
                    q_impacto_estilhacante: 'Impacto Estilhacante',
                    q_rastro_polvora: 'Rastro de Polvora',
                    q_convergencia_assassina: 'Convergencia Assassina',
                    w_campo_hemorragia: 'Campo de Hemorragia',
                    w_refracao_vital: 'Refracao Vital',
                    w_vacuo_magnetico: 'Vacuo Magnetico',
                    e_carapaca_reativa: 'Carapaca Reativa',
                    e_bateria_sobrecarga: 'Bateria de Sobrecarga',
                    e_fortaleza_inabalavel: 'Fortaleza Inabalavel',
                    r_furia_infinita: 'Furia Infinita',
                    r_distorcao_temporal: 'Distorcao Temporal',
                    r_singularidade_colaposo: 'Singularidade do Colaposo',
                    r_chuva_tetraedros: 'Chuva de Tetraedros',
                    r_raio_oblivio: 'Raio do Oblivio',
                    r_corte_dimensional: 'Corte Dimensional',
                    r_bastiao_titanio: 'Bastiao de Titanio',
                    r_terremoto_geometrico: 'Terremoto Geometrico',
                    r_armadura_reativa: 'Armadura Reativa',
                    r_singularidade: 'Singularidade',
                    r_distorcao_temporal_mut: 'Distorcao Temporal',
                    r_reset_dimensional: 'Reset Dimensional',
                    r_campo_fungos: 'Campo de Fungos',
                    r_olhar_gorgona: 'Olhar da Gorgona',
                    r_raio_peste: 'Raio da Peste'
                };
                
                const qUp = me.skillUpgrades.q || (me.selectedUpgrades && me.selectedUpgrades.q);
                const wUp = me.skillUpgrades.w || (me.selectedUpgrades && me.selectedUpgrades.w);
                const eUp = me.skillUpgrades.e || (me.selectedUpgrades && me.selectedUpgrades.e);
                const rUp = me.skillUpgrades.r || (me.selectedUpgrades && me.selectedUpgrades.r);

                if (qUp) html += `<div><strong style="color:#0ff;">Q:</strong> ${UPGRADE_NAMES[qUp] || qUp}</div>`;
                if (wUp) html += `<div><strong style="color:#0ff;">W:</strong> ${UPGRADE_NAMES[wUp] || wUp}</div>`;
                if (eUp) html += `<div><strong style="color:#0ff;">E:</strong> ${UPGRADE_NAMES[eUp] || eUp}</div>`;
                if (rUp) html += `<div><strong style="color:#ffd700;">R:</strong> ${UPGRADE_NAMES[rUp] || rUp}</div>`;

                if (!qUp && !wUp && !eUp && !rUp) {
                    html = `<div style="color:#666; text-align:center;">Nenhuma melhoria escolhida</div>`;
                }
            } else {
                html = `<div style="color:#666; text-align:center;">Nenhuma melhoria escolhida</div>`;
            }
            if (upgradesEl.innerHTML !== html) {
                upgradesEl.innerHTML = html;
            }
        }
    }
}
