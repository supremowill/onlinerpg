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
                background: rgba(0,0,0,.88);
                z-index: 300;
                justify-content: center;
                align-items: center;
                font-family: 'Orbitron', sans-serif;
            }
            #dash-overlay.open { display: flex; }
            #dash-modal {
                background: #0d0d0d;
                border: 2px solid #333;
                box-shadow: 6px 6px 0 #000, 0 0 40px rgba(0,229,255,.08);
                width: 96%;
                max-width: 1080px;
                max-height: 92vh;
                overflow-y: auto;
                color: #eee;
                padding: 0;
            }
            /* header */
            #dash-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #111;
                border-bottom: 2px solid #333;
                padding: 12px 20px;
            }
            #dash-header h2 {
                margin: 0;
                font-size: 1.1rem;
                letter-spacing: .12em;
                color: #00e5ff;
                text-shadow: 0 0 8px #00e5ff88;
            }
            #dash-close {
                background: #c0392b;
                border: none;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-size: .9rem;
                padding: 6px 14px;
                cursor: pointer;
                box-shadow: 3px 3px 0 #000;
                letter-spacing: .08em;
            }
            #dash-close:hover { background: #e74c3c; }
            /* body layout */
            #dash-body {
                display: grid;
                grid-template-columns: 220px 1fr;
                grid-template-rows: auto 1fr;
                gap: 0;
            }
            /* profile block */
            #dash-profile {
                grid-row: 1 / 3;
                border-right: 2px solid #222;
                padding: 20px 16px;
                background: #111;
            }
            #dash-profile h3 {
                margin: 0 0 4px;
                font-size: .75rem;
                color: #555;
                letter-spacing: .12em;
            }
            #dash-playername {
                font-size: 1.1rem;
                color: #00e5ff;
                margin-bottom: 18px;
                word-break: break-all;
            }
            .dash-kda-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
            }
            .dash-kda-block {
                flex: 1;
                text-align: center;
                background: #1a1a1a;
                border: 1px solid #333;
                box-shadow: 2px 2px 0 #000;
                padding: 8px 4px;
                margin: 0 2px;
            }
            .dash-kda-block .kda-val {
                font-size: 1.4rem;
                font-weight: 700;
                color: #fff;
            }
            .dash-kda-block .kda-lbl {
                font-size: .55rem;
                color: #888;
                letter-spacing: .1em;
                margin-top: 2px;
            }
            .dash-kda-block.k .kda-val { color: #00ff88; }
            .dash-kda-block.d .kda-val { color: #ff4444; }
            .dash-kda-block.a .kda-val { color: #ffd700; }
            .dash-stat-line {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #1e1e1e;
                font-size: .8rem;
            }
            .dash-stat-line span:last-child { color: #00e5ff; }
            .dash-rank-badge {
                margin-top: 14px;
                background: #1a1a1a;
                border: 1px solid #333;
                box-shadow: 2px 2px 0 #000;
                padding: 10px;
                text-align: center;
            }
            .dash-rank-badge .rank-num {
                font-size: 2rem;
                color: #ffd700;
            }
            .dash-rank-badge .rank-lbl {
                font-size: .6rem;
                color: #666;
                letter-spacing: .1em;
            }
            /* history block */
            #dash-history {
                padding: 16px 20px;
                border-bottom: 2px solid #222;
            }
            #dash-history h3 {
                margin: 0 0 10px;
                font-size: .7rem;
                color: #555;
                letter-spacing: .14em;
            }
            .dash-table {
                width: 100%;
                border-collapse: collapse;
                font-size: .78rem;
            }
            .dash-table th {
                text-align: left;
                padding: 6px 8px;
                background: #1a1a1a;
                color: #888;
                letter-spacing: .1em;
                font-size: .65rem;
                border-bottom: 1px solid #333;
            }
            .dash-table td {
                padding: 5px 8px;
                border-bottom: 1px solid #1e1e1e;
                color: #ccc;
            }
            .dash-table tr:nth-child(even) td { background: #0f0f0f; }
            .dash-table tr.me td { background: rgba(0,229,255,.07); color: #fff; }
            .score-cell { color: #00e5ff; font-weight: 700; }
            /* leaderboard section */
            #dash-leaderboard { padding: 16px 20px; }
            #dash-leaderboard h3 {
                margin: 0 0 10px;
                font-size: .7rem;
                color: #555;
                letter-spacing: .14em;
            }
            .dash-tabs { display: flex; gap: 0; margin-bottom: 12px; }
            .dash-tab {
                flex: 1;
                background: #1a1a1a;
                border: 1px solid #333;
                color: #666;
                font-family: 'Orbitron', sans-serif;
                font-size: .68rem;
                letter-spacing: .1em;
                padding: 8px;
                cursor: pointer;
                text-align: center;
            }
            .dash-tab.active {
                background: #003540;
                color: #00e5ff;
                border-color: #00e5ff;
                box-shadow: 0 0 8px rgba(0,229,255,.25);
            }
            .dash-tab:hover:not(.active) { background: #222; color: #aaa; }
            .dash-lb-panel { display: none; }
            .dash-lb-panel.active { display: block; }
            /* loading / error */
            .dash-loading {
                text-align: center;
                padding: 30px;
                color: #555;
                font-size: .85rem;
                letter-spacing: .1em;
            }
            /* scrollbar */
            #dash-modal::-webkit-scrollbar { width: 6px; }
            #dash-modal::-webkit-scrollbar-track { background: #111; }
            #dash-modal::-webkit-scrollbar-thumb { background: #333; }
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
                    <!-- Left: Profile & KDA -->
                    <div id="dash-profile">
                        <h3>JOGADOR</h3>
                        <div id="dash-playername">—</div>
                        <h3>K / D / A</h3>
                        <div class="dash-kda-row">
                            <div class="dash-kda-block k"><div class="kda-val" id="d-kills">0</div><div class="kda-lbl">KILLS</div></div>
                            <div class="dash-kda-block d"><div class="kda-val" id="d-deaths">0</div><div class="kda-lbl">DEATHS</div></div>
                            <div class="dash-kda-block a"><div class="kda-val" id="d-assists">0</div><div class="kda-lbl">ASSISTS</div></div>
                        </div>
                        <div class="dash-stat-line"><span>RATIO K/D</span><span id="d-ratio">—</span></div>
                        <div class="dash-stat-line"><span>PARTIDAS</span><span id="d-matches">0</span></div>
                        <div class="dash-stat-line"><span>PONTOS TOTAIS</span><span id="d-total">0</span></div>
                        <div class="dash-stat-line"><span>MELHOR SCORE</span><span id="d-best">0</span></div>
                        <div class="dash-rank-badge">
                            <div class="rank-num" id="d-rank-total">#—</div>
                            <div class="rank-lbl">RANK PONTOS</div>
                        </div>
                        <div class="dash-rank-badge" style="margin-top:6px;">
                            <div class="rank-num" id="d-rank-avg">#—</div>
                            <div class="rank-lbl">MÉDIA GERAL (10 BEST)</div>
                        </div>
                        <div class="dash-rank-badge" style="margin-top:6px;">
                            <div class="rank-num" id="d-rank-weekly">#—</div>
                            <div class="rank-lbl">MÉDIA SEMANAL (10 BEST)</div>
                        </div>
                    </div>

                    <!-- Right top: Match History -->
                    <div id="dash-history">
                        <h3>▶ HISTÓRICO DE PARTIDAS (ÚLTIMAS 10)</h3>
                        <div id="d-history-content"><div class="dash-loading">CARREGANDO...</div></div>
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
        document.getElementById('d-kills').textContent   = k.totalKills;
        document.getElementById('d-deaths').textContent  = k.totalDeaths;
        document.getElementById('d-assists').textContent = k.totalAssists;
        const ratio = k.totalDeaths > 0 ? (k.totalKills / k.totalDeaths).toFixed(2) : k.totalKills.toFixed(2);
        document.getElementById('d-ratio').textContent   = ratio;
        document.getElementById('d-matches').textContent = k.totalMatches;
        document.getElementById('d-total').textContent   = k.totalScore.toLocaleString();
        document.getElementById('d-best').textContent    = k.bestScore.toLocaleString();
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
