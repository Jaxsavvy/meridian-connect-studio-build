'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isAllowedServerUrl } = require('../../src/safe-url.js');
const AuthManager = require('../../src/auth.js');
const api = require('../../src/api.js');

const src = (file) => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');

// Stand-in for the OS encryption; the real app uses Electron safeStorage.
const fakeCipher = {
  encrypt: (text) => Buffer.from(text, 'utf8').reverse().toString('base64'),
  decrypt: (b64) => Buffer.from(b64, 'base64').reverse().toString('utf8'),
};
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'connect-auth-'));
const user = { username: 'sample', token: 'SAMPLE-TOKEN-123' };

test('server address: https anywhere, plain http only on this computer', () => {
  for (const ok of ['https://hub.example.com/connect', 'https://pc.tailnet.ts.net/connect', 'http://127.0.0.1:7871/connect', 'http://localhost:7871/connect'])
    assert.equal(isAllowedServerUrl(ok), true, ok);
  for (const bad of ['http://hub.example.com/connect', 'http://192.168.1.20:7871', 'https://user:pw@hub.example.com',
    'https://hub.example.com/?x=1', 'file:///C:/x', 'javascript:alert(1)', '', null, 42])
    assert.equal(isAllowedServerUrl(bad), false, String(bad));
});

test('saved login is encrypted on disk and loads back', () => {
  const dir = tmpDir();
  const a = new AuthManager(dir, false, fakeCipher);
  a._saveSession(user, true);
  const raw = fs.readFileSync(path.join(dir, 'session.json'), 'utf8');
  assert.doesNotMatch(raw, /SAMPLE-TOKEN-123/);
  assert.equal(JSON.parse(raw).v, 2);
  const b = new AuthManager(dir, false, fakeCipher);
  assert.equal(b.getCurrentUser().token, 'SAMPLE-TOKEN-123');
});

test('an old plain-text session file is upgraded to encrypted', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ user, savedAt: 1 }));
  const a = new AuthManager(dir, false, fakeCipher);
  assert.equal(a.getCurrentUser().token, 'SAMPLE-TOKEN-123');
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'session.json'), 'utf8'), /SAMPLE-TOKEN-123/);
});

test('without OS encryption the login is never written to disk', () => {
  const dir = tmpDir();
  new AuthManager(dir, false, null)._saveSession(user, true);
  assert.equal(fs.existsSync(path.join(dir, 'session.json')), false);
});

test('chat media addresses never contain the login token', () => {
  api.setAuthToken('SAMPLE-TOKEN-123', user);
  const pageUrl = api.getChatMediaUrl('abc123');
  assert.equal(pageUrl, 'meridian-media://media/abc123');
  const req = api.chatMediaRequest('abc123');
  assert.doesNotMatch(req.url, /token/i);
  assert.equal(req.headers.Authorization, 'Bearer SAMPLE-TOKEN-123');
  assert.doesNotMatch(src('api.js'), /\?token=/);
});

test('main.js guards settings, media and updates', () => {
  const main = src('main.js');
  assert.match(main, /ipcMain\.handle\('settings:save', saveSettingsFromPage\)/);
  assert.match(main, /protocol\.handle\('meridian-media', handleMediaRequest\)/);
  assert.match(main, /if \(!isAllowedServerUrl\(server\)\) return;/);
});

test('both pages carry a strict content security policy', () => {
  for (const page of ['renderer/index.html', 'renderer/popout.html']) {
    const html = src(page);
    const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    assert.ok(m, `${page} has a CSP`);
    assert.match(m[1], /script-src 'self';/);
    assert.doesNotMatch(m[1], /unsafe-eval/);
    assert.match(m[1], /object-src 'none'/);
  }
});
