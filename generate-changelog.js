/**
 * generate-changelog.js
 * 
 * Gera client/changelog.json a partir do git log.
 * Rode este script antes do deploy:
 *   node generate-changelog.js
 * 
 * Formato de saída:
 * [
 *   { "hash": "abc1234", "date": "2026-05-20T21:00:00-03:00", "message": "fix: buff do faraó", "author": "William" },
 *   ...
 * ]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 50;

// Git log com formato JSON-friendly, separador ||| entre campos
const gitLogCmd = `git log --pretty=format:"%H|||%aI|||%s|||%an" -n ${MAX_ENTRIES}`;

try {
    const raw = execSync(gitLogCmd, { encoding: 'utf-8', cwd: __dirname });
    const lines = raw.trim().split('\n').filter(l => l.trim());

    const changelog = lines.map(line => {
        const parts = line.split('|||');
        return {
            hash: parts[0]?.substring(0, 7) || '',
            date: parts[1] || '',
            message: parts[2] || '',
            author: parts[3] || ''
        };
    });

    const outPath = path.join(__dirname, 'client', 'changelog.json');
    fs.writeFileSync(outPath, JSON.stringify(changelog, null, 2), 'utf-8');
    console.log(`✅ changelog.json gerado com ${changelog.length} entradas em ${outPath}`);
} catch (err) {
    console.error('❌ Erro ao gerar changelog:', err.message);
    // Gera um arquivo vazio caso falhe (sem git, etc)
    const outPath = path.join(__dirname, 'client', 'changelog.json');
    fs.writeFileSync(outPath, '[]', 'utf-8');
    console.log('⚠️ changelog.json vazio gerado (fallback).');
}
