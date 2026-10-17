'use strict';
// Runs the actual installed employee app on an ephemeral Windows CI machine.
// No synthetic login, service, session, altered preload or production endpoint.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'test-output/windows-installed');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    const request = pending.get(result.id);
    if (!request) return;
    pending.delete(result.id);
    clearTimeout(request.timer);
    if (result.error) request.reject(Error(result.error.message));
    else request.resolve(result.result);
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 8000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function main() {
  assert.equal(process.platform, 'win32', 'Requires actual Windows');
  const executable = process.env.MERIDIAN_INSTALLED_EXE;
  assert.ok(executable && fs.existsSync(executable), 'Installed executable required');
  fs.mkdirSync(evidence, { recursive: true });
  const archive = path.join(path.dirname(executable), 'resources/app.asar');
  const tracked = execFileSync('git', ['ls-files', 'src', 'config/settings.json'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
  const sourceHashes = {};
  for (const file of tracked) {
    const source = fs.readFileSync(path.join(root, file));
    const installed = asar.extractFile(archive, path.normalize(file));
    assert.ok(source.equals(installed), 'Installed source mismatch: ' + file);
    sourceHashes[file] = createHash('sha256').update(installed).digest('hex');
  }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-installed-check-'));
  const child = spawn(executable, ['--force-renderer-accessibility', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9333', '--user-data-dir=' + userData], { stdio: ['ignore', 'ignore', 'ignore'] });
  let client;
  let spawnError;
  child.on('error', error => { spawnError = error; });
  try {
    let target;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error('Installed app exited before renderer became ready');
      try {
        const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
        target = targets.find(value => value.type === 'page' && /renderer\/index\.html$/.test(value.url));
        if (target) break;
      } catch (_) { /* Wait for this fresh local app's debugging endpoint. */ }
      await pause(100);
    }
    assert.ok(target, 'Actual installed renderer did not start');
    client = await connect(target.webSocketDebuggerUrl);
    const evaluate = async expression => {
      const value = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw Error(value.exceptionDetails.text);
      return value.result.value;
    };
    let state;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      state = await evaluate(`(async () => ({
        ready: document.readyState === 'complete' && !!window.meridian && typeof switchView === 'function',
        loginVisible: !!document.querySelector('#login-view') && getComputedStyle(document.querySelector('#login-view')).display !== 'none',
        studioDisabled: document.querySelector('#nav-studio-link')?.disabled,
        studioHidden: document.querySelector('#studioCenter')?.hidden,
        syntheticLoaded: [...document.scripts].some(s => s.src.includes('studio-ui/studio-shell.js')),
        development: window.meridian ? await window.meridian.isDevMode() : null,
        session: window.meridian ? await window.meridian.getCurrentUser() : null,
        devLoginHidden: !document.querySelector('#dev-bypass-box') || getComputedStyle(document.querySelector('#dev-bypass-box')).display === 'none',
        backgroundInert: [...document.querySelectorAll('[data-authenticated-ui]')].every(node => node.inert)
      }))()`);
      if (state.ready && state.loginVisible && state.studioDisabled) break;
      await pause(100);
    }
    assert.equal(state.loginVisible, true);
    assert.equal(state.development, false);
    assert.equal(state.session, null);
    assert.equal(state.devLoginHidden, true);
    assert.equal(state.backgroundInert, true);
    assert.equal(state.studioDisabled, true);
    assert.equal(state.studioHidden, true);
    assert.equal(state.syntheticLoaded, false);
    await evaluate(`switchView('studio')`);
    assert.equal(await evaluate(`document.body.classList.contains('view-studio')`), false);
    await evaluate(`document.querySelector('#login-username').focus()`);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate('document.activeElement.id'), 'login-password');
    await client.send('Accessibility.enable');
    let accessibility;
    let names;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      accessibility = await client.send('Accessibility.getFullAXTree');
      names = accessibility.nodes.filter(node => !node.ignored).map(node => ({ role: node.role?.value, name: node.name?.value }));
      if (['username', 'password'].every(label => names.some(node => node.role === 'textbox' && String(node.name).trim().toLowerCase() === label))) break;
      await pause(100);
    }
    fs.writeFileSync(path.join(evidence, 'accessibility-tree.json'), JSON.stringify(accessibility, null, 2) + '\n');
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(evidence, 'installed-employee-login.png'), Buffer.from(screenshot.data, 'base64'));
    for (const label of ['username', 'password']) assert.ok(names.some(node => node.role === 'textbox' && String(node.name).trim().toLowerCase() === label), 'Missing accessible login field: ' + label);
    assert.equal(names.some(node => node.role === 'button' && node.name === 'Overview'), false, 'Background navigation must not be exposed behind login');
    const results = {
      status: 'passed', platform: process.platform, release: os.release(),
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(),
      installedSourceMatches: true, installedSourceHashes: sourceHashes,
      installer: 'Actual existing NSIS installer, silent install on disposable Windows runner',
      employee: state, programmaticStudioRouteRejected: true,
      keyboard: 'Actual Tab input moved Username to Password', accessibility: names,
      limits: ['No authenticated installed Studio flow: approved synthetic service/session unavailable.', 'Accessibility tree is not Narrator speech verification.', 'Forced-color emulation in guided flow is not actual OS High Contrast verification.', 'No production release, installer distribution or live service acceptance.'],
    };
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log('WINDOWS_INSTALLED_SMOKE_PASSED');
  } finally {
    if (client) client.close();
    if (child.pid && child.exitCode === null) {
      try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
      catch (_) { /* The app may already have exited; preserve the test result. */ }
    }
  }
}

main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
