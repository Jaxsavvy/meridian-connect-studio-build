'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AuthManager = require('../../src/auth.js');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');

const fakeCipher = { encrypt: (t) => Buffer.from(t).toString('base64'), decrypt: (b) => Buffer.from(b, 'base64').toString() };

test('sample sign-in is refused outside developer mode', async () => {
  const res = await new AuthManager(fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')), false, fakeCipher).devLogin();
  assert.equal(res.success, false);
});

test('sample sign-in in developer mode: no token, nothing written to disk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
  const auth = new AuthManager(dir, true, fakeCipher);
  const res = await auth.devLogin();
  assert.equal(res.success, true);
  assert.equal(res.user.sample, true);
  assert.equal(res.user.token, null);
  assert.equal(fs.existsSync(path.join(dir, 'session.json')), false);
});

test('main.js never allows sample sign-in or developer tools in the installed app', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  assert.match(main, /new AuthManager\(userData, isDev && !app\.isPackaged\)/);
  assert.match(main, /'auth:is-dev', \(\) => isDev && !app\.isPackaged/);
});

test('with no assigned projects, sample Studio offers a demo client Space', async () => {
  const s = createSampleService();
  s.setProjects([]);
  const spaces = await s.listSpaces();
  assert.deepEqual(spaces.map(x => x.type), ['sandbox-personal', 'sandbox-team', 'client']);
  assert.equal(spaces[2].id, 'sample-client');
  assert.ok((await s.getSpace('sample-client')).dna);
});
