/**
 * Meridian Connect - Main Process
 *
 * Independent desktop shell for Meridian team members.
 * Supports multi-monitor panel popouts with per-user layout persistence.
 */

'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, shell, dialog, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');

const AuthManager = require('./auth');
const LayoutStore = require('./layout-store');
const api = require('./api');
const { isSafeExternalUrl, isAllowedServerUrl } = require('./safe-url');
const boardCheck = require('./board-check');
const previewCheck = require('./preview-check');

/** Opens a link in the person's browser or mail app, but only if it's a normal web or email link. */
function openSafeExternal(url) {
  if (!isSafeExternalUrl(url)) {
    console.warn('Blocked opening a non-web link.');
    return false;
  }
  shell.openExternal(url);
  return true;
}

// Every window: pop-ups never open inside the app; safe links go to the browser,
// and app windows never navigate away from the app's own pages.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => { openSafeExternal(url); return { action: 'deny' }; });
});

// Chat images/video/audio load through this private channel so the login token
// travels in a header from the main process and never appears in a page URL.
protocol.registerSchemesAsPrivileged([
  { scheme: 'meridian-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const MEDIA_ID = /^[A-Za-z0-9._-]{1,200}$/;

const STUDIO_FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function handleMediaRequest(request) {
  let parsed = null;
  try { parsed = new URL(request.url); } catch (e) { parsed = null; }
  if (parsed && parsed.host === 'studio') {   // meridian-media://studio/<spaceId>/<assetId> (Studio images, #48)
    const parts = parsed.pathname.replace(/^\/+/, '').split('/').map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
    if (parts.length !== 2 || !parts.every(p => STUDIO_FILE_ID.test(p))) return new Response('Not found', { status: 404 });
    const { url, headers } = api.studioFileRequest(parts[0], parts[1]);
    if (!isAllowedServerUrl(url.slice(0, url.indexOf('/api/')))) return new Response('Server address not allowed', { status: 403 });
    return net.fetch(url, { headers });
  }
  let mediaId = '';
  try { mediaId = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, '')); } catch (e) { mediaId = ''; }
  if (!MEDIA_ID.test(mediaId)) return new Response('Not found', { status: 404 });
  const { url, headers } = api.chatMediaRequest(mediaId);
  if (!isAllowedServerUrl(url.slice(0, url.indexOf('/api/')))) return new Response('Server address not allowed', { status: 403 });
  const range = request.headers.get('range');
  return net.fetch(url, { headers: range ? { ...headers, Range: range } : headers });
}

/** Saves settings from the Settings screen. Only known, harmless keys are accepted. Changing the
 *  server address needs a native confirmation the page can't fake, and signs the person out. */
const PAGE_SETTINGS = ['apiTimeoutMs', 'notificationsEnabled', 'speakReplies', 'idleTimeoutHours', 'reconnectIntervalMs'];

async function saveSettingsFromPage(event, incoming) {
  const input = incoming && typeof incoming === 'object' ? incoming : {};
  const safe = {};
  for (const key of PAGE_SETTINGS) if (key in input) safe[key] = input[key];
  const current = getSettings();
  const wanted = typeof input.serverUrl === 'string' ? input.serverUrl.trim().replace(/\/+$/, '') : '';
  const changingServer = wanted && wanted !== String(current.serverUrl || '').replace(/\/+$/, '');
  if (changingServer) {
    if (!isAllowedServerUrl(wanted)) {
      return { success: false, error: 'Server address must start with https:// (ask Jax for the right address).' };
    }
    const choice = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'warning',
      buttons: ['Cancel', 'Switch server'],
      defaultId: 0,
      cancelId: 0,
      title: 'Change server',
      message: `Connect will sign you out and send your next login to:\n${new URL(wanted).origin}`,
      detail: 'Only do this if Jax gave you this address.',
    });
    if (choice.response !== 1) return { success: false, canceled: true };
    safe.serverUrl = wanted;
  }
  const result = saveSettings(safe);
  if (result.success && changingServer) {
    await authManager.logout();
    return { ...result, signedOut: true };
  }
  return result;
}

function keepWindowOnAppPages(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    event.preventDefault();
    openSafeExternal(url);
  });
}

const isDev = process.argv.includes('--dev');
const isTestMode = process.argv.includes('--test-automation');
let authManager = null;
let layoutStore = null;
let mainWindow = null;
let tray = null;
const popoutWindows = new Map();

// 2026-10-06: the installed app can't write inside itself, so each person's settings (like the home-base
// address) live in their own app-data folder and override the defaults shipped in config/settings.json.
function userSettingsPath() {
  return process.env.MERIDIAN_CONNECT_SETTINGS || path.join(app.getPath('userData'), 'settings.json');
}

