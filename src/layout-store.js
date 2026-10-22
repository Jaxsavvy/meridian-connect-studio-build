/**
 * Meridian Connect Multi-Monitor Layout Store
 *
 * Persists window positions and popped-out panel states per user.
 * Built for remote employees (Cassy and Tyler) who run 3+ monitor workstations.
 * Remembers exact coordinates and open popout windows across restarts.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 2026-10-19: moving or resizing a window fires dozens of events a second, and each one used to rewrite this file
// synchronously on the main thread. Changes are now saved once, WRITE_DELAY_MS after the last one, and flush() on quit.
const WRITE_DELAY_MS = 400;

const DEFAULT_MAIN_BOUNDS = {
  width: 1400,
  height: 900
};

const DEFAULT_POPOUT_BOUNDS = {
  'projects': { width: 900, height: 700 },
  'files': { width: 850, height: 700 },
  'tasks': { width: 750, height: 650 },
  'chat': { width: 750, height: 750 },
  'messages': { width: 750, height: 650 },
  'send': { width: 700, height: 600 }
};

class LayoutStore {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    this.layoutFile = path.join(userDataDir, 'user-layouts.json');
    this.data = this._read();
  }

  _read() {
    try {
      if (fs.existsSync(this.layoutFile)) {
        return JSON.parse(fs.readFileSync(this.layoutFile, 'utf8'));
      }
    } catch (e) {
      // Fallback on corrupt file
    }
    return {};
  }

  _write() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }

  flush() {
    if (!this._timer) return;
    clearTimeout(this._timer);
    this._timer = null;
    try {
      fs.writeFileSync(this.layoutFile, JSON.stringify(this.data, null, 2));
    } catch (e) {
      // Ignore disk error
    }
  }

  _getUserKey(userId) {
    return (userId || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  getUserLayout(userId) {
    const key = this._getUserKey(userId);
    if (!this.data[key]) {
      this.data[key] = {
        main: { ...DEFAULT_MAIN_BOUNDS },
        popouts: {
          'projects': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['projects'] },
          'files': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['files'] },
          'tasks': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['tasks'] },
          'chat': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['chat'] },
          'messages': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['messages'] },
          'send': { isOpen: false, ...DEFAULT_POPOUT_BOUNDS['send'] }
        }
      };
      this._write();
    }
    return this.data[key];
  }

  saveMainWindowBounds(userId, bounds) {
    const layout = this.getUserLayout(userId);
    layout.main = { ...layout.main, ...bounds };
    this._write();
  }

  savePopoutBounds(userId, panelId, bounds) {
    const layout = this.getUserLayout(userId);
    if (!layout.popouts[panelId]) {
      layout.popouts[panelId] = { isOpen: true };
    }
    layout.popouts[panelId] = { ...layout.popouts[panelId], ...bounds };
    this._write();
  }

  setPopoutOpen(userId, panelId, isOpen, bounds = null) {
    const layout = this.getUserLayout(userId);
    if (!layout.popouts[panelId]) {
      layout.popouts[panelId] = { ...(DEFAULT_POPOUT_BOUNDS[panelId] || { width: 750, height: 650 }) };
    }
    layout.popouts[panelId].isOpen = Boolean(isOpen);
    if (bounds) {
      layout.popouts[panelId] = { ...layout.popouts[panelId], ...bounds };
    }
    this._write();
  }

  getOpenPopouts(userId) {
    const layout = this.getUserLayout(userId);
    const openList = [];
    for (const [panelId, info] of Object.entries(layout.popouts || {})) {
      if (info && info.isOpen) {
        openList.push({ panelId, ...info });
      }
    }
    return openList;
  }
}

module.exports = LayoutStore;
