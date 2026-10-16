/**
 * Meridian Connect Auth Module
 *
 * All authentication logic is centralized here.
 * Real login gets wired later to Meridian Command's authentication API (through Cloudflare Access).
 * Swapping in the real API is a one-file change right here in auth.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 2026-10-06: fake/stub users removed. Every login is checked by home base (Team Hub).

class AuthManager {
  constructor(userDataDir, isDev = false) {
    this.userDataDir = userDataDir;
    this.isDev = isDev;
    this.sessionFile = userDataDir ? path.join(userDataDir, 'session.json') : null;
    this.currentUser = null;
    this._loadSavedSession();
  }

  _loadSavedSession() {
    if (!this.sessionFile) return;
    try {
      if (fs.existsSync(this.sessionFile)) {
        const raw = fs.readFileSync(this.sessionFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.user && data.user.token) {
          this.currentUser = data.user;
          require('./api').setAuthToken(data.user.token, data.user);
        }
      }
    } catch (e) {
      // Ignore corrupted session file
    }
  }

  _saveSession(user, remember) {
    this.currentUser = user;
    if (!this.sessionFile) return;
    try {
      if (remember && user) {
        fs.writeFileSync(this.sessionFile, JSON.stringify({ user, savedAt: Date.now() }, null, 2));
      } else if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
    } catch (e) {
      // Ignore disk errors
    }
  }

  /**
   * DEV BYPASS for Jax:
   * Only accessible when started with --dev. Logs in directly as Jax.
   */
  async devLogin() {
    return { success: false, error: 'Dev login is turned off. Sign in with your Meridian account.' };
  }

  /**
   * Standard login method.
   * Calls /api/auth/login with graceful fallback.
   */
  async login(username, password, remember = false) {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const cleanUser = username.trim().toLowerCase();
    const api = require('./api');

    try {
      const apiRes = await api.login(cleanUser, password);
      if (apiRes.success && apiRes.user) {
        const user = {
          id: apiRes.user.id,
          username: cleanUser,
          displayName: apiRes.user.name || username.trim(),
          role: apiRes.user.role || 'Team Member',
          avatar: apiRes.user.avatar || username.trim().substring(0, 2).toUpperCase(),
          email: apiRes.user.email || `${cleanUser}@meridian.team`,
          isOwner: Boolean(apiRes.user.is_owner),
          token: apiRes.token
        };
        this._saveSession(user, Boolean(remember));
        return { success: true, user };
      }
      return { success: false, error: apiRes.error || 'Sign-in failed.', offline: Boolean(apiRes.offline) };
    } catch (e) {
      return { success: false, error: 'Cannot reach home base: ' + e.message, offline: true };
    }
  }

  async logout() {
    try {
      const api = require('./api');
      await api.logout();
    } catch (e) {}
    this.currentUser = null;
    if (this.sessionFile && fs.existsSync(this.sessionFile)) {
      try { fs.unlinkSync(this.sessionFile); } catch (e) {}
    }
    return { success: true };
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isDevMode() {
    return Boolean(this.isDev);
  }
}

module.exports = AuthManager;