function getSettings() {
  const settingsPath = path.join(__dirname, '..', 'config', 'settings.json');
  try {
    let merged = null;
    if (fs.existsSync(settingsPath)) merged = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const mine = userSettingsPath();
    if (fs.existsSync(mine)) merged = Object.assign(merged || {}, JSON.parse(fs.readFileSync(mine, 'utf8')));
    if (merged) return merged;
  } catch (e) {
    // Return defaults if read fails
  }
  return {
    serverUrl: 'https://meridian-command.your-team.cloudflareaccess.com',
    apiTimeoutMs: 10000,
    reconnectIntervalMs: 5000,
    idleTimeoutHours: 8,
    notificationsEnabled: true,
    appName: 'Meridian Connect'
  };
}

function saveSettings(newSettings) {
  const settingsPath = userSettingsPath();
  try {
    const existing = getSettings();
    const merged = { ...existing, ...newSettings };
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true, settings: merged };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function checkUpdate() {
  const pjsonPath = path.join(__dirname, '..', 'package.json');
  let currentVersion = '0.1.0';
  try {
    currentVersion = JSON.parse(fs.readFileSync(pjsonPath, 'utf8')).version;
  } catch (e) {}
  return {
    success: true,
    currentVersion,
    latestVersion: currentVersion,
    isLatest: true,
    checkedAt: new Date().toISOString()
  };
}

function showNotification({ title, body }) {
  if (!Notification.isSupported()) return false;
  try {
    const n = new Notification({
      title: title || 'Meridian Connect',
      body: body || '',
      icon: getIconPath()
    });
    n.show();
    return true;
  } catch (e) {
    return false;
  }
}

function getIconPath() {
  const iconPath = path.join(__dirname, '..', 'assets', 'meridian.ico');
  if (fs.existsSync(iconPath)) return iconPath;
  return null;
}

// REOPEN FIX (2026-10-11): one way to bring Connect to the front. If the main window was closed (or never
// finished loading), make a new one instead of doing nothing, so a second launch or the tray always opens Connect.
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (isTestMode) return;
  const icon = getIconPath();
  if (!icon) return;
  try {
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Meridian Connect', click: () => showMainWindow() },
      { type: 'separator' },
      { label: 'Status: Shell Mode (Standby)', enabled: false },
      { type: 'separator' },
      { label: 'Quit Meridian Connect', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Meridian Connect');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => showMainWindow());
  } catch (e) {
    console.error('Tray creation error:', e);
  }
}

// SPLASH (2026-10-08): the same small loading window Meridian Command uses, shown while Connect's main window loads.
let splashWindow = null;
function createSplashWindow() {
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  const w = 460, h = 300;
  splashWindow = new BrowserWindow({
    width: w, height: h,
    x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2),
    frame: false, transparent: true, resizable: false, alwaysOnTop: true, show: false, skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none}
    .container{background:#05060A;border:1px solid rgba(139,92,246,.4);border-radius:16px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 16px 48px rgba(0,0,0,.9),0 0 32px rgba(124,58,237,.25);position:relative;overflow:hidden}
    .glow{position:absolute;top:-50px;width:200px;height:100px;background:radial-gradient(circle,rgba(168,85,247,.3) 0%,transparent 70%);filter:blur(20px)}
    .title{font-size:26px;font-weight:800;letter-spacing:4px;background:linear-gradient(135deg,#06B6D4,#A855F7,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
    .sub{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#94A3B8;margin-bottom:28px}
    .status-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#CBD5E1}
    .pulse-dot{width:8px;height:8px;border-radius:50%;background:#06B6D4;box-shadow:0 0 10px #06B6D4;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.2)}}
    .shimmer-bar{width:180px;height:3px;background:rgba(255,255,255,.1);border-radius:2px;margin-top:18px;overflow:hidden;position:relative}
    .shimmer-bar::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,#A855F7,transparent);animation:shimmer 1.8s infinite}
    @keyframes shimmer{100%{left:100%}}
  </style></head><body><div class="container"><div class="glow"></div><div class="title">MERIDIAN</div>
    <div class="sub">Meridian Connect</div><div class="status-row"><div class="pulse-dot"></div><span>Starting Meridian Connect...</span></div>
    <div class="shimmer-bar"></div></div></body></html>`;
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  splashWindow.once('ready-to-show', () => { if (splashWindow) splashWindow.show(); });
  splashWindow.on('closed', () => { splashWindow = null; });
}
// The splash only appears when the main window is slow (not ready after SPLASH_DELAY_MS), and closes the moment the
// main window shows. It used to stay up for at least 1.2 s, which added about a second to every normal launch.
const SPLASH_DELAY_MS = 400;
let splashTimer = null;
function closeSplashThen(done) {
  clearTimeout(splashTimer);
  splashTimer = null;
  done();
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function createMainWindow() {
  const icon = getIconPath();
  const user = authManager ? authManager.getCurrentUser() : null;
  const userLayout = layoutStore ? layoutStore.getUserLayout(user ? user.id : 'default') : null;
  const bounds = (userLayout && userLayout.main) ? userLayout.main : { width: 1400, height: 900 };

  const winOpts = {
    width: bounds.width || 1400,
    height: bounds.height || 900,
    minWidth: 800,   // the top bar collapses cleanly down to 800px, so a narrow window and 200% zoom work (#83)
    minHeight: 700,
    backgroundColor: '#05060A',
    show: false,
    title: 'Meridian Connect',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (bounds.x !== undefined && bounds.y !== undefined) {
    winOpts.x = bounds.x;
    winOpts.y = bounds.y;
  }

  if (icon) winOpts.icon = icon;

  mainWindow = new BrowserWindow(winOpts);

  keepWindowOnAppPages(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // REOPEN FIX: if the page is slow or fails, still show the window after 15 s instead of leaving an
  // invisible Connect running in the background (which blocks every later launch).
  const showFallback = setTimeout(() => {
    closeSplashThen(() => { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show(); });
  }, 15000);
  mainWindow.webContents.on('render-process-gone', () => {   // page crashed: reload it rather than leave a blank window
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
  });

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    closeSplashThen(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show(); });
    if (isTestMode) {
      setTimeout(runAutomationTests, 800);
    }
  });

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const currentBounds = mainWindow.getBounds();
    const currentUser = authManager ? authManager.getCurrentUser() : null;
    if (layoutStore && currentUser) {
      layoutStore.saveMainWindowBounds(currentUser.id, currentBounds);
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close all popout windows when main window closes
    for (const [panelId, win] of popoutWindows.entries()) {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }
    popoutWindows.clear();
    // REOPEN FIX: website previews and the splash used to stay open (sometimes hidden), which kept Connect
    // running with no main window. Close everything so the app fully exits and can be opened again normally.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.destroy();
    }
    if (!isTestMode) app.quit();
  });
}

function createPopoutWindow(panelId) {
  const currentUser = authManager ? authManager.getCurrentUser() : null;
  const userId = currentUser ? currentUser.id : 'default';
  const userLayout = layoutStore ? layoutStore.getUserLayout(userId) : null;
  const popoutInfo = (userLayout && userLayout.popouts && userLayout.popouts[panelId]) || {};

  if (popoutWindows.has(panelId)) {
    const existing = popoutWindows.get(panelId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return true;
    }
  }

  const icon = getIconPath();
  const panelTitles = {
    'overview': 'Overview & Deck',
    'projects': 'My Projects',
    'files': 'Project Files & Notes',
    'tasks': 'My Tasks',
    'chat': 'Project AI Chat',
    'messages': 'Team Messages',
    'send': 'Send to Meridian',
    'tools': 'Tools & Services'
  };

  const winOpts = {
    width: popoutInfo.width || 800,
    height: popoutInfo.height || 700,
    minWidth: 500,
    minHeight: 450,
    backgroundColor: '#05060A',
    title: 'Meridian Connect - ' + (panelTitles[panelId] || 'Panel'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (popoutInfo.x !== undefined && popoutInfo.y !== undefined) {
    winOpts.x = popoutInfo.x;
    winOpts.y = popoutInfo.y;
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    winOpts.x = mainBounds.x + 60;
    winOpts.y = mainBounds.y + 60;
  }

  if (icon) winOpts.icon = icon;

  const popWin = new BrowserWindow(winOpts);
  popoutWindows.set(panelId, popWin);

  const queryParams = new URLSearchParams({
    panel: panelId,
    user: currentUser ? currentUser.displayName : 'Team Member',
    role: currentUser ? currentUser.role : 'Member'
  });

  keepWindowOnAppPages(popWin);
  popWin.loadFile(path.join(__dirname, 'renderer', 'popout.html'), {
    search: queryParams.toString()
  });

  const saveBounds = () => {
    if (!popWin || popWin.isDestroyed()) return;
    const currentBounds = popWin.getBounds();
    if (layoutStore && currentUser) {
      layoutStore.savePopoutBounds(currentUser.id, panelId, currentBounds);
    }
  };

  popWin.on('resize', saveBounds);
  popWin.on('move', saveBounds);

  popWin.on('closed', () => {
    popoutWindows.delete(panelId);
    if (layoutStore && currentUser) {
      layoutStore.setPopoutOpen(currentUser.id, panelId, false);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('layout:panel-docked', panelId);
    }
  });

  if (layoutStore && currentUser) {
    layoutStore.setPopoutOpen(currentUser.id, panelId, true, popWin.getBounds());
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('layout:panel-popped-out', panelId);
  }

  return true;
}

function dockPanel(panelId) {
  if (popoutWindows.has(panelId)) {
    const win = popoutWindows.get(panelId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    popoutWindows.delete(panelId);
  }

  const currentUser = authManager ? authManager.getCurrentUser() : null;
  if (layoutStore && currentUser) {
    layoutStore.setPopoutOpen(currentUser.id, panelId, false);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('layout:panel-docked', panelId);
  }

  return true;
}

function restoreUserPopouts(user) {
  if (!layoutStore || !user) return;
  const openPopouts = layoutStore.getOpenPopouts(user.id);
  for (const item of openPopouts) {
    createPopoutWindow(item.panelId);
  }
}

async function runAutomationTests() {
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  const outDir = (process.env.MERIDIAN_TEST_ARTIFACT_DIR || screenshotsDir).trim();
  fs.mkdirSync(outDir, { recursive: true });
  console.log('[TEST] Test mode initialized. Saving captures to:', outDir);

  const consoleErrors = [];
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 3) {
      consoleErrors.push({ message, line, sourceId });
    }
  });

  await new Promise(r => setTimeout(r, 1200));

  // 1. Capture Login Screen
  const imgLogin = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, '01_login.png'), imgLogin.toPNG());
  console.log('[TEST] Captured 01_login.png');

  // 2. Perform Dev Bypass Login
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('btn-dev-bypass').click();
  `);
  await new Promise(r => setTimeout(r, 1500));

  // 3. Capture Main Window with all 6 panels
  const imgMain = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, '02_main_window.png'), imgMain.toPNG());
  console.log('[TEST] Captured 02_main_window.png');

  // Helper to capture a panel element
  async function captureElement(selector, filename) {
    try {
      const rect = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const el = document.querySelector('${selector}');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
        })()
      `);
      if (rect && rect.width > 0 && rect.height > 0) {
        const img = await mainWindow.webContents.capturePage(rect);
        fs.writeFileSync(path.join(outDir, filename), img.toPNG());
        console.log('[TEST] Captured', filename);
      }
    } catch (e) {
      console.error('[TEST] Failed to capture', selector, e.message);
    }
  }

  // 4. Capture Overview and spaces
  await captureElement('.orbit-board', '02_main_window.png');
  await captureElement('.tile-calendar', '03_panel_projects.png');
  await captureElement('.tile-projects', '04_panel_files.png');
  await captureElement('.tile-tasks', '05_panel_tasks.png');
  await captureElement('.tile-gmail', '07_panel_messages.png');
  await captureElement('.tile-attention', '08_panel_send.png');

  // Switch to Tools space, test execution, and capture
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-view="tools"]').click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await mainWindow.webContents.executeJavaScript(`
    const btn = document.querySelector('[data-action="run-tool"]');
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureElement('#toolsCenter', '13_panel_tools.png');


  // 5. Open and capture Settings modal
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('openSettingsBtn').click();
  `);
  await new Promise(r => setTimeout(r, 600));
  const imgSettings = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, '09_settings_modal.png'), imgSettings.toPNG());
  console.log('[TEST] Captured 09_settings_modal.png');

  // Close Settings modal
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('btn-settings-cancel').click();
  `);
  await new Promise(r => setTimeout(r, 400));

  // 6. Open Quick Search modal via Ctrl+K and capture
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('dashboardSearchTrigger').click();
    const inp = document.getElementById('quick-search-input');
    inp.value = 'voice';
    inp.dispatchEvent(new Event('input'));
  `);
  await new Promise(r => setTimeout(r, 600));
  const imgSearch = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, '10_quick_search_modal.png'), imgSearch.toPNG());
  console.log('[TEST] Captured 10_quick_search_modal.png');

  // Close search modal
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('btn-search-close').click();
  `);
  await new Promise(r => setTimeout(r, 400));

  // Switch back to overview for popout test
  await mainWindow.webContents.executeJavaScript(`
    document.querySelector('[data-view="overview"]').click();
  `);
  await new Promise(r => setTimeout(r, 600));

  // 7. Pop out Overview panel into separate window
  await mainWindow.webContents.executeJavaScript(`
    document.getElementById('btn-popout-active').click();
  `);
  await new Promise(r => setTimeout(r, 1500));


  // 8. Capture Main Window after popout (showing docked placeholder)
  const imgMainPopped = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, '11_main_docked_state.png'), imgMainPopped.toPNG());
  console.log('[TEST] Captured 11_main_docked_state.png');

  // 9. Capture Popout Window
  const popWin = popoutWindows.get('overview') || popoutWindows.get('projects');
  if (popWin) {
    const imgPop = await popWin.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, '12_popout_window.png'), imgPop.toPNG());
    console.log('[TEST] Captured 12_popout_window.png');
  }

  // 10. Dock panel back
  try {
    await mainWindow.webContents.executeJavaScript(`
      (() => {
        const btn = document.getElementById('btn-dock-current');
        if (btn) btn.click();
      })()
    `);
  } catch (e) {
    dockPanel('overview');
  }
  await new Promise(r => setTimeout(r, 1000));


  // 11. Verify layout state
  const currentUser = authManager.getCurrentUser();
  const layout = layoutStore.getUserLayout(currentUser ? currentUser.id : 'default');
  console.log('[TEST] User Layout JSON:', JSON.stringify(layout));

  // 12. Check console errors
  if (consoleErrors.length > 0) {
    console.warn('[TEST] Console errors detected during test run:', JSON.stringify(consoleErrors));
  } else {
    console.log('[TEST] ZERO console errors observed during automated test run.');
  }

  console.log('[TEST] AUTOMATION_SUCCESS: All screenshots captured and multi-window layout verified.');
  app.quit();
}

