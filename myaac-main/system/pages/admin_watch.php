<?php
// myaac-main/system/pages/admin_watch.php
// Get token from PHP session if logged in
$session_token = '';
if (isset($_SESSION['player_id'])) {
    $session_token = generateJWT($_SESSION['player_id'], $_SESSION['player_name'], $_SESSION['is_admin'] ?? false);
}
?>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
    .adminwatch-container {
        font-family: Verdana, Arial, sans-serif;
        color: #3A1A05;
        margin: 10px 0;
    }
    .adminwatch-title {
        font-size: 1.6rem;
        color: #5A2800;
        font-weight: bold;
        border-bottom: 2px solid #5A2800;
        padding-bottom: 5px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
    }
    .adminwatch-dashboard {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
    }
    .adminwatch-panel {
        background-color: #F1E0C6;
        border: 1px solid #5A2800;
        padding: 15px;
        box-shadow: 1px 1px 4px rgba(0,0,0,0.1);
    }
    .adminwatch-panel h3 {
        margin-top: 0;
        border-bottom: 1px dashed #5A2800;
        padding-bottom: 5px;
        color: #5A2800;
        font-size: 1rem;
        font-weight: bold;
    }
    .adminwatch-metric {
        font-size: 2.2rem;
        text-align: center;
        margin: 15px 0;
        font-weight: bold;
        color: #A05000;
        text-shadow: 1px 1px 0px rgba(255,255,255,0.8);
    }
    .adminwatch-chart-container {
        height: 150px;
        width: 100%;
        background-color: #FFF;
        border: 1px solid #D4C0A1;
        padding: 5px;
        box-sizing: border-box;
    }
    .adminwatch-log-box {
        height: 150px;
        overflow-y: auto;
        background-color: #FFF;
        border: 1px solid #D4C0A1;
        padding: 8px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.8rem;
        color: #333;
    }
    .adminwatch-status-dot {
        display: inline-block;
        width: 12px; height: 12px;
        background-color: #d9534f;
        border-radius: 50%;
        margin-right: 10px;
    }
    .adminwatch-status-dot.online {
        background-color: #5cb85c;
        box-shadow: 0 0 5px #5cb85c;
    }
</style>

<div class="adminwatch-container">
    <div class="adminwatch-title">
        <span class="adminwatch-status-dot" id="ws-status"></span>
        Admin Watch - Monitoramento do Servidor
    </div>

    <div class="adminwatch-dashboard">
        <div class="adminwatch-panel">
            <h3>TPS (Ticks Per Second)</h3>
            <div class="adminwatch-metric" id="tps-val">--</div>
            <div class="adminwatch-chart-container">
                <canvas id="tpsChart"></canvas>
            </div>
        </div>
        
        <div class="adminwatch-panel">
            <h3>Memória Heap (MB)</h3>
            <div class="adminwatch-metric" id="mem-val">--</div>
            <div class="adminwatch-chart-container">
                <canvas id="memChart"></canvas>
            </div>
        </div>

        <div class="adminwatch-panel">
            <h3>Players & Salas</h3>
            <div style="display:flex; justify-content:space-around; margin-top:20px;">
                <div style="text-align:center;">
                    <div style="font-size:0.85rem; color:#666; font-weight:bold;">Online</div>
                    <div class="adminwatch-metric" id="players-val">0</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.85rem; color:#666; font-weight:bold;">Salas</div>
                    <div class="adminwatch-metric" id="rooms-val">0</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.85rem; color:#666; font-weight:bold;">Fila</div>
                    <div class="adminwatch-metric" id="queue-val">0</div>
                </div>
            </div>
        </div>

        <div class="adminwatch-panel" style="grid-column: span 1;">
            <h3>Logs do Servidor</h3>
            <div class="adminwatch-log-box" id="log-box">
                <div>[SYS] Inicializando Uplink...</div>
            </div>
        </div>
    </div>
</div>

