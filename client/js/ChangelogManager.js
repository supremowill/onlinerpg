/**
 * ChangelogManager.js
 * Gerencia o sininho de notificações de atualizações.
 * Busca changelog.json, exibe um badge "NOVO" quando há atualizações não vistas,
 * e abre um painel modal com a lista de commits.
 */
export class ChangelogManager {
    constructor() {
        this.entries = [];
        this.lastSeenHash = localStorage.getItem('changelog_last_seen') || '';
        this.isOpen = false;
        this.unreadCount = 0;

        this.createUI();
        this.fetchChangelog();
    }

    createUI() {
        // --- Botão do Sininho ---
        const bellBtn = document.createElement('div');
        bellBtn.id = 'changelog-bell';
        bellBtn.innerHTML = '🔔';
        bellBtn.title = 'Atualizações do Jogo';
        document.body.appendChild(bellBtn);

        // Badge
        const badge = document.createElement('span');
        badge.id = 'changelog-badge';
        badge.textContent = '0';
        badge.style.display = 'none';
        bellBtn.appendChild(badge);

        bellBtn.addEventListener('click', () => this.toggle());

        // --- Painel Modal ---
        const overlay = document.createElement('div');
        overlay.id = 'changelog-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <div id="changelog-panel">
                <div id="changelog-header">
                    <h2>📋 Atualizações do Jogo</h2>
                    <button id="changelog-close">✕</button>
                </div>
                <div id="changelog-list"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Fechar ao clicar no X ou no overlay de fundo
        document.getElementById('changelog-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        this.bellBtn = bellBtn;
        this.badge = badge;
        this.overlay = overlay;
        this.listEl = document.getElementById('changelog-list');
    }

    async fetchChangelog() {
        try {
            // Tenta carregar as atualizações customizadas primeiro
            let res = await fetch('/updates.json?t=' + Date.now());
            let isCustom = true;
            if (!res.ok) {
                isCustom = false;
                res = await fetch('/changelog.json?t=' + Date.now());
                if (!res.ok) throw new Error('Atualizações não encontradas');
            }
            this.entries = await res.json();
            this.isCustom = isCustom;

            // Contar entradas não lidas
            const lastSeenKey = this.lastSeenHash;
            if (lastSeenKey && this.entries.length > 0) {
                const lastIdx = this.entries.findIndex(e => (e.id || e.hash) === lastSeenKey);
                this.unreadCount = lastIdx === -1 ? this.entries.length : lastIdx;
            } else if (this.entries.length > 0 && !lastSeenKey) {
                this.unreadCount = this.entries.length;
            }

            this.updateBadge();
        } catch (err) {
            console.warn('ChangelogManager: não foi possível carregar as atualizações', err);
        }
    }

    updateBadge() {
        if (this.unreadCount > 0) {
            this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            this.badge.style.display = 'flex';
            this.bellBtn.classList.add('has-updates');
        } else {
            this.badge.style.display = 'none';
            this.bellBtn.classList.remove('has-updates');
        }
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.renderEntries();

        // Marcar como lido
        if (this.entries.length > 0) {
            const key = this.entries[0].id || this.entries[0].hash;
            localStorage.setItem('changelog_last_seen', key);
            this.lastSeenHash = key;
            this.unreadCount = 0;
            this.updateBadge();
        }
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
    }

    hide() {
        this.bellBtn.style.display = 'none';
        this.close();
    }

    show() {
        this.bellBtn.style.display = 'flex';
    }

    renderEntries() {
        if (this.entries.length === 0) {
            this.listEl.innerHTML = '<p class="changelog-empty">Nenhuma atualização disponível.</p>';
            return;
        }

        if (this.isCustom) {
            // Renderizar a tabela de novidades/updates customizados
            let html = `
                <div style="padding: 10px 15px;">
                    <table class="news-table">
                        <thead>
                            <tr>
                                <th style="width: 65px;">Data</th>
                                <th style="width: 75px;">Tipo</th>
                                <th style="width: 80px;">Alvo</th>
                                <th>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const entry of this.entries) {
                const d = new Date(entry.date);
                const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const typeClass = (entry.type || '').toLowerCase();
                const typeLabel = entry.type || 'Ajuste';
                const targetLabel = entry.target || 'Geral';
                const desc = entry.description || '';

                const isNew = this.isNewEntry(entry);
                const rowStyle = isNew ? 'background: rgba(0,255,255,0.04); border-left: 2px solid #0ff;' : '';

                html += `
                    <tr style="${rowStyle}">
                        <td style="color: #888; font-size: 0.75rem; vertical-align: middle;">${dateStr}</td>
                        <td style="vertical-align: middle;"><span class="news-badge ${typeClass}">${typeLabel}</span></td>
                        <td style="font-weight: 600; color: #fff; vertical-align: middle;">${targetLabel}</td>
                        <td style="color: #ccc; line-height: 1.3; font-family: sans-serif; font-size: 0.8rem; vertical-align: middle;">${this.escapeHtml(desc)}</td>
                    </tr>
                `;
            }

            html += `
                        </tbody>
                    </table>
                </div>
            `;
            this.listEl.innerHTML = html;
        } else {
            // Renderizador de commits clássico
            let html = '';
            let currentDate = '';

            for (const entry of this.entries) {
                const d = new Date(entry.date);
                const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

                if (dateStr !== currentDate) {
                    currentDate = dateStr;
                    html += `<div class="changelog-date-header">${dateStr}</div>`;
                }

                const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isNew = this.isNewEntry(entry);

                // Categorizar por prefixo
                let icon = '🔧';
                const msg = entry.message.toLowerCase();
                if (msg.startsWith('feat')) icon = '✨';
                else if (msg.startsWith('fix')) icon = '🐛';
                else if (msg.startsWith('style')) icon = '🎨';
                else if (msg.startsWith('chore')) icon = '📦';
                else if (msg.startsWith('perf')) icon = '⚡';
                else if (msg.startsWith('refactor')) icon = '♻️';

                html += `
                    <div class="changelog-entry${isNew ? ' is-new' : ''}">
                        <div class="changelog-entry-icon">${icon}</div>
                        <div class="changelog-entry-content">
                            <div class="changelog-entry-message">${this.escapeHtml(this.cleanMessage(entry.message))}</div>
                            <div class="changelog-entry-meta">
                                <span class="changelog-entry-time">${timeStr}</span>
                                <span class="changelog-entry-hash">${entry.hash}</span>
                                ${isNew ? '<span class="changelog-new-tag">NOVO</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            }

            this.listEl.innerHTML = html;
        }
    }

    isNewEntry(entry) {
        if (!this.lastSeenHash) return false; // Primeira visita, nada é "novo"
        const lastIdx = this.entries.findIndex(e => (e.id || e.hash) === this.lastSeenHash);
        const thisIdx = this.entries.indexOf(entry);
        return lastIdx === -1 ? false : thisIdx < lastIdx;
    }

    cleanMessage(msg) {
        // Remove prefixo conventional commits (feat:, fix:, etc.)
        return msg.replace(/^(feat|fix|style|chore|perf|refactor|docs|test|ci|build)(\([^)]*\))?:\s*/i, '');
    }

    escapeHtml(text) {
        const el = document.createElement('span');
        el.textContent = text;
        return el.innerHTML;
    }
}
