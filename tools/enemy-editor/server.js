/**
 * Enemy Editor — Mini servidor local para a Authoring Tool
 * Serve o editor HTML e provê API para ler/salvar game_data.json
 * 
 * Uso: node tools/enemy-editor/server.js
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;
const GAME_DATA_PATH = path.resolve(__dirname, '../../server/game_data.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// GET /api/game-data — Retorna o JSON atual
app.get('/api/game-data', (req, res) => {
    try {
        const raw = fs.readFileSync(GAME_DATA_PATH, 'utf-8');
        res.json(JSON.parse(raw));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game-data — Salva o JSON editado
app.post('/api/game-data', (req, res) => {
    try {
        const json = JSON.stringify(req.body, null, 2);
        fs.writeFileSync(GAME_DATA_PATH, json, 'utf-8');
        res.json({ success: true, size: json.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🎨 Enemy Editor running at http://localhost:${PORT}`);
    console.log(`   Editing: ${GAME_DATA_PATH}\n`);
});
