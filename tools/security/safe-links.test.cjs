'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isSafeExternalUrl } = require('../../src/safe-url.js');

test('normal web and email links are allowed', () => {
  for (const url of [
    'https://example.com',
    'https://example.com/path?q=1#top',
    'http://client-site.example/page',
    'mailto:hello@example.com',
  ]) assert.equal(isSafeExternalUrl(url), true, url);
});

test('links that could launch local files or programs are refused', () => {
  for (const url of [
    'file:///C:/Windows/System32/calc.exe',
    'file://server/share/run.bat',
    'javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'ms-msdt:/id PCWDiagnostic',
    'search-ms:query=x',
    'steam://run/1',
    'smb://server/share',
    'C:\\Windows\\System32\\cmd.exe',
    '\\\\server\\share\\x.exe',
  ]) assert.equal(isSafeExternalUrl(url), false, url);
});

test('hidden usernames/passwords, junk and oversized values are refused', () => {
  for (const url of [
    'https://user:pass@example.com',
    'https://bank.example@evil.example',
    'mailto:nobody',
    'https://',
    '',
    '   ',
    null,
    undefined,
    42,
    { href: 'https://example.com' },
    'https://example.com/' + 'a'.repeat(3000),
  ]) assert.equal(isSafeExternalUrl(url), false, String(url));
});

test('main.js routes every external open through the check', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const direct = main.match(/shell\.openExternal\(/g) || [];
  assert.equal(direct.length, 1, 'only openSafeExternal may call shell.openExternal');
  assert.match(main, /function openSafeExternal\(url\) \{\s*if \(!isSafeExternalUrl\(url\)\)/);
  assert.doesNotMatch(main, /ws:upload-chat-file/, 'the free-path upload handler must stay removed');
});

test('preload no longer exposes the free-path upload', () => {
  const preload = fs.readFileSync(path.join(__dirname, '../../src/preload.js'), 'utf8');
  assert.doesNotMatch(preload, /upload-chat-file/);
});