<script>
    const token = <?php echo json_encode($session_token); ?> || localStorage.getItem('onlinerpg_token');
    if (token) {
        localStorage.setItem('onlinerpg_token', token);
    }

    if (!token) {
        document.body.innerHTML = '<h2 style="color:red;text-align:center;padding:50px;">Acesso Negado. (Token ausente)</h2>';
        throw new Error("No token");
    }

    const wsStatus = document.getElementById('ws-status');
    const logBox = document.getElementById('log-box');

    // Setup Charts
    Chart.defaults.color = '#3A1A05';
    Chart.defaults.font.family = "Verdana, Arial, sans-serif";
    
    const tpsCtx = document.getElementById('tpsChart').getContext('2d');
    const tpsChart = new Chart(tpsCtx, {
        type: 'line',
        data: { 
            labels: Array(20).fill(''), 
            datasets: [{ 
                label: 'TPS', 
                data: Array(20).fill(0), 
                borderColor: '#5cb85c', 
                borderWidth: 2, 
                pointRadius: 0, 
                tension: 0.2 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { min: 0, max: 65, grid: { color: '#E6D5BC' } }, 
                x: { grid: { display: false } } 
            }, 
            plugins: { legend: { display: false } } 
        }
    });

    const memCtx = document.getElementById('memChart').getContext('2d');
    const memChart = new Chart(memCtx, {
        type: 'line',
        data: { 
            labels: Array(20).fill(''), 
            datasets: [{ 
                label: 'Heap (MB)', 
                data: Array(20).fill(0), 
                borderColor: '#A05000', 
                borderWidth: 2, 
                pointRadius: 0, 
                tension: 0.2, 
                fill: true, 
                backgroundColor: 'rgba(160, 80, 0, 0.1)' 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { beginAtZero: true, grid: { color: '#E6D5BC' } }, 
                x: { grid: { display: false } } 
            }, 
            plugins: { legend: { display: false } } 
        }
    });

    function addLog(msg) {
        const div = document.createElement('div');
        div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logBox.appendChild(div);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function connectWS() {
        const host = window.location.hostname;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const gamePort = (host === 'localhost' || host === '127.0.0.1') ? '3000' : '';
        const WS_URL = wsProtocol + '//' + host + (gamePort ? ':' + gamePort : '') + '/ws';

        addLog(`Tentando conectar ao uplink: ${WS_URL}`);
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            wsStatus.classList.add('online');
            addLog('Conexão WebSocket estabelecida. Autenticando Admin...');
            ws.send(JSON.stringify({
                type: 'JOIN_ADMIN',
                payload: { token }
            }));
        };

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'ADMIN_WELCOME') {
                addLog('Autenticação Aceita. Recebendo biometria do servidor.');
            } else if (msg.type === 'ADMIN_STATS') {
                const s = msg.payload;
                
                document.getElementById('tps-val').innerText = s.totalTps ? s.totalTps.toFixed(1) : '0';
                document.getElementById('players-val').innerText = s.totalPlayers || 0;
                document.getElementById('rooms-val').innerText = s.activeRooms || 0;
                document.getElementById('queue-val').innerText = s.playersInQueue || 0;
                
                const mb = s.memory ? (s.memory.heapUsed / 1024 / 1024).toFixed(1) : 0;
                document.getElementById('mem-val').innerText = mb;

                tpsChart.data.datasets[0].data.shift();
                tpsChart.data.datasets[0].data.push(s.totalTps || 0);
                tpsChart.update('none');

                memChart.data.datasets[0].data.shift();
                memChart.data.datasets[0].data.push(mb);
                memChart.update('none');
            }
        };

        ws.onclose = (e) => {
            wsStatus.classList.remove('online');
            addLog(`Uplink perdido (Código: ${e.code}). Tentando reconectar em 3s...`);
            setTimeout(connectWS, 3000);
        };
    }

    connectWS();
</script>
