/**
 * AuthManager - Gerencia login/registro e JWT no localStorage
 */
export class AuthManager {
    constructor() {
        this.TOKEN_KEY = 'survival_jwt_token';
        this.USERNAME_KEY = 'survival_username';
        console.log('[Auth] AuthManager initialized');
    }

    getToken() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        console.log('[Auth] getToken:', token ? 'exists' : 'null');
        return token;
    }

    getUsername() {
        return localStorage.getItem(this.USERNAME_KEY) || '';
    }

    isLoggedIn() {
        const token = this.getToken();
        if (!token) return false;
        const parts = token.split('.');
        return parts.length === 3;
    }

    async register(username, password) {
        console.log('[Auth] Registering:', username);
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        this.saveSession(data.token, data.username);
        return data;
    }

    async login(username, password) {
        console.log('[Auth] Logging in:', username);
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        this.saveSession(data.token, data.username);
        return data;
    }

    async verifyToken() {
        const token = this.getToken();
        if (!token) return false;
        try {
            console.log('[Auth] Verifying token...');
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) { this.logout(); return false; }
            const data = await res.json();
            localStorage.setItem(this.USERNAME_KEY, data.username);
            return true;
        } catch (e) {
            console.error('[Auth] Token verification failed:', e);
            return false;
        }
    }

    saveSession(token, username) {
        console.log('[Auth] Saving session for:', username);
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USERNAME_KEY, username);
    }

    logout() {
        console.log('[Auth] Logging out');
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USERNAME_KEY);
    }
}
