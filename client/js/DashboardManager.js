/**
 * DashboardManager — Player Dashboard & Ranking UI
 * Geometric low-poly style: zero border-radius, hard box-shadows, solid colors
 */
export class DashboardManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.modal = null;
        this._inject();
    }

    _inject() {
        /* ── CSS ────────────────────────────────────────────────────────────── */
        const style = document.createElement('style');
        style.textContent = `
            /* ── Dashboard Modal ─────────────────────────────── */
            #dash-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(4, 6, 12, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 300;
                justify-content: center;
                align-items: center;
                font-family: 'Orbitron', sans-serif;
                animation: dashFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes dashFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            #dash-overlay.open { display: flex; }
            #dash-modal {
                background: rgba(10, 14, 24, 0.96);
                border: 1px solid rgba(0, 229, 255, 0.25);
                box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,229,255,0.05);
                width: 96%;
                max-width: 1120px;
                max-height: 94vh;
                overflow-y: auto;
                color: #eee;
                padding: 0;
                border-radius: 16px;
                transform: scale(0.98);
                animation: modalScaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            @keyframes modalScaleUp {
                to { transform: scale(1); }
            }
            /* header */
            #dash-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(10, 14, 24, 0.9) 100%);
                border-bottom: 1px solid rgba(0, 229, 255, 0.15);
                padding: 16px 24px;
                border-top-left-radius: 15px;
                border-top-right-radius: 15px;
            }
            #dash-header h2 {
                margin: 0;
                font-size: 1.15rem;
                letter-spacing: .15em;
                color: #00e5ff;
                text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
                font-weight: 700;
            }
            #dash-close {
                background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
                border: none;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-size: .85rem;
                font-weight: 700;
                padding: 8px 18px;
                cursor: pointer;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(255, 75, 43, 0.3);
                letter-spacing: .08em;
                transition: all 0.25s ease;
            }
            #dash-close:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(255, 75, 43, 0.5);
                filter: brightness(1.1);
            }
            #dash-close:active {
                transform: translateY(1px);
            }
            /* body layout */
            #dash-body {
                display: grid;
                grid-template-columns: 260px 1fr;
                grid-template-rows: auto auto;
                gap: 20px;
                padding: 24px;
            }
            /* profile block */
            #dash-profile {
                grid-row: 1 / 3;
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 14px;
                padding: 24px 20px;
                background: rgba(18, 22, 36, 0.6);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(4px);
            }
            #dash-profile h3 {
                margin: 0 0 8px;
                font-size: .75rem;
                color: #5d6d7e;
                letter-spacing: .12em;
                font-weight: 600;
            }
            #dash-playername {
                font-size: 1.4rem;
                font-weight: 800;
                background: linear-gradient(90deg, #00e5ff 0%, #00ff88 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 24px;
                word-break: break-all;
                filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.3));
            }
            .dash-kda-row {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }
            .dash-kda-block {
                text-align: center;
                background: rgba(26, 32, 53, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                padding: 12px 6px;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }
            .dash-kda-block:hover {
                transform: translateY(-3px);
                background: rgba(26, 32, 53, 0.7);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            .dash-kda-block.k { border-color: rgba(0, 255, 136, 0.15); }
            .dash-kda-block.d { border-color: rgba(255, 68, 68, 0.15); }
            .dash-kda-block.a { border-color: rgba(255, 215, 0, 0.15); }
            
            .dash-kda-block.k:hover { border-color: rgba(0, 255, 136, 0.4); box-shadow: 0 4px 12px rgba(0, 255, 136, 0.15); }
            .dash-kda-block.d:hover { border-color: rgba(255, 68, 68, 0.4); box-shadow: 0 4px 12px rgba(255, 68, 68, 0.15); }
            .dash-kda-block.a:hover { border-color: rgba(255, 215, 0, 0.4); box-shadow: 0 4px 12px rgba(255, 215, 0, 0.15); }

            .dash-kda-block .kda-val {
                font-size: 1.3rem;
                font-weight: 800;
                color: #fff;
            }
            .dash-kda-block .kda-lbl {
                font-size: .52rem;
                color: #888;
                letter-spacing: .08em;
                margin-top: 4px;
                font-weight: 700;
            }
            .dash-kda-block.k .kda-val { color: #00ff88; text-shadow: 0 0 10px rgba(0, 255, 136, 0.3); }
            .dash-kda-block.d .kda-val { color: #ff4444; text-shadow: 0 0 10px rgba(255, 68, 68, 0.3); }
            .dash-kda-block.a .kda-val { color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
            
            .dash-stat-line {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                font-size: .75rem;
                color: #abb2b9;
                align-items: center;
            }
            .dash-stat-line span:first-child { font-weight: 500; letter-spacing: .05em; }
            .dash-stat-line span:last-child { color: #00e5ff; font-weight: 700; text-shadow: 0 0 8px rgba(0, 229, 255, 0.2); }
            
            /* Rank section */
            .dash-ranks-container {
                margin-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                padding-top: 18px;
            }
            .dash-ranks-title {
                font-size: .7rem;
                color: #5d6d7e;
                letter-spacing: .12em;
                margin-bottom: 12px;
                font-weight: 700;
            }
            .dash-rank-item {
                display: flex;
                align-items: center;
                background: rgba(26, 32, 53, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding: 8px 12px;
                margin-bottom: 8px;
                transition: all 0.3s;
            }
            .dash-rank-item:hover {
                background: rgba(26, 32, 53, 0.6);
                border-color: rgba(0, 229, 255, 0.2);
            }
            .dash-rank-item .rank-icon {
                font-size: 1.1rem;
                margin-right: 12px;
            }
            .dash-rank-item .rank-info {
                flex: 1;
            }
            .dash-rank-item .rank-info-lbl {
                font-size: .52rem;
                color: #888;
                letter-spacing: .08em;
                text-transform: uppercase;
                font-weight: 700;
            }
            .dash-rank-item .rank-info-val {
                font-size: .85rem;
                font-weight: 700;
                color: #00e5ff;
            }
            .dash-rank-item.gold .rank-info-val { color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
            .dash-rank-item.silver .rank-info-val { color: #e5e8e8; text-shadow: 0 0 10px rgba(229, 232, 232, 0.3); }
            .dash-rank-item.bronze .rank-info-val { color: #d35400; text-shadow: 0 0 10px rgba(211, 84, 0, 0.3); }

            /* history block */
            #dash-history {
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 14px;
                padding: 24px;
                background: rgba(18, 22, 36, 0.4);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }
            #dash-history h3 {
                margin: 0 0 16px;
                font-size: .8rem;
                color: #00e5ff;
                font-weight: 700;
                letter-spacing: .12em;
                text-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
            }
            .dash-table-container {
                overflow-x: auto;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .dash-table {
                width: 100%;
                border-collapse: collapse;
                font-size: .78rem;
            }
            .dash-table th {
                text-align: left;
                padding: 10px 12px;
                background: rgba(0, 229, 255, 0.06);
                color: #00e5ff;
                letter-spacing: .08em;
                font-size: .65rem;
                font-weight: 700;
                border-bottom: 1px solid rgba(0, 229, 255, 0.15);
                text-transform: uppercase;
            }
            .dash-table td {
                padding: 9px 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                color: #cbd5e1;
            }
            .dash-table tr:nth-child(even) td { background: rgba(255, 255, 255, 0.01); }
            .dash-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
            .dash-table tr.me td {
                background: linear-gradient(90deg, rgba(0, 229, 255, 0.15) 0%, rgba(0, 229, 255, 0.02) 100%);
                color: #fff;
                border-left: 3px solid #00e5ff;
                font-weight: 600;
            }
            .score-cell { color: #00e5ff; font-weight: 700; }
            
            /* leaderboard section */
            #dash-leaderboard {
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 14px;
                padding: 24px;
                background: rgba(18, 22, 36, 0.4);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }
            #dash-leaderboard h3 {
                margin: 0 0 16px;
                font-size: .8rem;
                color: #00e5ff;
                font-weight: 700;
                letter-spacing: .12em;
                text-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
            }
            .dash-tabs {
                display: flex;
                gap: 6px;
                margin-bottom: 16px;
                background: rgba(0, 0, 0, 0.2);
                padding: 4px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.03);
            }
            .dash-tab {
                flex: 1;
                background: transparent;
                border: 1px solid transparent;
                color: #7f8c8d;
                font-family: 'Orbitron', sans-serif;
                font-size: .7rem;
                font-weight: 700;
                letter-spacing: .08em;
                padding: 10px;
                cursor: pointer;
                text-align: center;
                border-radius: 6px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .dash-tab.active {
                background: linear-gradient(135deg, rgba(0, 229, 255, 0.18) 0%, rgba(0, 229, 255, 0.04) 100%);
                color: #00e5ff;
                border-color: rgba(0, 229, 255, 0.3);
                box-shadow: 0 0 15px rgba(0, 229, 255, 0.15);
                text-shadow: 0 0 6px rgba(0, 229, 255, 0.4);
            }
            .dash-tab:hover:not(.active) {
                background: rgba(255, 255, 255, 0.04);
                color: #cbd5e1;
            }
            .dash-lb-panel { display: none; }
            .dash-lb-panel.active { display: block; }
            
            /* loading / error */
            .dash-loading {
                text-align: center;
                padding: 40px;
                color: #555;
                font-size: .85rem;
                letter-spacing: .12em;
                font-weight: 600;
            }
            /* scrollbar */
            #dash-modal::-webkit-scrollbar { width: 6px; }
            #dash-modal::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
            #dash-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            #dash-modal::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.3); }
        `;
        document.head.appendChild(style);

        /* ── HTML ───────────────────────────────────────────────────────────── */
        const overlay = document.createElement('div');
        overlay.id = 'dash-overlay';
        overlay.innerHTML = `
            <div id="dash-modal">
                <div id="dash-header">
                    <h2>◆ DASHBOARD DO JOGADOR</h2>
                    <button id="dash-close">✕ FECHAR</button>
                </div>
                <div id="dash-body">
                    <!-- Left: Profile & Survival Stats -->
                    <div id="dash-profile">
                        <h3>JOGADOR</h3>
                        <div id="dash-playername">—</div>
                        
                        <h3>MÉDIAS POR RUN</h3>
                        <div class="dash-kda-row">
                            <div class="dash-kda-block k">
                                <div class="kda-val" id="d-avg-kills">0.0</div>
                                <div class="kda-lbl">MÉDIA KILLS</div>
                            </div>
                            <div class="dash-kda-block d">
                                <div class="kda-val" id="d-avg-time">00:00</div>
                                <div class="kda-lbl">MÉDIA TEMPO</div>
                            </div>
                            <div class="dash-kda-block a">
                                <div class="kda-val" id="d-avg-collapse">Lv.0.0</div>
                                <div class="kda-lbl">MÉDIA COLAPSO</div>
                            </div>
                        </div>
                        
                        <div class="dash-stat-line"><span>ASSISTÊNCIAS TOTAIS</span><span id="d-total-assists">—</span></div>
                        <div class="dash-stat-line"><span>PARTIDAS JOGADAS</span><span id="d-matches">0</span></div>
                        <div class="dash-stat-line"><span>PONTOS TOTAIS</span><span id="d-total">0</span></div>
                        <div class="dash-stat-line"><span>MELHOR SCORE</span><span id="d-best">0</span></div>
                        
                        <div class="dash-ranks-container">
                            <div class="dash-ranks-title">RANQUEAMENTOS</div>
                            <div class="dash-rank-item gold">
                                <div class="rank-icon">🏆</div>
                                <div class="rank-info">
                                    <div class="rank-info-lbl">RANK PONTOS</div>
                                    <div class="rank-info-val" id="d-rank-total">#—</div>
                                </div>
                            </div>
                            <div class="dash-rank-item silver">
                                <div class="rank-icon">📊</div>
                                <div class="rank-info">
                                    <div class="rank-info-lbl">MÉDIA GERAL (10 BEST)</div>
                                    <div class="rank-info-val" id="d-rank-avg">#—</div>
                                </div>
                            </div>
                            <div class="dash-rank-item bronze">
                                <div class="rank-icon">📅</div>
                                <div class="rank-info">
                                    <div class="rank-info-lbl">MÉDIA SEMANAL (10 BEST)</div>
                                    <div class="rank-info-val" id="d-rank-weekly">#—</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right top: Match History -->
                    <div id="dash-history">
                        <h3>▶ HISTÓRICO DE PARTIDAS (ÚLTIMAS 10)</h3>
                        <div class="dash-table-container" id="d-history-content"><div class="dash-loading">CARREGANDO...</div></div>
                    </div>

                    <!-- Right bottom: Leaderboard -->
                    <div id="dash-leaderboard">
                        <h3>▶ LEADERBOARD</h3>
                        <div class="dash-tabs">
                            <div class="dash-tab active" data-tab="total">🏆 TOP SCORE</div>
                            <div class="dash-tab" data-tab="avg">📊 MÉDIA GERAL</div>
                            <div class="dash-tab" data-tab="weekly">📅 MÉDIA SEMANAL</div>
                        </div>
                        <div class="dash-lb-panel active" id="lb-total"><div class="dash-loading">CARREGANDO...</div></div>
                        <div class="dash-lb-panel" id="lb-avg"><div class="dash-loading">CARREGANDO...</div></div>
                        <div class="dash-lb-panel" id="lb-weekly"><div class="dash-loading">CARREGANDO...</div></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.modal = overlay;

        /* ── Events ─────────────────────────────────────────────────────────── */
        document.getElementById('dash-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });

        // Tab switching
        overlay.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                overlay.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                overlay.querySelectorAll('.dash-lb-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`lb-${tab.dataset.tab}`).classList.add('active');
            });
        });
    }

    async open() {
        this.modal.classList.add('open');
        await this._load();
    }

    close() {
        this.modal.classList.remove('open');
    }

    async _load() {
        const token = this.authManager.getToken();
        const username = this.authManager.getUsername();
        document.getElementById('dash-playername').textContent = username || '—';

        // Set placeholder states
        document.getElementById('d-history-content').innerHTML = '<div class="dash-loading">CARREGANDO...</div>';
        document.getElementById('lb-total').innerHTML = '<div class="dash-loading">CARREGANDO...</div>';
        document.getElementById('lb-avg').innerHTML = '<div class="dash-loading">CARREGANDO...</div>';
        document.getElementById('lb-weekly').innerHTML = '<div class="dash-loading">CARREGANDO...</div>';

        try {
            const res = await fetch('/api/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            this._renderProfile(data);
            this._renderHistory(data.matchHistory, data.username);
            this._renderLeaderboard('lb-total', data.rankingTotal, data.username, false);
            this._renderLeaderboard('lb-avg', data.rankingAvg, data.username, true);
            this._renderLeaderboard('lb-weekly', data.rankingWeekly, data.username, true);
        } catch (e) {
            console.warn('[Dashboard] Load failed:', e.message);
            document.getElementById('d-history-content').innerHTML = '<div class="dash-loading" style="color:#c0392b">ERRO AO CARREGAR DADOS</div>';
        }
    }

    _renderProfile(data) {
        const k = data.kda;
        document.getElementById('d-avg-kills').textContent = k.avgKills ? k.avgKills.toFixed(1) : '0.0';
        document.getElementById('d-avg-time').textContent  = k.avgSurvivalTime ? this._fmtTime(k.avgSurvivalTime) : '00:00';
        document.getElementById('d-avg-collapse').textContent = k.avgCollapse ? `Lv. ${k.avgCollapse.toFixed(1)}` : 'Lv. 1.0';
        document.getElementById('d-total-assists').textContent = k.totalAssists || '0';
        document.getElementById('d-matches').textContent = k.totalMatches || '0';
        document.getElementById('d-total').textContent   = k.totalScore ? k.totalScore.toLocaleString() : '0';
        document.getElementById('d-best').textContent    = k.bestScore ? k.bestScore.toLocaleString() : '0';
        document.getElementById('d-rank-total').textContent = data.playerRankTotal > 0 ? `#${data.playerRankTotal}` : '#—';
        document.getElementById('d-rank-avg').textContent   = data.playerRankAvg > 0 ? `#${data.playerRankAvg}` : '#—';
        document.getElementById('d-rank-weekly').textContent = data.playerRankWeekly > 0 ? `#${data.playerRankWeekly}` : '#—';
    }

    _renderHistory(matches, username) {
        const el = document.getElementById('d-history-content');
        if (!matches || matches.length === 0) {
            el.innerHTML = '<div class="dash-loading">NENHUMA PARTIDA REGISTRADA</div>';
            return;
        }
        const rows = matches.map((m, i) => {
            const date = new Date(m.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
            const dur = this._fmtTime(m.duration || 0);
            return `<tr>
                <td>${i + 1}</td>
                <td>${date}</td>
                <td class="score-cell">${(m.score||0).toLocaleString()}</td>
                <td style="color:#00ff88">${m.kills||0}</td>
                <td style="color:#ff4444">${m.deaths||0}</td>
                <td style="color:#ffd700">${m.assists||0}</td>
                <td>${dur}</td>
                <td style="color:#888">${m.players_in_room||1}p</td>
            </tr>`;
        }).join('');
        el.innerHTML = `
            <table class="dash-table">
                <thead><tr>
                    <th>#</th><th>DATA</th><th>SCORE</th>
                    <th>K</th><th>D</th><th>A</th>
                    <th>TEMPO</th><th>SALA</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    _renderLeaderboard(containerId, list, username, isAvg) {
        const el = document.getElementById(containerId);
        if (!list || list.length === 0) {
            el.innerHTML = '<div class="dash-loading">NENHUM DADO DISPONÍVEL</div>';
            return;
        }
        const rows = list.map((entry, i) => {
            const isMe = entry.playerName === username;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const scoreCell = isAvg
                ? `<td class="score-cell">${entry.avgScore}</td><td style="color:#888">${entry.totalMatches} pts</td>`
                : `<td class="score-cell">${(entry.score||0).toLocaleString()}</td><td></td>`;
            return `<tr class="${isMe ? 'me' : ''}">
                <td style="color:#888;min-width:28px">${medal}</td>
                <td style="flex:1">${isMe ? `<strong style="color:#00e5ff">${entry.playerName}</strong>` : entry.playerName}</td>
                ${scoreCell}
            </tr>`;
        }).join('');
        const scoreHeader = isAvg ? '<th>MÉDIA</th><th>PARTIDAS</th>' : '<th>PONTOS</th><th></th>';
        el.innerHTML = `
            <table class="dash-table" style="max-height:260px;overflow-y:auto;display:block">
                <thead><tr><th>#</th><th>JOGADOR</th>${scoreHeader}</tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    _fmtTime(secs) {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
}