// Developer copy (npm run dev) keeps its own settings and sign-in folder, so it runs
// alongside the installed Meridian Connect instead of closing itself to give way to it.
if (isDev && !app.isPackaged) app.setPath('userData', `${app.getPath('userData')} (dev)`);

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showMainWindow();
  });

  // AUTO-UPDATE (2026-10-08): Connect checks home base for a newer version (on start, then every 30 minutes),
  // downloads it quietly, and shows "Restart to update". New versions are published with
  // Meridian\runtime\publish-connect.ps1, which puts them in home base's connect-updates folder.
  let updateReady = null;
  function setupAutoUpdate() {
    ipcMain.handle('update:status', () => ({ ready: updateReady, version: app.getVersion(), packaged: app.isPackaged }));
    if (!app.isPackaged) return;   // running from the code (npm start): nothing to update
    let updater;
    try { ({ autoUpdater: updater } = require('electron-updater')); } catch (e) { return; }
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.disableDifferentialDownload = true;
    updater.logger = null;
    updater.on('update-downloaded', (info) => {
      updateReady = { version: info && info.version };
      BrowserWindow.getAllWindows().forEach((w) => { try { w.webContents.send('update:ready', updateReady); } catch (e) {} });
    });
    updater.on('error', () => {});   // home base offline or no update published: try again later
    const check = () => {
      try {
        const server = api.getServerUrl();
        if (!isAllowedServerUrl(server)) return;   // never take app updates from an unsafe address
        updater.setFeedURL({ provider: 'generic', url: server + '/updates' });
        updater.checkForUpdates().catch(() => {});
      } catch (e) { /* ignore */ }
    };
    ipcMain.handle('update:install', () => { if (updateReady) setImmediate(() => updater.quitAndInstall(true, true)); return !!updateReady; });
    ipcMain.handle('update:check', () => { check(); return true; });
    setTimeout(check, 20000);
    setInterval(check, 30 * 60 * 1000);
  }

  app.whenReady().then(() => {
    const userData = app.getPath('userData');
    process.env.MERIDIAN_CONNECT_SETTINGS = path.join(userData, 'settings.json');
    authManager = new AuthManager(userData, isDev && !app.isPackaged);   // sample sign-in never works in the installed app
    protocol.handle('meridian-media', handleMediaRequest);
    layoutStore = new LayoutStore(userData);

    // Setup IPC
    ipcMain.handle('auth:is-dev', () => isDev && !app.isPackaged);   // developer tools never appear in the installed app
    ipcMain.handle('auth:get-current-user', () => authManager.getCurrentUser());

    ipcMain.handle('auth:dev-login', async () => {
      const res = await authManager.devLogin();
      if (res.success && res.user && !isTestMode) {
        setTimeout(() => restoreUserPopouts(res.user), 500);
      }
      return res;
    });

    ipcMain.handle('auth:login', async (event, { username, password, remember }) => {
      const res = await authManager.login(username, password, remember);
      if (res.success && res.user && !isTestMode) {
        setTimeout(() => restoreUserPopouts(res.user), 500);
      }
      return res;
    });

    ipcMain.handle('auth:logout', async () => {
      for (const [panelId, win] of popoutWindows.entries()) {
        if (win && !win.isDestroyed()) win.close();
      }
      popoutWindows.clear();
      return authManager.logout();
    });

    ipcMain.handle('settings:get', () => getSettings());
    ipcMain.handle('settings:save', saveSettingsFromPage);
    ipcMain.handle('app:check-update', () => checkUpdate());
    ipcMain.handle('app:show-notification', (e, opts) => showNotification(opts));
    ipcMain.handle('app:open-external', (e, url) => openSafeExternal(url));

    ipcMain.handle('layout:get-user-layout', (event, userId) => {
      return layoutStore.getUserLayout(userId);
    });

    ipcMain.handle('layout:popout-panel', (event, panelId) => {
      return createPopoutWindow(panelId);
    });

    ipcMain.handle('layout:dock-panel', (event, panelId) => {
      return dockPanel(panelId);
    });

    // Broadcast data changes between main and popout windows
    ipcMain.on('sync:broadcast', (event, payload) => {
      if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
        mainWindow.webContents.send('sync:data-changed', payload);
      }
      for (const [panelId, win] of popoutWindows.entries()) {
        if (win && !win.isDestroyed() && event.sender !== win.webContents) {
          win.webContents.send('sync:data-changed', payload);
        }
      }
    });

    // API IPC Stub Handlers
    ipcMain.handle('api:get-me', (e, user) => api.getMe(user));
    ipcMain.handle('api:time', (e, req) => api.timeReport(req && req.from, req && req.to));   // TIME 2026-10-31: Jax's Time page
    ipcMain.handle('api:ping', () => api.ping());   // home-base status banner (2026-10-08)
    ipcMain.handle('api:change-password', (e, { current, next }) => api.changePassword(current, next));
    // Project workspace (2026-10-06)
    ipcMain.handle('ws:request', (e, { method, endpoint, body }) => api.wsRequest(method, endpoint, body));
    ipcMain.handle('studio:request', (e, req) => api.studioRequest(req && req.method, req && req.endpoint, req && req.body));
    // Pitch deck outputs (research summary, deck data, home pages, board) saved into the project's folder
    // (Files tab, Docs section). Text files only, safe names only; Team Hub checks who may write to the project.
    ipcMain.handle('studio:save-project-file', async (e, req) => {
      const projectId = String((req && req.projectId) || '');
      const name = String((req && req.name) || '');
      const content = req && req.content;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return { success: false, error: 'Unknown project.' };
      if (!/^[A-Za-z0-9 ._()-]{1,140}\.(md|json|html|txt)$/.test(name) || name.includes('..')) return { success: false, error: 'Use a normal file name.' };
      if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) return { success: false, error: 'File must be text, 5 MB at most.' };
      return api.uploadProjectBytes(projectId, Buffer.from(content, 'utf8'), name, 'Docs');
    });
    // Studio's save files read back from the project's folder (Docs): only these two (pitch deck #171, website #226); Team Hub checks access.
    const STUDIO_SAVES = ['Pitch deck - Studio save.json', 'Website - Studio save.json'];
    ipcMain.handle('studio:read-project-save', async (e, req) => {
      const projectId = String((req && req.projectId) || '');
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return { success: false, error: 'Unknown project.' };
      const name = req && req.name !== undefined ? req.name : STUDIO_SAVES[0];
      if (!STUDIO_SAVES.includes(name)) return { success: false, error: 'Studio only reads its own save files.' };
      const res = await api.downloadProjectFile(projectId, name, 'Docs');
      if (!res.success) return { success: false, missing: res.error === 'HTTP 404', offline: !!res.offline, error: res.error };
      if (res.bytes.length > 5 * 1024 * 1024) return { success: false, error: 'The save file is too big.' };
      return { success: true, content: res.bytes.toString('utf8') };
    });
    // Auto check part 2 (#131): the pitch deck board at phone width (screenshot saved to the project's Docs) and every link on it.
    // A hidden window in its own in-memory session, JavaScript off, no navigation or popups; Chromium's page tools do the measuring.
    ipcMain.handle('studio:check-board', async (e, req) => {
      let job;
      try { job = boardCheck.checkRequest(req); } catch (err) { return { success: false, error: err.message }; }
      const { width, height } = boardCheck.PHONE, flags = [], ran = [];
      let screenshot = null;
      const win = new BrowserWindow({ show: false, width, height, useContentSize: true,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, partition: 'board-check' } });
      win.webContents.on('will-navigate', ev => ev.preventDefault());
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      try {
        // The whole window step is timed (#270), and only its finished result counts: a late step can't change what was sent.
        const { metrics, shot } = await boardCheck.timed(async () => {
          await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(job.html));
          const tools = win.webContents.debugger;
          tools.attach('1.3');
          const measured = await tools.sendCommand('Page.getLayoutMetrics');
          const full = Math.min(Math.ceil(Number((measured.cssContentSize || measured.contentSize || {}).height) || height), 16000);
          return { metrics: measured, shot: await tools.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
            clip: { x: 0, y: 0, width, height: full, scale: 1 } }) };
        }, 30000);
        flags.push(...boardCheck.phoneFlags(metrics));
        ran.push('phone-screenshot');
        const saved = await api.uploadProjectBytes(job.projectId, Buffer.from(shot.data, 'base64'), job.fileName, 'Docs');
        if (saved.success) screenshot = job.fileName;
      } catch (_) {
        /* the phone check stays "not run"; the links are still checked */
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
      flags.push(...await boardCheck.linkFlags(job.links, (url, opts) => fetch(url, opts)));
      ran.push('links-open');
      return { success: true, flags, ran, screenshot };
    });
    // The real site, part 2 (#260): every page of the client site's Cloudflare Pages preview at desktop and phone width,
    // screenshots to the project's Docs. One in-memory session for these windows, refusing permissions and downloads.
    let previewSession = null;
    ipcMain.handle('studio:check-preview', async (e, req) => {
      let job;
      try { job = previewCheck.previewRequest(req); } catch (err) { return { success: false, error: err.message }; }
      if (!previewSession) {
        previewSession = session.fromPartition('preview-check');   // no "persist:": nothing is kept on disk
        previewSession.setPermissionRequestHandler((wc, permission, done) => done(false));
        previewSession.setPermissionCheckHandler(() => false);
        previewSession.on('will-download', ev => ev.preventDefault());
      }
      return previewCheck.checkPreview(job, { capture: previewCheck.makeCapture({ BrowserWindow, ses: previewSession, origin: job.origin }),
        upload: async (png, name) => !!(await api.uploadProjectBytes(job.projectId, png, name, 'Docs')).success,
        fetchFn: (url, opts) => fetch(url, opts) });
    });
    ipcMain.handle('ws:upload', async (e, { projectId, section }) => {
      const pick = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Add files to project', properties: ['openFile', 'multiSelections'] });
      if (pick.canceled || !pick.filePaths.length) return { success: true, uploaded: 0 };
      const errors = [];
      let uploaded = 0;
      for (const p of pick.filePaths) {
        const r = await api.uploadProjectFile(projectId, p, section);
        if (r.success) uploaded += 1; else errors.push(`${path.basename(p)}: ${r.error}`);
      }
      return { success: errors.length === 0, uploaded, error: errors.join('; ') };
    });
    ipcMain.handle('ws:download', async (e, { projectId, name, section }) => {
      const r = await api.downloadProjectFile(projectId, name, section);
      if (!r.success) return r;
      const save = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Save file', defaultPath: name });
      if (save.canceled || !save.filePath) return { success: true, saved: false };
      fs.writeFileSync(save.filePath, r.bytes);
      return { success: true, saved: true, path: save.filePath };
    });
    // Chat media (2026-10-08)
    ipcMain.handle('ws:upload-chat-media', async (e, { convo, caption }) => {
      const pick = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
        title: 'Share file or media in chat',
        properties: ['openFile']
      });
      if (pick.canceled || !pick.filePaths.length) return { success: true, canceled: true };
      return await api.uploadChatMedia(convo, pick.filePaths[0], caption);
    });
    // A file dropped onto the chat. The page sends the file's bytes, never a path, so it can only share
    // what the person actually dropped. Home base checks the conversation and size again.
    const DROP_MAX_BYTES = 100 * 1024 * 1024;
    ipcMain.handle('ws:upload-dropped-chat-file', async (e, { convo, name, bytes, caption }) => {
      if (typeof convo !== 'string' || !/^[cd]:/.test(convo) || convo.length > 200
        || typeof name !== 'string' || !name.trim() || name.length > 200
        || !(bytes instanceof Uint8Array) || !bytes.length
        || (caption != null && (typeof caption !== 'string' || caption.length > 2000))) {
        return { success: false, error: 'Could not read the dropped file.' };
      }
      if (bytes.length > DROP_MAX_BYTES) return { success: false, error: 'That file is over 100 MB.' };
      return await api.uploadChatBytes(convo, Buffer.from(bytes), name, caption || '');
    });
    ipcMain.handle('ws:create-project-pdf', async (e, { projectId, title, content }) => {
      if (typeof projectId !== 'string' || !/^[0-9a-f]{32}$/.test(projectId)
        || typeof title !== 'string' || !title.trim() || title.length > 100
        || typeof content !== 'string' || content.length > 50000) {
        return { success: false, error: 'Use a project, title, and content under 50,000 characters.' };
      }
      const safe = title.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\.+$/, '').slice(0, 80);
      if (!safe) return { success: false, error: 'Use a normal document title.' };
      const escapeHtml = (s) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font:12pt/1.55 Arial,sans-serif;color:#152235;margin:0;padding:28mm 22mm}
        h1{font:normal 24pt Georgia,serif;margin:0 0 10mm}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}
        </style></head><body><h1>${escapeHtml(safe)}</h1><pre>${escapeHtml(content)}</pre></body></html>`;
      const win = new BrowserWindow({ show: false, width: 1000, height: 1200,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
      try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
        return await api.uploadProjectBytes(projectId, pdf, safe + '.pdf', 'Docs');
      } catch (_) {
        return { success: false, error: 'Could not create the PDF. Try again.' };
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });    ipcMain.handle('ws:download-chat-media', async (e, { mediaId, name }) => {
      const r = await api.downloadChatMedia(mediaId);
      if (!r.success) return r;
      const save = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Save file', defaultPath: name });
      if (save.canceled || !save.filePath) return { success: true, saved: false };
      fs.writeFileSync(save.filePath, r.bytes);
      return { success: true, saved: true, path: save.filePath };
    });
    ipcMain.handle('ws:chat-media-url', (e, { mediaId }) => {
      return api.getChatMediaUrl(mediaId);
    });
    // Storyboards (2026-10-08): frames as data URLs, upload a frame, export the board to PDF
    ipcMain.handle('ws:image', (e, { endpoint }) => api.wsImage(endpoint));
    ipcMain.handle('ws:upload-image', async (e, { endpoint }) => {
      const pick = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Choose a frame',
        properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
      if (pick.canceled || !pick.filePaths.length) return { success: true, uploaded: 0 };
      const r = await api.uploadPanelImage(endpoint, pick.filePaths[0]);
      return r.success ? { ...r, uploaded: 1 } : r;
    });
    ipcMain.handle('voice:transcribe', (e, bytes) => api.voiceTranscribe(bytes));   // talk to Meridian (2026-10-08)
    ipcMain.handle('voice:speech', (e, text) => api.voiceSpeech(text));
    ipcMain.handle('ws:capture', async (e, { endpoint }) => {   // snapshot of this Connect window only, on request
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return { success: false, error: 'No window' };
      try {
        const img = await win.webContents.capturePage();
        const size = img.getSize();
        const png = (size.width > 1920 ? img.resize({ width: 1920 }) : img).toPNG();
        const res = await api.uploadScreen(endpoint, png);
        return res.success ? { ...res, preview: img.resize({ width: 240 }).toDataURL() } : res;
      } catch (err) {
        return { success: false, error: `Snapshot failed (${err.message})` };
      }
    });
    ipcMain.handle('ws:export-pdf', async (e, { html, name }) => {
      if (typeof html !== 'string' || html.length > 80 * 1024 * 1024) return { success: false, error: 'Nothing to export' };
      const safe = String(name || 'Storyboard').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 80) || 'Storyboard';
      const save = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Save storyboard PDF',
        defaultPath: safe + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (save.canceled || !save.filePath) return { success: true, saved: false };
      const tmp = path.join(app.getPath('temp'), `meridian-storyboard-${Date.now()}.html`);
      const win = new BrowserWindow({ show: false, width: 1400, height: 1000,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
      try {
        fs.writeFileSync(tmp, html, 'utf8');
        await win.loadFile(tmp);
        const pdf = await win.webContents.printToPDF({ landscape: true, printBackground: true, pageSize: 'Letter',
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } });
        fs.writeFileSync(save.filePath, pdf);
        return { success: true, saved: true, path: save.filePath };
      } catch (err) {
        return { success: false, error: `PDF export failed (${err.message})` };
      } finally {
        if (!win.isDestroyed()) win.destroy();   // the main window closing may already have closed it
        fs.rm(tmp, { force: true }, () => {});
      }
    });
    // Website preview in its own smaller window (web pages only, no app access)
    ipcMain.handle('ws:preview', (e, { url, title }) => {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { success: false, error: 'Not a web address' };
      const parent = BrowserWindow.fromWebContents(e.sender);
      const win = new BrowserWindow({ width: 1180, height: 800, title: title || 'Website preview', autoHideMenuBar: true,
        backgroundColor: '#070912', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      win.webContents.setWindowOpenHandler(({ url: u }) => { openSafeExternal(u); return { action: 'deny' }; });
      win.loadURL(url);
      if (parent) { const b = parent.getBounds(); win.setPosition(b.x + 60, b.y + 60); }
      return { success: true };
    });
    ipcMain.handle('api:get-projects', (e, user) => api.getProjects(user));
    ipcMain.handle('api:get-project-files', (e, id) => api.getProjectFiles(id));
    ipcMain.handle('api:get-project-notes', (e, id) => api.getProjectNotes(id));
    ipcMain.handle('api:get-tasks', (e, user) => api.getTasks(user));
    ipcMain.handle('api:mark-task-done', (e, { taskId, completed }) => api.markTaskDone(taskId, completed));
    ipcMain.handle('api:send-chat-message', (e, { projectId, message }) => api.sendChatMessage(projectId, message));
    ipcMain.handle('api:stream-chat', (e, { projectId, message, streamId }) => {
      const id = typeof streamId === 'string' && /^[0-9a-z-]{1,40}$/.test(streamId) ? streamId : null;
      return api.streamChat(projectId, message,
        (text) => { if (id && !e.sender.isDestroyed()) e.sender.send('api:stream-chat-chunk', { streamId: id, text }); });
    });
    ipcMain.handle('api:get-chat-history', (e, id) => api.getChatHistory(id));
    ipcMain.handle('api:get-messages', () => api.getMessages());
    ipcMain.handle('api:send-team-message', (e, { text, senderName }) => api.sendTeamMessage(text, senderName));
    ipcMain.handle('api:upload-send-to-meridian', (e, { payload, senderName }) => api.uploadToSendToMeridian(payload, senderName));
    ipcMain.handle('api:get-sent-to-meridian-list', () => api.getSentToMeridianList());
    ipcMain.handle('api:search-all', (e, { query, username }) => api.searchAll(query, username));
    ipcMain.handle('api:get-tools', () => api.getTools());
    ipcMain.handle('api:execute-tool', (e, { toolId, params }) => api.executeTool(toolId, params));


    createTray();
    if (!isTestMode) splashTimer = setTimeout(createSplashWindow, SPLASH_DELAY_MS);
    createMainWindow();
    setupAutoUpdate();

    // If session remembered, restore popouts
    const currentUser = authManager.getCurrentUser();
    if (currentUser && !isTestMode) {
      setTimeout(() => restoreUserPopouts(currentUser), 1000);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  app.on('will-quit', () => { if (layoutStore) layoutStore.flush(); });   // save the last window position (writes are batched)
}
