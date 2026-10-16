'use strict';
// Human review of current renderer with the same explicitly synthetic preload as CI.
const { app, BrowserWindow, Menu, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'test-output/windows-manual');
const employee = process.argv.includes('--review-employee');
fs.mkdirSync(output, { recursive: true });
const profile = path.join(output, employee ? 'employee-profile' : 'synthetic-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setAccessibilitySupportEnabled(true);
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const source = { commit: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']) };
let window;
let sequence = 0;

async function capture() {
  const name = `review-${Date.now()}-${++sequence}`;
  window.webContents.invalidate();
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const bytes = (await window.webContents.capturePage()).toPNG();
  const state = await window.webContents.executeJavaScript(`({
    focusedId: document.activeElement?.id,
    focusedText: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.slice(0,200),
    forcedColors: matchMedia('(forced-colors: active)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    projectId: window.meridianStudioContext?.snapshot().project?.id || null
  })`);
  fs.writeFileSync(path.join(output, `${name}.png`), bytes);
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify({
    source, sourceChanges: git(['diff', '--name-only', 'HEAD', '--', 'src', 'tools/website-builder', 'docs/studio/design/9/runtime-preload.cjs']),
    platform: process.platform, osRelease: os.release(), electron: process.versions.electron,
    mode: employee ? 'synthetic employee-gate renderer' : 'synthetic development renderer',
    actualOSHighContrast: nativeTheme.shouldUseHighContrastColors,
    capturedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'),
    state, humanNarratorResult: 'NOT RECORDED: tester must report actual speech and outcome on issue #9',
  }, null, 2) + '\n');
  console.log(`Saved ${name}.png and matching provenance JSON in test-output/windows-manual`);
}

app.whenReady().then(async () => {
  if (process.platform !== 'win32') throw Error('This review command requires Windows.');
  window = new BrowserWindow({
    width: 1440, height: 1000, show: true, backgroundColor: '#07101d',
    title: 'DEV-006 — synthetic human accessibility review',
    webPreferences: {
      preload: path.join(root, 'docs/studio/design/9/runtime-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      additionalArguments: ['--studio-evidence-mode=' + (employee ? 'employee' : 'development')],
    },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Review evidence', submenu: [
    { label: 'Capture current state and provenance', accelerator: 'F8', click: () => capture().catch(console.error) },
    { label: 'Zoom in', role: 'zoomIn' }, { label: 'Zoom out', role: 'zoomOut' }, { label: 'Reset zoom', role: 'resetZoom' },
    { type: 'separator' }, { role: 'quit' },
  ] }]));
  console.log('Synthetic-only DEV-006 Windows review', JSON.stringify(source));
  console.log('Use Narrator and actual Windows Contrast themes. F8 captures current pixels/provenance; results require human reporting.');
  await window.loadFile(path.join(root, 'src/renderer/index.html'));
}).catch(error => { console.error(error.stack || String(error)); app.exit(1); });
app.on('window-all-closed', () => app.quit());
