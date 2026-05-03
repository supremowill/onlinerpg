/**
 * AuthManager - Gerencia login/registro e JWT no localStorage
 */
export class AuthManager {
    constructor() {
        this.TOKEN_KEY = 'survival_jwt_token';
        this.USERNAME_KEY = 'survival_username';
    }

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    getUsername() {
        return localStorage.getItem(this.USERNAME_KEY) || '';
    }

    isLoggedIn() {
        const token = this.getToken();
        if (!token) return false;
        // Basic JWT structure check (header.payload.signature)
        const parts = token.split('.');
        return parts.length === 3;
    }

    async register(username, password) {
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
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) { this.logout(); return false; }
            const data = await res.json();
            localStorage.setItem(this.USERNAME_KEY, data.username);
            return true;
        } catch {
            return false;
        }
    }

    saveSession(token, username) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USERNAME_KEY, username);
    }

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USERNAME_KEY);
    }
}
