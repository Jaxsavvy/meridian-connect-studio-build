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

/** Encrypts the saved login with the operating system's own protection (Windows DPAPI via Electron safeStorage). */
function osCipher() {
  try {
    const { safeStorage } = require('electron');
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) return null;
    return {
      encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
      decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
    };
  } catch (e) {
    return null;
  }
}

class AuthManager {
  constructor(userDataDir, isDev = false, cipher) {
    this.userDataDir = userDataDir;
    this.isDev = isDev;
    this.sessionFile = userDataDir ? path.join(userDataDir, 'session.json') : null;
    this.cipher = cipher === undefined ? osCipher() : cipher;
    this.currentUser = null;
    this._loadSavedSession();
  }

  _loadSavedSession() {
    if (!this.sessionFile) return;
    try {
      if (fs.existsSync(this.sessionFile)) {
        const stored = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
        let data = stored;
        if (stored && stored.v === 2 && typeof stored.enc === 'string') {
          if (!this.cipher) return;   // can't decrypt here: ask the person to sign in again
          data = JSON.parse(this.cipher.decrypt(stored.enc));
        }
        if (data && data.user && data.user.token) {
          this.currentUser = data.user;
          require('./api').setAuthToken(data.user.token, data.user);
          if (stored.v !== 2) this._saveSession(data.user, true);   // upgrade an old plain-text session file
        }
      }
    } catch (e) {
      // Ignore unreadable or corrupted session file; the person signs in again
    }
  }

  _saveSession(user, remember) {
    this.currentUser = user;
    if (!this.sessionFile) return;
    try {
      if (remember && user) {
        if (!this.cipher) {   // no OS encryption available: don't leave the login on disk in plain text
          if (fs.existsSync(this.sessionFile)) fs.unlinkSync(this.sessionFile);
          return;
        }
        const enc = this.cipher.encrypt(JSON.stringify({ user, savedAt: Date.now() }));
        fs.writeFileSync(this.sessionFile, JSON.stringify({ v: 2, enc }), { mode: 0o600 });
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
